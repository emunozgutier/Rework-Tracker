import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { db, initDb } from './db.js';
import { apiLoggerMiddleware } from './logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = 5002;

// Configure Multer Storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = path.join(__dirname, '../../../pictures');
        if (!fs.existsSync(dir)){
            fs.mkdirSync(dir);
        }
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));
app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    next();
});
app.use(apiLoggerMiddleware);

// --- Request Deduplication & Serialization Middlewares ---
const inFlightRequests = new Map();

function deduplicate(req, res, next) {
    if (req.method === 'GET') {
        return next();
    }
    
    // Prevent double execution if registered both globally and locally
    if (req._deduplicated) {
        return next();
    }
    req._deduplicated = true;

    const fileSignature = (req.files || []).map(f => `${f.originalname}-${f.size}`).join(',');
    const bodyKey = JSON.stringify(req.body || {});
    const key = `${req.method}:${req.originalUrl}:${bodyKey}:${fileSignature}`;

    if (inFlightRequests.has(key)) {
        console.log(`[Server Deduplicate] Duplicate request detected for key: ${key}.`);
        const pending = inFlightRequests.get(key);
        
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

    const pending = {
        listeners: [],
        response: null
    };
    inFlightRequests.set(key, pending);

    const originalSend = res.send;
    res.send = function (body) {
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

function serializeWrites(req, res, next) {
    if (req.method === 'GET') {
        return next();
    }
    
    // Prevent double execution if registered both globally and locally
    if (req._serialized) {
        return next();
    }
    req._serialized = true;

    writeQueue = writeQueue.then(() => {
        return new Promise((resolve) => {
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
app.use((req, res, next) => {
    const isMultipart = req.headers['content-type'] && req.headers['content-type'].startsWith('multipart/form-data');
    if (isMultipart) {
        return next();
    }
    deduplicate(req, res, next);
});

// Apply serialization to JSON write operations second
app.use((req, res, next) => {
    const isMultipart = req.headers['content-type'] && req.headers['content-type'].startsWith('multipart/form-data');
    if (isMultipart) {
        return next();
    }
    serializeWrites(req, res, next);
});

app.use('/api/pictures', express.static(path.join(__dirname, '../../../pictures')));

// Initialize Database
initDb().then(() => {


// Migration: Split product_name_and_rev into board_flavor, board_rev, silicon_rev, silicon_corner
db.all("SELECT id, product_name_and_rev, project_id FROM pcbs WHERE product_name_and_rev IS NOT NULL AND board_flavor IS NULL", [], (err, pcbs) => {
    if (!err && pcbs && pcbs.length > 0) {
        db.all("SELECT id, formfactors, silicon_corners FROM projects", [], (err, projects) => {
            if (err || !projects) return;
            pcbs.forEach(pcb => {
                const project = projects.find(p => p.id === pcb.project_id);
                let rawProduct = pcb.product_name_and_rev || '';
                let foundRev = '';
                let foundFormfactor = '';
                let foundSilicon = '';

                if (project) {
                    if (project.silicon_corners) {
                        let parsedCorners = [];
                        try { parsedCorners = typeof project.silicon_corners === 'string' ? project.silicon_corners.split(',').map(s => s.trim()).filter(Boolean) : []; } catch(e){}
                        for (const corner of parsedCorners) {
                            if (rawProduct.endsWith(` ${corner}`) || rawProduct === corner) {
                                foundSilicon = corner;
                                rawProduct = rawProduct.slice(0, rawProduct.length - corner.length).trim();
                                break;
                            }
                        }
                    }

                    if (project.formfactors) {
                        let parsedFF = [];
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

                db.run("UPDATE pcbs SET board_flavor = ?, board_rev = ?, silicon_rev = ?, silicon_corner = ? WHERE id = ?", [foundFormfactor, boardRev, siliconRev, foundSilicon, pcb.id], (err) => {
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
db.all("SELECT id, formfactors FROM projects", [], (err, projects) => {
    if (!err && projects && projects.length > 0) {
        let hasFormfactors = false;
        projects.forEach(project => {
            if (project.formfactors) {
                hasFormfactors = true;
                let parsedFF = [];
                try { parsedFF = JSON.parse(project.formfactors); } catch(e){}
                parsedFF.forEach(ff => {
                    db.run("INSERT INTO pcb_flavors (project_id, name, revisions, boms) VALUES (?, ?, ?, ?)", [
                        project.id, 
                        ff.name, 
                        JSON.stringify(ff.revisions || []), 
                        JSON.stringify(ff.boms || [])
                    ], (err) => {
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
db.all("SELECT id FROM pcbs WHERE short_code IS NULL", [], (err, pcbs) => {
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
app.get('/api/dashboard', (req, res) => {
    const stats = {};
    db.get("SELECT COUNT(*) as count FROM projects", [], (err, row) => {
        if (err || !row) stats.projects = 0; else stats.projects = row.count;
        db.get("SELECT COUNT(*) as count FROM pcbs", [], (err, row) => {
            if (err || !row) stats.pcbs = 0; else stats.pcbs = row.count;
            db.get("SELECT COUNT(*) as count FROM owners", [], (err, row) => {
                if (err || !row) stats.owners = 0; else stats.owners = row.count;
                db.get("SELECT COUNT(*) as count FROM reworks", [], (err, row) => {
                    if (err || !row) stats.reworks = 0; else stats.reworks = row.count;
                    db.get("SELECT COUNT(*) as count FROM tags", [], (err, row) => {
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

function generateCRC(input) {
    let sum = 0;
    for (let i = 0; i < input.length; i++) {
        const char = input[i].toUpperCase();
        sum += char.charCodeAt(0) * (i + 1);
    }
    return CHARSET[sum % CHARSET.length];
}

const RESERVED_URLS = new Set(['project', 'projects', 'pcb', 'pcbs', 'rework', 'reworks', 'owners', 'tags', 'crc', 'api', 'demo']);

function generateShortCode(attempt = 1) {
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
        
        db.get("SELECT id FROM pcbs WHERE short_code = ?", [code], (err, row) => {
            if (err) return reject(err);
            if (row) resolve(generateShortCode(attempt + 1));
            else resolve(code);
        });
    });
}

function sanitizeProjectName(name) {
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

function generateProjectKey(name, attempt = 1) {
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

        db.get("SELECT id FROM projects WHERE project_key = ?", [proposedKey], (err, row) => {
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
app.get('/api/projects', (req, res) => {
    const query = `
        SELECT projects.*, 
        COUNT(pcbs.id) as pcb_count,
        GROUP_CONCAT(pcbs.board_number) as pcb_list
        FROM projects
        LEFT JOIN pcbs ON projects.id = pcbs.project_id
        GROUP BY projects.id
    `;
    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        
        db.all("SELECT * FROM pcb_flavors", [], (err, flavors) => {
            if (err) return res.status(500).json({ error: err.message });
            
            res.json(rows.map(row => {
                const projectFlavors = flavors.filter(f => f.project_id === row.id).map(f => ({
                    id: f.id,
                    name: f.name,
                    revisions: f.revisions ? JSON.parse(f.revisions) : [],
                    boms: f.boms ? JSON.parse(f.boms) : []
                }));
                
                delete row.formfactors; // Remove old column if it was present
                
                return {
                    ...row,
                    revisions: row.revisions ? row.revisions.split(',').map(r => r.trim()) : [],
                    flavors: projectFlavors,
                    pcbs: row.pcb_list ? row.pcb_list.split(',') : []
                };
            }));
        });
    });
});

app.post('/api/projects', async (req, res) => {
    const { name, description, revisions, project_key, flavors, silicon_corners, number_format } = req.body;
    const cleanName = sanitizeProjectName(name);
    
    if (!cleanName) return res.status(400).json({ error: "Project name is required and must contain alphanumeric characters" });

    try {
        const finalProjectKey = project_key ? project_key.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3) : await generateProjectKey(cleanName);
        db.run("INSERT INTO projects (name, description, revisions, project_key, silicon_corners, number_format) VALUES (?, ?, ?, ?, ?, ?)", [cleanName, description, revisions, finalProjectKey, silicon_corners || null, number_format || 'decimal'], function(err) {
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
                flavors.forEach(f => {
                    db.run("INSERT INTO pcb_flavors (project_id, name, revisions, boms) VALUES (?, ?, ?, ?)", [newProjectId, f.name, JSON.stringify(f.revisions || []), JSON.stringify(f.boms || [])], (err) => {
                        if (err) console.error("Error inserting flavor (POST):", err.message, f);
                    });
                });
            }
            
            res.status(201).json({ id: newProjectId, name: cleanName, project_key: finalProjectKey });
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PCBs API
app.get('/api/pcbs', (req, res) => {
    const query = `
        SELECT pcbs.*, projects.name as project_name, projects.project_key, projects.number_format as number_format, owners.name as owner_name, owners.username as owner_username,
               (SELECT GROUP_CONCAT(tag_id) FROM pcb_tags WHERE pcb_id = pcbs.id) as tag_ids
        FROM pcbs 
        LEFT JOIN projects ON pcbs.project_id = projects.id
        LEFT JOIN owners ON pcbs.owner_id = owners.id
    `;
    db.all(query, [], (err, rows) => {
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

app.post('/api/pcbs', async (req, res) => {
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
        db.run(query, [numPart, status, board_flavor, board_rev, silicon_rev, silicon_corner, bom, project_id, owner_id, short_code], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.status(201).json({ id: this.lastID, board_number, short_code });
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Owners API
app.get('/api/owners', (req, res) => {
    const query = `
        SELECT owners.*,
            (SELECT COUNT(*) FROM pcbs WHERE pcbs.owner_id = owners.id) AS pcb_count,
            (SELECT COUNT(*) FROM reworks WHERE reworks.owner_id = owners.id) AS rework_count,
            (SELECT COUNT(*) FROM tags WHERE tags.owner_id = owners.id) AS tag_count
        FROM owners
    `;
    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/owners', (req, res) => {
    const { name, username, email } = req.body;
    const cleanUsername = username ? username.replace(/\s+/g, '').toLowerCase() : null;
    db.run("INSERT INTO owners (name, username, email) VALUES (?, ?, ?)", [name, cleanUsername, email || null], function(err) {
        if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
                return res.status(400).json({ error: `Username "${cleanUsername}" is already taken.` });
            }
            return res.status(500).json({ error: err.message });
        }
        res.status(201).json({ id: this.lastID, name, username: cleanUsername, email: email || null });
    });
});

// Tags API
app.get('/api/tags', (req, res) => {
    const query = `
        SELECT tags.*, owners.name as owner_name, owners.username as owner_username, COUNT(pcb_tags.pcb_id) as pcb_count
        FROM tags
        LEFT JOIN owners ON tags.owner_id = owners.id
        LEFT JOIN pcb_tags ON tags.id = pcb_tags.tag_id
        GROUP BY tags.id
    `;
    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/tags', (req, res) => {
    const { name, color, owner_id, type } = req.body;
    const finalOwnerId = owner_id && owner_id !== '-1' && owner_id !== 'null' ? parseInt(owner_id) : null;
    db.run("INSERT INTO tags (name, color, owner_id, type) VALUES (?, ?, ?, ?)", [name, color, finalOwnerId, type || 'public'], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ id: this.lastID, name });
    });
});

// Reworks API
app.get('/api/reworks', (req, res) => {
    const query = `
        SELECT reworks.*, pcbs.board_number, owners.name as owner_name, owners.username as owner_username
        FROM reworks 
        LEFT JOIN pcbs ON reworks.pcb_id = pcbs.id
        LEFT JOIN owners ON reworks.owner_id = owners.id
        ORDER BY timestamp DESC
    `;
    db.all(query, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/reworks', upload.any(), deduplicate, serializeWrites, (req, res) => {
    const { pcb_id, title, description, owner_id, rework_type, new_product, new_silicon_rev, new_silicon_corner } = req.body;
    
    // 1. Get the PCB board_number
    db.get("SELECT pcbs.*, projects.project_key, projects.number_format FROM pcbs LEFT JOIN projects ON pcbs.project_id = projects.id WHERE pcbs.id = ?", [pcb_id], (err, row) => {
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
        db.get("SELECT MAX(rework_number) as max_num FROM reworks WHERE pcb_id = ?", [pcb_id], (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            
            let sequence = (result && result.max_num) ? result.max_num + 1 : 1;
            
            const reworkName = `${boardName}-R${String(sequence).padStart(3, '0')}`;
            
            // Post-process the uploaded files dynamically to match the reworkName
            let finalPaths = [];
            if (req.files && req.files.length > 0) {
                req.files.slice(0, 3).forEach((file, index) => {
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
                        finalPaths.push(`/pictures/${file.filename}`); // Fallback
                    }
                });
            }
            const image_path = finalPaths.length > 0 ? JSON.stringify(finalPaths) : null;
            
            // 3. Insert new rework
            const finalOwnerId = owner_id && owner_id !== '-1' && owner_id !== 'null' ? parseInt(owner_id) : null;
            const insertQuery = "INSERT INTO reworks (pcb_id, rework_number, title, description, owner_id, image_path, rework_type) VALUES (?, ?, ?, ?, ?, ?, ?)";
            db.run(insertQuery, [pcb_id, sequence, title || null, description, finalOwnerId, image_path, rework_type || 'Minor'], function(err) {
                if (err) return res.status(500).json({ error: err.message });
                const reworkId = this.lastID;
                
                // 4. Update PCB if it's a Silicon Swap
                if (rework_type === 'Silicon Swap' && new_silicon_rev !== undefined) {
                    db.run("UPDATE pcbs SET silicon_rev = ?, silicon_corner = ? WHERE id = ?", [new_silicon_rev, new_silicon_corner, pcb_id], function(updateErr) {
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

// --- Projects API Expansions ---
app.put('/api/projects/:id', (req, res) => {
    const { name, description, revisions, project_key, flavors, silicon_corners, number_format } = req.body;
    const cleanName = sanitizeProjectName(name);

    if (!cleanName) return res.status(400).json({ error: "Project name is required" });
    const finalProjectKey = project_key ? project_key.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3) : null;

    db.get("SELECT number_format, project_key FROM projects WHERE id = ?", [req.params.id], (err, row) => {
        const oldFormat = row ? (row.number_format || 'hex') : 'hex';
        const oldProjectKey = row ? row.project_key : null;
        
        db.run("UPDATE projects SET name = ?, description = ?, revisions = ?, project_key = ?, silicon_corners = ?, number_format = ? WHERE id = ?", [cleanName, description, revisions, finalProjectKey, silicon_corners || null, number_format || 'decimal', req.params.id], function(err) {
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
                    flavors.forEach(f => {
                        db.run("INSERT INTO pcb_flavors (project_id, name, revisions, boms) VALUES (?, ?, ?, ?)", [req.params.id, f.name, JSON.stringify(f.revisions || []), JSON.stringify(f.boms || [])], (err) => {
                            if (err) console.error("Error inserting flavor (PUT):", err.message, f);
                        });
                    });
                }
            });

            const changes = this.changes;
            const newFormat = number_format || 'decimal';
            
            res.json({ updated: changes, name: cleanName });
        });
    });
});

app.delete('/api/projects/:id', (req, res) => {
    db.run("DELETE FROM projects WHERE id = ?", [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ deleted: this.changes });
    });
});

// --- PCBs API Expansions ---
app.get('/api/pcbs/:id', (req, res) => {
    db.get("SELECT pcbs.*, projects.project_key, projects.number_format FROM pcbs LEFT JOIN projects ON pcbs.project_id = projects.id WHERE pcbs.id = ?", [req.params.id], (err, row) => {
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
app.get('/api/pcbs/:id/tags', (req, res) => {
    const query = `
        SELECT tags.*, owners.username as owner_username, owners.name as owner_name 
        FROM tags 
        JOIN pcb_tags ON tags.id = pcb_tags.tag_id 
        LEFT JOIN owners ON tags.owner_id = owners.id
        WHERE pcb_tags.pcb_id = ?
    `;
    db.all(query, [req.params.id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/pcbs/:id/tags', express.json(), (req, res) => {
    const pcbId = req.params.id;
    const tagId = req.body.tag_id;
    if (!tagId) return res.status(400).json({ error: 'tag_id is required' });
    db.run("INSERT OR IGNORE INTO pcb_tags (pcb_id, tag_id) VALUES (?, ?)", [pcbId, tagId], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true, changes: this.changes });
    });
});

app.delete('/api/pcbs/:id/tags/:tag_id', (req, res) => {
    db.run("DELETE FROM pcb_tags WHERE pcb_id = ? AND tag_id = ?", [req.params.id, req.params.tag_id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ deleted: this.changes });
    });
});

app.put('/api/pcbs/:id', (req, res) => {
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
    const query = "UPDATE pcbs SET board_number = ?, status = ?, board_flavor = ?, board_rev = ?, silicon_rev = ?, silicon_corner = ?, bom = ?, project_id = ?, owner_id = ? WHERE id = ?";
    db.run(query, [numPart, status, board_flavor, board_rev, silicon_rev, silicon_corner, bom, project_id, owner_id, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ updated: this.changes });
    });
});

app.delete('/api/pcbs/:id', (req, res) => {
    const pcbId = parseInt(req.params.id, 10);
    const checkQuery = `
        SELECT 
            created_at, 
            (SELECT COUNT(*) FROM reworks WHERE pcb_id = pcbs.id) as rework_count 
        FROM pcbs 
        WHERE id = ?
    `;
    db.get(checkQuery, [pcbId], (err, row) => {
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
            db.run("DELETE FROM pcbs WHERE id = ?", [pcbId], function(err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ deleted: this.changes });
            });
        });
    });
});

// --- Owners API Expansions ---
app.get('/api/owners/:id', (req, res) => {
    db.get("SELECT * FROM owners WHERE id = ?", [req.params.id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(row);
    });
});

app.put('/api/owners/:id', (req, res) => {
    const { name, username, email } = req.body;
    const cleanUsername = username ? username.replace(/\s+/g, '').toLowerCase() : null;
    db.run("UPDATE owners SET name = ?, username = ?, email = ? WHERE id = ?", [name, cleanUsername, email || null, req.params.id], function(err) {
        if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
                return res.status(400).json({ error: `Username "${cleanUsername}" is already in use.` });
            }
            return res.status(500).json({ error: err.message });
        }
        res.json({ updated: this.changes });
    });
});

app.delete('/api/owners/:id', (req, res) => {
    const ownerId = req.params.id;
    // Automatically detach the owner from all dependencies to bypass Foreign Key constraint restrictions safely
    db.serialize(() => {
        db.run("UPDATE pcbs SET owner_id = NULL WHERE owner_id = ?", [ownerId]);
        db.run("UPDATE reworks SET owner_id = NULL WHERE owner_id = ?", [ownerId]);
        db.run("UPDATE tags SET owner_id = NULL WHERE owner_id = ?", [ownerId]);

        db.run("DELETE FROM owners WHERE id = ?", [ownerId], function(err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ deleted: this.changes });
        });
    });
});

// --- Tags API Expansions ---
app.get('/api/tags/:id', (req, res) => {
    db.get("SELECT * FROM tags WHERE id = ?", [req.params.id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(row);
    });
});

app.get('/api/tags/:id/pcbs', (req, res) => {
    const query = `
        SELECT pcbs.*, projects.project_key 
        FROM pcbs 
        JOIN pcb_tags ON pcbs.id = pcb_tags.pcb_id 
        LEFT JOIN projects ON pcbs.project_id = projects.id
        WHERE pcb_tags.tag_id = ?
    `;
    db.all(query, [req.params.id], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.put('/api/tags/:id', (req, res) => {
    const { name, color, owner_id, type } = req.body;
    const finalOwnerId = owner_id && owner_id !== '-1' && owner_id !== 'null' ? parseInt(owner_id) : null;
    db.run("UPDATE tags SET name = ?, color = ?, owner_id = ?, type = ? WHERE id = ?", [name, color, finalOwnerId, type || 'public', req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ updated: this.changes });
    });
});

app.delete('/api/tags/:id', (req, res) => {
    db.run("DELETE FROM tags WHERE id = ?", [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ deleted: this.changes });
    });
});

// --- Reworks API Expansions ---
app.get('/api/reworks/:id', (req, res) => {
    db.get("SELECT * FROM reworks WHERE id = ?", [req.params.id], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(row);
    });
});

app.put('/api/reworks/:id', (req, res) => {
    const { pcb_id, title, description, owner_id, rework_type, new_product } = req.body;
    const finalOwnerId = owner_id && owner_id !== '-1' && owner_id !== 'null' ? parseInt(owner_id) : null;
    db.run("UPDATE reworks SET pcb_id = ?, title = ?, description = ?, owner_id = ?, rework_type = ? WHERE id = ?", [pcb_id, title || null, description, finalOwnerId, rework_type || 'Minor', req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        
        let changes = this.changes;
        if (rework_type === 'Silicon Swap' && new_product) {
            db.run("UPDATE pcbs SET product_name_and_rev = ? WHERE id = ?", [new_product, pcb_id], function(updateErr) {
                return res.json({ updated: changes });
            });
        } else {
            res.json({ updated: changes });
        }
    });
});

app.delete('/api/reworks/:id', (req, res) => {
    const reworkId = parseInt(req.params.id, 10);
    
    db.get("SELECT * FROM reworks WHERE id = ?", [reworkId], (err, rework) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!rework) return res.status(404).json({ error: "Rework not found" });

        db.get("SELECT COUNT(*) as newer_count FROM reworks WHERE pcb_id = ? AND id > ?", [rework.pcb_id, reworkId], (err, row) => {
            if (err) return res.status(500).json({ error: err.message });
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

            db.run("DELETE FROM reworks WHERE id = ?", [reworkId], function(err) {
                if (err) return res.status(500).json({ error: err.message });
                res.json({ deleted: this.changes });
            });
        });
    });
});

app.post('/api/test/cleanup', (req, res) => {
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

        db.run('PRAGMA foreign_keys = ON', (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: "Test data successfully cleaned up" });
        });
    });
});


