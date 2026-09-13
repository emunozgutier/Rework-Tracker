import fs from 'fs';
import path from 'path';

const sandboxDbPath = path.resolve(process.cwd(), 'src/store/serverDataBase/data/pcb_tracker_sandbox.db');
const sandboxUploadsPath = path.resolve(process.cwd(), 'src/store/serverDataBase/data/sandbox_uploads');

console.log('[Reset Sandbox] Resetting sandbox environment...');

const filesToDelete = [
    sandboxDbPath,
    `${sandboxDbPath}-wal`,
    `${sandboxDbPath}-shm`
];

filesToDelete.forEach(f => {
    if (fs.existsSync(f)) {
        try {
            fs.unlinkSync(f);
            console.log(`[Reset Sandbox] Deleted ${path.basename(f)}`);
        } catch (e: any) {
            console.warn(`[Reset Sandbox] Warning deleting ${f}:`, e.message);
        }
    }
});

if (fs.existsSync(sandboxUploadsPath)) {
    try {
        fs.rmSync(sandboxUploadsPath, { recursive: true, force: true });
        console.log('[Reset Sandbox] Emptied sandbox upload directory');
    } catch (e: any) {
        console.warn('[Reset Sandbox] Warning deleting sandbox uploads:', e.message);
    }
}
fs.mkdirSync(sandboxUploadsPath, { recursive: true });

console.log('[Reset Sandbox] Sandbox environment reset! Next time `npm run dev:sandbox` starts, it will automatically populate fresh demo data.');
