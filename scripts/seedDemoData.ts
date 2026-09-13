import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

const targetDbPath = process.env.DB_PATH 
    ? path.resolve(process.cwd(), process.env.DB_PATH)
    : path.resolve(process.cwd(), 'src/store/serverDataBase/data/pcb_tracker.db');

const demoDataPath = path.resolve(process.cwd(), 'src/store/serverDataBase/data/demoData.json');

console.log(`[Seed Demo Data] Target DB: ${targetDbPath}`);

if (!fs.existsSync(demoDataPath)) {
    console.error(`[Seed Demo Data] Error: ${demoDataPath} not found.`);
    process.exit(1);
}

const demoJson = JSON.parse(fs.readFileSync(demoDataPath, 'utf8'));
const { demoProjects = [], demoOwners = [], demoTags = [], demoPcbs = [], demoPcbTags = {}, demoReworks = [] } = demoJson;

const db = new sqlite3.Database(targetDbPath);
db.configure("busyTimeout", 10000);

const runAsync = (sql: string, params: any[] = []): Promise<any> => {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(this: any, err: Error | null) {
            if (err) return reject(err);
            resolve(this);
        });
    });
};

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

async function saveProjectHierarchy(projectId: number | string, packagesInput: any[], siliconVersionsInput: any[]): Promise<void> {
    await runAsync("DELETE FROM packages WHERE project_id = ?", [projectId]);
    await runAsync("DELETE FROM silicon_versions WHERE project_id = ?", [projectId]);

    let pkgsList = Array.isArray(packagesInput) ? packagesInput : [];
    if (pkgsList.length === 0) {
        pkgsList = [{ name: 'Default Package', description: '', formfactors: [] }];
    }

    for (const pkg of pkgsList) {
        const pkgName = pkg.name || 'Default Package';
        const res = await runAsync("INSERT INTO packages (project_id, name, description) VALUES (?, ?, ?)", [projectId, pkgName, pkg.description || '']);
        const packageId = res.lastID;

        for (const sv of siliconVersionsInput) {
            const svName = sv.name || 'A0';
            const cornersStr = Array.isArray(sv.silicon_corners) ? sv.silicon_corners.join(', ') : (sv.silicon_corners || '');
            const svRes = await runAsync("INSERT INTO silicon_versions (project_id, package_id, name, silicon_corners, description) VALUES (?, ?, ?, ?, ?)", [projectId, packageId, svName, cornersStr, sv.description || '']);
            const svId = svRes.lastID;

            const cornersArr = Array.isArray(sv.silicon_corners)
                ? sv.silicon_corners
                : (sv.silicon_corners ? String(sv.silicon_corners).split(',').map((s: string) => s.trim()).filter(Boolean) : []);
            for (const c of cornersArr) {
                await runAsync("INSERT OR IGNORE INTO silicon_corners (silicon_version_id, name) VALUES (?, ?)", [svId, c]);
            }
        }

        let rawFfs = pkg.formfactors || pkg.board_formfactors || [];
        if (rawFfs.length === 0) {
            rawFfs = [{ name: 'Default', revisions: ['1.0'] }];
        }

        for (const ff of rawFfs) {
            const ffName = ff.name || 'Default';
            const ffRes = await runAsync("INSERT INTO board_formfactors (package_id, silicon_version_id, name, description) VALUES (?, ?, ?, ?)", [packageId, null, ffName, ff.description || '']);
            const formfactorId = ffRes.lastID;

            let revisions = ff.revisionDetails || ff.revisions || ['1.0'];
            if (typeof revisions === 'string') {
                revisions = revisions.split(',').map((s: string) => s.trim()).filter(Boolean);
            }

            for (const r of revisions) {
                const revName = typeof r === 'object' ? (r.name || '1.0') : String(r);
                const revDesc = typeof r === 'object' ? (r.description || '') : '';
                const revRes = await runAsync("INSERT INTO board_formfactor_revisions (board_formfactor_id, name, description) VALUES (?, ?, ?)", [formfactorId, revName, revDesc]);
                const revisionId = revRes.lastID;

                let boms = ['Default'];
                if (typeof r === 'object' && r) {
                    if (Array.isArray(r.boms)) boms = r.boms;
                    else if (r.boms) boms = String(r.boms).split(',').map((s: string) => s.trim()).filter(Boolean);
                }
                for (const b of boms) {
                    await runAsync("INSERT OR IGNORE INTO bom_flavors (formfactor_revision_id, name) VALUES (?, ?)", [revisionId, b]);
                }
            }
        }
    }
}

async function seed() {
    try {
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

        // 1. Owners
        for (let i = 0; i < demoOwners.length; i++) {
            const o = demoOwners[i];
            const isSuper = i === 0 || o.username === 'admin' || o.username === 'asmith' ? 1 : 0;
            await runAsync("INSERT OR REPLACE INTO owners (id, name, username, is_super_user) VALUES (?, ?, ?, ?)", [o.id, o.name, o.username, isSuper]);
        }
        await runAsync("INSERT OR IGNORE INTO owners (id, name, username, is_super_user) VALUES (999, 'Super Admin', 'admin', 1)");

        // 2. Tags
        for (const t of demoTags) {
            await runAsync("INSERT OR REPLACE INTO tags (id, name, color, owner_id, type) VALUES (?, ?, ?, ?, ?)", [t.id, t.name, t.color || '#818cf8', t.owner_id || 1, t.type || 'public']);
        }

        // 3. Projects
        for (const p of demoProjects) {
            const cleanName = p.name;
            const finalKey = p.project_key || 'PRJ';
            await runAsync(
                "INSERT OR REPLACE INTO projects (id, name, description, revisions, project_key, silicon_corners, number_format, created_by, updated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                [p.id, cleanName, p.description || '', Array.isArray(p.revisions) ? p.revisions.join(', ') : (p.revisions || ''), finalKey, p.silicon_corners || null, p.number_format || 'decimal', 'admin', 'admin']
            );

            const pkgs = extractProjectPackages(p);
            const siVers = extractProjectSiliconVersions(p, pkgs);
            await saveProjectHierarchy(p.id, pkgs, siVers);
        }

        // 4. PCBs
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

        // 5. PCB Tags
        for (const [pcbId, tagIds] of Object.entries(demoPcbTags)) {
            if (Array.isArray(tagIds)) {
                for (const tId of tagIds) {
                    await runAsync("INSERT OR IGNORE INTO pcb_tags (pcb_id, tag_id) VALUES (?, ?)", [parseInt(pcbId), tId]);
                }
            }
        }

        // 6. Reworks
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

        console.log(`[Seed Demo Data] Successfully seeded demo dataset:`);
        console.log(`  - Projects: ${demoProjects.length}`);
        console.log(`  - PCBs: ${demoPcbs.length}`);
        console.log(`  - Reworks: ${demoReworks.length}`);
        console.log(`  - Tags: ${demoTags.length}`);
        console.log(`  - Owners: ${demoOwners.length}`);

        db.close();
    } catch (err: any) {
        console.error('[Seed Demo Data] Error seeding database:', err);
        db.close();
        process.exit(1);
    }
}

seed();
