import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import cors from 'cors';
import morgan from 'morgan';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { db, initDb, getDbPath } from './db';
import { apiLoggerMiddleware } from './logger';
import {
    authenticateToken,
    generateToken,
    isSuperUser,
    canUpdatePcb,
    canUpdateRework,
    canAddPcb,
    canAddRework,
    canAddProject,
    canUpdateProject,
    canDeleteProject,
    canAddProjectDoc,
    canDeleteProjectDoc
} from '../../authentication/serverAuth';
import {
    inputSanityCheckMiddleware,
    fileSanityCheckMiddleware,
    lockFileExecution,
    lockDirectoryFiles
} from './inputSanityChecker';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 5002;

// Configure Multer Storage
const storage = multer.diskStorage({
    destination: function (req, _file, cb) {
        let dir = '';
        if (req.originalUrl.includes('/docs')) {
            dir = path.join(__dirname, 'docs');
        } else {
            dir = path.join(__dirname, 'pictures');
        }
        if (!fs.existsSync(dir)){
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: function (_req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Middleware
app.use(cors({
    origin: (_origin, callback) => callback(null, true),
    credentials: true
}));
app.use(authenticateToken as any);
app.use(express.json());
app.use(morgan('dev', {
    skip: (req) => req.method === 'GET'
}));
app.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    next();
});
app.use(apiLoggerMiddleware);
app.use(inputSanityCheckMiddleware);

// --- Request Deduplication & Serialization Middlewares ---
interface CustomRequest extends Request {
    _deduplicated?: boolean;
    _serialized?: boolean;
    files?: any;
}

interface InFlightRequest {
    listeners: Array<(response: any) => void>;
    response: any | null;
}

const inFlightRequests = new Map<string, InFlightRequest>();

function deduplicate(req: Request, res: Response, next: NextFunction) {
    const creq = req as CustomRequest;
    if (creq.method === 'GET' || creq.method === 'DELETE') {
        return next();
    }
    
    // Prevent double execution if registered both globally and locally
    if (creq._deduplicated) {
        return next();
    }
    creq._deduplicated = true;

    const filesArray = Array.isArray(creq.files) ? creq.files : [];
    const fileSignature = filesArray.map((f: any) => `${f.originalname}-${f.size}`).join(',');
    const bodyKey = JSON.stringify(creq.body || {});
    const username = creq.headers['x-user-username'] || 'guest';
    const key = `${creq.method}:${creq.originalUrl}:${bodyKey}:${fileSignature}:${username}`;

    if (inFlightRequests.has(key)) {
        console.log(`[Server Deduplicate] Duplicate request detected for key: ${key}.`);
        const pending = inFlightRequests.get(key)!;
        
        if (pending.response) {
            console.log(`[Server Deduplicate] Returning cached response for key: ${key}.`);
            res.status(pending.response.statusCode);
            res.set(pending.response.headers);
            res.send(pending.response.body);
            return;
        }
        
        pending.listeners.push((response) => {
            res.status(response.statusCode);
            res.set(response.headers);
            res.send(response.body);
        });
        return;
    }

    const pending: InFlightRequest = {
        listeners: [],
        response: null
    };
    inFlightRequests.set(key, pending);

    const originalSend = res.send;
    res.send = function (this: Response, body: any) {
        res.send = originalSend;

        const responseData = {
            statusCode: res.statusCode,
            headers: res.getHeaders(),
            body: body
        };

        pending.response = responseData;

        // Keep in cache for 3 seconds to catch quick staggered retries/double-submits
        setTimeout(() => {
            inFlightRequests.delete(key);
        }, 3000);

        originalSend.call(res, body);

        pending.listeners.forEach((listener) => {
            try {
                listener(responseData);
            } catch (e) {
                console.error('[Server Deduplicate] Failed to notify listener:', e);
            }
        });
        return res;
    } as any;

    res.on('close', () => {
        if (inFlightRequests.has(key) && inFlightRequests.get(key) === pending && !pending.response) {
            inFlightRequests.delete(key);
            pending.listeners.forEach((listener) => {
                try {
                    listener({
                        statusCode: 500,
                        headers: {},
                        body: JSON.stringify({ error: "Original request closed prematurely" })
                    });
                } catch (e) {}
            });
        }
    });

    next();
}

let writeQueue = Promise.resolve();

function serializeWrites(req: Request, res: Response, next: NextFunction) {
    const creq = req as CustomRequest;
    if (creq.method === 'GET') {
        return next();
    }
    
    // Prevent double execution if registered both globally and locally
    if (creq._serialized) {
        return next();
    }
    creq._serialized = true;

    console.log(`[Queue Entry] ${req.method} ${req.originalUrl}`);

    let resolved = false;
    let releaseFn = () => {};

    const cleanup = () => {
        if (!resolved) {
            resolved = true;
            console.log(`[Queue Cleanup] Resolving promise for ${req.method} ${req.originalUrl}`);
            releaseFn();
        }
    };

    const timeoutId = setTimeout(() => {
        console.log(`[Queue Timeout] 10s fallback triggered for ${req.method} ${req.originalUrl}`);
        cleanup();
    }, 10000); // 10s safety fallback

    res.on('finish', () => {
        clearTimeout(timeoutId);
        cleanup();
    });
    res.on('close', () => {
        clearTimeout(timeoutId);
        cleanup();
    });

    const currentFinished = new Promise<void>((resolve) => {
        releaseFn = resolve;
        if (resolved) {
            resolve();
        }
    });

    const previousFinished = writeQueue;
    writeQueue = writeQueue.then(() => {
        console.log(`[Queue Chain] Resolving queue for ${req.method} ${req.originalUrl}`);
        return currentFinished;
    });

    previousFinished.then(() => {
        if ((req.socket && req.socket.destroyed) || res.writableEnded || resolved) {
            cleanup();
            return;
        }
        next();
    });
}

// Apply deduplication to JSON write operations first
app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
        return next();
    }
    const isMultipart = req.headers['content-type'] && req.headers['content-type'].startsWith('multipart/form-data');
    if (isMultipart || req.originalUrl.startsWith('/api/otp/')) {
        return next();
    }
    deduplicate(req, res, next);
});

// Apply serialization to JSON write operations second
app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
        return next();
    }
    const isMultipart = req.headers['content-type'] && req.headers['content-type'].startsWith('multipart/form-data');
    if (isMultipart) {
        return next();
    }
    serializeWrites(req, res, next);
});

// Migrate legacy physical schematics folder to docs on startup
const oldSchematicsDir = path.join(__dirname, 'schematics');
const newDocsDir = path.join(__dirname, 'docs');
if (fs.existsSync(oldSchematicsDir)) {
    if (!fs.existsSync(newDocsDir)) {
        try {
            fs.renameSync(oldSchematicsDir, newDocsDir);
        } catch (e) {
            console.error("Failed to rename schematics folder to docs:", e);
        }
    }
}

app.use('/api/pictures', express.static(path.join(__dirname, 'pictures')));
app.use('/api/docs', express.static(path.join(__dirname, 'docs')));

// Initialize Database
initDb().then(() => {
    // Ensure docs directories exist for all projects and copy default files if missing
    db.all("SELECT id, project_key FROM projects", [], (errProj: Error | null, projects: any[]) => {
        if (!errProj && projects) {
            projects.forEach((p) => {
                const projectKey = p.project_key || 'PRJ';
                const targetDir = path.join(__dirname, 'docs', projectKey);
                if (!fs.existsSync(targetDir)) {
                    fs.mkdirSync(targetDir, { recursive: true });
                }

                const publicDocsDir = path.join(__dirname, '..', '..', '..', 'public', 'docs');
                const copyIfMissing = (filename: string) => {
                    const destPath = path.join(targetDir, filename);
                    if (!fs.existsSync(destPath)) {
                        const srcPath = path.join(publicDocsDir, filename);
                        if (fs.existsSync(srcPath)) {
                            try {
                                fs.copyFileSync(srcPath, destPath);
                                lockFileExecution(destPath);
                                console.log(`[Startup Docs] Copied default ${filename} to ${destPath}`);
                            } catch (e: any) {
                                console.error(`[Startup Docs] Failed to copy ${filename}:`, e.message);
                            }
                        }
                    }
                };
                copyIfMissing("BBB-SCH.pdf");
                copyIfMissing("BBB.brd");
            });
        }
    });

    // Lock all files in docs and pictures to prevent execution
    lockDirectoryFiles(path.join(__dirname, 'docs'));
    lockDirectoryFiles(path.join(__dirname, 'pictures'));

    // Migrate legacy short codes to Base36 format
    db.all("SELECT id, board_number, project_id, short_code FROM pcbs WHERE length(short_code) < 5 OR short_code IS NULL", [], (errPcb: Error | null, rows: any[]) => {
        if (!errPcb && rows) {
            rows.forEach((row: any) => {
                getProjectKeyById(row.project_id).then((pKey) => {
                    const newCode = encodeBase36ShortCode(pKey, row.board_number);
                    db.run("UPDATE pcbs SET short_code = ? WHERE id = ?", [newCode, row.id]);
                });
            });
        }
    });

    // Start Server
    app.listen(port, () => {
        console.log(`Server running at http://localhost:${port}`);
    });
}).catch(err => {
    console.error("Database initialization failed:", err);
    process.exit(1);
});

// Routes

// Dashboard Summary
app.get('/api/dashboard', (_req: Request, res: Response) => {
    const stats: any = {};
    db.get("SELECT COUNT(*) as count FROM projects", [], (err: Error | null, row: any) => {
        if (err || !row) stats.projects = 0; else stats.projects = row.count;
        db.get("SELECT COUNT(*) as count FROM pcbs", [], (errPcb: Error | null, rowPcb: any) => {
            if (errPcb || !rowPcb) stats.pcbs = 0; else stats.pcbs = rowPcb.count;
            db.get("SELECT COUNT(*) as count FROM owners", [], (errOwner: Error | null, rowOwner: any) => {
                if (errOwner || !rowOwner) stats.owners = 0; else stats.owners = rowOwner.count;
                db.get("SELECT COUNT(*) as count FROM reworks", [], (errRework: Error | null, rowRework: any) => {
                    if (errRework || !rowRework) stats.reworks = 0; else stats.reworks = rowRework.count;
                    db.get("SELECT COUNT(*) as count FROM tags", [], (errTag: Error | null, rowTag: any) => {
                        if (errTag || !rowTag) stats.tags = 0; else stats.tags = rowTag.count;
                        res.json(stats);
                    });
                });
            });
        });
    });
});

// --- Helpers ---
const CHARSET = 'ABCDEFGHJKMNPQRSTUVWXY';

function generateCRC(input: string): string {
    let sum = 0;
    for (let i = 0; i < input.length; i++) {
        const char = input[i].toUpperCase();
        sum += char.charCodeAt(0) * (i + 1);
    }
    return CHARSET[sum % CHARSET.length];
}

const RESERVED_URLS = new Set(['project', 'projects', 'pcb', 'pcbs', 'rework', 'reworks', 'owners', 'tags', 'crc', 'api', 'demo', 'settings']);

function getProjectKeyById(projectId: number | string | undefined): Promise<string> {
    return new Promise((resolve) => {
        if (!projectId) return resolve("PCB");
        db.get("SELECT project_key, name FROM projects WHERE id = ?", [projectId], (_err: Error | null, row: any) => {
            if (row && row.project_key) {
                resolve(row.project_key.toUpperCase().slice(0, 3));
            } else if (row && row.name) {
                resolve(row.name.replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 3) || "PCB");
            } else {
                resolve("PCB");
            }
        });
    });
}

function encodeBase36ShortCode(projectKey: string, boardNumber: number | string): string {
    const cleanKey = (projectKey || "PCB").toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3).padEnd(3, 'A');
    const c0 = cleanKey.charCodeAt(0) - 65;
    const c1 = cleanKey.charCodeAt(1) - 65;
    const c2 = cleanKey.charCodeAt(2) - 65;
    const projectIndex = (Math.max(0, Math.min(25, c0)) * 676) + 
                         (Math.max(0, Math.min(25, c1)) * 26) + 
                         Math.max(0, Math.min(25, c2));
    
    let num = 0;
    if (typeof boardNumber === 'number') {
        num = boardNumber;
    } else {
        const matches = String(boardNumber).match(/\d+/g);
        if (matches && matches.length > 0) {
            num = parseInt(matches[matches.length - 1], 10);
        }
    }
    const safeNum = Math.abs(isNaN(num) ? 0 : num) % 10000;
    
    const combined = (projectIndex * 10000) + safeNum;
    return combined.toString(36).toUpperCase().padStart(5, '0');
}

function generateShortCode(projectKey = "PCB", boardNum?: string | number, attempt = 1): Promise<string> {
    return new Promise((resolve, reject) => {
        if (attempt > 30) return reject(new Error("Unable to generate short code"));
        
        let code = '';
        if (attempt === 1 && boardNum !== undefined && boardNum !== null && String(boardNum).trim() !== '') {
            // Encode the 3-letter project and 4-digit board number into Base36
            code = encodeBase36ShortCode(projectKey, boardNum);
        } else {
            // If collision or no boardNum, generate random 5-char Base36
            const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
            for (let i = 0; i < 5; i++) {
                code += chars.charAt(Math.floor(Math.random() * chars.length));
            }
        }
        
        if (RESERVED_URLS.has(code.toLowerCase())) {
            code = code + 'X';
        }
        
        db.get("SELECT id FROM pcbs WHERE short_code = ?", [code], (err: Error | null, row: any) => {
            if (err) return reject(err);
            if (row) resolve(generateShortCode(projectKey, boardNum, attempt + 1));
            else resolve(code);
        });
    });
}

function sanitizeProjectName(name: string): string {
    if (!name) return "";
    // Remove non-alphanumeric characters but keep spaces for splitting
    const clean = name.replace(/[^a-zA-Z0-9\s]/g, '');
    // Split by spaces, filter empty, capitalize (PascalCase), and join
    return clean
        .split(/\s+/)
        .filter(word => word.length > 0)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join('');
}

function generateProjectKey(name: string, attempt = 1): Promise<string> {
    return new Promise((resolve, reject) => {
        if (attempt > 20) return reject(new Error("Unable to generate unique project key"));
        
        // Grab alpha chars
        let chars = name.replace(/[^A-Za-z]/g, '').toUpperCase();
        if (chars.length < 3) chars = chars + 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        
        let proposedKey = chars[0] + chars[1] + chars[2];
        
        if (attempt > 1) {
            const i1 = Math.floor(Math.random() * chars.length);
            const i2 = Math.floor(Math.random() * chars.length);
            const i3 = Math.floor(Math.random() * chars.length);
            proposedKey = chars[i1] + chars[i2] + chars[i3];
        }

        db.get("SELECT id FROM projects WHERE project_key = ?", [proposedKey], (err: Error | null, row: any) => {
            if (err) return reject(err);
            if (row) {
                resolve(generateProjectKey(name, attempt + 1));
            } else {
                resolve(proposedKey);
            }
        });
    });
}

function extractProjectSiliconVersions(body: any, packagesInput?: any[]): any[] {
    if (body && Array.isArray(body.silicon_versions) && body.silicon_versions.length > 0) {
        return body.silicon_versions.map((sv: any) => ({
            name: (typeof sv === 'object' ? sv.name : String(sv)) || 'A0',
            silicon_corners: (typeof sv === 'object' && sv.silicon_corners) 
                ? (Array.isArray(sv.silicon_corners) ? sv.silicon_corners : String(sv.silicon_corners).split(',').map((s: string) => s.trim()).filter(Boolean))
                : ['TT'],
            description: (typeof sv === 'object' && sv.description) ? sv.description : ''
        }));
    }

    const svMap = new Map<string, any>();
    if (Array.isArray(packagesInput)) {
        for (const pkg of packagesInput) {
            if (Array.isArray(pkg.silicon_versions)) {
                for (const sv of pkg.silicon_versions) {
                    const svName = (typeof sv === 'object' ? sv.name : String(sv)) || 'A0';
                    if (!svMap.has(svName)) {
                        svMap.set(svName, {
                            name: svName,
                            silicon_corners: (typeof sv === 'object' && sv.silicon_corners) 
                                ? (Array.isArray(sv.silicon_corners) ? sv.silicon_corners : String(sv.silicon_corners).split(',').map((s: string) => s.trim()).filter(Boolean))
                                : ['TT'],
                            description: (typeof sv === 'object' && sv.description) ? sv.description : ''
                        });
                    }
                }
            }
        }
    }
    if (svMap.size > 0) {
        return Array.from(svMap.values());
    }

    if (body && body.revisions) {
        const revs = typeof body.revisions === 'string' ? body.revisions.split(',').map((s: string) => s.trim()).filter(Boolean) : (Array.isArray(body.revisions) ? body.revisions : ['A0']);
        const corners = body.silicon_corners ? String(body.silicon_corners).split(',').map((s: string) => s.trim()).filter(Boolean) : ['TT'];
        return revs.map((r: string) => ({
            name: r,
            silicon_corners: corners,
            description: ''
        }));
    }

    return [{ name: 'A0', silicon_corners: ['TT'], description: '' }];
}

function extractProjectPackages(body: any): any[] {
    if (body.packages && Array.isArray(body.packages) && body.packages.length > 0) {
        return body.packages.map((pkg: any) => {
            let formfactors = pkg.formfactors || pkg.board_formfactors || [];
            if ((!formfactors || formfactors.length === 0) && Array.isArray(pkg.silicon_versions)) {
                const ffMap = new Map<string, any>();
                for (const sv of pkg.silicon_versions) {
                    if (Array.isArray(sv.formfactors)) {
                        for (const ff of sv.formfactors) {
                            if (!ffMap.has(ff.name)) {
                                ffMap.set(ff.name, { ...ff });
                            }
                        }
                    }
                }
                formfactors = Array.from(ffMap.values());
            }
            if ((!formfactors || formfactors.length === 0) && Array.isArray(body.flavors) && body.flavors.length > 0) {
                formfactors = body.flavors;
            }
            return {
                name: pkg.name || 'Default Package',
                description: pkg.description || '',
                formfactors: formfactors && formfactors.length > 0 ? formfactors : [{ name: 'Default', revisions: [{ name: '1.0', boms: ['Default'] }] }]
            };
        });
    }

    const flavors = body.flavors && Array.isArray(body.flavors) && body.flavors.length > 0
        ? body.flavors
        : [{ name: 'Default', revisions: [{ name: '1.0', boms: ['Default'] }] }];

    return [{
        name: 'Default Package',
        description: '',
        formfactors: flavors
    }];
}

function saveProjectHierarchy(
    projectId: number | string,
    packagesInput: any[],
    siliconVersionsInput?: any[] | ((err?: Error | null) => void),
    maybeDone?: (err?: Error | null) => void
) {
    const done = typeof siliconVersionsInput === 'function' ? siliconVersionsInput : (maybeDone || (() => {}));
    const siVersionsList: any[] = Array.isArray(siliconVersionsInput)
        ? siliconVersionsInput
        : extractProjectSiliconVersions({}, packagesInput);
    let pkgsList: any[] = Array.isArray(packagesInput) ? packagesInput : [];
    if (pkgsList.length === 0) {
        pkgsList = [{ name: 'Default Package', description: '', formfactors: [] }];
    }

    db.run("DELETE FROM packages WHERE project_id = ?", [projectId], (errDel: Error | null) => {
        if (errDel) return done(errDel);
        db.run("DELETE FROM silicon_versions WHERE project_id = ?", [projectId], (errDelSv: Error | null) => {
            if (errDelSv) return done(errDelSv);

            let hasError = false;
            const finish = (err?: Error | null) => {
                if (hasError) return;
                if (err) {
                    hasError = true;
                    return done(err);
                }
                done(null);
            };

            // 1. Insert packages first
            let pkgPending = pkgsList.length;
            const insertedPackages: { pkg: any; packageId: number }[] = [];

            pkgsList.forEach((pkg: any) => {
                const pkgName = pkg.name || 'Default Package';
                db.run("INSERT INTO packages (project_id, name, description) VALUES (?, ?, ?)", [projectId, pkgName, pkg.description || ''], function(this: any, errPkg: Error | null) {
                    if (errPkg) return finish(errPkg);
                    insertedPackages.push({ pkg, packageId: this.lastID });
                    if (--pkgPending === 0) {
                        const firstPkgId = insertedPackages[0].packageId;

                        // 2. Insert silicon versions with project_id and package_id (to satisfy NOT NULL)
                        let svPending = siVersionsList.length;

                        const onSiliconVersionsDone = () => {
                            // 3. Insert board formfactors for each package
                            let totalFfs = 0;
                            insertedPackages.forEach(({ pkg }) => {
                                let rawFfs = pkg.formfactors || pkg.board_formfactors || [];
                                if (rawFfs.length === 0 && Array.isArray(pkg.silicon_versions)) {
                                    const ffMap = new Map<string, any>();
                                    for (const sv of pkg.silicon_versions) {
                                        if (Array.isArray(sv.formfactors)) {
                                            for (const ff of sv.formfactors) {
                                                if (!ffMap.has(ff.name)) ffMap.set(ff.name, { ...ff });
                                            }
                                        }
                                    }
                                    rawFfs = Array.from(ffMap.values());
                                }
                                totalFfs += rawFfs.length;
                            });

                            if (totalFfs === 0) return finish(null);

                            let ffsPending = totalFfs;
                            insertedPackages.forEach(({ pkg, packageId }) => {
                                let rawFfs = pkg.formfactors || pkg.board_formfactors || [];
                                if (rawFfs.length === 0 && Array.isArray(pkg.silicon_versions)) {
                                    const ffMap = new Map<string, any>();
                                    for (const sv of pkg.silicon_versions) {
                                        if (Array.isArray(sv.formfactors)) {
                                            for (const ff of sv.formfactors) {
                                                if (!ffMap.has(ff.name)) ffMap.set(ff.name, { ...ff });
                                            }
                                        }
                                    }
                                    rawFfs = Array.from(ffMap.values());
                                }

                                rawFfs.forEach((ff: any) => {
                                    const ffName = ff.name || 'Default';
                                    db.run("INSERT INTO board_formfactors (package_id, silicon_version_id, name, description) VALUES (?, ?, ?, ?)", [packageId, null, ffName, ff.description || ''], function(this: any, errFf: Error | null) {
                                        if (errFf) return finish(errFf);
                                        const formfactorId = this.lastID;
                                        const rawRevs = ff.revisionDetails || ff.revisions || [];
                                        let revisions: any[] = [];
                                        if (typeof rawRevs === 'string') {
                                            revisions = rawRevs.split(',').map((s: string) => s.trim()).filter(Boolean);
                                        } else if (Array.isArray(rawRevs)) {
                                            revisions = rawRevs;
                                        } else if (rawRevs) {
                                            revisions = [rawRevs];
                                        }
                                        if (revisions.length === 0) {
                                            revisions = ['1.0'];
                                        }

                                        let revPending = revisions.length;
                                        revisions.forEach((r: any) => {
                                            const revName = typeof r === 'object' ? (r.name || '1.0') : String(r);
                                            db.run("INSERT INTO board_formfactor_revisions (board_formfactor_id, name, description) VALUES (?, ?, ?)", [formfactorId, revName, (typeof r === 'object' ? r.description : '') || ''], function(this: any, errRev: Error | null) {
                                                if (errRev) return finish(errRev);
                                                const revisionId = this.lastID;

                                                let bomsList: string[] = [];
                                                if (typeof r === 'object' && r) {
                                                    if (Array.isArray(r.boms)) bomsList = r.boms;
                                                    else if (r.boms) bomsList = String(r.boms).split(',').map((s: string) => s.trim()).filter(Boolean);
                                                    else if (Array.isArray(r.bom_flavors)) bomsList = r.bom_flavors.map((b: any) => b.name);
                                                }
                                                if (bomsList.length === 0) bomsList = ['Default'];

                                                bomsList.forEach((bomName: string) => {
                                                    db.run("INSERT OR IGNORE INTO bom_flavors (formfactor_revision_id, name) VALUES (?, ?)", [revisionId, bomName]);
                                                });

                                                if (typeof r === 'object' && r) {
                                                    if (r.schematic || r.doc) {
                                                        const sch = r.schematic || r.doc;
                                                        db.run("INSERT INTO formfactor_revision_docs (formfactor_revision_id, doc_type, filename, path) VALUES (?, 'schematic', ?, ?)", [revisionId, sch, `/docs/${sch}`]);
                                                        db.run("INSERT OR REPLACE INTO uploaded_docs (entity_type, entity_id, project_id, doc_type, filename, original_filename, path, mime_type) VALUES ('revision', ?, ?, 'schematic', ?, ?, ?, 'application/pdf')", [revisionId, projectId, sch, sch, `/docs/${sch}`]);
                                                    }
                                                    if (r.board_file) {
                                                        db.run("INSERT INTO formfactor_revision_docs (formfactor_revision_id, doc_type, filename, path) VALUES (?, 'board_file', ?, ?)", [revisionId, r.board_file, `/docs/${r.board_file}`]);
                                                        db.run("INSERT OR REPLACE INTO uploaded_docs (entity_type, entity_id, project_id, doc_type, filename, original_filename, path, mime_type) VALUES ('revision', ?, ?, 'board_file', ?, ?, ?, 'application/octet-stream')", [revisionId, projectId, r.board_file, r.board_file, `/docs/${r.board_file}`]);
                                                    }
                                                    if (r.bom_csv) {
                                                        db.run("INSERT INTO formfactor_revision_docs (formfactor_revision_id, doc_type, filename, path) VALUES (?, 'bom_csv', ?, ?)", [revisionId, r.bom_csv, `/docs/${r.bom_csv}`]);
                                                        db.run("INSERT OR REPLACE INTO uploaded_docs (entity_type, entity_id, project_id, doc_type, filename, original_filename, path, mime_type) VALUES ('revision', ?, ?, 'bom_csv', ?, ?, ?, 'text/csv')", [revisionId, projectId, r.bom_csv, r.bom_csv, `/docs/${r.bom_csv}`]);
                                                    }
                                                    if (r.datasheet) {
                                                        db.run("INSERT INTO formfactor_revision_docs (formfactor_revision_id, doc_type, filename, path) VALUES (?, 'datasheet', ?, ?)", [revisionId, r.datasheet, `/docs/${r.datasheet}`]);
                                                        db.run("INSERT OR REPLACE INTO uploaded_docs (entity_type, entity_id, project_id, doc_type, filename, original_filename, path, mime_type) VALUES ('revision', ?, ?, 'datasheet', ?, ?, ?, 'application/pdf')", [revisionId, projectId, r.datasheet, r.datasheet, `/docs/${r.datasheet}`]);
                                                    }
                                                    if (Array.isArray(r.documents)) {
                                                        r.documents.forEach((docItem: any) => {
                                                            if (docItem.filename && !['schematic', 'board_file', 'bom_csv', 'datasheet'].includes(docItem.doc_type)) {
                                                                db.run("INSERT INTO formfactor_revision_docs (formfactor_revision_id, doc_type, filename, path) VALUES (?, ?, ?, ?)", [revisionId, docItem.doc_type || 'other', docItem.filename, docItem.path || `/docs/${docItem.filename}`]);
                                                                db.run("INSERT OR REPLACE INTO uploaded_docs (entity_type, entity_id, project_id, doc_type, filename, original_filename, path) VALUES ('revision', ?, ?, ?, ?, ?, ?)", [revisionId, projectId, docItem.doc_type || 'other', docItem.filename, docItem.filename, docItem.path || `/docs/${docItem.filename}`]);
                                                            }
                                                        });
                                                    }
                                                }

                                                if (--revPending === 0) {
                                                    if (--ffsPending === 0) {
                                                        finish(null);
                                                    }
                                                }
                                            });
                                        });
                                    });
                                });
                            });
                        };

                        if (siVersionsList.length === 0) {
                            onSiliconVersionsDone();
                        } else {
                            siVersionsList.forEach((sv: any) => {
                                const svName = sv.name || 'A0';
                                const cornersStr = Array.isArray(sv.silicon_corners) ? sv.silicon_corners.join(', ') : (sv.silicon_corners || '');
                                db.run("INSERT INTO silicon_versions (project_id, package_id, name, silicon_corners, description) VALUES (?, ?, ?, ?, ?)", [projectId, firstPkgId, svName, cornersStr, sv.description || ''], function(this: any, errSv: Error | null) {
                                    if (errSv) return finish(errSv);
                                    const svId = this.lastID;

                                    const cornersArr = Array.isArray(sv.silicon_corners)
                                        ? sv.silicon_corners
                                        : (sv.silicon_corners ? String(sv.silicon_corners).split(',').map((s: string) => s.trim()).filter(Boolean) : []);
                                    cornersArr.forEach((c: string) => {
                                        db.run("INSERT OR IGNORE INTO silicon_corners (silicon_version_id, name) VALUES (?, ?)", [svId, c]);
                                    });

                                    if (--svPending === 0) {
                                        onSiliconVersionsDone();
                                    }
                                });
                            });
                        }
                    }
                });
            });
        });
    });
}

function fetchProjectsWithHierarchy(callback: (err: Error | null, projects?: any[]) => void) {
    const query = `
        SELECT projects.*, 
        COUNT(DISTINCT pcbs.id) as pcb_count,
        GROUP_CONCAT(DISTINCT pcbs.board_number) as pcb_list,
        (
            (SELECT COUNT(*) FROM project_docs WHERE project_docs.project_id = projects.id) +
            (SELECT COUNT(*) FROM formfactor_revision_docs ffrd 
             JOIN board_formfactor_revisions bfr ON ffrd.formfactor_revision_id = bfr.id
             JOIN board_formfactors bf ON bfr.board_formfactor_id = bf.id
             LEFT JOIN packages pkg ON bf.package_id = pkg.id
             LEFT JOIN silicon_versions sv ON bf.silicon_version_id = sv.id
             LEFT JOIN packages pkg_sv ON sv.package_id = pkg_sv.id
             WHERE pkg.project_id = projects.id OR pkg_sv.project_id = projects.id OR sv.project_id = projects.id)
        ) as doc_count
        FROM projects
        LEFT JOIN pcbs ON projects.id = pcbs.project_id
        GROUP BY projects.id
    `;

    db.all(query, [], (err: Error | null, rows: any[]) => {
        if (err) return callback(err);

        db.all("SELECT * FROM packages", [], (errPkg: Error | null, packages: any[]) => {
            if (errPkg) return callback(errPkg);
            db.all("SELECT * FROM silicon_versions", [], (errSv: Error | null, siliconVersions: any[]) => {
                if (errSv) return callback(errSv);
                db.all("SELECT * FROM silicon_corners", [], (errSc: Error | null, siliconCorners: any[]) => {
                    if (errSc) return callback(errSc);
                    db.all("SELECT * FROM board_formfactors", [], (errBff: Error | null, boardFormFactors: any[]) => {
                        if (errBff) return callback(errBff);
                        db.all("SELECT * FROM board_formfactor_revisions", [], (errBfr: Error | null, bffRevisions: any[]) => {
                            if (errBfr) return callback(errBfr);
                            db.all("SELECT * FROM bom_flavors", [], (errBoms: Error | null, bomFlavors: any[]) => {
                                if (errBoms) return callback(errBoms);
                                db.all("SELECT * FROM formfactor_revision_docs", [], (errDocs: Error | null, revisionDocs: any[]) => {
                                    if (errDocs) return callback(errDocs);
                                    db.all("SELECT * FROM pcb_flavors", [], (errFlv: Error | null, legacyFlavors: any[]) => {
                                        if (errFlv) return callback(errFlv);

                                        const result = rows.map(row => {
                                            const projPkgs = (packages || []).filter(pkg => pkg.project_id === row.id);
                                            const projSiVers = (siliconVersions || []).filter(sv => sv.project_id === row.id || projPkgs.some(p => p.id === sv.package_id));

                                            const assembledSiVers = projSiVers.map(sv => {
                                                const svCorners = (siliconCorners || []).filter(sc => sc.silicon_version_id === sv.id).map(sc => sc.name);
                                                const svCornersList = svCorners.length > 0 
                                                    ? svCorners 
                                                    : (sv.silicon_corners ? sv.silicon_corners.split(',').map((s: string) => s.trim()).filter(Boolean) : []);
                                                return {
                                                    id: sv.id,
                                                    name: sv.name,
                                                    description: sv.description || '',
                                                    silicon_corners: svCornersList
                                                };
                                            });

                                            const assembledPackages = projPkgs.map(pkg => {
                                                const pkgFfs = (boardFormFactors || []).filter(ff => ff.package_id === pkg.id || projSiVers.some(sv => sv.id === ff.silicon_version_id));
                                                const assembledFfs = pkgFfs.map(ff => {
                                                    const ffRevs = (bffRevisions || []).filter(r => r.board_formfactor_id === ff.id);
                                                    const assembledRevs = ffRevs.map(r => {
                                                        const rBoms = (bomFlavors || []).filter(b => b.formfactor_revision_id === r.id);
                                                        const rDocs = (revisionDocs || []).filter(d => d.formfactor_revision_id === r.id);
                                                        
                                                        const schDoc = rDocs.find(d => d.doc_type === 'schematic');
                                                        const brdDoc = rDocs.find(d => d.doc_type === 'board_file');
                                                        const bomCsvDoc = rDocs.find(d => d.doc_type === 'bom_csv');
                                                        const dsDoc = rDocs.find(d => d.doc_type === 'datasheet');

                                                        return {
                                                            id: r.id,
                                                            name: r.name,
                                                            description: r.description,
                                                            boms: rBoms.map(b => b.name),
                                                            bom_flavors: rBoms,
                                                            documents: rDocs,
                                                            schematic: schDoc ? schDoc.filename : null,
                                                            board_file: brdDoc ? brdDoc.filename : null,
                                                            bom_csv: bomCsvDoc ? bomCsvDoc.filename : null,
                                                            datasheet: dsDoc ? dsDoc.filename : null,
                                                            doc: schDoc ? schDoc.filename : null
                                                        };
                                                    });
                                                    return {
                                                        id: ff.id,
                                                        name: ff.name,
                                                        description: ff.description,
                                                        revisions: assembledRevs.map(r => r.name),
                                                        revisionDetails: assembledRevs
                                                    };
                                                });

                                                const pkgSiliconVersions = assembledSiVers.map(sv => ({
                                                    ...sv,
                                                    formfactors: assembledFfs
                                                }));

                                                return {
                                                    id: pkg.id,
                                                    name: pkg.name,
                                                    description: pkg.description,
                                                    formfactors: assembledFfs,
                                                    board_formfactors: assembledFfs,
                                                    silicon_versions: pkgSiliconVersions
                                                };
                                            });

                                            const allSiRevs = new Set<string>();
                                            const allCorners = new Set<string>();
                                            const allFlavorsMap = new Map<string, any>();

                                            assembledSiVers.forEach(sv => {
                                                allSiRevs.add(sv.name);
                                                sv.silicon_corners.forEach((c: string) => allCorners.add(c));
                                            });

                                            assembledPackages.forEach(pkg => {
                                                (pkg.formfactors || []).forEach(ff => {
                                                    if (!allFlavorsMap.has(ff.name)) {
                                                        allFlavorsMap.set(ff.name, {
                                                            id: ff.id,
                                                            name: ff.name,
                                                            revisions: [...ff.revisions],
                                                            revisionDetails: [...ff.revisionDetails]
                                                        });
                                                    } else {
                                                        const existing = allFlavorsMap.get(ff.name);
                                                        ff.revisions.forEach((r: string) => {
                                                            if (!existing.revisions.includes(r)) existing.revisions.push(r);
                                                        });
                                                        ff.revisionDetails.forEach((rd: any) => {
                                                            if (!existing.revisionDetails.some((e: any) => e.name === rd.name)) {
                                                                existing.revisionDetails.push(rd);
                                                            }
                                                        });
                                                    }
                                                });
                                            });

                                            const synthesizedRevs = allSiRevs.size > 0 
                                                ? Array.from(allSiRevs) 
                                                : (row.revisions ? row.revisions.split(',').map((s: string) => s.trim()).filter(Boolean) : []);
                                            const synthesizedCorners = allCorners.size > 0 
                                                ? Array.from(allCorners).join(', ') 
                                                : (row.silicon_corners || '');
                                            const synthesizedFlavors = allFlavorsMap.size > 0 
                                                ? Array.from(allFlavorsMap.values()) 
                                                : (legacyFlavors || []).filter(f => f.project_id === row.id).map(f => {
                                                    let parsedRevs: any[] = [];
                                                    try {
                                                        parsedRevs = (typeof f.revisions === 'string' && (f.revisions.startsWith('[') || f.revisions.startsWith('{'))) ? JSON.parse(f.revisions) : (f.revisions ? f.revisions.split(',').map((s: string) => s.trim()) : []);
                                                    } catch { parsedRevs = []; }
                                                    return {
                                                        id: f.id,
                                                        name: f.name,
                                                        revisions: parsedRevs.map(r => typeof r === 'object' ? r.name : r),
                                                        revisionDetails: parsedRevs.map(r => typeof r === 'object' ? r : { name: r, boms: [] })
                                                    };
                                                });

                                            return {
                                                ...row,
                                                packages: assembledPackages,
                                                silicon_versions: assembledSiVers,
                                                revisions: synthesizedRevs,
                                                silicon_corners: synthesizedCorners,
                                                flavors: synthesizedFlavors,
                                                pcbs: row.pcb_list ? row.pcb_list.split(',') : []
                                            };
                                        });

                                        callback(null, result);
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });
    });
}

// Projects API
app.get('/api/projects', (_req: Request, res: Response) => {
    fetchProjectsWithHierarchy((err, projects) => {
        if (err) {
            console.error("PROJECTS QUERY ERROR:", err.message);
            return res.status(500).json({ error: err.message });
        }
        res.json(projects);
    });
});

app.post('/api/projects', async (req: Request, res: Response) => {
    if (!canAddProject(req as any)) {
        return res.status(403).json({ error: "You do not have permission to create projects." });
    }
    const { name, description, revisions, project_key, silicon_corners, number_format } = req.body;
    const cleanName = sanitizeProjectName(name);
    
    if (!cleanName) return res.status(400).json({ error: "Project name is required and must contain alphanumeric characters" });

    try {
        const finalProjectKey = project_key ? project_key.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3) : await generateProjectKey(cleanName);
        const creator = req.headers['x-user-username'] || 'guest';
        db.run("INSERT INTO projects (name, description, revisions, project_key, silicon_corners, number_format, created_by, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [cleanName, description || '', revisions || '', finalProjectKey, silicon_corners || null, number_format || 'decimal', creator, creator], function(this: any, err: Error | null) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    if (err.message.includes('projects.name')) {
                        return res.status(400).json({ error: `A project with the name "${cleanName}" already exists.` });
                    }
                    if (err.message.includes('projects.project_key')) {
                        return res.status(500).json({ error: "Failed to allocate unique project key. Try again." });
                    }
                }
                return res.status(500).json({ error: err.message });
            }
            const newProjectId = this.lastID;
            const pkgsToSave = extractProjectPackages(req.body);
            const siVersToSave = extractProjectSiliconVersions(req.body, pkgsToSave);

            saveProjectHierarchy(newProjectId, pkgsToSave, siVersToSave, (errHierarchy) => {
                if (errHierarchy) console.error("Error saving project hierarchy:", errHierarchy.message);
                res.status(201).json({ id: newProjectId, name: cleanName, project_key: finalProjectKey });
            });
        });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// PCBs API
app.get('/api/pcbs', (_req: Request, res: Response) => {
    const query = `
        SELECT pcbs.*, projects.name as project_name, projects.project_key, projects.number_format as number_format,
               owners.name as owner_name, owners.username as owner_username,
               pf.name as flavor_name_fk,
               (SELECT GROUP_CONCAT(tag_id) FROM pcb_tags WHERE pcb_id = pcbs.id) as tag_ids
        FROM pcbs
        LEFT JOIN projects ON pcbs.project_id = projects.id
        LEFT JOIN owners ON pcbs.owner_id = owners.id
        LEFT JOIN pcb_flavors pf ON pcbs.board_flavor_id = pf.id
    `;
    db.all(query, [], (err: Error | null, rows: any[]) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows.map(row => {
            let fullBoardName = row.board_number;
            if (row.project_key && !row.board_number.toString().includes('-')) {
                let formattedNum = '';
                if (row.number_format === 'hex') {
                    formattedNum = parseInt(row.board_number).toString(16).toUpperCase().padStart(4, '0');
                } else {
                    formattedNum = parseInt(row.board_number).toString(10).padStart(4, '0');
                }
                let generatedCrc = '';
                if (row.number_format !== 'hex') {
                    generatedCrc = generateCRC(`${row.project_key}-${formattedNum}`);
                }
                fullBoardName = `${row.project_key}-${formattedNum}${generatedCrc}`;
            }

            // Resolve flavor name: prefer the FK-joined name, fall back to stored text string
            const resolvedFlavor = row.flavor_name_fk || row.board_flavor || '';

            return {
                id: row.id,
                board_number: fullBoardName,
                status: row.status,
                project: row.project_name,
                project_id: row.project_id,
                package_id: row.package_id || null,
                package_name: row.package_name || undefined,
                silicon_version_id: row.silicon_version_id || null,
                board_formfactor_id: row.board_formfactor_id || null,
                formfactor_revision_id: row.formfactor_revision_id || null,
                bom_flavor_id: row.bom_flavor_id || null,
                number_format: row.number_format || 'decimal',
                owner: row.owner_name || 'Unassigned',
                owner_username: row.owner_username || undefined,
                product: [resolvedFlavor, row.board_rev, row.silicon_rev, row.silicon_corner].filter(Boolean).join(' ') || '',
                board_flavor: resolvedFlavor,
                board_flavor_id: row.board_flavor_id || null,
                board_rev: row.board_rev || '',
                silicon_rev: row.silicon_rev || '',
                silicon_corner: row.silicon_corner || '',
                bom: row.bom,
                manufacturer_id: row.manufacturer_id || '',
                tag_ids: row.tag_ids ? row.tag_ids.split(',').map(Number) : [],
                short_code: row.short_code,
                created_at: row.created_at,
                created_by: row.created_by,
                updated_by: row.updated_by
            };
        }));
    });
});

app.post('/api/pcbs', async (req: Request, res: Response) => {
    if (!canAddPcb(req as any)) {
        return res.status(403).json({ error: "Guest users cannot add PCBs." });
    }
    const { board_number, status, board_flavor, board_rev, silicon_rev, silicon_corner, bom, project_id, package_id, package_name, silicon_version_id, board_formfactor_id, formfactor_revision_id, bom_flavor_id, owner_id, manufacturer_id } = req.body;
    let numPart = board_number;
    if (board_number && board_number.includes('-')) {
        const parts = board_number.split('-');
        numPart = parts.slice(-1)[0];
        if (numPart.length > 1 && /^[a-zA-Z]$/.test(numPart.slice(-1))) {
            numPart = numPart.slice(0, -1);
        }
        let val = parseInt(numPart, 10);
        if (isNaN(val)) val = parseInt(numPart, 16);
        if (!isNaN(val)) numPart = val.toString();
    }
    try {
        const projectKey = await getProjectKeyById(project_id);
        const short_code = await generateShortCode(projectKey, numPart);
        const creator = req.headers['x-user-username'] || 'guest';
        // Resolve flavor name to FK id
        const resolveFlavorId = (cb: (id: number | null) => void) => {
            if (!board_flavor || !project_id) return cb(null);
            db.get("SELECT id FROM pcb_flavors WHERE project_id = ? AND name = ? LIMIT 1", [project_id, board_flavor], (_e: Error | null, row: any) => {
                cb(row ? row.id : null);
            });
        };
        resolveFlavorId((board_flavor_id) => {
            const query = "INSERT INTO pcbs (board_number, status, board_flavor, board_flavor_id, board_rev, silicon_rev, silicon_corner, bom, project_id, package_id, package_name, silicon_version_id, board_formfactor_id, formfactor_revision_id, bom_flavor_id, owner_id, short_code, manufacturer_id, created_at, created_by, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, ?)";
            db.run(query, [numPart, status, board_flavor, board_flavor_id, board_rev, silicon_rev, silicon_corner, bom, project_id, package_id || null, package_name || null, silicon_version_id || null, board_formfactor_id || null, formfactor_revision_id || null, bom_flavor_id || null, owner_id, short_code, manufacturer_id || null, creator, creator], function(this: any, err: Error | null) {
                if (err) return res.status(500).json({ error: err.message });
                res.status(201).json({ id: this.lastID, board_number, short_code, manufacturer_id });
            });
        });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// --- OTP Helpers ---
function base32ToBuf(base32: string): Buffer {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let clean = base32.trim().replace(/=+$/, '').replace(/\s+/g, '').toUpperCase();
    let length = clean.length;
    let bits = 0;
    let value = 0;
    let index = 0;
    const buf = Buffer.alloc(Math.floor(length * 5 / 8));
    
    for (let i = 0; i < length; i++) {
        const val = alphabet.indexOf(clean[i]);
        if (val === -1) throw new Error("Invalid base32 character");
        value = (value << 5) | val;
        bits += 5;
        if (bits >= 8) {
            buf[index++] = (value >> (bits - 8)) & 255;
            bits -= 8;
        }
    }
    return buf;
}

function generateTotp(secret: string, time = Date.now()): string {
    const counter = Math.floor(time / 1000 / 30);
    const key = base32ToBuf(secret);
    
    const countBuf = Buffer.alloc(8);
    let tmp = counter;
    for (let i = 7; i >= 0; i--) {
        countBuf[i] = tmp & 0xff;
        tmp = Math.floor(tmp / 256);
    }
    
    const hmac = crypto.createHmac('sha1', key).update(countBuf).digest();
    const offset = hmac[hmac.length - 1] & 0xf;
    const code = ((hmac[offset] & 0x7f) << 24) |
                 ((hmac[offset + 1] & 0xff) << 16) |
                 ((hmac[offset + 2] & 0xff) << 8) |
                 (hmac[offset + 3] & 0xff);
                 
    return String(code % 1000000).padStart(6, '0');
}

function verifyTotp(secret: string, token: string): boolean {
    if (!secret || !token) return false;
    const cleanSecret = String(secret).trim().replace(/\s+/g, '').toUpperCase();
    const cleanToken = String(token).trim().replace(/\s+/g, '').padStart(6, '0');
    const now = Date.now();
    for (let i = -1; i <= 1; i++) {
        const expected = generateTotp(cleanSecret, now + i * 30 * 1000);
        if (expected === cleanToken) return true;
    }
    return false;
}

function generateSecret(): string {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let secret = '';
    for (let i = 0; i < 16; i++) {
        secret += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return secret;
}

function getUserRole(ownerId: number): Promise<'Super User' | 'User'> {
    return new Promise((resolve) => {
        db.get("SELECT is_super_user FROM owners WHERE id = ?", [ownerId], (err: Error | null, row: any) => {
            if (err || !row) return resolve('User');
            resolve(row.is_super_user === 1 ? 'Super User' : 'User');
        });
    });
}




app.get('/api/otp/setup', (req: Request, res: Response) => {
    const { username, host } = req.query;
    if (!username) return res.status(400).json({ error: "Username is required." });
    const secret = generateSecret();
    // Strip protocol and any port number (e.g. localhost:5173 -> localhost) so no colons exist in host
    const cleanHost = host ? (host as string).replace(/^https?:\/\//i, '').replace(/:\d+$/, '') : '';
    const issuer = 'ReworkTracker';
    const accountName = cleanHost ? `${username} (${cleanHost})` : (username as string);
    // According to RFC 6238 Key URI Format (Google Authenticator specification):
    // The issuer and accountname tokens must each be URL-encoded, but the colon character separating them must not be encoded.
    const otpauthUrl = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(accountName)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}`;
    res.json({ secret, otpauthUrl });
});

interface LoginAttempt {
    timestamp: number;
    success: boolean;
}

app.post('/api/otp/verify', (req: Request, res: Response) => {
    const { secret, token, username } = req.body;
    console.log("[OTP DEBUG] /api/otp/verify entry. Body:", req.body);

    // If username is not provided, this is a stateless verify call (e.g. from AddUser setup)
    if (!username) {
        console.log("[OTP DEBUG] Stateless verify call");
        if (!secret || !token) {
            console.log("[OTP DEBUG] Error: Secret and token are required");
            return res.status(400).json({ error: "Secret and token are required." });
        }
        try {
            const isValid = verifyTotp(secret, token);
            console.log("[OTP DEBUG] Stateless verify result:", isValid);
            return res.json({ valid: isValid });
        } catch (err: any) {
            console.log("[OTP DEBUG] Stateless verify exception:", err.message);
            return res.status(400).json({ error: err.message });
        }
    }

    const cleanUsername = username.replace(/\s+/g, '').toLowerCase();
    console.log("[OTP DEBUG] Statefull verify for user:", cleanUsername);

    db.get("SELECT id, login_attempts, otp_secret FROM owners WHERE username = ?", [cleanUsername], (err: Error | null, row: any) => {
        if (err) {
            console.error("[OTP DEBUG] DB Select Error:", err);
            return res.status(500).json({ error: err.message });
        }
        if (!row) {
            console.log("[OTP DEBUG] User not found");
            return res.status(404).json({ error: "User not found." });
        }

        console.log("[OTP DEBUG] User row found:", { id: row.id, has_otp: !!row.otp_secret });

        let attempts: LoginAttempt[] = [];
        if (row.login_attempts) {
            try {
                attempts = JSON.parse(row.login_attempts);
            } catch (e) {
                attempts = [];
            }
        }

        if (!Array.isArray(attempts)) {
            attempts = [];
        }

        // Check if currently locked out (3 failed attempts within 15 minutes, locked for 30 minutes)
        if (attempts.length === 3 && attempts.every(a => !a.success)) {
            const oldest = attempts[0].timestamp;
            const latest = attempts[2].timestamp;
            if (latest - oldest <= 15 * 60 * 1000) {
                const lockoutEndTime = latest + 30 * 60 * 1000;
                const now = Date.now();
                if (now < lockoutEndTime) {
                    const minutesLeft = Math.ceil((lockoutEndTime - now) / (60 * 1000));
                    console.log("[OTP DEBUG] Account is locked out. minutesLeft:", minutesLeft);
                    return res.status(403).json({
                        error: `This account is temporarily locked due to multiple failed login attempts. Please try again in ${minutesLeft} minute${minutesLeft !== 1 ? 's' : ''}.`
                    });
                }
            }
        }

        // Look up OTP secret directly from DB (or fallback to passed secret)
        const userSecret = row.otp_secret || secret;

        // If user has an OTP secret configured, verify the token
        let isValid = true;
        if (userSecret) {
            if (!token) {
                console.log("[OTP DEBUG] Token is missing, isValid = false");
                isValid = false;
            } else {
                try {
                    console.log("[OTP DEBUG] Calling verifyTotp with DB secret length:", userSecret.length, "token:", token);
                    isValid = verifyTotp(userSecret, token);
                    console.log("[OTP DEBUG] verifyTotp returned:", isValid);
                } catch (totpErr: any) {
                    console.error("[OTP DEBUG] verifyTotp exception:", totpErr);
                    isValid = false;
                }
            }
        }

        // Record the attempt
        const newAttempt: LoginAttempt = {
            timestamp: Date.now(),
            success: isValid
        };

        attempts.push(newAttempt);
        if (attempts.length > 3) {
            attempts.shift();
        }

        console.log("[OTP DEBUG] Updating login_attempts to DB. Row ID:", row.id, "attempts:", attempts);
        db.run("UPDATE owners SET login_attempts = ? WHERE id = ?", [JSON.stringify(attempts), row.id], (updateErr: Error | null) => {
            if (updateErr) {
                console.error("[OTP DEBUG] DB UPDATE Error:", updateErr);
                return res.status(500).json({ error: updateErr.message });
            }

            console.log("[OTP DEBUG] DB UPDATE complete. isValid:", isValid);

            if (!isValid) {
                // If it was failed, check if this triggers a new lockout
                if (attempts.length === 3 && attempts.every(a => !a.success)) {
                    const oldest = attempts[0].timestamp;
                    const latest = attempts[2].timestamp;
                    if (latest - oldest <= 15 * 60 * 1000) {
                        console.log("[OTP DEBUG] Lockout triggered by 3rd failed attempt");
                        return res.status(403).json({
                            valid: false,
                            error: "Invalid verification code. This account has been locked for 30 minutes due to 3 failed login attempts."
                        });
                    }
                }
                console.log("[OTP DEBUG] Invalid verification code response");
                return res.status(400).json({
                    valid: false,
                    error: "Invalid 6-digit verification code. Please check your authenticator."
                });
            }

            db.get("SELECT id, name, username FROM owners WHERE id = ?", [row.id], async (errOwner: Error | null, ownerRow: any) => {
                if (errOwner || !ownerRow) {
                    console.error("[OTP DEBUG] Failed to load owner details for token generation:", errOwner);
                    return res.status(500).json({ error: "Failed to load user details." });
                }

                try {
                    const role = await getUserRole(ownerRow.id);
                    const token = generateToken({
                        id: ownerRow.id,
                        username: ownerRow.username,
                        name: ownerRow.name,
                        role: role
                    });

                    res.cookie('session_token', token, {
                        maxAge: 7 * 24 * 60 * 60 * 1000, // 1 week
                        httpOnly: true,
                        sameSite: 'lax',
                        path: '/'
                    });

                    console.log("[OTP DEBUG] Valid verification response. Sending success with token!");
                    return res.json({
                        valid: true,
                        token,
                        user: {
                            id: ownerRow.id,
                            username: ownerRow.username,
                            name: ownerRow.name,
                            role: role
                        }
                    });
                } catch (tokenErr: any) {
                    console.error("[OTP DEBUG] Token generation error:", tokenErr);
                    return res.status(500).json({ error: tokenErr.message });
                }
            });
        });
    });
});

// Owners API
app.get('/api/owners', (_req: Request, res: Response) => {
    const query = `
        SELECT 
            owners.id,
            owners.name,
            owners.username,
            owners.email,
            owners.crc_format,
            owners.is_super_user,
            owners.otp_reset_token,
            owners.otp_reset_expires,
            owners.otp_reset_by,
            owners.otp_reset_at,
            CASE WHEN (owners.otp_secret IS NOT NULL AND owners.otp_secret != '') THEN 1 ELSE 0 END AS has_otp,
            (SELECT COUNT(*) FROM pcbs WHERE pcbs.owner_id = owners.id) AS pcb_count,
            (SELECT COUNT(*) FROM reworks WHERE reworks.owner_id = owners.id) AS rework_count,
            (SELECT COUNT(*) FROM tags WHERE tags.owner_id = owners.id) AS tag_count
        FROM owners
    `;
    db.all(query, [], (err: Error | null, rows: any[]) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/owners', (req: Request, res: Response) => {
    const { name, username, email, otp_secret, crc_format, is_super_user, role } = req.body;
    const cleanUsername = username ? username.replace(/\s+/g, '').toLowerCase() : null;
    const superUserVal = is_super_user !== undefined ? (is_super_user ? 1 : 0) : (role === 'Super User' ? 1 : 0);
    db.run("INSERT INTO owners (name, username, email, otp_secret, crc_format, is_super_user) VALUES (?, ?, ?, ?, ?, ?)", [name, cleanUsername, email || null, otp_secret || null, crc_format || 'letter', superUserVal], function(this: any, err: Error | null) {
        if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
                return res.status(400).json({ error: `Username "${cleanUsername}" is already taken.` });
            }
            return res.status(500).json({ error: err.message });
        }
        res.status(201).json({ id: this.lastID, name, username: cleanUsername, email: email || null, crc_format: crc_format || 'letter', is_super_user: superUserVal });
    });
});

// Tags API
app.get('/api/tags', (_req: Request, res: Response) => {
    const query = `
        SELECT tags.*, owners.name as owner_name, owners.username as owner_username, COUNT(pcb_tags.pcb_id) as pcb_count
        FROM tags
        LEFT JOIN owners ON tags.owner_id = owners.id
        LEFT JOIN pcb_tags ON tags.id = pcb_tags.tag_id
        GROUP BY tags.id
    `;
    db.all(query, [], (err: Error | null, rows: any[]) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/tags', (req: Request, res: Response) => {
    if (!isSuperUser(req as any)) {
        return res.status(403).json({ error: "Only Super Users can create tags." });
    }
    const { name, color, owner_id, type } = req.body;
    const finalOwnerId = owner_id && owner_id !== '-1' && owner_id !== 'null' ? parseInt(owner_id) : null;
    db.run("INSERT INTO tags (name, color, owner_id, type) VALUES (?, ?, ?, ?)", [name, color, finalOwnerId, type || 'public'], function(this: any, err: Error | null) {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ id: this.lastID, name });
    });
});

// Reworks API
app.get('/api/reworks', (_req: Request, res: Response) => {
    const query = `
        SELECT reworks.*, pcbs.board_number, owners.name as owner_name, owners.username as owner_username
        FROM reworks 
        LEFT JOIN pcbs ON reworks.pcb_id = pcbs.id
        LEFT JOIN owners ON reworks.owner_id = owners.id
        ORDER BY timestamp DESC
    `;
    db.all(query, [], (err: Error | null, rows: any[]) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/reworks', upload.any(), fileSanityCheckMiddleware, deduplicate, serializeWrites, (req: Request, res: Response) => {
    const { pcb_id, title, description, owner_id, rework_type, new_product, new_silicon_rev, new_silicon_corner } = req.body;
    
    db.get("SELECT value FROM global_settings WHERE key = 'allowGuestMinorRework'", [], (_errSettings: Error | null, rowSettings: any) => {
        const allowGuest = !rowSettings || rowSettings.value === 'true';
        db.get("SELECT value FROM global_settings WHERE key = ?", [`priority_${rework_type || 'Minor'}`], (_errPri: Error | null, rowPri: any) => {
            const priority = rowPri ? rowPri.value : 'Low';
            const isHigh = priority === 'High';
            if (!canAddRework(req as any, isHigh, allowGuest)) {
                return res.status(403).json({ error: "You are not authorized to add this rework log (guests can only add low priority logs when allowed)." });
            }

            // 1. Get the PCB board_number
            db.get("SELECT pcbs.*, projects.project_key, projects.number_format FROM pcbs LEFT JOIN projects ON pcbs.project_id = projects.id WHERE pcbs.id = ?", [pcb_id], (err: Error | null, row: any) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: "PCB not found" });
        
        let boardName = row.board_number;
        if (row.project_key && !row.board_number.toString().includes('-')) {
            let formattedNum = '';
            if (row.number_format === 'hex') {
                formattedNum = parseInt(row.board_number).toString(16).toUpperCase().padStart(4, '0');
            } else {
                formattedNum = parseInt(row.board_number).toString(10).padStart(4, '0');
            }
            boardName = `${row.project_key}-${formattedNum}${row.crc || ''}`;
        }
        
        // 2. Query existing reworks to find the next sequence
        db.get("SELECT MAX(rework_number) as max_num FROM reworks WHERE pcb_id = ?", [pcb_id], (errRework: Error | null, result: any) => {
            if (errRework) return res.status(500).json({ error: errRework.message });
            
            let sequence = (result && result.max_num) ? result.max_num + 1 : 1;
            
            const reworkName = `${boardName}-R${String(sequence).padStart(3, '0')}`;
            
            // Post-process the uploaded files dynamically to match the reworkName
            let finalPaths: string[] = [];
            const reqFiles = req.files as Express.Multer.File[] | undefined;
            if (reqFiles && reqFiles.length > 0) {
                reqFiles.slice(0, 3).forEach((file, index) => {
                    const ext = path.extname(file.originalname) || '.jpg';
                    const newFileName = `${reworkName}-PIC-${index + 1}${ext}`;
                    const projectKey = row.project_key || 'PRJ';
                    const oldPath = path.join(__dirname, 'pictures', file.filename);
                    const targetDir = path.join(__dirname, 'pictures', projectKey);
                    if (!fs.existsSync(targetDir)) {
                        fs.mkdirSync(targetDir, { recursive: true });
                    }
                    const newPath = path.join(targetDir, newFileName);
                    
                    try {
                        if (fs.existsSync(oldPath)) {
                            fs.renameSync(oldPath, newPath);
                            lockFileExecution(newPath);
                            finalPaths.push(`/pictures/${projectKey}/${newFileName}`);
                        }
                    } catch (errRename) {
                        console.error('Failed to rename picture file:', errRename);
                        finalPaths.push(`/pictures/${file.filename}`); // Fallback
                    }
                });
            }
            const image_path = finalPaths.length > 0 ? JSON.stringify(finalPaths) : null;
            
            // 3. Insert new rework
            const finalOwnerId = owner_id && owner_id !== '-1' && owner_id !== 'null' && owner_id !== 'guest' ? parseInt(owner_id) : null;
            const creator = req.headers['x-user-username'] || 'guest';
            const insertQuery = "INSERT INTO reworks (pcb_id, rework_number, title, description, owner_id, image_path, rework_type, created_by, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
            db.run(insertQuery, [pcb_id, sequence, title || null, description, finalOwnerId, image_path, rework_type || 'Minor', creator, creator], function(this: any, errInsert: Error | null) {
                if (errInsert) return res.status(500).json({ error: errInsert.message });
                const reworkId = this.lastID;

                // Record rework images in uploaded_docs
                if (finalPaths.length > 0) {
                    finalPaths.forEach((imgPath, idx) => {
                        const fn = path.basename(imgPath);
                        const origFile = reqFiles && reqFiles[idx] ? reqFiles[idx].originalname : fn;
                        const fileSize = reqFiles && reqFiles[idx] ? reqFiles[idx].size : 0;
                        const mimeType = reqFiles && reqFiles[idx] ? reqFiles[idx].mimetype : 'image/jpeg';
                        db.run(
                            "INSERT INTO uploaded_docs (entity_type, entity_id, project_id, pcb_id, doc_type, filename, original_filename, path, file_size, mime_type, uploaded_by) VALUES ('rework', ?, ?, ?, 'picture', ?, ?, ?, ?, ?, ?)",
                            [reworkId, row.project_id || null, pcb_id, fn, origFile, imgPath, fileSize, mimeType, creator]
                        );
                    });
                }
                
                // 4. Update PCB if it's a Silicon Swap
                if (rework_type === 'Silicon Swap' && new_silicon_rev !== undefined) {
                    db.run("UPDATE pcbs SET silicon_rev = ?, silicon_corner = ? WHERE id = ?", [new_silicon_rev, new_silicon_corner, pcb_id], function(this: any, updateErr: Error | null) {
                        if (updateErr) return res.status(500).json({ error: updateErr.message });
                        res.status(201).json({ id: reworkId, pcb_id, rework_number: sequence, rework_name: reworkName, title: title || null, rework_type, image_path, new_product });
                    });
                } else {
                    res.status(201).json({ id: reworkId, pcb_id, rework_number: sequence, rework_name: reworkName, title: title || null, rework_type: rework_type || 'Minor', image_path });
                }
            });
        });
    });
        });
    });
});

// --- Projects API Expansions ---
app.put('/api/projects/:id', (req: Request, res: Response) => {
    if (!canUpdateProject(req as any)) {
        return res.status(403).json({ error: "You do not have permission to update projects." });
    }
    const { name, description, revisions, project_key, silicon_corners, number_format } = req.body;
    const cleanName = sanitizeProjectName(name);

    if (!cleanName) return res.status(400).json({ error: "Project name is required" });
    const finalProjectKey = project_key ? project_key.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3) : null;

    db.get("SELECT number_format, project_key FROM projects WHERE id = ?", [req.params.id], (_err: Error | null, _row: any) => {
        const editor = req.headers['x-user-username'] || 'guest';
        db.run("UPDATE projects SET name = ?, description = ?, revisions = ?, project_key = ?, silicon_corners = ?, number_format = ?, updated_by = ? WHERE id = ?", [cleanName, description || '', revisions || '', finalProjectKey, silicon_corners || null, number_format || 'decimal', editor, req.params.id], function(this: any, errUpdate: Error | null) {
            if (errUpdate) {
                if (errUpdate.message.includes('UNIQUE constraint failed')) {
                    if (errUpdate.message.includes('projects.name')) {
                        return res.status(400).json({ error: `A project with the name "${cleanName}" already exists.` });
                    }
                    if (errUpdate.message.includes('projects.project_key')) {
                        return res.status(400).json({ error: `The project key "${finalProjectKey}" is already in use.` });
                    }
                }
                return res.status(500).json({ error: errUpdate.message });
            }
            
            const pkgsToSave = extractProjectPackages(req.body);
            const siVersToSave = extractProjectSiliconVersions(req.body, pkgsToSave);

            saveProjectHierarchy(String(req.params.id), pkgsToSave, siVersToSave, (errHierarchy) => {
                if (errHierarchy) console.error("Error saving updated project hierarchy:", errHierarchy.message);
                res.json({ updated: this.changes, name: cleanName });
            });
        });
    });
});

app.delete('/api/projects/:id', (req: Request, res: Response) => {
    if (!canDeleteProject(req as any)) {
        return res.status(403).json({ error: "You do not have permission to delete projects." });
    }
    db.get("SELECT COUNT(*) as cnt FROM pcbs WHERE project_id = ?", [req.params.id], (_errPcb: any, pcbRow: any) => {
        if (pcbRow && pcbRow.cnt > 0) {
            return res.status(400).json({ error: "Failed to delete project: project has active PCBs associated with it." });
        }
        db.run("DELETE FROM projects WHERE id = ?", [req.params.id], function(this: any, err: Error | null) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ deleted: this.changes });
        });
    });
});

// --- Project Docs API ---
app.get('/api/projects/:id/docs', (req: Request, res: Response) => {
    const projectId = req.params.id;
    db.all("SELECT * FROM project_docs WHERE project_id = ? ORDER BY uploaded_at DESC", [projectId], (err: Error | null, rows: any[]) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/projects/:id/docs', upload.any(), fileSanityCheckMiddleware, (req: Request, res: Response) => {
    if (!canAddProjectDoc(req as any)) {
        return res.status(403).json({ error: "You do not have permission to add project documents." });
    }
    const projectId = req.params.id;
    db.get("SELECT name, project_key FROM projects WHERE id = ?", [projectId], (err: Error | null, project: any) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!project) return res.status(404).json({ error: "Project not found" });

        const reqFiles = req.files as Express.Multer.File[] | undefined;
        if (!reqFiles || reqFiles.length === 0) {
            return res.status(400).json({ error: "No files uploaded" });
        }

        const projectKey = project.project_key || 'PRJ';
        let processedCount = 0;
        const insertedDocs: any[] = [];
        let errorOccurred = false;

        db.serialize(() => {
            reqFiles.forEach((file) => {
                if (errorOccurred) return;
                
                const originalName = file.originalname;
                const cleanOriginal = originalName.replace(/[^a-zA-Z0-9.\-_]/g, '_');
                const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E4);
                const newFileName = `${uniqueSuffix}-${cleanOriginal}`;
                
                const oldPath = path.join(__dirname, 'docs', file.filename);
                const targetDir = path.join(__dirname, 'docs', projectKey);
                if (!fs.existsSync(targetDir)) {
                    fs.mkdirSync(targetDir, { recursive: true });
                }
                const newPath = path.join(targetDir, newFileName);
                
                try {
                    if (fs.existsSync(oldPath)) {
                        fs.renameSync(oldPath, newPath);
                        lockFileExecution(newPath);
                        const relativePath = `/docs/${projectKey}/${newFileName}`;
                        
                        db.run(
                            "INSERT INTO project_docs (project_id, filename, path) VALUES (?, ?, ?)",
                            [projectId, originalName, relativePath],
                            function(this: any, insertErr: Error | null) {
                                if (insertErr) {
                                    errorOccurred = true;
                                    return res.status(500).json({ error: insertErr.message });
                                }
                                insertedDocs.push({
                                    id: this.lastID,
                                    project_id: parseInt(projectId as string),
                                    filename: originalName,
                                    path: relativePath,
                                    uploaded_at: new Date().toISOString()
                                });

                                // Record in uploaded_docs
                                const docType = originalName.toLowerCase().endsWith('.brd') ? 'board_file'
                                              : originalName.toLowerCase().endsWith('.csv') ? 'bom_csv'
                                              : originalName.toLowerCase().includes('datasheet') ? 'datasheet'
                                              : originalName.toLowerCase().endsWith('.pdf') ? 'schematic'
                                              : 'other';
                                const mimeType = file.mimetype || (docType === 'board_file' ? 'application/octet-stream' : docType === 'bom_csv' ? 'text/csv' : 'application/pdf');
                                const editor = req.headers['x-user-username'] || 'guest';
                                db.run(
                                    "INSERT INTO uploaded_docs (entity_type, entity_id, project_id, doc_type, filename, original_filename, path, file_size, mime_type, uploaded_by) VALUES ('project', ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                                    [projectId, projectId, docType, originalName, originalName, relativePath, file.size || 0, mimeType, editor]
                                );
                                
                                processedCount++;
                                if (processedCount === reqFiles.length && !errorOccurred) {
                                    res.status(201).json(insertedDocs);
                                }
                            }
                        );
                    } else {
                        throw new Error("Uploaded file not found on disk");
                    }
                } catch (renameErr: any) {
                    errorOccurred = true;
                    return res.status(500).json({ error: renameErr.message });
                }
            });
        });
    });
});

app.delete('/api/projects/:projectId/docs/:docId', (req: Request, res: Response) => {
    if (!canDeleteProjectDoc(req as any)) {
        return res.status(403).json({ error: "You do not have permission to delete project documents." });
    }
    const { projectId, docId } = req.params;
    db.get("SELECT * FROM project_docs WHERE id = ? AND project_id = ?", [docId, projectId], (err: Error | null, row: any) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: "Document not found" });

        const filePath = path.join(__dirname, row.path.replace(/^\//, ''));
        db.run("DELETE FROM project_docs WHERE id = ?", [docId], function(this: any, deleteErr: Error | null) {
            if (deleteErr) return res.status(500).json({ error: deleteErr.message });

            // Also remove from uploaded_docs
            db.run("DELETE FROM uploaded_docs WHERE entity_type = 'project' AND project_id = ? AND (path = ? OR filename = ?)", [projectId, row.path, row.filename]);

            try {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            } catch (unlinkErr) {
                console.error("Failed to delete physical document file:", unlinkErr);
            }

            res.json({ message: "Document deleted successfully" });
        });
    });
});

// --- Uploaded Docs Unified API ---
app.get('/api/uploaded-docs', (req: Request, res: Response) => {
    const { entity_type, entity_id, project_id, pcb_id, doc_type, search } = req.query;
    let query = `
        SELECT ud.*, 
               p.name as project_name, 
               p.project_key,
               pcb.board_number as pcb_board_number,
               pcb.crc as pcb_crc,
               rw.rework_number as rework_number,
               rw.title as rework_title
        FROM uploaded_docs ud
        LEFT JOIN projects p ON ud.project_id = p.id
        LEFT JOIN pcbs pcb ON ud.pcb_id = pcb.id
        LEFT JOIN reworks rw ON ud.entity_type = 'rework' AND ud.entity_id = rw.id
        WHERE 1=1
    `;
    const params: any[] = [];

    if (entity_type) {
        query += " AND ud.entity_type = ?";
        params.push(entity_type);
    }
    if (entity_id) {
        query += " AND ud.entity_id = ?";
        params.push(entity_id);
    }
    if (project_id) {
        query += " AND ud.project_id = ?";
        params.push(project_id);
    }
    if (pcb_id) {
        query += " AND ud.pcb_id = ?";
        params.push(pcb_id);
    }
    if (doc_type) {
        query += " AND ud.doc_type = ?";
        params.push(doc_type);
    }
    if (search) {
        query += " AND (ud.filename LIKE ? OR ud.original_filename LIKE ?)";
        params.push(`%${search}%`, `%${search}%`);
    }

    query += " ORDER BY ud.uploaded_at DESC";

    db.all(query, params, (err: Error | null, rows: any[]) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows || []);
    });
});

app.get('/api/uploaded-docs/summary', (req: Request, res: Response) => {
    const { project_id, pcb_id } = req.query;
    let whereClause = "WHERE 1=1";
    const params: any[] = [];
    if (project_id) {
        whereClause += " AND project_id = ?";
        params.push(project_id);
    }
    if (pcb_id) {
        whereClause += " AND pcb_id = ?";
        params.push(pcb_id);
    }

    db.all(
        `SELECT doc_type, COUNT(*) as count FROM uploaded_docs ${whereClause} GROUP BY doc_type`,
        params,
        (err: Error | null, rows: any[]) => {
            if (err) return res.status(500).json({ error: err.message });
            const counts: Record<string, number> = {
                picture: 0,
                schematic: 0,
                board_file: 0,
                bom_csv: 0,
                datasheet: 0,
                other: 0,
                total: 0
            };
            (rows || []).forEach((r: any) => {
                counts[r.doc_type] = r.count;
                counts.total += r.count;
            });
            res.json(counts);
        }
    );
});

app.delete('/api/uploaded-docs/:id', (req: Request, res: Response) => {
    if (!canDeleteProjectDoc(req as any)) {
        return res.status(403).json({ error: "You do not have permission to delete documents." });
    }
    const docId = req.params.id;
    db.get("SELECT * FROM uploaded_docs WHERE id = ?", [docId], (err: Error | null, row: any) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: "Document not found" });

        const filePath = path.join(__dirname, row.path.replace(/^\//, ''));
        db.run("DELETE FROM uploaded_docs WHERE id = ?", [docId], function(this: any, delErr: Error | null) {
            if (delErr) return res.status(500).json({ error: delErr.message });

            // If it's a project doc, also clean up from project_docs
            if (row.entity_type === 'project') {
                db.run("DELETE FROM project_docs WHERE project_id = ? AND (path = ? OR filename = ?)", [row.project_id, row.path, row.filename]);
            } else if (row.entity_type === 'revision') {
                db.run("DELETE FROM formfactor_revision_docs WHERE formfactor_revision_id = ? AND (path = ? OR filename = ?)", [row.entity_id, row.path, row.filename]);
            }

            try {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            } catch (unlinkErr) {
                console.error("Failed to delete physical file:", unlinkErr);
            }

            res.json({ message: "Document deleted successfully", deletedId: docId });
        });
    });
});


// --- PCBs API Expansions ---
app.get('/api/pcbs/:id', (req: Request, res: Response) => {
    const query = `
        SELECT pcbs.*, projects.name as project_name, projects.project_key, projects.number_format as number_format,
               owners.name as owner_name, owners.username as owner_username,
               pf.name as flavor_name_fk
        FROM pcbs
        LEFT JOIN projects ON pcbs.project_id = projects.id
        LEFT JOIN owners ON pcbs.owner_id = owners.id
        LEFT JOIN pcb_flavors pf ON pcbs.board_flavor_id = pf.id
        WHERE pcbs.id = ?
    `;
    db.get(query, [req.params.id], (err: Error | null, row: any) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: "PCB not found" });
        
        let fullBoardName = row.board_number;
        if (row.project_key && !row.board_number.toString().includes('-')) {
            let formattedNum = '';
            if (row.number_format === 'hex') {
                formattedNum = parseInt(row.board_number).toString(16).toUpperCase().padStart(4, '0');
            } else {
                formattedNum = parseInt(row.board_number).toString(10).padStart(4, '0');
            }
            let generatedCrc = '';
            if (row.number_format !== 'hex') {
                generatedCrc = generateCRC(`${row.project_key}-${formattedNum}`);
            }
            fullBoardName = `${row.project_key}-${formattedNum}${generatedCrc}`;
        }
        
        const resolvedFlavor = row.flavor_name_fk || row.board_flavor || '';
        
        res.json({
            id: row.id,
            board_number: fullBoardName,
            status: row.status,
            project: row.project_name,
            project_id: row.project_id,
            package_id: row.package_id || null,
            package_name: row.package_name || undefined,
            silicon_version_id: row.silicon_version_id || null,
            board_formfactor_id: row.board_formfactor_id || null,
            formfactor_revision_id: row.formfactor_revision_id || null,
            bom_flavor_id: row.bom_flavor_id || null,
            number_format: row.number_format || 'decimal',
            owner: row.owner_name || 'Unassigned',
            owner_username: row.owner_username || undefined,
            product: [resolvedFlavor, row.board_rev, row.silicon_rev, row.silicon_corner].filter(Boolean).join(' ') || '',
            board_flavor: resolvedFlavor,
            board_flavor_id: row.board_flavor_id || null,
            board_rev: row.board_rev || '',
            silicon_rev: row.silicon_rev || '',
            silicon_corner: row.silicon_corner || '',
            bom: row.bom,
            manufacturer_id: row.manufacturer_id || '',
            short_code: row.short_code,
            created_at: row.created_at,
            created_by: row.created_by,
            updated_by: row.updated_by
        });
    });
});

app.get('/api/pcbs/:id/tags', (req: Request, res: Response) => {
    const query = `
        SELECT tags.*, owners.username as owner_username 
        FROM tags
        JOIN pcb_tags ON tags.id = pcb_tags.tag_id
        LEFT JOIN owners ON tags.owner_id = owners.id
        WHERE pcb_tags.pcb_id = ?
    `;
    db.all(query, [req.params.id], (err: Error | null, rows: any[]) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/pcbs/:id/tags', express.json(), (req: Request, res: Response) => {
    const pcbId = req.params.id;
    const tagId = req.body.tag_id;
    if (!tagId) return res.status(400).json({ error: 'tag_id is required' });
    db.run("INSERT OR IGNORE INTO pcb_tags (pcb_id, tag_id) VALUES (?, ?)", [pcbId, tagId], function(this: any, err: Error | null) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, changes: this.changes });
    });
});

app.delete('/api/pcbs/:id/tags/:tag_id', (req: Request, res: Response) => {
    db.run("DELETE FROM pcb_tags WHERE pcb_id = ? AND tag_id = ?", [req.params.id, req.params.tag_id], function(this: any, err: Error | null) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ deleted: this.changes });
    });
});

app.put('/api/pcbs/:id', async (req: Request, res: Response) => {
    const authorized = await canUpdatePcb(req as any, parseInt(req.params.id as string));
    if (!authorized) {
        return res.status(403).json({ error: "You are not authorized to update this PCB because you do not own it." });
    }
    const { board_number, status, board_flavor, board_rev, silicon_rev, silicon_corner, bom, project_id, package_id, package_name, silicon_version_id, board_formfactor_id, formfactor_revision_id, bom_flavor_id, owner_id, manufacturer_id } = req.body;
    let numPart = board_number;
    if (board_number && board_number.includes('-')) {
        const parts = board_number.split('-');
        numPart = parts.slice(-1)[0];
        if (numPart.length > 1 && /^[a-zA-Z]$/.test(numPart.slice(-1))) {
            numPart = numPart.slice(0, -1);
        }
        let val = parseInt(numPart, 10);
        if (isNaN(val)) val = parseInt(numPart, 16);
        if (!isNaN(val)) numPart = val.toString();
    }
    const editor = req.headers['x-user-username'] || 'guest';
    const resolveFlavorId = (cb: (id: number | null) => void) => {
        if (!board_flavor || !project_id) return cb(null);
        db.get("SELECT id FROM pcb_flavors WHERE project_id = ? AND name = ? LIMIT 1", [project_id, board_flavor], (_e: Error | null, row: any) => {
            cb(row ? row.id : null);
        });
    };
    resolveFlavorId((board_flavor_id) => {
        const query = "UPDATE pcbs SET board_number = ?, status = ?, board_flavor = ?, board_flavor_id = ?, board_rev = ?, silicon_rev = ?, silicon_corner = ?, bom = ?, project_id = ?, package_id = ?, package_name = ?, silicon_version_id = ?, board_formfactor_id = ?, formfactor_revision_id = ?, bom_flavor_id = ?, owner_id = ?, manufacturer_id = ?, updated_by = ? WHERE id = ?";
        db.run(query, [numPart, status, board_flavor, board_flavor_id, board_rev, silicon_rev, silicon_corner, bom, project_id, package_id || null, package_name || null, silicon_version_id || null, board_formfactor_id || null, formfactor_revision_id || null, bom_flavor_id || null, owner_id, manufacturer_id || null, editor, req.params.id], function(this: any, err: Error | null) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ updated: this.changes });
        });
    });
});

app.delete('/api/pcbs/:id', (req: Request, res: Response) => {
    if (!isSuperUser(req as any)) {
        return res.status(403).json({ error: "Only Super Users can delete PCBs." });
    }
    const pcbId = parseInt(req.params.id as string, 10);
    const checkQuery = `
        SELECT 
            created_at, 
            (SELECT COUNT(*) FROM reworks WHERE pcb_id = pcbs.id) as rework_count 
        FROM pcbs 
        WHERE id = ?
    `;
    db.get(checkQuery, [pcbId], (err: Error | null, row: any) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: "PCB not found" });

        if (row.rework_count > 0) {
            return res.status(400).json({ error: "Cannot delete PCB because it has rework logs attached." });
        }

        let daysDiff = 999; // Default to blocked if no created_at
        if (row.created_at) {
            const dateStr = row.created_at.includes('T') ? row.created_at : row.created_at.replace(' ', 'T') + 'Z';
            const createdAt = new Date(dateStr);
            if (!isNaN(createdAt.getTime())) {
                daysDiff = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
            }
        }

        if (daysDiff > 3) {
            return res.status(400).json({ error: "Cannot delete PCB because it was created more than 3 days ago." });
        }

        db.serialize(() => {
            db.run("DELETE FROM pcb_tags WHERE pcb_id = ?", [pcbId]);
            db.run("DELETE FROM pcbs WHERE id = ?", [pcbId], function(this: any, errDelete: Error | null) {
                if (errDelete) return res.status(500).json({ error: errDelete.message });
                res.json({ deleted: this.changes });
            });
        });
    });
});

// --- Owners API Expansions ---
app.get('/api/owners/:id', (req: Request, res: Response) => {
    const query = `
        SELECT 
            id,
            name,
            username,
            email,
            crc_format,
            is_super_user,
            otp_reset_token,
            otp_reset_expires,
            otp_reset_by,
            otp_reset_at,
            CASE WHEN (otp_secret IS NOT NULL AND otp_secret != '') THEN 1 ELSE 0 END AS has_otp
        FROM owners WHERE id = ?
    `;
    db.get(query, [req.params.id], (err: Error | null, row: any) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(row);
    });
});

app.put('/api/owners/:id', (req: Request, res: Response) => {
    const { name, username, email, crc_format } = req.body;
    const cleanUsername = username ? username.replace(/\s+/g, '').toLowerCase() : null;
    db.run("UPDATE owners SET name = ?, username = ?, email = ?, crc_format = ? WHERE id = ?", [name, cleanUsername, email || null, crc_format || null, req.params.id], function(this: any, err: Error | null) {
        if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
                return res.status(400).json({ error: `Username "${cleanUsername}" is already in use.` });
            }
            return res.status(500).json({ error: err.message });
        }
        res.json({ updated: this.changes });
    });
});

// --- Change User Role (Super User only) ---
app.patch('/api/owners/:id/role', (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!user || user.role !== 'Super User') {
        return res.status(403).json({ error: 'Only Super Users can change user roles.' });
    }
    const { role } = req.body;
    if (!role || !['Super User', 'User'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role. Must be "Super User" or "User".' });
    }

    // Enforce: must always have at least one Super User
    if (role === 'User') {
        db.get("SELECT COUNT(*) as cnt FROM owners WHERE is_super_user = 1", [], (err: Error | null, row: any) => {
            if (err) return res.status(500).json({ error: err.message });
            if (row && row.cnt <= 1) {
                return res.status(400).json({ error: 'Cannot demote: there must always be at least one Super User.' });
            }
            const isSuperUserValue = 0;
            db.run("UPDATE owners SET is_super_user = ? WHERE id = ?", [isSuperUserValue, req.params.id], function(this: any, err: Error | null) {
                if (err) return res.status(500).json({ error: err.message });
                if (this.changes === 0) return res.status(404).json({ error: 'Owner not found.' });
                res.json({ success: true, role });
            });
        });
    } else {
        db.run("UPDATE owners SET is_super_user = 1 WHERE id = ?", [req.params.id], function(this: any, err: Error | null) {
            if (err) return res.status(500).json({ error: err.message });
            if (this.changes === 0) return res.status(404).json({ error: 'Owner not found.' });
            res.json({ success: true, role });
        });
    }
});

app.delete('/api/owners/:id', (req: Request, res: Response) => {
    const ownerId = req.params.id;
    // Automatically detach the owner from all dependencies to bypass Foreign Key constraint restrictions safely
    db.serialize(() => {
        db.run("UPDATE pcbs SET owner_id = NULL WHERE owner_id = ?", [ownerId]);
        db.run("UPDATE reworks SET owner_id = NULL WHERE owner_id = ?", [ownerId]);
        db.run("UPDATE tags SET owner_id = NULL WHERE owner_id = ?", [ownerId]);

        db.run("DELETE FROM owners WHERE id = ?", [ownerId], function(this: any, err: Error | null) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ deleted: this.changes });
        });
    });
});

// --- OTP Reset Management (Super User Audit Logged) ---
app.post('/api/owners/:id/reset-otp', (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!user || user.role !== 'Super User') {
        return res.status(403).json({ error: 'Only Super Users can initiate an OTP reset.' });
    }

    const ownerId = req.params.id;
    const token = crypto.randomBytes(32).toString('hex');
    const expires = Date.now() + 15 * 60 * 1000; // 15 mins
    const superuser = req.headers['x-user-username'] || 'admin';
    const resetAt = new Date().toISOString();

    db.run(
        `UPDATE owners SET 
            otp_reset_token = ?, 
            otp_reset_expires = ?, 
            otp_reset_by = ?, 
            otp_reset_at = ?
         WHERE id = ?`,
        [token, expires, superuser, resetAt, ownerId],
        function(this: any, err: Error | null) {
            if (err) return res.status(500).json({ error: err.message });
            if (this.changes === 0) return res.status(404).json({ error: 'Owner not found.' });

            const resetLink = `/reset-otp?token=${token}`;
            res.json({ success: true, resetLink, token });
        }
    );
});

app.get('/api/otp/reset-info', (req: Request, res: Response) => {
    const { token } = req.query;
    if (!token) return res.status(400).json({ error: 'Token is required.' });

    db.get(
        "SELECT id, name, username, otp_reset_expires FROM owners WHERE otp_reset_token = ?",
        [token],
        (err: Error | null, row: any) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!row) return res.status(404).json({ error: 'Reset link is invalid or expired.' });

            if (row.otp_reset_expires < Date.now()) {
                return res.status(400).json({ error: 'Reset link has expired.' });
            }

            res.json({ valid: true, owner: { id: row.id, name: row.name, username: row.username } });
        }
    );
});

app.post('/api/otp/reset-confirm', (req: Request, res: Response) => {
    const { token, secret, code } = req.body;
    if (!token || !secret || !code) {
        return res.status(400).json({ error: 'Token, secret, and code are required.' });
    }

    db.get(
        "SELECT id, otp_reset_expires FROM owners WHERE otp_reset_token = ?",
        [token],
        (err: Error | null, row: any) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!row) return res.status(404).json({ error: 'Reset token is invalid or expired.' });

            if (row.otp_reset_expires < Date.now()) {
                return res.status(400).json({ error: 'Reset token has expired.' });
            }

            try {
                const isValid = verifyTotp(secret, code);
                if (!isValid) {
                    return res.status(400).json({ error: 'Invalid verification code.' });
                }

                db.run(
                    `UPDATE owners SET 
                        otp_secret = ?,
                        otp_reset_token = NULL,
                        otp_reset_expires = NULL
                     WHERE id = ?`,
                    [secret, row.id],
                    function(updateErr: Error | null) {
                        if (updateErr) return res.status(500).json({ error: updateErr.message });
                        res.json({ success: true });
                    }
                );
            } catch (totpErr: any) {
                res.status(400).json({ error: totpErr.message });
            }
        }
    );
});

// --- Tags API Expansions ---
app.get('/api/tags/:id', (req: Request, res: Response) => {
    db.get("SELECT * FROM tags WHERE id = ?", [req.params.id], (err: Error | null, row: any) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(row);
    });
});

app.get('/api/tags/:id/pcbs', (req: Request, res: Response) => {
    const query = `
        SELECT pcbs.*, projects.project_key 
        FROM pcbs 
        JOIN pcb_tags ON pcbs.id = pcb_tags.pcb_id 
        LEFT JOIN projects ON pcbs.project_id = projects.id
        WHERE pcb_tags.tag_id = ?
    `;
    db.all(query, [req.params.id], (err: Error | null, rows: any[]) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.put('/api/tags/:id', (req: Request, res: Response) => {
    if (!isSuperUser(req as any)) {
        return res.status(403).json({ error: "Only Super Users can update tags." });
    }
    const { name, color, owner_id, type } = req.body;
    const finalOwnerId = owner_id && owner_id !== '-1' && owner_id !== 'null' ? parseInt(owner_id) : null;
    db.run("UPDATE tags SET name = ?, color = ?, owner_id = ?, type = ? WHERE id = ?", [name, color, finalOwnerId, type || 'public', req.params.id], function(this: any, err: Error | null) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ updated: this.changes });
    });
});

app.delete('/api/tags/:id', (req: Request, res: Response) => {
    if (!isSuperUser(req as any)) {
        return res.status(403).json({ error: "Only Super Users can delete tags." });
    }
    db.run("DELETE FROM tags WHERE id = ?", [req.params.id], function(this: any, err: Error | null) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ deleted: this.changes });
    });
});

// --- Reworks API Expansions ---
app.get('/api/reworks/:id', (req: Request, res: Response) => {
    db.get("SELECT * FROM reworks WHERE id = ?", [req.params.id], (err: Error | null, row: any) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(row);
    });
});

app.put('/api/reworks/:id', async (req: Request, res: Response) => {
    const reworkId = parseInt(req.params.id as string, 10);
    const authorized = await canUpdateRework(req as any, reworkId);
    if (!authorized) {
        return res.status(403).json({ error: "You are not authorized to update this rework log because you do not own it." });
    }
    const { pcb_id, title, description, owner_id, rework_type, new_product } = req.body;
    const finalOwnerId = owner_id && owner_id !== '-1' && owner_id !== 'null' ? parseInt(owner_id) : null;

    db.get("SELECT * FROM reworks WHERE id = ?", [reworkId], (err: Error | null, rework: any) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!rework) return res.status(404).json({ error: "Rework log not found." });

        const timestamp = rework.timestamp;
        const timestampDate = new Date(timestamp ? (timestamp.includes('T') ? timestamp : timestamp.replace(' ', 'T') + 'Z') : Date.now());
        const daysDiff = (Date.now() - timestampDate.getTime()) / (1000 * 60 * 60 * 24);
        if (daysDiff > 14) {
            return res.status(400).json({ error: "Rework log is older than 2 weeks and cannot be edited." });
        }

        const editor = req.headers['x-user-username'] || 'guest';
        db.run("UPDATE reworks SET pcb_id = ?, title = ?, description = ?, owner_id = ?, rework_type = ?, updated_by = ? WHERE id = ?", [pcb_id, title || null, description, finalOwnerId, rework_type || 'Minor', editor, reworkId], function(this: any, errUpdate: Error | null) {
            if (errUpdate) return res.status(500).json({ error: errUpdate.message });
            
            let changes = this.changes;
            if (rework_type === 'Silicon Swap' && new_product) {
                db.run("UPDATE pcbs SET product_name_and_rev = ? WHERE id = ?", [new_product, pcb_id], function(_updateErr: Error | null) {
                    return res.json({ updated: changes });
                });
            } else {
                res.json({ updated: changes });
            }
        });
    });
});

app.delete('/api/reworks/:id', async (req: Request, res: Response) => {
    const reworkId = parseInt(req.params.id as string, 10);
    const authorized = await canUpdateRework(req as any, reworkId);
    if (!authorized) {
        return res.status(403).json({ error: "You are not authorized to delete this rework log because you do not own it." });
    }
    
    db.get("SELECT * FROM reworks WHERE id = ?", [reworkId], (err: Error | null, rework: any) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!rework) return res.status(404).json({ error: "Rework not found" });

        db.get("SELECT COUNT(*) as newer_count FROM reworks WHERE pcb_id = ? AND id > ?", [rework.pcb_id, reworkId], (errRow: Error | null, row: any) => {
            if (errRow) return res.status(500).json({ error: errRow.message });
            if (row && row.newer_count > 0) {
                return res.status(400).json({ error: "Cannot delete rework because there are newer rework logs after it on this board." });
            }

            let daysDiff = 999;
            if (rework.timestamp) {
                const dateStr = rework.timestamp.includes('T') ? rework.timestamp : rework.timestamp.replace(' ', 'T') + 'Z';
                const timestampDate = new Date(dateStr);
                if (!isNaN(timestampDate.getTime())) {
                    daysDiff = (Date.now() - timestampDate.getTime()) / (1000 * 60 * 60 * 24);
                }
            }

            if (daysDiff > 3) {
                return res.status(400).json({ error: "Cannot delete rework because it was created more than 3 days ago." });
            }

            db.run("DELETE FROM reworks WHERE id = ?", [reworkId], function(this: any, errDelete: Error | null) {
                if (errDelete) return res.status(500).json({ error: errDelete.message });
                
                // Clean up rework images from uploaded_docs and disk
                db.all("SELECT path FROM uploaded_docs WHERE entity_type = 'rework' AND entity_id = ?", [reworkId], (_eDoc: any, docRows: any[]) => {
                    if (docRows && docRows.length > 0) {
                        docRows.forEach((d: any) => {
                            try {
                                const diskPath = path.join(__dirname, d.path.replace(/^\//, ''));
                                if (fs.existsSync(diskPath)) fs.unlinkSync(diskPath);
                            } catch {}
                        });
                    }
                    db.run("DELETE FROM uploaded_docs WHERE entity_type = 'rework' AND entity_id = ?", [reworkId]);
                });

                res.json({ deleted: this.changes });
            });
        });
    });
});

app.post('/api/test/cleanup', (_req: Request, res: Response) => {
    db.serialize(() => {
        db.run('PRAGMA foreign_keys = OFF');
        
        // 1. Delete pcb_tags of test pcbs
        db.run(`
            DELETE FROM pcb_tags 
            WHERE pcb_id IN (
                SELECT id FROM pcbs 
                WHERE board_number LIKE '%vitest%' 
                   OR project_id IN (SELECT id FROM projects WHERE name LIKE '%vitest%' OR name LIKE '%Test Project%' OR project_key IN ('VTT', 'VVV', 'DIO', 'TPR'))
            )
        `);

        // 2. Delete reworks of test pcbs or test owners
        db.run(`
            DELETE FROM reworks 
            WHERE pcb_id IN (
                SELECT id FROM pcbs 
                WHERE board_number LIKE '%vitest%' 
                   OR project_id IN (SELECT id FROM projects WHERE name LIKE '%vitest%' OR name LIKE '%Test Project%' OR project_key IN ('VTT', 'VVV', 'DIO', 'TPR'))
            )
            OR owner_id IN (SELECT id FROM owners WHERE name LIKE '%vitest%' OR username LIKE '%vitest%')
            OR description LIKE '%Vitest%'
            OR title LIKE '%Silicon Swap to B0%'
        `);

        // 3. Delete pcbs
        db.run(`
            DELETE FROM pcbs 
            WHERE board_number LIKE '%vitest%' 
               OR project_id IN (SELECT id FROM projects WHERE name LIKE '%vitest%' OR name LIKE '%Test Project%' OR project_key IN ('VTT', 'VVV', 'DIO', 'TPR'))
               OR owner_id IN (SELECT id FROM owners WHERE name LIKE '%vitest%' OR username LIKE '%vitest%')
        `);

        // 4. Delete pcb_flavors
        db.run(`
            DELETE FROM pcb_flavors 
            WHERE project_id IN (SELECT id FROM projects WHERE name LIKE '%vitest%' OR name LIKE '%Test Project%' OR project_key IN ('VTT', 'VVV', 'DIO', 'TPR'))
        `);

        // 5. Delete projects
        db.run(`
            DELETE FROM projects 
            WHERE name LIKE '%vitest%' 
               OR name LIKE '%Test Project%' 
               OR project_key IN ('VTT', 'VVV', 'DIO', 'TPR')
        `);

        // 6. Delete tags
        db.run(`
            DELETE FROM tags 
            WHERE name LIKE '%vitest%' 
               OR name LIKE '%test%' 
               OR owner_id IN (SELECT id FROM owners WHERE name LIKE '%vitest%' OR username LIKE '%vitest%')
        `);

        // 7. Delete owners
        db.run(`
            DELETE FROM owners 
            WHERE name LIKE '%vitest%' 
               OR username LIKE '%vitest%'
        `);

        db.run('PRAGMA foreign_keys = ON', (err: Error | null) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: "Test data successfully cleaned up" });
        });
    });
});

app.get('/api/settings', (_req: Request, res: Response) => {
    db.all("SELECT * FROM global_settings", [], (err: Error | null, rows: any[]) => {
        if (err) return res.status(500).json({ error: err.message });
        const settings: any = {};
        rows.forEach(r => {
            settings[r.key] = r.value;
        });
        res.json(settings);
    });
});

app.post('/api/settings', (req: Request, res: Response) => {
    const user = (req as any).user;
    if (!user || user.role !== 'Super User') {
        return res.status(403).json({ error: 'Only Super Users can modify settings.' });
    }

    const updates = req.body;
    db.serialize(() => {
        const stmt = db.prepare("INSERT OR REPLACE INTO global_settings (key, value) VALUES (?, ?)");
        Object.keys(updates).forEach(key => {
            stmt.run(key, String(updates[key]));
        });
        stmt.finalize(() => {
            res.json({ success: true });
        });
    });
});

// --- DB Settings, Backup & Test Mode Endpoints ---
const defaultBackupPath = path.resolve(__dirname, 'backups');

function getBackupList(dirPath: string) {
    const targetDir = dirPath || defaultBackupPath;
    if (!fs.existsSync(targetDir)) return [];
    try {
        const files = fs.readdirSync(targetDir);
        return files
            .filter(f => f.endsWith('.db') || f.endsWith('.sqlite'))
            .map(f => {
                const fullPath = path.join(targetDir, f);
                const stat = fs.statSync(fullPath);
                return {
                    filename: f,
                    path: fullPath,
                    size: stat.size,
                    createdAt: stat.mtime ? stat.mtime.toISOString() : stat.birthtime.toISOString()
                };
            })
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch {
        return [];
    }
}

function performDatabaseBackup(customPath: string | undefined, callback: (err: Error | null, info?: any) => void) {
    const targetDir = customPath || defaultBackupPath;
    const activeDbPath = getDbPath();
    try {
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `pcb_tracker_backup_${timestamp}.db`;
        const destPath = path.join(targetDir, filename);

        if (!fs.existsSync(activeDbPath)) {
            return callback(new Error("Active database file does not exist."));
        }

        fs.copyFileSync(activeDbPath, destPath);
        const stat = fs.statSync(destPath);
        callback(null, {
            filename,
            path: destPath,
            size: stat.size,
            createdAt: stat.mtime ? stat.mtime.toISOString() : new Date().toISOString()
        });
    } catch (err: any) {
        callback(err);
    }
}

async function seedDemoDatabase(): Promise<void> {
    const demoDataPath = path.resolve(__dirname, 'data', 'demoData.json');
    if (!fs.existsSync(demoDataPath)) {
        throw new Error("demoData.json file not found.");
    }
    const demoJson = JSON.parse(fs.readFileSync(demoDataPath, 'utf8'));
    const { demoProjects = [], demoOwners = [], demoTags = [], demoPcbs = [], demoPcbTags = {}, demoReworks = [] } = demoJson;

    const runAsync = (sql: string, params: any[] = []): Promise<any> => {
        return new Promise((resolve, reject) => {
            db.run(sql, params, function(this: any, err: Error | null) {
                if (err) return reject(err);
                resolve(this);
            });
        });
    };

    await runAsync('PRAGMA foreign_keys = OFF');

    await runAsync('DELETE FROM reworks');
    await runAsync('DELETE FROM pcb_tags');
    await runAsync('DELETE FROM pcbs');
    await runAsync('DELETE FROM formfactor_revision_docs');
    await runAsync('DELETE FROM bom_flavors');
    await runAsync('DELETE FROM board_formfactor_revisions');
    await runAsync('DELETE FROM board_formfactors');
    await runAsync('DELETE FROM silicon_corners');
    await runAsync('DELETE FROM silicon_versions');
    await runAsync('DELETE FROM packages');
    await runAsync('DELETE FROM project_docs');
    await runAsync('DELETE FROM pcb_flavors');
    await runAsync('DELETE FROM projects');
    await runAsync('DELETE FROM tags');
    await runAsync('DELETE FROM owners');

    // 1. Insert demo owners
    for (let i = 0; i < demoOwners.length; i++) {
        const o = demoOwners[i];
        const isSuper = i === 0 || o.username === 'admin' || o.username === 'asmith' ? 1 : 0;
        await runAsync("INSERT OR REPLACE INTO owners (id, name, username, is_super_user) VALUES (?, ?, ?, ?)", [o.id, o.name, o.username, isSuper]);
    }
    await runAsync("INSERT OR IGNORE INTO owners (id, name, username, is_super_user) VALUES (999, 'Super Admin', 'admin', 1)");

    // 2. Insert demo tags
    for (const t of demoTags) {
        await runAsync("INSERT OR REPLACE INTO tags (id, name, color, owner_id, type) VALUES (?, ?, ?, ?, ?)", [t.id, t.name, t.color || '#818cf8', t.owner_id || 1, t.type || 'public']);
    }

    // 3. Insert demo projects with packages hierarchy
    for (const p of demoProjects) {
        const cleanName = p.name;
        const finalKey = p.project_key || 'PRJ';
        const creator = 'admin';
        await runAsync(
            "INSERT OR REPLACE INTO projects (id, name, description, revisions, project_key, silicon_corners, number_format, created_by, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [p.id, cleanName, p.description || '', Array.isArray(p.revisions) ? p.revisions.join(', ') : (p.revisions || ''), finalKey, p.silicon_corners || null, p.number_format || 'decimal', creator, creator]
        );

        const pkgs = extractProjectPackages(p);
        const siVers = extractProjectSiliconVersions(p, pkgs);

        await new Promise<void>((resolve, reject) => {
            saveProjectHierarchy(p.id, pkgs, siVers, (err) => {
                if (err) return reject(err);
                resolve();
            });
        });
    }

    // 4. Insert demo PCBs
    for (const pcb of demoPcbs) {
        await runAsync(`
            INSERT OR REPLACE INTO pcbs (
                id, board_number, status, project_id, owner_id, 
                board_flavor, board_rev, silicon_rev, silicon_corner, bom, short_code, manufacturer_id, created_by, updated_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'admin', 'admin')
        `, [
            pcb.id,
            pcb.board_number,
            pcb.status || 'In Progress',
            pcb.project_id || null,
            pcb.owner_id || null,
            pcb.board_flavor || '',
            pcb.board_rev || '',
            pcb.silicon_rev || '',
            pcb.silicon_corner || '',
            pcb.bom || '',
            pcb.short_code || null,
            pcb.manufacturer_id || null
        ]);
    }

    // 5. Insert demo PCB tags
    for (const [pcbId, tagIds] of Object.entries(demoPcbTags)) {
        if (Array.isArray(tagIds)) {
            for (const tId of tagIds) {
                await runAsync("INSERT OR IGNORE INTO pcb_tags (pcb_id, tag_id) VALUES (?, ?)", [parseInt(pcbId), tId]);
            }
        }
    }

    // 6. Insert demo reworks
    for (const rw of demoReworks) {
        await runAsync(`
            INSERT OR REPLACE INTO reworks (
                id, pcb_id, title, rework_number, description, rework_type, status, owner_id, timestamp, image_path, created_by, updated_by
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'admin', 'admin')
        `, [
            rw.id,
            rw.pcb_id,
            rw.title || rw.description || `Rework ${rw.rework_number || 1}`,
            rw.rework_number || 1,
            rw.description || 'Rework description',
            rw.rework_type || 'Minor',
            rw.status || 'Completed',
            rw.owner_id || 1,
            rw.timestamp || new Date().toISOString(),
            rw.image_path || null
        ]);
    }

    await runAsync("INSERT OR REPLACE INTO global_settings (key, value) VALUES ('db_mode', 'demo')");
    await runAsync('PRAGMA foreign_keys = ON');
}

async function clearToEmptyDatabase(): Promise<void> {
    const runAsync = (sql: string, params: any[] = []): Promise<any> => {
        return new Promise((resolve, reject) => {
            db.run(sql, params, function(this: any, err: Error | null) {
                if (err) return reject(err);
                resolve(this);
            });
        });
    };

    await runAsync('PRAGMA foreign_keys = OFF');

    await runAsync('DELETE FROM reworks');
    await runAsync('DELETE FROM pcb_tags');
    await runAsync('DELETE FROM pcbs');
    await runAsync('DELETE FROM formfactor_revision_docs');
    await runAsync('DELETE FROM bom_flavors');
    await runAsync('DELETE FROM board_formfactor_revisions');
    await runAsync('DELETE FROM board_formfactors');
    await runAsync('DELETE FROM silicon_corners');
    await runAsync('DELETE FROM silicon_versions');
    await runAsync('DELETE FROM packages');
    await runAsync('DELETE FROM project_docs');
    await runAsync('DELETE FROM pcb_flavors');
    await runAsync('DELETE FROM projects');
    await runAsync('DELETE FROM tags');

    const adminCheck: any = await new Promise((resolve) => {
        db.get("SELECT COUNT(*) as cnt FROM owners WHERE username = 'admin' OR is_super_user = 1", [], (_err: Error | null, row: any) => resolve(row));
    });

    if (!adminCheck || adminCheck.cnt === 0) {
        await runAsync("INSERT OR REPLACE INTO owners (id, name, username, is_super_user) VALUES (1, 'Super Admin', 'admin', 1)");
    }

    await runAsync("INSERT OR REPLACE INTO global_settings (key, value) VALUES ('db_mode', 'empty')");
    await runAsync('PRAGMA foreign_keys = ON');
}

app.get('/api/db/settings', (_req: Request, res: Response) => {
    db.all("SELECT * FROM global_settings WHERE key IN ('db_backup_path', 'db_mode')", [], (err: Error | null, rows: any[]) => {
        if (err) return res.status(500).json({ error: err.message });
        const settings: Record<string, string> = {};
        rows.forEach(r => { settings[r.key] = r.value; });

        const currentBackupPath = settings['db_backup_path'] || defaultBackupPath;
        const currentMode = settings['db_mode'] || 'production';
        const backups = getBackupList(currentBackupPath);

        res.json({
            backup_path: currentBackupPath,
            default_backup_path: defaultBackupPath,
            current_mode: currentMode,
            backups
        });
    });
});

app.post('/api/db/settings', (req: Request, res: Response) => {
    if (!isSuperUser(req as any)) {
        return res.status(403).json({ error: 'Only Super Users can modify DB settings.' });
    }
    const { backup_path } = req.body;
    if (backup_path) {
        db.run("INSERT OR REPLACE INTO global_settings (key, value) VALUES ('db_backup_path', ?)", [String(backup_path).trim()], (err: Error | null) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ success: true, backup_path: String(backup_path).trim() });
        });
    } else {
        res.status(400).json({ error: 'backup_path is required' });
    }
});

app.post('/api/db/backup', (req: Request, res: Response) => {
    if (!isSuperUser(req as any)) {
        return res.status(403).json({ error: 'Only Super Users can create database backups.' });
    }

    db.get("SELECT value FROM global_settings WHERE key = 'db_backup_path'", [], (_err: Error | null, row: any) => {
        const targetPath = req.body.backup_path || (row ? row.value : null) || defaultBackupPath;
        performDatabaseBackup(targetPath, (errBackup: Error | null, info: any) => {
            if (errBackup) {
                return res.status(500).json({ error: errBackup.message });
            }
            res.json({ success: true, backup: info });
        });
    });
});

app.post('/api/db/mode', async (req: Request, res: Response) => {
    if (!isSuperUser(req as any)) {
        return res.status(403).json({ error: 'Only Super Users can change database mode.' });
    }

    const { mode } = req.body;
    if (!['production', 'demo', 'empty'].includes(mode)) {
        return res.status(400).json({ error: "Invalid database mode. Must be 'production', 'demo', or 'empty'." });
    }

    // First take a safety snapshot before modifying dataset
    performDatabaseBackup(undefined, async (errSnap) => {
        if (errSnap) {
            console.warn("Safety snapshot before DB mode switch failed:", errSnap.message);
        }

        try {
            if (mode === 'demo') {
                await seedDemoDatabase();
                return res.json({ success: true, mode: 'demo', message: 'Database successfully seeded with demo dataset.' });
            } else if (mode === 'empty') {
                await clearToEmptyDatabase();
                return res.json({ success: true, mode: 'empty', message: 'Database successfully cleared to an empty state.' });
            } else {
                db.run("INSERT OR REPLACE INTO global_settings (key, value) VALUES ('db_mode', 'production')", [], (errProd: Error | null) => {
                    if (errProd) return res.status(500).json({ error: errProd.message });
                    return res.json({ success: true, mode: 'production', message: 'Database mode set to production.' });
                });
            }
        } catch (errMode: any) {
            console.error("Error setting database mode:", errMode);
            return res.status(500).json({ error: errMode.message });
        }
    });
});
