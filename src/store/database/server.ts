import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { db, initDb } from './db.js';
import { apiLoggerMiddleware } from './logger.js';
import { loginRouter } from '../../login/server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 5002;

// Configure Multer Storage
const storage = multer.diskStorage({
    destination: function (_req, _file, cb) {
        const dir = path.join(__dirname, '../../../pictures');
        if (!fs.existsSync(dir)){
            fs.mkdirSync(dir);
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
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));
app.use((_req: Request, res: Response, next: NextFunction) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    next();
});
app.use(apiLoggerMiddleware as any);

// --- Request Deduplication & Serialization Middlewares ---
interface PendingRequest {
    listeners: Array<(res: { statusCode: number; headers: any; body: any }) => void>;
    response: { statusCode: number; headers: any; body: any } | null;
}

const inFlightRequests = new Map<string, PendingRequest>();

function deduplicate(req: any, res: Response, next: NextFunction): void {
    if (req.method === 'GET' || req.method === 'DELETE') {
        return next();
    }
    
    // Prevent double execution if registered both globally and locally
    if (req._deduplicated) {
        return next();
    }
    req._deduplicated = true;

    const fileSignature = (req.files || []).map((f: any) => `${f.originalname}-${f.size}`).join(',');
    const bodyKey = JSON.stringify(req.body || {});
    const key = `${req.method}:${req.originalUrl}:${bodyKey}:${fileSignature}`;

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

    const pending: PendingRequest = {
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
    };

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

function serializeWrites(req: any, res: Response, next: NextFunction): void {
    if (req.method === 'GET') {
        return next();
    }
    
    // Prevent double execution if registered both globally and locally
    if (req._serialized) {
        return next();
    }
    req._serialized = true;

    writeQueue = writeQueue.then(() => {
        return new Promise<void>((resolve) => {
            let resolved = false;
            const release = () => {
                if (!resolved) {
                    resolved = true;
                    resolve();
                }
            };

            const timeoutId = setTimeout(release, 10000); // 10s safety fallback

            res.on('finish', () => {
                clearTimeout(timeoutId);
                release();
            });
            res.on('close', () => {
                clearTimeout(timeoutId);
                release();
            });

            next();
        });
    });
}

// Apply deduplication to all JSON write operations first
app.use((req: Request, res: Response, next: NextFunction) => {
    const isMultipart = req.headers['content-type'] && req.headers['content-type'].startsWith('multipart/form-data');
    if (isMultipart) {
        return next();
    }
    deduplicate(req, res, next);
});

// Apply serialization to JSON write operations second
app.use((req: Request, res: Response, next: NextFunction) => {
    const isMultipart = req.headers['content-type'] && req.headers['content-type'].startsWith('multipart/form-data');
    if (isMultipart) {
        return next();
    }
    serializeWrites(req, res, next);
});

app.use('/api/pictures', express.static(path.join(__dirname, '../../../pictures')));
app.use('/api/auth', loginRouter);

// Initialize Database
initDb().then(() => {

// Migration: Split product_name_and_rev into board_flavor, board_rev, silicon_rev, silicon_corner
db.all("SELECT id, product_name_and_rev, project_id FROM pcbs WHERE product_name_and_rev IS NOT NULL AND board_flavor IS NULL", [], (err: any, pcbs: any[]) => {
    if (!err && pcbs && pcbs.length > 0) {
        db.all("SELECT id, formfactors, silicon_corners FROM projects", [], (err: any, projects: any[]) => {
            if (err || !projects) return;
            pcbs.forEach(pcb => {
                const project = projects.find(p => p.id === pcb.project_id);
                let rawProduct = pcb.product_name_and_rev || '';
                let foundFormfactor = '';
                let foundSilicon = '';

                if (project) {
                    if (project.silicon_corners) {
                        let parsedCorners: string[] = [];
                        try { parsedCorners = typeof project.silicon_corners === 'string' ? project.silicon_corners.split(',').map((s: string) => s.trim()).filter(Boolean) : []; } catch(e){}
                        for (const corner of parsedCorners) {
                            if (rawProduct.endsWith(` ${corner}`) || rawProduct === corner) {
                                foundSilicon = corner;
                                rawProduct = rawProduct.slice(0, rawProduct.length - corner.length).trim();
                                break;
                            }
                        }
                    }

                    if (project.formfactors) {
                        let parsedFF: any[] = [];
                        try { parsedFF = JSON.parse(project.formfactors); } catch(e){}
                        for (const ff of parsedFF) {
                            if (rawProduct.startsWith(ff.name)) {
                                foundFormfactor = ff.name;
                                rawProduct = rawProduct.slice(ff.name.length).trim();
                                break;
                            }
                        }
                    }
                }
                
                // What's left is board_rev and silicon_rev
                let boardRev = '';
                let siliconRev = '';
                const remainingParts = rawProduct.split(' ').filter(Boolean);
                if (remainingParts.length > 0) {
                    boardRev = remainingParts[0];
                    if (remainingParts.length > 1) {
                        siliconRev = remainingParts.slice(1).join(' ');
                    }
                }

                db.run("UPDATE pcbs SET board_flavor = ?, board_rev = ?, silicon_rev = ?, silicon_corner = ? WHERE id = ?", [foundFormfactor, boardRev, siliconRev, foundSilicon, pcb.id], (_err: any) => {
                    // Check if this was the last item to migrate
                    if (pcbs.indexOf(pcb) === pcbs.length - 1) {
                        // After all updates, safely drop the old column
                        db.run("ALTER TABLE pcbs DROP COLUMN product_name_and_rev", () => {
                            // Ignore error if column already dropped
                        });
                    }
                });
            });
        });
    } else {
        // Drop column immediately if migration isn't needed but it exists
        db.run("ALTER TABLE pcbs DROP COLUMN product_name_and_rev", () => {});
    }
});

// Migration: Extract formfactors from projects into pcb_flavors
db.all("SELECT id, formfactors FROM projects", [], (err: any, projects: any[]) => {
    if (!err && projects && projects.length > 0) {
        projects.forEach(project => {
            if (project.formfactors) {
                let parsedFF: any[] = [];
                try { parsedFF = JSON.parse(project.formfactors); } catch(e){}
                parsedFF.forEach(ff => {
                    db.run("INSERT INTO pcb_flavors (project_id, name, revisions, boms) VALUES (?, ?, ?, ?)", [
                        project.id, 
                        ff.name, 
                        JSON.stringify(ff.revisions || []), 
                        JSON.stringify(ff.boms || [])
                    ], (err: any) => {
                        if (err) console.error("Migration error inserting flavor:", err.message);
                    });
                });
            }
        });
        
        // After migration, drop the column
        db.run("ALTER TABLE projects DROP COLUMN formfactors", () => {});
    }
});

// Migration: add short codes to existing PCBs
db.all("SELECT id FROM pcbs WHERE short_code IS NULL", [], (err: any, pcbs: any[]) => {
    if (!err && pcbs && pcbs.length > 0) {
        pcbs.forEach(async pcb => {
            try {
                const code = await generateShortCode();
                db.run("UPDATE pcbs SET short_code = ? WHERE id = ?", [code, pcb.id]);
            } catch(e) {}
        });
    }
});

    // Start Server
    app.listen(port, '0.0.0.0', () => {
        console.log(`Server running at http://0.0.0.0:${port}`);
    });
}).catch(err => {
    console.error("Database initialization failed:", err);
    process.exit(1);
});

// Routes

// Dashboard Summary
app.get('/api/dashboard', (_req: Request, res: Response) => {
    const stats: any = {};
    db.get("SELECT COUNT(*) as count FROM projects", [], (err: any, row: any) => {
        if (err || !row) stats.projects = 0; else stats.projects = row.count;
        db.get("SELECT COUNT(*) as count FROM pcbs", [], (err: any, row: any) => {
            if (err || !row) stats.pcbs = 0; else stats.pcbs = row.count;
            db.get("SELECT COUNT(*) as count FROM owners", [], (err: any, row: any) => {
                if (err || !row) stats.owners = 0; else stats.owners = row.count;
                db.get("SELECT COUNT(*) as count FROM reworks", [], (err: any, row: any) => {
                    if (err || !row) stats.reworks = 0; else stats.reworks = row.count;
                    db.get("SELECT COUNT(*) as count FROM tags", [], (err: any, row: any) => {
                        if (err || !row) stats.tags = 0; else stats.tags = row.count;
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

const RESERVED_URLS = new Set(['project', 'projects', 'pcb', 'pcbs', 'rework', 'reworks', 'owners', 'tags', 'crc', 'api', 'demo']);

function generateShortCode(attempt = 1): Promise<string> {
    return new Promise((resolve, reject) => {
        if (attempt > 20) return reject(new Error("Unable to generate short code"));
        const chars = 'ABCDEFGHJKMNPQRSTUVWXYabcdefghjkmnpqrstuvwxy3456789';
        let code = '';
        for (let i = 0; i < 3; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        
        if (RESERVED_URLS.has(code.toLowerCase())) {
            return resolve(generateShortCode(attempt + 1));
        }
        
        db.get("SELECT id FROM pcbs WHERE short_code = ?", [code], (err: any, row: any) => {
            if (err) return reject(err);
            if (row) resolve(generateShortCode(attempt + 1));
            else resolve(code);
        });
    });
}

function sanitizeProjectName(name: string): string {
    if (!name) return "";
    const clean = name.replace(/[^a-zA-Z0-9\s]/g, '');
    return clean
        .split(/\s+/)
        .filter(word => word.length > 0)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join('');
}

function generateProjectKey(name: string, attempt = 1): Promise<string> {
    return new Promise((resolve, reject) => {
        if (attempt > 20) return reject(new Error("Unable to generate unique project key"));
        
        let chars = name.replace(/[^A-Za-z]/g, '').toUpperCase();
        if (chars.length < 3) chars = chars + 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        
        let proposedKey = chars[0] + chars[1] + chars[2];
        
        if (attempt > 1) {
            const i1 = Math.floor(Math.random() * chars.length);
            const i2 = Math.floor(Math.random() * chars.length);
            const i3 = Math.floor(Math.random() * chars.length);
            proposedKey = chars[i1] + chars[i2] + chars[i3];
        }

        db.get("SELECT id FROM projects WHERE project_key = ?", [proposedKey], (err: any, row: any) => {
            if (err) return reject(err);
            if (row) {
                resolve(generateProjectKey(name, attempt + 1));
            } else {
                resolve(proposedKey);
            }
        });
    });
}

// Projects API
app.get('/api/projects', (_req: Request, res: Response) => {
    const query = `
        SELECT projects.*, 
        COUNT(pcbs.id) as pcb_count,
        GROUP_CONCAT(pcbs.board_number) as pcb_list
        FROM projects
        LEFT JOIN pcbs ON projects.id = pcbs.project_id
        GROUP BY projects.id
    `;
    db.all(query, [], (err: any, rows: any[]) => {
        if (err) return res.status(500).json({ error: err.message });
        
        db.all("SELECT * FROM pcb_flavors", [], (err: any, flavors: any[]) => {
            if (err) return res.status(500).json({ error: err.message });
            
            res.json(rows.map(row => {
                const projectFlavors = flavors.filter(f => f.project_id === row.id).map(f => ({
                    id: f.id,
                    name: f.name,
                    revisions: f.revisions ? JSON.parse(f.revisions) : [],
                    boms: f.boms ? JSON.parse(f.boms) : []
                }));
                
                delete row.formfactors;
                
                return {
                    ...row,
                    revisions: row.revisions ? row.revisions.split(',').map((r: string) => r.trim()) : [],
                    flavors: projectFlavors,
                    pcbs: row.pcb_list ? row.pcb_list.split(',') : []
                };
            }));
        });
    });
});

app.post('/api/projects', async (req: Request, res: Response) => {
    const { name, description, revisions, project_key, flavors, silicon_corners, number_format } = req.body;
    const cleanName = sanitizeProjectName(name);
    
    if (!cleanName) return res.status(400).json({ error: "Project name is required and must contain alphanumeric characters" });

    try {
        const finalProjectKey = project_key ? project_key.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3) : await generateProjectKey(cleanName);
        db.run("INSERT INTO projects (name, description, revisions, project_key, silicon_corners, number_format) VALUES (?, ?, ?, ?, ?, ?)", [cleanName, description, revisions, finalProjectKey, silicon_corners || null, number_format || 'decimal'], function(this: any, err: any) {
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
            
            if (flavors && flavors.length > 0) {
                flavors.forEach((f: any) => {
                    db.run("INSERT INTO pcb_flavors (project_id, name, revisions, boms) VALUES (?, ?, ?, ?)", [newProjectId, f.name, JSON.stringify(f.revisions || []), JSON.stringify(f.boms || [])], (err: any) => {
                        if (err) console.error("Error inserting flavor (POST):", err.message, f);
                    });
                });
            }
            
            res.status(201).json({ id: newProjectId, name: cleanName, project_key: finalProjectKey });
        });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// PCBs API
app.get('/api/pcbs', (_req: Request, res: Response) => {
    const query = `
        SELECT pcbs.*, projects.name as project_name, projects.project_key, projects.number_format as number_format, owners.name as owner_name, owners.username as owner_username,
               (SELECT GROUP_CONCAT(tag_id) FROM pcb_tags WHERE pcb_id = pcbs.id) as tag_ids
        FROM pcbs 
        LEFT JOIN projects ON pcbs.project_id = projects.id
        LEFT JOIN owners ON pcbs.owner_id = owners.id
    `;
    db.all(query, [], (err: any, rows: any[]) => {
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

            return {
                id: row.id,
                board_number: fullBoardName,
                status: row.status,
                project: row.project_name,
                project_id: row.project_id,
                number_format: row.number_format || 'decimal',
                owner: row.owner_name || 'Unassigned',
                owner_username: row.owner_username || undefined,
                product: [row.board_flavor, row.board_rev, row.silicon_rev, row.silicon_corner].filter(Boolean).join(' ') || '',
                board_flavor: row.board_flavor || '',
                board_rev: row.board_rev || '',
                silicon_rev: row.silicon_rev || '',
                silicon_corner: row.silicon_corner || '',
                bom: row.bom,
                tag_ids: row.tag_ids ? row.tag_ids.split(',').map(Number) : [],
                short_code: row.short_code,
                created_at: row.created_at
            };
        }));
    });
});

app.post('/api/pcbs', async (req: Request, res: Response) => {
    const { board_number, status, board_flavor, board_rev, silicon_rev, silicon_corner, bom, project_id, owner_id } = req.body;
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
        const short_code = await generateShortCode();
        const query = "INSERT INTO pcbs (board_number, status, board_flavor, board_rev, silicon_rev, silicon_corner, bom, project_id, owner_id, short_code, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))";
        db.run(query, [numPart, status, board_flavor, board_rev, silicon_rev, silicon_corner, bom, project_id, owner_id, short_code], function(this: any, err: any) {
            if (err) return res.status(500).json({ error: err.message });
            res.status(201).json({ id: this.lastID, board_number, short_code });
        });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Owners API
app.get('/api/owners', (_req: Request, res: Response) => {
    const query = `
        SELECT owners.*,
            (SELECT COUNT(*) FROM pcbs WHERE pcbs.owner_id = owners.id) AS pcb_count,
            (SELECT COUNT(*) FROM reworks WHERE reworks.owner_id = owners.id) AS rework_count,
            (SELECT COUNT(*) FROM tags WHERE tags.owner_id = owners.id) AS tag_count
        FROM owners
    `;
    db.all(query, [], (err: any, rows: any[]) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/owners', (req: Request, res: Response) => {
    const { name, username, email, superuser } = req.body;
    const cleanUsername = username ? username.replace(/\s+/g, '').toLowerCase() : null;
    
    db.get("SELECT COUNT(*) as count FROM owners", [], (errCount: any, row: any) => {
        if (errCount) return res.status(500).json({ error: errCount.message });
        
        const isFirst = (row && row.count === 0);
        const superuserVal = isFirst ? 1 : (superuser ? 1 : 0);
        
        db.run("INSERT INTO owners (name, username, email, superuser) VALUES (?, ?, ?, ?)", [name, cleanUsername, email || null, superuserVal], function(this: any, err: any) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(400).json({ error: `Username "${cleanUsername}" is already taken.` });
                }
                return res.status(500).json({ error: err.message });
            }
            res.status(201).json({ id: this.lastID, name, username: cleanUsername, email: email || null, superuser: superuserVal });
        });
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
    db.all(query, [], (err: any, rows: any[]) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/tags', (req: Request, res: Response) => {
    const { name, color, owner_id, type } = req.body;
    const finalOwnerId = owner_id && owner_id !== '-1' && owner_id !== 'null' ? parseInt(owner_id) : null;
    db.run("INSERT INTO tags (name, color, owner_id, type) VALUES (?, ?, ?, ?)", [name, color, finalOwnerId, type || 'public'], function(this: any, err: any) {
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
    db.all(query, [], (err: any, rows: any[]) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/reworks', upload.any(), deduplicate, serializeWrites, (req: any, res: Response) => {
    const { pcb_id, title, description, owner_id, rework_type, new_product, new_silicon_rev, new_silicon_corner } = req.body;
    
    db.get("SELECT pcbs.*, projects.project_key, projects.number_format FROM pcbs LEFT JOIN projects ON pcbs.project_id = projects.id WHERE pcbs.id = ?", [pcb_id], (err: any, row: any) => {
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
        
        db.get("SELECT MAX(rework_number) as max_num FROM reworks WHERE pcb_id = ?", [pcb_id], (err: any, result: any) => {
            if (err) return res.status(500).json({ error: err.message });
            
            let sequence = (result && result.max_num) ? result.max_num + 1 : 1;
            
            const reworkName = `${boardName}-R${String(sequence).padStart(3, '0')}`;
            
            let finalPaths: string[] = [];
            if (req.files && req.files.length > 0) {
                req.files.slice(0, 3).forEach((file: any, index: number) => {
                    const ext = path.extname(file.originalname) || '.jpg';
                    const newFileName = `${reworkName}-PIC-${index + 1}${ext}`;
                    const oldPath = path.join(__dirname, '../../../pictures', file.filename);
                    const newPath = path.join(__dirname, '../../../pictures', newFileName);
                    
                    try {
                        if (fs.existsSync(oldPath)) {
                            fs.renameSync(oldPath, newPath);
                            finalPaths.push(`/pictures/${newFileName}`);
                        }
                    } catch (err) {
                        console.error('Failed to rename picture file:', err);
                        finalPaths.push(`/pictures/${file.filename}`);
                    }
                });
            }
            const image_path = finalPaths.length > 0 ? JSON.stringify(finalPaths) : null;
            
            const finalOwnerId = owner_id && owner_id !== '-1' && owner_id !== 'null' ? parseInt(owner_id) : null;
            const insertQuery = "INSERT INTO reworks (pcb_id, rework_number, title, description, owner_id, image_path, rework_type) VALUES (?, ?, ?, ?, ?, ?, ?)";
            db.run(insertQuery, [pcb_id, sequence, title || null, description, finalOwnerId, image_path, rework_type || 'Minor'], function(this: any, err: any) {
                if (err) return res.status(500).json({ error: err.message });
                const reworkId = this.lastID;
                
                if (rework_type === 'Silicon Swap' && new_silicon_rev !== undefined) {
                    db.run("UPDATE pcbs SET silicon_rev = ?, silicon_corner = ? WHERE id = ?", [new_silicon_rev, new_silicon_corner, pcb_id], function(updateErr: any) {
                        if (updateErr) return res.status(500).json({ error: updateErr.message });
                        res.status(201).json({ id: reworkId, pcb_id, rework_number: sequence, title: title || null, rework_type, image_path, new_product });
                    });
                } else {
                    res.status(201).json({ id: reworkId, pcb_id, rework_number: sequence, title: title || null, rework_type: rework_type || 'Minor', image_path });
                }
            });
        });
    });
});

// Projects API Expansions
app.put('/api/projects/:id', (req: Request, res: Response) => {
    const { name, description, revisions, project_key, flavors, silicon_corners, number_format } = req.body;
    const cleanName = sanitizeProjectName(name);

    if (!cleanName) return res.status(400).json({ error: "Project name is required" });
    const finalProjectKey = project_key ? project_key.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3) : null;

    db.get("SELECT number_format, project_key FROM projects WHERE id = ?", [req.params.id], (err: any, _row: any) => {
        db.run("UPDATE projects SET name = ?, description = ?, revisions = ?, project_key = ?, silicon_corners = ?, number_format = ? WHERE id = ?", [cleanName, description, revisions, finalProjectKey, silicon_corners || null, number_format || 'decimal', req.params.id], function(this: any, err: any) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    if (err.message.includes('projects.name')) {
                        return res.status(400).json({ error: `A project with the name "${cleanName}" already exists.` });
                    }
                    if (err.message.includes('projects.project_key')) {
                        return res.status(400).json({ error: `The project key "${finalProjectKey}" is already in use.` });
                    }
                }
                return res.status(500).json({ error: err.message });
            }
            
            db.run("DELETE FROM pcb_flavors WHERE project_id = ?", [req.params.id], () => {
                if (flavors && flavors.length > 0) {
                    flavors.forEach((f: any) => {
                        db.run("INSERT INTO pcb_flavors (project_id, name, revisions, boms) VALUES (?, ?, ?, ?)", [req.params.id, f.name, JSON.stringify(f.revisions || []), JSON.stringify(f.boms || [])], (err: any) => {
                            if (err) console.error("Error inserting flavor (PUT):", err.message, f);
                        });
                    });
                }
            });

            const changes = this.changes;
            res.json({ updated: changes, name: cleanName });
        });
    });
});

app.delete('/api/projects/:id', (req: Request, res: Response) => {
    db.run("DELETE FROM projects WHERE id = ?", [req.params.id], function(this: any, err: any) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ deleted: this.changes });
    });
});

// PCBs API Expansions
app.get('/api/pcbs/:id', (req: Request, res: Response) => {
    db.get("SELECT pcbs.*, projects.project_key, projects.number_format FROM pcbs LEFT JOIN projects ON pcbs.project_id = projects.id WHERE pcbs.id = ?", [req.params.id], (err: any, row: any) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: "PCB not found" });

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
            row.board_number = `${row.project_key}-${formattedNum}${generatedCrc}`;
        }
        res.json(row);
    });
});

// PCB Tags Association API
app.get('/api/pcbs/:id/tags', (req: Request, res: Response) => {
    const query = `
        SELECT tags.*, owners.username as owner_username, owners.name as owner_name 
        FROM tags 
        JOIN pcb_tags ON tags.id = pcb_tags.tag_id 
        LEFT JOIN owners ON tags.owner_id = owners.id
        WHERE pcb_tags.pcb_id = ?
    `;
    db.all(query, [req.params.id], (err: any, rows: any[]) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/pcbs/:id/tags', express.json(), (req: Request, res: Response) => {
    const pcbId = req.params.id;
    const tagId = req.body.tag_id;
    if (!tagId) return res.status(400).json({ error: 'tag_id is required' });
    db.run("INSERT OR IGNORE INTO pcb_tags (pcb_id, tag_id) VALUES (?, ?)", [pcbId, tagId], function(this: any, err: any) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, changes: this.changes });
    });
});

app.delete('/api/pcbs/:id/tags/:tag_id', (req: Request, res: Response) => {
    const pcbId = req.params.id;
    const tagId = req.params.tag_id;
    db.run("DELETE FROM pcb_tags WHERE pcb_id = ? AND tag_id = ?", [pcbId, tagId], function(this: any, err: any) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, changes: this.changes });
    });
});

app.put('/api/pcbs/:id', (req: Request, res: Response) => {
    const { status, owner_id, board_flavor, board_rev, silicon_rev, silicon_corner, bom, project_id } = req.body;
    const finalOwnerId = owner_id && owner_id !== '-1' && owner_id !== 'null' ? parseInt(owner_id) : null;
    
    db.run(
        "UPDATE pcbs SET status = ?, owner_id = ?, board_flavor = ?, board_rev = ?, silicon_rev = ?, silicon_corner = ?, bom = ?, project_id = ? WHERE id = ?",
        [status, finalOwnerId, board_flavor || null, board_rev || null, silicon_rev || null, silicon_corner || null, bom || null, project_id || null, req.params.id],
        function(this: any, err: any) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ updated: this.changes });
        }
    );
});

app.delete('/api/pcbs/:id', (req: Request, res: Response) => {
    db.run("DELETE FROM pcbs WHERE id = ?", [req.params.id], function(this: any, err: any) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: "PCB not found" });
        db.run("DELETE FROM pcb_tags WHERE pcb_id = ?", [req.params.id], () => {
            res.json({ deleted: this.changes });
        });
    });
});

// Tags API Expansions
app.get('/api/tags/:id/pcbs', (req: Request, res: Response) => {
    const query = `
        SELECT pcbs.*, projects.name as project_name, projects.project_key 
        FROM pcbs 
        JOIN pcb_tags ON pcbs.id = pcb_tags.pcb_id 
        LEFT JOIN projects ON pcbs.project_id = projects.id
        WHERE pcb_tags.tag_id = ?
    `;
    db.all(query, [req.params.id], (err: any, rows: any[]) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.put('/api/tags/:id', (req: Request, res: Response) => {
    const { name, color, owner_id, type } = req.body;
    const finalOwnerId = owner_id && owner_id !== '-1' && owner_id !== 'null' ? parseInt(owner_id) : null;
    
    db.run("UPDATE tags SET name = ?, color = ?, owner_id = ?, type = ? WHERE id = ?", [name, color, finalOwnerId, type || 'public', req.params.id], function(this: any, err: any) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ updated: this.changes });
    });
});

app.delete('/api/tags/:id', (req: Request, res: Response) => {
    db.run("DELETE FROM tags WHERE id = ?", [req.params.id], function(this: any, err: any) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: "Tag not found" });
        db.run("DELETE FROM pcb_tags WHERE tag_id = ?", [req.params.id], () => {
            res.json({ deleted: this.changes });
        });
    });
});

// Reworks API Expansions
app.get('/api/reworks/:id', (req: Request, res: Response) => {
    db.get("SELECT reworks.*, pcbs.board_number, owners.name as owner_name, owners.username as owner_username FROM reworks LEFT JOIN pcbs ON reworks.pcb_id = pcbs.id LEFT JOIN owners ON reworks.owner_id = owners.id WHERE reworks.id = ?", [req.params.id], (err: any, row: any) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: "Rework not found" });
        res.json(row);
    });
});

app.put('/api/reworks/:id', upload.any(), deduplicate, serializeWrites, (req: any, res: Response) => {
    const { title, description, owner_id, rework_type, new_silicon_rev, new_silicon_corner, pcb_id } = req.body;
    
    db.get("SELECT timestamp FROM reworks WHERE id = ?", [req.params.id], (err: any, row: any) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: "Rework log not found" });
        
        let daysDiff = 999;
        if (row.timestamp) {
            const dateStr = row.timestamp.includes('T') ? row.timestamp : row.timestamp.replace(' ', 'T') + 'Z';
            const timestampDate = new Date(dateStr);
            if (!isNaN(timestampDate.getTime())) {
                daysDiff = (Date.now() - timestampDate.getTime()) / (1000 * 60 * 60 * 24);
            }
        }
        
        if (daysDiff > 14) {
            return res.status(400).json({ error: "Rework log is older than 2 weeks and cannot be edited." });
        }
        
        let imagePathClause = "";
        let queryParams = [title || null, description, owner_id && owner_id !== '-1' && owner_id !== 'null' ? parseInt(owner_id) : null, rework_type || 'Minor'];
        
        if (req.files && req.files.length > 0) {
            let finalPaths: string[] = [];
            req.files.slice(0, 3).forEach((file: any, index: number) => {
                const ext = path.extname(file.originalname) || '.jpg';
                const newFileName = `REWORK-${req.params.id}-PIC-${index + 1}${ext}`;
                const oldPath = path.join(__dirname, '../../../pictures', file.filename);
                const newPath = path.join(__dirname, '../../../pictures', newFileName);
                try {
                    if (fs.existsSync(oldPath)) {
                        fs.renameSync(oldPath, newPath);
                        finalPaths.push(`/pictures/${newFileName}`);
                    }
                } catch (e) {
                    finalPaths.push(`/pictures/${file.filename}`);
                }
            });
            imagePathClause = ", image_path = ?";
            queryParams.push(JSON.stringify(finalPaths));
        }
        
        queryParams.push(req.params.id);
        
        const updateQuery = `UPDATE reworks SET title = ?, description = ?, owner_id = ?, rework_type = ?${imagePathClause} WHERE id = ?`;
        
        db.run(updateQuery, queryParams, function(this: any, err: any) {
            if (err) return res.status(500).json({ error: err.message });
            
            if (rework_type === 'Silicon Swap' && new_silicon_rev !== undefined && pcb_id) {
                db.run("UPDATE pcbs SET silicon_rev = ?, silicon_corner = ? WHERE id = ?", [new_silicon_rev, new_silicon_corner, pcb_id], (updateErr: any) => {
                    if (updateErr) return res.status(500).json({ error: updateErr.message });
                    res.json({ updated: this.changes });
                });
            } else {
                res.json({ updated: this.changes });
            }
        });
    });
});

app.delete('/api/reworks/:id', (req: Request, res: Response) => {
    db.get("SELECT pcb_id, timestamp FROM reworks WHERE id = ?", [req.params.id], (err: any, row: any) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: "Rework not found" });
        
        db.get("SELECT COUNT(*) as count FROM reworks WHERE pcb_id = ? AND id > ?", [row.pcb_id, req.params.id], (err: any, countRow: any) => {
            if (err) return res.status(500).json({ error: err.message });
            if (countRow && countRow.count > 0) {
                return res.status(400).json({ error: "Cannot delete rework because there are newer rework logs after it on this board." });
            }
            
            let daysDiff = 999;
            if (row.timestamp) {
                const dateStr = row.timestamp.includes('T') ? row.timestamp : row.timestamp.replace(' ', 'T') + 'Z';
                const timestampDate = new Date(dateStr);
                if (!isNaN(timestampDate.getTime())) {
                    daysDiff = (Date.now() - timestampDate.getTime()) / (1000 * 60 * 60 * 24);
                }
            }
            
            if (daysDiff > 3) {
                return res.status(400).json({ error: "Cannot delete rework because it was created more than 3 days ago." });
            }
            
            db.run("DELETE FROM reworks WHERE id = ?", [req.params.id], function(this: any, err: any) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ deleted: this.changes });
            });
        });
    });
});

// Owners API Expansions
app.put('/api/owners/:id', (req: Request, res: Response) => {
    const { name, username, email, superuser } = req.body;
    const cleanUsername = username ? username.replace(/\s+/g, '').toLowerCase() : null;
    
    db.run("UPDATE owners SET name = ?, username = ?, email = ?, superuser = ? WHERE id = ?", [name, cleanUsername, email || null, superuser ? 1 : 0, req.params.id], function(this: any, err: any) {
        if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
                return res.status(400).json({ error: `Username "${cleanUsername}" is already taken.` });
            }
            return res.status(500).json({ error: err.message });
        }
        res.json({ updated: this.changes });
    });
});

app.delete('/api/owners/:id', (req: Request, res: Response) => {
    db.run("DELETE FROM owners WHERE id = ?", [req.params.id], function(this: any, err: any) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: "Owner not found" });
        res.json({ deleted: this.changes });
    });
});

export { app };
