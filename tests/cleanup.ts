import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function cleanupTestData(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        const dbPath = path.resolve(__dirname, '../src/store/database/pcb_tracker.db');
        const db = new sqlite3.Database(dbPath);

        db.serialize(() => {
            db.run('PRAGMA foreign_keys = OFF');

            db.run(`
                DELETE FROM pcb_tags 
                WHERE pcb_id IN (
                    SELECT id FROM pcbs 
                    WHERE board_number LIKE '%vitest%' 
                       OR project_id IN (SELECT id FROM projects WHERE name LIKE '%vitest%' OR name LIKE '%Test Project%' OR project_key IN ('VTT', 'VVV', 'DIO', 'TPR'))
                )
            `);

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

            db.run(`
                DELETE FROM pcbs 
                WHERE board_number LIKE '%vitest%' 
                   OR project_id IN (SELECT id FROM projects WHERE name LIKE '%vitest%' OR name LIKE '%Test Project%' OR project_key IN ('VTT', 'VVV', 'DIO', 'TPR'))
                   OR owner_id IN (SELECT id FROM owners WHERE name LIKE '%vitest%' OR username LIKE '%vitest%')
            `);

            db.run(`
                DELETE FROM pcb_flavors 
                WHERE project_id IN (SELECT id FROM projects WHERE name LIKE '%vitest%' OR name LIKE '%Test Project%' OR project_key IN ('VTT', 'VVV', 'DIO', 'TPR'))
            `);

            db.run(`
                DELETE FROM projects 
                WHERE name LIKE '%vitest%' 
                   OR name LIKE '%Test Project%' 
                   OR project_key IN ('VTT', 'VVV', 'DIO', 'TPR', 'VT')
            `);

            db.run(`
                DELETE FROM tags 
                WHERE name LIKE '%vitest%' 
                   OR name LIKE '%test%' 
                   OR owner_id IN (SELECT id FROM owners WHERE name LIKE '%vitest%' OR username LIKE '%vitest%')
            `);

            db.run(`
                DELETE FROM owners 
                WHERE name LIKE '%vitest%' 
                   OR username LIKE '%vitest%'
            `);

            db.run('PRAGMA foreign_keys = ON', (err) => {
                db.close((closeErr) => {
                    if (err || closeErr) reject(err || closeErr);
                    else resolve();
                });
            });
        });
    });
}

export function updateCreatedAt(pcbId: number, daysAgo: number): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        const dbPath = path.resolve(__dirname, '../src/store/database/pcb_tracker.db');
        const db = new sqlite3.Database(dbPath);
        
        // Calculate date YYYY-MM-DD HH:MM:SS
        const targetDate = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
        const yyyy = targetDate.getUTCFullYear();
        const mm = String(targetDate.getUTCMonth() + 1).padStart(2, '0');
        const dd = String(targetDate.getUTCDate()).padStart(2, '0');
        const hh = String(targetDate.getUTCHours()).padStart(2, '0');
        const min = String(targetDate.getUTCMinutes()).padStart(2, '0');
        const ss = String(targetDate.getUTCSeconds()).padStart(2, '0');
        const dateStr = `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
        
        db.run("UPDATE pcbs SET created_at = ? WHERE id = ?", [dateStr, pcbId], (err) => {
            db.close((closeErr) => {
                if (err || closeErr) reject(err || closeErr);
                else resolve();
            });
        });
    });
}
