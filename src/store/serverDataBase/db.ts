import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const getDbPath = (): string => {
    if (process.env.DB_PATH) return process.env.DB_PATH;
    const isTest = process.env.NODE_ENV === 'test' || typeof (globalThis as any).__vitest_worker__ !== 'undefined';
    const filename = isTest ? 'pcb_tracker_test.db' : 'pcb_tracker.db';
    return path.resolve(__dirname, 'data', filename);
};

export const dbPath = getDbPath();

let dbInstance: sqlite3.Database = new sqlite3.Database(dbPath);
dbInstance.configure("busyTimeout", 10000);

const db = {
    run: (sql: string, ...args: any[]): sqlite3.Database => (dbInstance.run as any)(sql, ...args),
    all: (sql: string, ...args: any[]): sqlite3.Database => (dbInstance.all as any)(sql, ...args),
    get: (sql: string, ...args: any[]): sqlite3.Database => (dbInstance.get as any)(sql, ...args),
    serialize: (callback?: () => void): void => dbInstance.serialize(callback),
    prepare: (sql: string, ...args: any[]): sqlite3.Statement => (dbInstance.prepare as any)(sql, ...args),
    close: (callback?: (err: Error | null) => void): void => dbInstance.close(callback)
};

const recreateDb = (): Promise<void> => {
    return new Promise((resolve, reject) => {
        const activePath = getDbPath();
        dbInstance.close((err) => {
            if (err && (err as any).code !== 'SQLITE_MISUSE') {
                console.error("Error closing corrupted DB:", err);
            }
            try {
                if (fs.existsSync(activePath)) fs.unlinkSync(activePath);
                if (fs.existsSync(`${activePath}-wal`)) fs.unlinkSync(`${activePath}-wal`);
                if (fs.existsSync(`${activePath}-shm`)) fs.unlinkSync(`${activePath}-shm`);
            } catch (e) {
                console.error("Error deleting DB files:", e);
            }
            dbInstance = new sqlite3.Database(activePath, (err) => {
                if (err) return reject(err);
                dbInstance.configure("busyTimeout", 10000);
                resolve();
            });
        });
    });
};

const checkIntegrity = (): Promise<boolean> => {
    return new Promise((resolve) => {
        dbInstance.get('PRAGMA integrity_check;', (err: Error | null, row: any) => {
            if (err) return resolve(false);
            if (row && row.integrity_check === 'ok') return resolve(true);
            resolve(false);
        });
    });
};

const initDb = async (): Promise<void> => {
    let isHealthy = await checkIntegrity();
    if (!isHealthy) {
        console.warn("Database corrupted or invalid. Recreating from scratch...");
        await recreateDb();
    }

    return new Promise<void>((resolve) => {
        dbInstance.serialize(() => {
            dbInstance.run('PRAGMA foreign_keys = ON');

            // Projects Table
            dbInstance.run(`CREATE TABLE IF NOT EXISTS projects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                description TEXT,
                revisions TEXT,
                project_key TEXT UNIQUE,
                silicon_corners TEXT,
                number_format TEXT DEFAULT 'decimal',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                created_by TEXT,
                updated_by TEXT
            )`);
            dbInstance.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_key ON projects(project_key)`);
            dbInstance.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_name ON projects(name COLLATE NOCASE)`);

            // Project Docs Table
            dbInstance.run(`CREATE TABLE IF NOT EXISTS project_docs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL,
                filename TEXT NOT NULL,
                path TEXT NOT NULL,
                uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            )`);

            // Legacy table rename: project_schematics -> project_docs
            dbInstance.get("SELECT name FROM sqlite_master WHERE type='table' AND name='project_schematics'", (_err: any, row: any) => {
                if (row) {
                    dbInstance.serialize(() => {
                        dbInstance.run("INSERT OR IGNORE INTO project_docs (id, project_id, filename, path, uploaded_at) SELECT id, project_id, filename, path, uploaded_at FROM project_schematics", () => {
                            dbInstance.run("DROP TABLE IF EXISTS project_schematics");
                        });
                    });
                }
            });

            // PCB Flavors Table (Legacy / compatibility)
            dbInstance.run(`CREATE TABLE IF NOT EXISTS pcb_flavors (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                revisions TEXT,
                boms TEXT,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            )`);

            // Packages Table (e.g. '40 pin', '48 pin IC')
            dbInstance.run(`CREATE TABLE IF NOT EXISTS packages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                description TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            )`);
            dbInstance.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_packages_project_name ON packages(project_id, name COLLATE NOCASE)`);

            // Silicon Versions Table (e.g. 'A0', 'B0')
            dbInstance.run(`CREATE TABLE IF NOT EXISTS silicon_versions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER,
                package_id INTEGER,
                name TEXT NOT NULL,
                silicon_corners TEXT,
                description TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
                FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE
            )`);
            dbInstance.run(`CREATE INDEX IF NOT EXISTS idx_silicon_versions_pkg ON silicon_versions(package_id)`);

            // Silicon Corners Table (e.g. 'TT', 'FF', 'SS')
            dbInstance.run(`CREATE TABLE IF NOT EXISTS silicon_corners (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                silicon_version_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                FOREIGN KEY (silicon_version_id) REFERENCES silicon_versions(id) ON DELETE CASCADE
            )`);
            dbInstance.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_silicon_corners_ver_name ON silicon_corners(silicon_version_id, name COLLATE NOCASE)`);

            // Board FormFactors Table (e.g. 'Demo', 'Validation', 'SVB')
            dbInstance.run(`CREATE TABLE IF NOT EXISTS board_formfactors (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                package_id INTEGER,
                silicon_version_id INTEGER,
                name TEXT NOT NULL,
                description TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE,
                FOREIGN KEY (silicon_version_id) REFERENCES silicon_versions(id) ON DELETE CASCADE
            )`);

            // Board FormFactor Revisions Table (e.g. '1.0', '1.1', '2.0')
            dbInstance.run(`CREATE TABLE IF NOT EXISTS board_formfactor_revisions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                board_formfactor_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                description TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (board_formfactor_id) REFERENCES board_formfactors(id) ON DELETE CASCADE
            )`);
            dbInstance.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_bff_revisions_ff_name ON board_formfactor_revisions(board_formfactor_id, name COLLATE NOCASE)`);

            // BOM Flavors Table (e.g. 'Default', 'BOM1', 'BOM2')
            dbInstance.run(`CREATE TABLE IF NOT EXISTS bom_flavors (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                formfactor_revision_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                description TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (formfactor_revision_id) REFERENCES board_formfactor_revisions(id) ON DELETE CASCADE
            )`);
            dbInstance.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_bom_flavors_rev_name ON bom_flavors(formfactor_revision_id, name COLLATE NOCASE)`);

            // FormFactor Revision Documents Table (Schematic PDF, Board BRD, BOM CSV, Datasheet PDF)
            dbInstance.run(`CREATE TABLE IF NOT EXISTS formfactor_revision_docs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                formfactor_revision_id INTEGER NOT NULL,
                doc_type TEXT NOT NULL,
                filename TEXT NOT NULL,
                path TEXT NOT NULL,
                uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (formfactor_revision_id) REFERENCES board_formfactor_revisions(id) ON DELETE CASCADE
            )`);
            dbInstance.run(`CREATE INDEX IF NOT EXISTS idx_ff_revision_docs_rev ON formfactor_revision_docs(formfactor_revision_id)`);

            // Uploaded Docs Table (Unified registry for pictures, schematics, board files, bom files, datasheets)
            dbInstance.run(`CREATE TABLE IF NOT EXISTS uploaded_docs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                entity_type TEXT NOT NULL, -- 'rework' | 'revision' | 'project' | 'pcb'
                entity_id INTEGER NOT NULL,
                project_id INTEGER,
                pcb_id INTEGER,
                doc_type TEXT NOT NULL,    -- 'picture' | 'schematic' | 'board_file' | 'bom_csv' | 'datasheet' | 'other'
                filename TEXT NOT NULL,
                original_filename TEXT,
                path TEXT NOT NULL,
                file_size INTEGER DEFAULT 0,
                mime_type TEXT,
                uploaded_by TEXT,
                uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
            )`);
            dbInstance.run(`CREATE INDEX IF NOT EXISTS idx_uploaded_docs_entity ON uploaded_docs(entity_type, entity_id)`);
            dbInstance.run(`CREATE INDEX IF NOT EXISTS idx_uploaded_docs_type ON uploaded_docs(doc_type)`);
            dbInstance.run(`CREATE INDEX IF NOT EXISTS idx_uploaded_docs_project ON uploaded_docs(project_id)`);
            dbInstance.run(`CREATE INDEX IF NOT EXISTS idx_uploaded_docs_pcb ON uploaded_docs(pcb_id)`);

            // Owners Table
            dbInstance.run(`CREATE TABLE IF NOT EXISTS owners (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                username TEXT UNIQUE,
                email TEXT,
                otp_secret TEXT,
                otp_reset_token TEXT,
                otp_reset_expires INTEGER,
                otp_reset_by TEXT,
                otp_reset_at TEXT,
                crc_format TEXT,
                login_attempts TEXT,
                is_super_user INTEGER DEFAULT 0
            )`);
            dbInstance.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_owners_username ON owners(username)`);
            dbInstance.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_owners_name_nocase ON owners(name COLLATE NOCASE)`);

            // Migration: add is_super_user column if it doesn't exist yet
            dbInstance.all('PRAGMA table_info(owners)', (_err: any, columns: any[]) => {
                if (columns && !columns.some((c: any) => c.name === 'is_super_user')) {
                    dbInstance.run(`ALTER TABLE owners ADD COLUMN is_super_user INTEGER DEFAULT 0`);
                }
            });
            // Seed: set the first registered user (lowest id) as Super User if none are marked yet.
            // Run unconditionally so it works even if the column already existed before ALTER TABLE.
            setTimeout(() => {
                dbInstance.get("SELECT COUNT(*) as cnt FROM owners WHERE is_super_user = 1", [], (_e: any, row: any) => {
                    if (row && row.cnt === 0) {
                        dbInstance.run("UPDATE owners SET is_super_user = 1 WHERE id = (SELECT MIN(id) FROM owners)");
                    }
                });
            }, 500);

            // Tags Table
            dbInstance.run(`CREATE TABLE IF NOT EXISTS tags (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                color TEXT DEFAULT '#818cf8',
                owner_id INTEGER REFERENCES owners(id),
                type TEXT DEFAULT 'public'
            )`);
            dbInstance.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_owner_name ON tags(owner_id, name COLLATE NOCASE)`);
            dbInstance.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_name_nocase ON tags(name COLLATE NOCASE)`);

            // Global Settings Table
            dbInstance.run(`CREATE TABLE IF NOT EXISTS global_settings (
                key TEXT PRIMARY KEY,
                value TEXT
            )`);
            dbInstance.run(`INSERT OR IGNORE INTO global_settings (key, value) VALUES ('allowGuestMinorRework', 'true')`);
            dbInstance.run(`INSERT OR IGNORE INTO global_settings (key, value) VALUES ('priority_Silicon Swap', 'High')`);
            dbInstance.run(`INSERT OR IGNORE INTO global_settings (key, value) VALUES ('priority_Major Rework', 'High')`);
            dbInstance.run(`INSERT OR IGNORE INTO global_settings (key, value) VALUES ('priority_Minor Rework', 'Low')`);
            dbInstance.run(`INSERT OR IGNORE INTO global_settings (key, value) VALUES ('priority_Resistor Swap', 'Low')`);

            // PCBs Table
            dbInstance.run(`CREATE TABLE IF NOT EXISTS pcbs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                board_number TEXT NOT NULL,
                status TEXT DEFAULT 'In Progress',
                board_flavor TEXT,
                board_flavor_id INTEGER REFERENCES pcb_flavors(id),
                board_rev TEXT,
                silicon_rev TEXT,
                silicon_corner TEXT,
                bom TEXT,
                project_id INTEGER,
                package_id INTEGER REFERENCES packages(id),
                package_name TEXT,
                silicon_version_id INTEGER REFERENCES silicon_versions(id),
                board_formfactor_id INTEGER REFERENCES board_formfactors(id),
                formfactor_revision_id INTEGER REFERENCES board_formfactor_revisions(id),
                bom_flavor_id INTEGER REFERENCES bom_flavors(id),
                owner_id INTEGER,
                short_code TEXT UNIQUE,
                manufacturer_id TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                created_by TEXT,
                updated_by TEXT,
                FOREIGN KEY (project_id) REFERENCES projects (id),
                FOREIGN KEY (owner_id) REFERENCES owners (id)
            )`);
            dbInstance.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_pcbs_project_board_nocase ON pcbs(project_id, board_number COLLATE NOCASE)`);

            // Migration: add new columns to pcbs if they don't exist yet
            dbInstance.all('PRAGMA table_info(pcbs)', (_err: any, columns: any[]) => {
                if (columns) {
                    if (!columns.some((c: any) => c.name === 'manufacturer_id')) {
                        dbInstance.run(`ALTER TABLE pcbs ADD COLUMN manufacturer_id TEXT`);
                    }
                    if (!columns.some((c: any) => c.name === 'package_id')) {
                        dbInstance.run(`ALTER TABLE pcbs ADD COLUMN package_id INTEGER REFERENCES packages(id)`);
                    }
                    if (!columns.some((c: any) => c.name === 'package_name')) {
                        dbInstance.run(`ALTER TABLE pcbs ADD COLUMN package_name TEXT`);
                    }
                    if (!columns.some((c: any) => c.name === 'silicon_version_id')) {
                        dbInstance.run(`ALTER TABLE pcbs ADD COLUMN silicon_version_id INTEGER REFERENCES silicon_versions(id)`);
                    }
                    if (!columns.some((c: any) => c.name === 'board_formfactor_id')) {
                        dbInstance.run(`ALTER TABLE pcbs ADD COLUMN board_formfactor_id INTEGER REFERENCES board_formfactors(id)`);
                    }
                    if (!columns.some((c: any) => c.name === 'formfactor_revision_id')) {
                        dbInstance.run(`ALTER TABLE pcbs ADD COLUMN formfactor_revision_id INTEGER REFERENCES board_formfactor_revisions(id)`);
                    }
                    if (!columns.some((c: any) => c.name === 'bom_flavor_id')) {
                        dbInstance.run(`ALTER TABLE pcbs ADD COLUMN bom_flavor_id INTEGER REFERENCES bom_flavors(id)`);
                    }
                }
            });

            // Drop obsolete unique index on silicon_version_id if present
            dbInstance.run("DROP INDEX IF EXISTS idx_board_formfactors_ver_name");

            // Migration: ensure board_formfactors has package_id and nullable silicon_version_id
            dbInstance.all('PRAGMA table_info(board_formfactors)', (_err: any, columns: any[]) => {
                if (columns) {
                    const siCol = columns.find((c: any) => c.name === 'silicon_version_id');
                    const hasPkgCol = columns.some((c: any) => c.name === 'package_id');
                    if (!hasPkgCol || (siCol && siCol.notnull === 1)) {
                        dbInstance.serialize(() => {
                            dbInstance.run("PRAGMA foreign_keys = OFF");
                            dbInstance.run(`CREATE TABLE IF NOT EXISTS board_formfactors_migration (
                                id INTEGER PRIMARY KEY AUTOINCREMENT,
                                package_id INTEGER,
                                silicon_version_id INTEGER,
                                name TEXT NOT NULL,
                                description TEXT,
                                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                                FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE,
                                FOREIGN KEY (silicon_version_id) REFERENCES silicon_versions(id) ON DELETE CASCADE
                            )`);
                            dbInstance.run(`INSERT OR IGNORE INTO board_formfactors_migration (id, package_id, silicon_version_id, name, description, created_at)
                                SELECT b.id, 
                                       COALESCE(b.package_id, sv.package_id), 
                                       b.silicon_version_id, 
                                       b.name, 
                                       b.description, 
                                       b.created_at
                                FROM board_formfactors b
                                LEFT JOIN silicon_versions sv ON sv.id = b.silicon_version_id`);
                            dbInstance.run("DROP TABLE board_formfactors");
                            dbInstance.run("ALTER TABLE board_formfactors_migration RENAME TO board_formfactors");
                            dbInstance.run("CREATE INDEX IF NOT EXISTS idx_board_formfactors_pkg ON board_formfactors(package_id)");
                            dbInstance.run("PRAGMA foreign_keys = ON");
                        });
                    }
                }
            });

            // Migration: ensure silicon_versions has project_id and nullable package_id
            dbInstance.all('PRAGMA table_info(silicon_versions)', (_err: any, columns: any[]) => {
                if (columns) {
                    const pkgCol = columns.find((c: any) => c.name === 'package_id');
                    const hasProjCol = columns.some((c: any) => c.name === 'project_id');
                    if (!hasProjCol || (pkgCol && pkgCol.notnull === 1)) {
                        dbInstance.serialize(() => {
                            dbInstance.run("PRAGMA foreign_keys = OFF");
                            dbInstance.run(`CREATE TABLE IF NOT EXISTS silicon_versions_migration (
                                id INTEGER PRIMARY KEY AUTOINCREMENT,
                                project_id INTEGER,
                                package_id INTEGER,
                                name TEXT NOT NULL,
                                silicon_corners TEXT,
                                description TEXT,
                                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                                FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
                                FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE
                            )`);
                            dbInstance.run(`INSERT OR IGNORE INTO silicon_versions_migration (id, project_id, package_id, name, silicon_corners, description, created_at)
                                SELECT sv.id,
                                       COALESCE(sv.project_id, pkg.project_id),
                                       sv.package_id,
                                       sv.name,
                                       sv.silicon_corners,
                                       sv.description,
                                       sv.created_at
                                FROM silicon_versions sv
                                LEFT JOIN packages pkg ON pkg.id = sv.package_id`);
                            dbInstance.run("DROP TABLE silicon_versions");
                            dbInstance.run("ALTER TABLE silicon_versions_migration RENAME TO silicon_versions");
                            dbInstance.run("CREATE INDEX IF NOT EXISTS idx_silicon_versions_proj ON silicon_versions(project_id)");
                            dbInstance.run("CREATE INDEX IF NOT EXISTS idx_silicon_versions_pkg ON silicon_versions(package_id)");
                            dbInstance.run("PRAGMA foreign_keys = ON");
                        });
                    }
                }
            });

            // Auto-migrate legacy project structure to packages hierarchy if packages table is empty
            setTimeout(() => {
                dbInstance.get("SELECT COUNT(*) as cnt FROM packages", [], (_e: any, rowPkg: any) => {
                    if (rowPkg && rowPkg.cnt === 0) {
                        dbInstance.all("SELECT * FROM projects", [], (_ePrj: any, prjRows: any[]) => {
                            if (!prjRows || prjRows.length === 0) return;
                            dbInstance.all("SELECT * FROM pcb_flavors", [], (_eFlv: any, flvRows: any[]) => {
                                const flavors = flvRows || [];
                                prjRows.forEach(proj => {
                                    dbInstance.run("INSERT INTO packages (project_id, name, description) VALUES (?, ?, ?)", [proj.id, 'Default Package', 'Auto-migrated package'], function(this: any) {
                                        const pkgId = this.lastID;
                                        if (!pkgId) return;

                                        let siliconRevs = ['A0'];
                                        if (proj.revisions) {
                                            const revs = proj.revisions.split(',').map((s: string) => s.trim()).filter(Boolean);
                                            if (revs.length > 0) siliconRevs = revs;
                                        }

                                        siliconRevs.forEach(siRev => {
                                            dbInstance.run("INSERT INTO silicon_versions (package_id, name, silicon_corners) VALUES (?, ?, ?)", [pkgId, siRev, proj.silicon_corners || null], function(this: any) {
                                                const siVerId = this.lastID;
                                                if (!siVerId) return;

                                                if (proj.silicon_corners) {
                                                    const corners = proj.silicon_corners.split(',').map((c: string) => c.trim()).filter(Boolean);
                                                    corners.forEach((corner: string) => {
                                                        dbInstance.run("INSERT OR IGNORE INTO silicon_corners (silicon_version_id, name) VALUES (?, ?)", [siVerId, corner]);
                                                    });
                                                }

                                                const projFlavors = flavors.filter((f: any) => f.project_id === proj.id);
                                                const flavorList = projFlavors.length > 0 ? projFlavors : [{ name: 'Default', revisions: '1.0', boms: 'Default' }];

                                                flavorList.forEach((flv: any) => {
                                                    dbInstance.run("INSERT INTO board_formfactors (silicon_version_id, name) VALUES (?, ?)", [siVerId, flv.name], function(this: any) {
                                                        const bffId = this.lastID;
                                                        if (!bffId) return;

                                                        let revsList: any[] = [];
                                                        if (flv.revisions) {
                                                            try {
                                                                const p = (typeof flv.revisions === 'string' && (flv.revisions.startsWith('[') || flv.revisions.startsWith('{'))) ? JSON.parse(flv.revisions) : flv.revisions;
                                                                revsList = Array.isArray(p) ? p : [p];
                                                            } catch {
                                                                revsList = String(flv.revisions).split(',').map((s: string) => s.trim());
                                                            }
                                                        } else {
                                                            revsList = ['1.0'];
                                                        }

                                                        revsList.forEach((revItem: any) => {
                                                            const revName = typeof revItem === 'object' && revItem ? revItem.name : String(revItem);
                                                            dbInstance.run("INSERT INTO board_formfactor_revisions (board_formfactor_id, name) VALUES (?, ?)", [bffId, revName], function(this: any) {
                                                                const revId = this.lastID;
                                                                if (!revId) return;

                                                                let bomsList: string[] = [];
                                                                if (typeof revItem === 'object' && revItem && revItem.boms) {
                                                                    bomsList = Array.isArray(revItem.boms) ? revItem.boms : String(revItem.boms).split(',').map((s: string) => s.trim());
                                                                } else if (flv.boms) {
                                                                    try {
                                                                        const p = (typeof flv.boms === 'string' && (flv.boms.startsWith('[') || flv.boms.startsWith('{'))) ? JSON.parse(flv.boms) : flv.boms;
                                                                        bomsList = Array.isArray(p) ? p : [p];
                                                                    } catch {
                                                                        bomsList = String(flv.boms).split(',').map((s: string) => s.trim());
                                                                    }
                                                                }

                                                                bomsList.filter(Boolean).forEach((bomName: string) => {
                                                                    dbInstance.run("INSERT OR IGNORE INTO bom_flavors (formfactor_revision_id, name) VALUES (?, ?)", [revId, bomName]);
                                                                });

                                                                if (typeof revItem === 'object' && revItem) {
                                                                    if (revItem.schematic || revItem.doc) {
                                                                        const schName = revItem.schematic || revItem.doc;
                                                                        dbInstance.run("INSERT INTO formfactor_revision_docs (formfactor_revision_id, doc_type, filename, path) VALUES (?, 'schematic', ?, ?)", [revId, schName, `/docs/${schName}`]);
                                                                    }
                                                                    if (revItem.board_file) {
                                                                        dbInstance.run("INSERT INTO formfactor_revision_docs (formfactor_revision_id, doc_type, filename, path) VALUES (?, 'board_file', ?, ?)", [revId, revItem.board_file, `/docs/${revItem.board_file}`]);
                                                                    }
                                                                    if (revItem.bom_csv) {
                                                                        dbInstance.run("INSERT INTO formfactor_revision_docs (formfactor_revision_id, doc_type, filename, path) VALUES (?, 'bom_csv', ?, ?)", [revId, revItem.bom_csv, `/docs/${revItem.bom_csv}`]);
                                                                    }
                                                                    if (revItem.datasheet) {
                                                                        dbInstance.run("INSERT INTO formfactor_revision_docs (formfactor_revision_id, doc_type, filename, path) VALUES (?, 'datasheet', ?, ?)", [revId, revItem.datasheet, `/docs/${revItem.datasheet}`]);
                                                                    }
                                                                }
                                                            });
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
                });
            }, 800);

            // Reworks Table
            dbInstance.run(`CREATE TABLE IF NOT EXISTS reworks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                pcb_id INTEGER,
                title TEXT,
                rework_number INTEGER,
                description TEXT NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                status TEXT DEFAULT 'Completed',
                owner_id INTEGER,
                image_path TEXT,
                rework_type TEXT DEFAULT 'Minor',
                created_by TEXT,
                updated_by TEXT,
                FOREIGN KEY (pcb_id) REFERENCES pcbs (id),
                FOREIGN KEY (owner_id) REFERENCES owners (id)
            )`);
            dbInstance.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_reworks_pcb_num ON reworks(pcb_id, rework_number)`);

            // PCB_Tags Join Table
            dbInstance.run(`CREATE TABLE IF NOT EXISTS pcb_tags (
                pcb_id INTEGER,
                tag_id INTEGER,
                PRIMARY KEY (pcb_id, tag_id),
                FOREIGN KEY (pcb_id) REFERENCES pcbs (id),
                FOREIGN KEY (tag_id) REFERENCES tags (id)
            )`);

            // Restore from data.sql if the database is empty
            dbInstance.get("SELECT COUNT(*) as count FROM projects", (_errCount: any, rowCount: any) => {
                if (rowCount && rowCount.count === 0) {
                    console.log("Database projects table is empty. Checking for data.sql recovery...");
                    const sqlPath = path.resolve(__dirname, 'data', 'data.sql');
                    if (fs.existsSync(sqlPath)) {
                        console.log("Recovering database from data.sql...");
                        try {
                            const sqlContent = fs.readFileSync(sqlPath, 'utf8');
                            const cleanSql = sqlContent.split('\n')
                                .filter((line: string) => !line.trim().startsWith('.'))
                                .join('\n')
                                .replace(/CREATE TABLE /gi, 'CREATE TABLE IF NOT EXISTS ')
                                .replace(/CREATE UNIQUE INDEX /gi, 'CREATE UNIQUE INDEX IF NOT EXISTS ');

                            dbInstance.run('PRAGMA foreign_keys = OFF', () => {
                                dbInstance.exec(cleanSql, (execErr: any) => {
                                    if (execErr) {
                                        console.error("Error executing data.sql:", execErr);
                                    } else {
                                        console.log("data.sql loaded successfully.");
                                    }
                                    dbInstance.run('PRAGMA foreign_keys = ON', () => {
                                        resolve();
                                    });
                                });
                            });
                        } catch (e: any) {
                            console.error("Failed to recover data from data.sql:", e.message);
                            resolve();
                        }
                    } else {
                        resolve();
                    }
                } else {
                    resolve();
                }
            });

            // Auto-migrate legacy documents (project_docs, formfactor_revision_docs, reworks.image_path) to uploaded_docs
            setTimeout(() => {
                autoMigrateUploadedDocs(dbInstance);
            }, 1000);
        });
    });
};

export function autoMigrateUploadedDocs(dbInstance: any = db) {
    if (!dbInstance) return;

    // 1. Backfill from project_docs
    dbInstance.run(`
        INSERT OR IGNORE INTO uploaded_docs (entity_type, entity_id, project_id, doc_type, filename, original_filename, path, uploaded_at)
        SELECT 'project', pd.project_id, (SELECT id FROM projects WHERE id = pd.project_id),
               CASE 
                 WHEN lower(pd.filename) LIKE '%.brd' THEN 'board_file'
                 WHEN lower(pd.filename) LIKE '%.csv' THEN 'bom_csv'
                 WHEN lower(pd.filename) LIKE '%datasheet%.pdf' THEN 'datasheet'
                 WHEN lower(pd.filename) LIKE '%.pdf' THEN 'schematic'
                 ELSE 'other'
               END,
               pd.filename, pd.filename, pd.path, pd.uploaded_at
        FROM project_docs pd
        WHERE NOT EXISTS (
            SELECT 1 FROM uploaded_docs u
            WHERE u.entity_type = 'project' AND u.entity_id = pd.project_id AND u.path = pd.path
        )
    `);

    // 2. Backfill from formfactor_revision_docs
    dbInstance.run(`
        INSERT OR IGNORE INTO uploaded_docs (entity_type, entity_id, project_id, doc_type, filename, original_filename, path, uploaded_at)
        SELECT 'revision', ffrd.formfactor_revision_id, (SELECT id FROM projects WHERE id = pkg.project_id), ffrd.doc_type, ffrd.filename, ffrd.filename, ffrd.path, ffrd.uploaded_at
        FROM formfactor_revision_docs ffrd
        LEFT JOIN board_formfactor_revisions bffr ON bffr.id = ffrd.formfactor_revision_id
        LEFT JOIN board_formfactors bff ON bff.id = bffr.board_formfactor_id
        LEFT JOIN silicon_versions sv ON sv.id = bff.silicon_version_id
        LEFT JOIN packages pkg ON pkg.id = sv.package_id
        WHERE NOT EXISTS (
            SELECT 1 FROM uploaded_docs u
            WHERE u.entity_type = 'revision' AND u.entity_id = ffrd.formfactor_revision_id AND u.path = ffrd.path
        )
    `);

    // 3. Backfill from reworks.image_path
    dbInstance.all(
        `SELECT r.id, r.pcb_id, r.image_path, r.timestamp, r.created_by, p.project_id
         FROM reworks r
         LEFT JOIN pcbs p ON p.id = r.pcb_id
         WHERE r.image_path IS NOT NULL AND r.image_path != ''`,
        [],
        (_err: any, reworkRows: any[]) => {
            if (!reworkRows || reworkRows.length === 0) return;
            reworkRows.forEach(rw => {
                let imgList: string[] = [];
                try {
                    imgList = JSON.parse(rw.image_path);
                    if (!Array.isArray(imgList)) imgList = [rw.image_path];
                } catch {
                    imgList = [rw.image_path];
                }
                imgList.forEach(imgUrl => {
                    if (!imgUrl || typeof imgUrl !== 'string') return;
                    const fn = path.basename(imgUrl);
                    dbInstance.get(
                        "SELECT id FROM uploaded_docs WHERE entity_type = 'rework' AND entity_id = ? AND path = ?",
                        [rw.id, imgUrl],
                        (_errDoc: any, docRow: any) => {
                            if (!docRow) {
                                dbInstance.get("SELECT id FROM projects WHERE id = ?", [rw.project_id], (_ePrj: any, prjRow: any) => {
                                    const finalProjectId = prjRow ? rw.project_id : null;
                                    dbInstance.run(
                                        `INSERT INTO uploaded_docs (entity_type, entity_id, project_id, pcb_id, doc_type, filename, original_filename, path, mime_type, uploaded_by, uploaded_at)
                                         VALUES ('rework', ?, ?, ?, 'picture', ?, ?, ?, 'image/jpeg', ?, ?)`,
                                        [rw.id, finalProjectId, rw.pcb_id || null, fn, fn, imgUrl, rw.created_by || 'guest', rw.timestamp || new Date().toISOString()]
                                    );
                                });
                            }
                        }
                    );
                });
            });
        }
    );
}

export { db, initDb };