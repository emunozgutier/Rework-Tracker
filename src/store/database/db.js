import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.resolve(__dirname, 'pcb_tracker.db');
const db = new sqlite3.Database(dbPath);

const initDb = () => {
    db.serialize(() => {
        db.run('PRAGMA foreign_keys = ON');
        
        // Projects Table
        db.run(`CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            revisions TEXT,
            project_key TEXT UNIQUE,
            silicon_corners TEXT,
            number_format TEXT DEFAULT 'decimal',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);
        db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_key ON projects(project_key)`);
        db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_name ON projects(name COLLATE NOCASE)`);

        // PCB Flavors Table
        db.run(`CREATE TABLE IF NOT EXISTS pcb_flavors (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            revisions TEXT,
            boms TEXT,
            FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        )`);

        // Owners Table
        db.run(`CREATE TABLE IF NOT EXISTS owners (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            username TEXT UNIQUE
        )`);
        db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_owners_username ON owners(username)`);

        // Tags Table
        db.run(`CREATE TABLE IF NOT EXISTS tags (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            color TEXT DEFAULT '#818cf8',
            owner_id INTEGER REFERENCES owners(id),
            type TEXT DEFAULT 'public'
        )`);
        db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_owner_name ON tags(owner_id, name COLLATE NOCASE)`);

        // PCBs Table
        db.run(`CREATE TABLE IF NOT EXISTS pcbs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            board_number TEXT NOT NULL,
            status TEXT DEFAULT 'In Progress',
            board_flavor TEXT,
            board_rev TEXT,
            silicon_rev TEXT,
            silicon_corner TEXT,
            bom TEXT,
            project_id INTEGER,
            owner_id INTEGER,
            FOREIGN KEY (project_id) REFERENCES projects (id),
            FOREIGN KEY (owner_id) REFERENCES owners (id)
        )`);
        db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_pcbs_project_board_nocase ON pcbs(project_id, board_number COLLATE NOCASE)`);

        // Reworks Table
        db.run(`CREATE TABLE IF NOT EXISTS reworks (
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
            FOREIGN KEY (pcb_id) REFERENCES pcbs (id),
            FOREIGN KEY (owner_id) REFERENCES owners (id)
        )`);
        db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_reworks_pcb_num ON reworks(pcb_id, rework_number)`);

        // PCB_Tags Join Table
        db.run(`CREATE TABLE IF NOT EXISTS pcb_tags (
            pcb_id INTEGER,
            tag_id INTEGER,
            PRIMARY KEY (pcb_id, tag_id),
            FOREIGN KEY (pcb_id) REFERENCES pcbs (id),
            FOREIGN KEY (tag_id) REFERENCES tags (id)
        )`);

        // Add Case-Insensitive Unique Indexes for all entities
        db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_owners_name_nocase ON owners(name COLLATE NOCASE)`);
        db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_name_nocase ON tags(name COLLATE NOCASE)`);

        // Migration: Add number_format column to projects if it doesn't exist
        db.run(`ALTER TABLE projects ADD COLUMN number_format TEXT DEFAULT 'decimal'`, (err) => {
            // Ignore error if column already exists
        });


        // Migration: Add new split columns to pcbs if they don't exist
        db.run(`ALTER TABLE pcbs ADD COLUMN board_flavor TEXT`, () => {});
        db.run(`ALTER TABLE pcbs ADD COLUMN board_rev TEXT`, () => {});
        db.run(`ALTER TABLE pcbs ADD COLUMN silicon_rev TEXT`, () => {});
        db.run(`ALTER TABLE pcbs ADD COLUMN silicon_corner TEXT`, () => {});
    });
};

export { db, initDb };
