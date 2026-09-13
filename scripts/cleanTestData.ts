import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

const targetDbPath = process.env.DB_PATH 
    ? path.resolve(process.cwd(), process.env.DB_PATH)
    : path.resolve(process.cwd(), 'src/store/serverDataBase/data/pcb_tracker.db');

const uploadRoot = process.env.UPLOAD_DIR
    ? path.resolve(process.cwd(), process.env.UPLOAD_DIR)
    : path.resolve(process.cwd(), 'src/store/serverDataBase');

console.log(`[Clean Test Data] Targeting database: ${targetDbPath}`);
console.log(`[Clean Test Data] Upload directory: ${uploadRoot}`);

if (!fs.existsSync(targetDbPath)) {
    console.log(`[Clean Test Data] Database file not found at ${targetDbPath}. Nothing to clean.`);
    process.exit(0);
}

const db = new sqlite3.Database(targetDbPath);
db.configure("busyTimeout", 10000);

const runAsync = (sql: string, params: any[] = []): Promise<{ changes: number }> => {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(this: any, err: Error | null) {
            if (err) return reject(err);
            resolve({ changes: this.changes || 0 });
        });
    });
};

const allAsync = (sql: string, params: any[] = []): Promise<any[]> => {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err: Error | null, rows: any[]) => {
            if (err) return reject(err);
            resolve(rows || []);
        });
    });
};

async function clean() {
    try {
        await runAsync('PRAGMA foreign_keys = OFF');

        // 1. Find and delete physical uploaded files linked to test projects or pcbs
        const files = await allAsync(`
            SELECT path FROM uploaded_docs 
            WHERE project_id IN (SELECT id FROM projects WHERE name LIKE '%vitest%' OR name LIKE '%Test Project%' OR name LIKE '%[TEST]%' OR project_key IN ('VTT', 'VVV', 'DIO', 'TPR'))
               OR pcb_id IN (SELECT id FROM pcbs WHERE board_number LIKE '%vitest%' OR board_number LIKE '%TEST%')
        `);

        let deletedFilesCount = 0;
        for (const file of files) {
            if (file.path) {
                const cleanRel = file.path.replace(/^\//, '');
                const diskPath = path.join(uploadRoot, cleanRel);
                if (fs.existsSync(diskPath)) {
                    try {
                        fs.unlinkSync(diskPath);
                        deletedFilesCount++;
                    } catch (e: any) {
                        console.warn(`Could not delete file ${diskPath}:`, e.message);
                    }
                }
            }
        }

        // 2. Delete database records in reverse dependency order
        const docsResult = await runAsync(`
            DELETE FROM uploaded_docs 
            WHERE project_id IN (SELECT id FROM projects WHERE name LIKE '%vitest%' OR name LIKE '%Test Project%' OR name LIKE '%[TEST]%' OR project_key IN ('VTT', 'VVV', 'DIO', 'TPR'))
               OR pcb_id IN (SELECT id FROM pcbs WHERE board_number LIKE '%vitest%' OR board_number LIKE '%TEST%')
        `);

        const pcbTagsResult = await runAsync(`
            DELETE FROM pcb_tags 
            WHERE pcb_id IN (
                SELECT id FROM pcbs 
                WHERE board_number LIKE '%vitest%' OR board_number LIKE '%TEST%'
                   OR project_id IN (SELECT id FROM projects WHERE name LIKE '%vitest%' OR name LIKE '%Test Project%' OR name LIKE '%[TEST]%' OR project_key IN ('VTT', 'VVV', 'DIO', 'TPR'))
            )
        `);

        const reworksResult = await runAsync(`
            DELETE FROM reworks 
            WHERE pcb_id IN (
                SELECT id FROM pcbs 
                WHERE board_number LIKE '%vitest%' OR board_number LIKE '%TEST%'
                   OR project_id IN (SELECT id FROM projects WHERE name LIKE '%vitest%' OR name LIKE '%Test Project%' OR name LIKE '%[TEST]%' OR project_key IN ('VTT', 'VVV', 'DIO', 'TPR'))
            )
            OR owner_id IN (SELECT id FROM owners WHERE name LIKE '%vitest%' OR username LIKE '%vitest%')
            OR description LIKE '%Vitest%'
            OR description LIKE '%[TEST]%'
            OR title LIKE '%[TEST]%'
            OR title LIKE '%Silicon Swap to B0%'
        `);

        const pcbsResult = await runAsync(`
            DELETE FROM pcbs 
            WHERE board_number LIKE '%vitest%' OR board_number LIKE '%TEST%'
               OR project_id IN (SELECT id FROM projects WHERE name LIKE '%vitest%' OR name LIKE '%Test Project%' OR name LIKE '%[TEST]%' OR project_key IN ('VTT', 'VVV', 'DIO', 'TPR'))
               OR owner_id IN (SELECT id FROM owners WHERE name LIKE '%vitest%' OR username LIKE '%vitest%')
        `);

        const pcbFlavorsResult = await runAsync(`
            DELETE FROM pcb_flavors 
            WHERE project_id IN (SELECT id FROM projects WHERE name LIKE '%vitest%' OR name LIKE '%Test Project%' OR name LIKE '%[TEST]%' OR project_key IN ('VTT', 'VVV', 'DIO', 'TPR'))
        `);

        const projectsResult = await runAsync(`
            DELETE FROM projects 
            WHERE name LIKE '%vitest%' 
               OR name LIKE '%Test Project%' 
               OR name LIKE '%[TEST]%'
               OR project_key IN ('VTT', 'VVV', 'DIO', 'TPR')
        `);

        const tagsResult = await runAsync(`
            DELETE FROM tags 
            WHERE name LIKE '%vitest%' 
               OR name LIKE '%test%' 
               OR name LIKE '%[TEST]%'
               OR owner_id IN (SELECT id FROM owners WHERE name LIKE '%vitest%' OR username LIKE '%vitest%')
        `);

        const ownersResult = await runAsync(`
            DELETE FROM owners 
            WHERE name LIKE '%vitest%' 
               OR username LIKE '%vitest%'
        `);

        await runAsync('PRAGMA foreign_keys = ON');

        console.log(`[Clean Test Data] Success! Cleaned up:`);
        console.log(`  - Projects: ${projectsResult.changes}`);
        console.log(`  - PCBs: ${pcbsResult.changes}`);
        console.log(`  - Reworks: ${reworksResult.changes}`);
        console.log(`  - PCB Tags: ${pcbTagsResult.changes}`);
        console.log(`  - Tags: ${tagsResult.changes}`);
        console.log(`  - Owners: ${ownersResult.changes}`);
        console.log(`  - Uploaded Docs: ${docsResult.changes}`);
        console.log(`  - Physical disk files deleted: ${deletedFilesCount}`);

        db.close();
    } catch (err: any) {
        console.error('[Clean Test Data] Error during cleanup:', err);
        db.close();
        process.exit(1);
    }
}

clean();
