import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, '../src/store/database/pcb_tracker.db');
const db = new sqlite3.Database(dbPath);

db.all("SELECT id, name, project_key FROM projects", [], (err, rows) => {
    if (err) console.error("Projects err:", err);
    console.log("PROJECTS:", rows);
    db.all("SELECT id, name, username FROM owners", [], (err, rows2) => {
        console.log("OWNERS:", rows2);
        db.all("SELECT id, name FROM tags", [], (err, rows3) => {
            console.log("TAGS:", rows3);
            db.all("SELECT id, board_number, project_id, owner_id FROM pcbs", [], (err, rows4) => {
                console.log("PCBS:", rows4);
                db.close();
            });
        });
    });
});
