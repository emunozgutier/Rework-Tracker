import { useDemoStore } from '../useDemoStore';
import { useAppState } from '../useAppState';
import { usePermissionsStore } from '../clientDataBase/usePermissionsStore';
import { getSessionCookie } from '../../authentication/clientAuth';
import demoData from './data/demoData.json';

const getApiBase = () => {
    // In Node / Vitest test runner, connect directly to local test backend on 5002
    if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') {
        return 'http://localhost:5002/api';
    }
    // In browser, use relative base path so requests stay on HTTPS and route through proxy
    if (typeof window !== 'undefined') {
        const base = import.meta.env?.BASE_URL || '/';
        const cleanBase = base.endsWith('/') ? base : `${base}/`;
        return `${cleanBase}api`;
    }
    return '/api';
};

export const API_BASE = getApiBase();


let internalProjects = [...demoData.demoProjects] as any[];
let internalPcbs = [...demoData.demoPcbs] as any[];
let internalOwners = (demoData.demoOwners as any[]).map((o: any, idx: number) => ({
    ...o,
    is_super_user: o.is_super_user !== undefined ? o.is_super_user : (idx === 0 ? 1 : 0)
}));
let internalProjectDocs = [] as any[];
let docIdCounter = 1;
internalProjects.forEach((p: any) => {
    internalProjectDocs.push({
        id: docIdCounter++,
        project_id: p.id,
        filename: "BBB-SCH.pdf",
        path: "/docs/BBB-SCH.pdf",
        uploaded_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
    });
    internalProjectDocs.push({
        id: docIdCounter++,
        project_id: p.id,
        filename: "BBB.brd",
        path: "/docs/BBB.brd",
        uploaded_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
    });
});
const reworkCounts: Record<number, number> = {};
let internalReworks = demoData.demoReworks.map((r: any) => {

    if (!reworkCounts[r.pcb_id]) reworkCounts[r.pcb_id] = 0;
    reworkCounts[r.pcb_id]++;
    return {
        ...r,
        rework_number: r.rework_number || reworkCounts[r.pcb_id]
    };
}) as any[];
let internalTags = [...demoData.demoTags] as any[];
let internalPcbTags = { ...demoData.demoPcbTags } as any;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function createResponse(data: any, status = 200) {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => data
    } as Response;
}

const inFlightDemoRequests = new Map<string, { listeners: Array<(res: Response) => void>; response: Response | null }>();
let demoWriteQueue = Promise.resolve();

export async function apiFetch(fullUrl: string, options?: RequestInit): Promise<Response> {
    const isDemoMode = useDemoStore.getState().isDemoMode;
    
    if (!isDemoMode) {
        const { currentUser, currentUserRole, debugBypassPermissions } = useAppState.getState();
        const headers = new Headers(options?.headers);
        const username = currentUser?.username || (currentUserRole === 'Super User' ? 'admin' : 'guest');
        const name = currentUser?.name || (currentUserRole === 'Super User' ? 'Super User' : 'Guest');
        headers.set('X-User-Username', username);
        headers.set('X-User-Name', name);
        headers.set('X-User-Role', currentUserRole);

        if (debugBypassPermissions) {
            headers.set('X-Debug-Bypass', 'true');
        }

        try {
            const { permissions } = usePermissionsStore.getState();
            const canAddProj = debugBypassPermissions || currentUserRole === 'Super User' ||
                (currentUserRole === 'User' && permissions['Projects__Add__user'] === true) ||
                (currentUserRole === 'Guest' && permissions['Projects__Add__guest'] === true);
            if (canAddProj) {
                headers.set('X-Allow-Add-Project', 'true');
            }

            const canEditProj = debugBypassPermissions || currentUserRole === 'Super User' ||
                (currentUserRole === 'User' && permissions['Projects__Edit__user'] === true) ||
                (currentUserRole === 'Guest' && permissions['Projects__Edit__guest'] === true);
            if (canEditProj) {
                headers.set('X-Allow-Edit-Project', 'true');
            }

            const canAddDoc = debugBypassPermissions || currentUserRole === 'Super User' ||
                (currentUserRole === 'User' && permissions['Docs__Add__user'] === true) ||
                (currentUserRole === 'Guest' && permissions['Docs__Add__guest'] === true);
            if (canAddDoc) {
                headers.set('X-Allow-Add-Doc', 'true');
            }
        } catch {}

        const token = getSessionCookie();
        if (token) {
            headers.set('Authorization', `Bearer ${token}`);
            headers.set('X-Session-Token', token);
        }
        
        return fetch(fullUrl, {
            ...options,
            headers
        });
    }

    const method = options?.method || 'GET';

    // GET requests don't need deduplication or queueing
    if (method === 'GET') {
        return processDemoRequest(fullUrl, options);
    }

    // Deduplicate identical in-flight write requests (POST, PUT, DELETE)
    let bodyStr = '';
    if (options?.body) {
        if (typeof options.body === 'string') {
            bodyStr = options.body;
        } else if (options.body instanceof FormData) {
            bodyStr = JSON.stringify(Object.fromEntries(options.body.entries()));
        }
    }
    const key = `${method}:${fullUrl}:${bodyStr}`;

    if (inFlightDemoRequests.has(key)) {
        console.log(`[Demo Deduplicate] Duplicate request detected: ${key}`);
        const pending = inFlightDemoRequests.get(key)!;
        if (pending.response) {
            console.log(`[Demo Deduplicate] Returning cached response for key: ${key}`);
            return Promise.resolve(pending.response);
        }
        return new Promise<Response>((resolve) => {
            pending.listeners.push(resolve);
        });
    }

    const pending: { listeners: Array<(res: Response) => void>; response: Response | null } = {
        listeners: [],
        response: null
    };
    inFlightDemoRequests.set(key, pending);

    // Queue all writes to prevent race conditions (e.g. concurrent inserts trying to generate same sequence ID)
    return new Promise<Response>((resolve, reject) => {
        demoWriteQueue = demoWriteQueue.then(async () => {
            try {
                const response = await processDemoRequest(fullUrl, options);
                pending.response = response;
                
                // Keep in cache for 3 seconds to catch quick staggered retries/double-submits
                setTimeout(() => {
                    inFlightDemoRequests.delete(key);
                }, 3000);
                
                resolve(response);
                pending.listeners.forEach((listener) => {
                    listener(response);
                });
            } catch (err) {
                inFlightDemoRequests.delete(key);
                reject(err);
                pending.listeners.forEach((listener) => {
                    listener(createResponse({ error: err instanceof Error ? err.message : String(err) }, 500));
                });
            }
        });
    });
}

async function processDemoRequest(fullUrl: string, options?: RequestInit): Promise<Response> {
    // DEMO MODE MOCK LOGIC
    await delay(300); // Simulate network latency
    
    // Extract just the path from fullUrl (e.g. "http://localhost:5002/api/projects" -> "/projects")
    let localPath = fullUrl;
    if (fullUrl.includes('/api/')) {
        localPath = '/' + fullUrl.split('/api/')[1];
    }
    
    const method = options?.method || 'GET';
    let body: any = null;
    if (options?.body) {
        if (typeof options.body === 'string') {
            body = JSON.parse(options.body);
        } else if (options.body instanceof FormData) {
            body = Object.fromEntries(options.body.entries());
        } else {
            body = options.body;
        }
    }
    
    // Route matching
    if (localPath.startsWith('/dashboard')) {
        if (method === 'GET') {
            return createResponse({
                projects: internalProjects.length,
                pcbs: internalPcbs.length,
                owners: internalOwners.length,
                reworks: internalReworks.length,
                tags: internalTags.length
            });
        }
    }
    if (localPath.startsWith('/uploaded-docs')) {
        const parts = localPath.split('/');
        if (method === 'DELETE' && parts.length === 3) {
            const docId = parseInt(parts[2]);
            internalProjectDocs = internalProjectDocs.filter(s => s.id !== docId);
            return createResponse({ message: 'Document deleted successfully', deletedId: docId });
        }

        // Build list of all uploaded documents
        const allDocs: any[] = [];
        // 1. Project docs
        internalProjectDocs.forEach(d => {
            const fn = d.filename || '';
            const docType = fn.toLowerCase().endsWith('.brd') ? 'board_file'
                          : fn.toLowerCase().endsWith('.csv') ? 'bom_csv'
                          : fn.toLowerCase().includes('datasheet') ? 'datasheet'
                          : 'schematic';
            const proj = internalProjects.find(p => p.id === d.project_id);
            allDocs.push({
                id: d.id,
                entity_type: 'project',
                entity_id: d.project_id,
                project_id: d.project_id,
                project_name: proj?.name || 'Project',
                project_key: proj?.project_key || 'PRJ',
                doc_type: docType,
                filename: d.filename,
                original_filename: d.filename,
                path: d.path,
                mime_type: docType === 'board_file' ? 'application/octet-stream' : docType === 'bom_csv' ? 'text/csv' : 'application/pdf',
                uploaded_at: d.uploaded_at || new Date().toISOString()
            });
        });

        // 2. Rework images
        internalReworks.forEach(r => {
            if (r.image_path) {
                let paths: string[] = [];
                try {
                    paths = JSON.parse(r.image_path);
                    if (!Array.isArray(paths)) paths = [r.image_path];
                } catch {
                    paths = [r.image_path];
                }
                const pcb = internalPcbs.find(p => p.id === r.pcb_id);
                const proj = pcb ? internalProjects.find(p => p.name === pcb.project) : null;
                paths.forEach((imgUrl, i) => {
                    const fn = imgUrl.split('/').pop() || `PIC-${i + 1}`;
                    allDocs.push({
                        id: 100000 + r.id * 10 + i,
                        entity_type: 'rework',
                        entity_id: r.id,
                        project_id: proj?.id || null,
                        pcb_id: r.pcb_id,
                        project_name: proj?.name || pcb?.project,
                        project_key: proj?.project_key,
                        pcb_board_number: pcb?.board_number,
                        rework_number: r.rework_number || r.id,
                        rework_title: r.title,
                        doc_type: 'picture',
                        filename: fn,
                        original_filename: fn,
                        path: imgUrl,
                        mime_type: 'image/jpeg',
                        uploaded_at: r.timestamp || new Date().toISOString()
                    });
                });
            }
        });

        if (localPath.includes('/summary')) {
            const counts: Record<string, number> = {
                picture: 0,
                schematic: 0,
                board_file: 0,
                bom_csv: 0,
                datasheet: 0,
                other: 0,
                total: allDocs.length
            };
            allDocs.forEach(d => {
                if (counts[d.doc_type] !== undefined) counts[d.doc_type]++;
                else counts.other++;
            });
            return createResponse(counts);
        }

        return createResponse(allDocs);
    }
    if (localPath.startsWith('/projects')) {
        const parts = localPath.split('/');
        
        // Check for /projects/:id/docs/:docId (delete)
        if (parts.length === 5 && parts[3] === 'docs') {
            const projectId = parseInt(parts[2]);
            const docId = parseInt(parts[4]);
            if (method === 'DELETE') {
                internalProjectDocs = internalProjectDocs.filter(s => !(s.id === docId && s.project_id === projectId));
                return createResponse({ message: 'Document deleted' });
            }
        }
        
        // Check for /projects/:id/docs (get / post)
        if (parts.length === 4 && parts[3] === 'docs') {
            const projectId = parseInt(parts[2]);
            if (method === 'GET') {
                const docs = internalProjectDocs.filter(s => s.project_id === projectId);
                return createResponse(docs);
            }
            if (method === 'POST') {
                const created: any[] = [];
                if (options?.body && options.body instanceof FormData) {
                    for (const [, value] of options.body.entries()) {
                        const file = value as any;
                        if (file && typeof file === 'object' && file.name) {
                             const sch = {
                                id: Date.now() + Math.floor(Math.random() * 1000) + created.length,
                                project_id: projectId,
                                filename: file.name,
                                path: file.name.toLowerCase().endsWith('.brd') ? "/docs/BBB.brd" : "/docs/demo_doc.pdf",
                                uploaded_at: new Date().toISOString()
                            };
                            internalProjectDocs.push(sch);
                            created.push(sch);
                        }
                    }
                }
                if (created.length === 0) {
                    const sch = {
                        id: Date.now(),
                        project_id: projectId,
                        filename: "datasheet_revA.pdf",
                        path: "/docs/demo_doc.pdf",
                        uploaded_at: new Date().toISOString()
                    };
                    internalProjectDocs.push(sch);
                    created.push(sch);
                }
                return createResponse(created, 201);
            }
        }

        if (method === 'GET') {
            if (parts.length === 3 && parts[2]) {
                const id = parseInt(parts[2]);
                const p = internalProjects.find(x => x.id === id);
                if (p) {
                    const count = internalProjectDocs.filter(s => s.project_id === p.id).length;
                    return createResponse({ ...p, doc_count: count });
                }
                return createResponse({ error: 'Not found' }, 404);
            }
            const projectsWithCount = internalProjects.map(p => {
                const count = internalProjectDocs.filter(s => s.project_id === p.id).length;
                return { ...p, doc_count: count };
            });
            return createResponse(projectsWithCount);
        }
        if (method === 'POST') {
            const newProject = { id: Date.now(), ...body, pcb_count: 0, pcbs: [] };
            internalProjects.push(newProject);
            return createResponse(newProject, 201);
        }
        if (method === 'PUT') {
            const id = parseInt(parts.pop() || '0');
            internalProjects = internalProjects.map(p => p.id === id ? { ...p, ...body } : p);
            return createResponse({ message: 'Project updated' });
        }
        if (method === 'DELETE') {
            const id = parseInt(parts.pop() || '0');
            internalProjects = internalProjects.filter(p => p.id !== id);
            return createResponse({ message: 'Project deleted' });
        }
    }
    
    if (localPath.startsWith('/pcbs')) {
        if (method === 'GET') {
            const parts = localPath.split('/');
            // Check for /pcbs/:id/tags
            if (parts.length === 4 && parts[3] === 'tags') {
                const pcbId = parseInt(parts[2]);
                const tagIds = internalPcbTags[pcbId] || [];
                const tagsForPcb = internalTags
                    .filter(t => tagIds.includes(t.id))
                    .map(tag => {
                        const owner = internalOwners.find(o => String(o.id) === String(tag.owner_id));
                        return owner ? { ...tag, owner_name: owner.name, owner_username: owner.username } : tag;
                    });
                return createResponse(tagsForPcb);
            }
            if (parts.length === 3 && parts[2]) {
                const id = parseInt(parts[2]);
                const pcb = internalPcbs.find(x => x.id === id);
                return createResponse(pcb || { error: 'Not found' }, pcb ? 200 : 404);
            }
            const pcbsWithTags = internalPcbs.map(pcb => {
                const ownerObj = internalOwners.find(o => String(o.id) === String(pcb.owner_id) || o.name === pcb.owner);
                return {
                    ...pcb,
                    product: pcb.product_name_and_rev || pcb.product,
                    tag_ids: internalPcbTags[pcb.id] || [],
                    owner_username: pcb.owner_username || (ownerObj ? ownerObj.username : undefined)
                };
            });
            return createResponse(pcbsWithTags);
        }
        if (method === 'POST') {
            const parts = localPath.split('/');
            if (parts.length === 4 && parts[3] === 'tags') {
                const pcbId = parseInt(parts[2]);
                const tagId = parseInt(body.tag_id);
                if (!internalPcbTags[pcbId]) {
                    internalPcbTags[pcbId] = [];
                }
                if (!internalPcbTags[pcbId].includes(tagId)) {
                    internalPcbTags[pcbId].push(tagId);
                }
                return createResponse({ message: 'Tag attached' }, 201);
            }
            
            const proj = internalProjects.find(p => p.id === parseInt(body.project_id));
            const ownerObj = internalOwners.find(o => o.id === parseInt(body.owner_id));
            const newPcb = { 
                id: Date.now(), 
                ...body,
                project: proj ? proj.name : 'Unknown',
                owner: ownerObj ? ownerObj.name : 'Unassigned',
                owner_username: ownerObj ? ownerObj.username : undefined
            };
            
            if (proj) {
                proj.pcb_count = (proj.pcb_count || 0) + 1;
                if (!proj.pcbs) proj.pcbs = [];
                proj.pcbs.push(newPcb.board_number);
            }
            if (ownerObj) {
                ownerObj.pcb_count = (ownerObj.pcb_count || 0) + 1;
            }

            internalPcbs.push(newPcb);
            return createResponse(newPcb, 201);
        }
        if (method === 'PUT') {
            const id = parseInt(localPath.split('/').pop() || '0');
            internalPcbs = internalPcbs.map(p => p.id === id ? { ...p, ...body } : p);
            return createResponse({ message: 'PCB updated' });
        }
        if (method === 'DELETE') {
            const parts = localPath.split('/');
            if (parts.length === 5 && parts[3] === 'tags') {
                const pcbId = parseInt(parts[2]);
                const tagId = parseInt(parts[4]);
                if (internalPcbTags[pcbId]) {
                    internalPcbTags[pcbId] = internalPcbTags[pcbId].filter((id: number) => id !== tagId);
                }
                return createResponse({ message: 'Tag detached' });
            }
            const id = parseInt(localPath.split('/').pop() || '0');
            internalPcbs = internalPcbs.filter(p => p.id !== id);
            return createResponse({ message: 'PCB deleted' });
        }
    }
    
    if (localPath.startsWith('/owners')) {
        if (method === 'GET') {
            const parts = localPath.split('/');
            if (parts.length === 3 && parts[2]) {
                const id = parseInt(parts[2]);
                const o = internalOwners.find(x => x.id === id);
                return createResponse(o || { error: 'Not found' }, o ? 200 : 404);
            }
            return createResponse(internalOwners);
        }
        if (method === 'POST') {
            const superCount = internalOwners.filter(o => o.is_super_user === 1 || o.is_super_user === true).length;
            const isFirst = internalOwners.length === 0 || superCount === 0;
            const isSuperUser = isFirst ? 1 : (body.is_super_user !== undefined ? (body.is_super_user ? 1 : 0) : (body.role === 'Super User' ? 1 : 0));
            const newOwner = { id: Date.now(), ...body, is_super_user: isSuperUser, pcb_count: 0, rework_count: 0, tag_count: 0 };
            internalOwners.push(newOwner);
            return createResponse(newOwner, 201);
        }
        if (method === 'PUT') {
            const id = parseInt(localPath.split('/').pop() || '0');
            internalOwners = internalOwners.map(p => p.id === id ? { ...p, ...body } : p);
            return createResponse({ message: 'Owner updated' });
        }
        if (method === 'DELETE') {
            const id = parseInt(localPath.split('/').pop() || '0');
            const target = internalOwners.find(p => p.id === id);
            if (target && (target.is_super_user === 1 || target.is_super_user === true)) {
                const superCount = internalOwners.filter(o => o.is_super_user === 1 || o.is_super_user === true).length;
                if (superCount <= 1) {
                    return createResponse({ error: 'Cannot delete this user: it is the only super user.' }, 400);
                }
            }
            internalOwners = internalOwners.filter(p => p.id !== id);
            return createResponse({ message: 'Owner deleted' });
        }
        if (method === 'PATCH' && localPath.includes('/role')) {
            const id = parseInt(localPath.split('/')[2] || '0');
            const { role } = body as any;
            const target = internalOwners.find(p => p.id === id);
            if (target && (target.is_super_user === 1 || target.is_super_user === true) && role === 'User') {
                const superCount = internalOwners.filter(o => o.is_super_user === 1 || o.is_super_user === true).length;
                if (superCount <= 1) {
                    return createResponse({ error: 'Cannot demote this user: it is the only super user.' }, 400);
                }
            }
            internalOwners = internalOwners.map(p =>
                p.id === id ? { ...p, is_super_user: role === 'Super User' ? 1 : 0 } : p
            );
            return createResponse({ success: true, role });
        }
    }
    
    if (localPath.startsWith('/reworks')) {
        if (method === 'GET') {
            const parts = localPath.split('/');
            if (parts.length === 3 && parts[2]) {
                const id = parseInt(parts[2]);
                const r = internalReworks.find(x => x.id === id);
                if (r) {
                    const owner = internalOwners.find(o => String(o.id) === String(r.owner_id));
                    return createResponse(owner ? { ...r, owner_name: owner.name, owner_username: owner.username } : r);
                }
                return createResponse({ error: 'Not found' }, 404);
            }
            return createResponse(internalReworks.map(r => {
                const owner = internalOwners.find(o => String(o.id) === String(r.owner_id));
                return owner ? { ...r, owner_name: owner.name, owner_username: owner.username } : r;
            }));
        }
        if (method === 'POST') {
            const pcbId = parseInt(body.pcb_id);
            const pcbObj = internalPcbs.find(p => p.id === pcbId);

            // Find existing reworks for this PCB
            const pcbReworks = internalReworks.filter(r => r.pcb_id === pcbId || r.pcb_id === String(pcbId));
            
            let sequence = 1;
            if (pcbReworks.length > 0) {
                const sortedReworks = [...pcbReworks].sort((a, b) => b.id - a.id);
                const lastRework = sortedReworks[0];
                if (lastRework && lastRework.rework_number) {
                    sequence = lastRework.rework_number + 1;
                } else {
                    sequence = pcbReworks.length + 1;
                }
            }

            const ownerObj = internalOwners.find(o => o.id === parseInt(body.owner_id));
            const newRework = { 
                id: Date.now(), 
                timestamp: new Date().toISOString(), 
                ...body,
                pcb_id: pcbId,
                owner_id: parseInt(body.owner_id),
                rework_number: sequence,
                owner_name: ownerObj ? ownerObj.name : 'Unknown',
                owner_username: ownerObj ? ownerObj.username : undefined
            };
            
            if (ownerObj) {
                ownerObj.rework_count = (ownerObj.rework_count || 0) + 1;
            }

            if (body.new_product && pcbObj) {
                pcbObj.product = body.new_product;
                pcbObj.product_name_and_rev = body.new_product;
            }

            internalReworks.push(newRework);
            return createResponse(newRework, 201);
        }
        if (method === 'PUT') {
            const id = parseInt(localPath.split('/').pop() || '0');
            const rework = internalReworks.find(p => p.id === id);
            if (!rework) {
                return createResponse({ error: 'Rework not found' }, 404);
            }

            let daysDiff = 999;
            if (rework.timestamp) {
                const dateStr = rework.timestamp.includes('T') ? rework.timestamp : rework.timestamp.replace(' ', 'T') + 'Z';
                const timestampDate = new Date(dateStr);
                if (!isNaN(timestampDate.getTime())) {
                    daysDiff = (Date.now() - timestampDate.getTime()) / (1000 * 60 * 60 * 24);
                }
            }
            if (daysDiff > 14) {
                return createResponse({ error: 'Rework log is older than 2 weeks and cannot be edited.' }, 400);
            }

            internalReworks = internalReworks.map(p => p.id === id ? { ...p, ...body } : p);

            // Handle Silicon Swap product update in demo mode if applicable
            if (body.rework_type === 'Silicon Swap' && body.new_product && body.pcb_id) {
                const pcbObj = internalPcbs.find(pcb => pcb.id === parseInt(body.pcb_id));
                if (pcbObj) {
                    pcbObj.product = body.new_product;
                    pcbObj.product_name_and_rev = body.new_product;
                }
            }

            return createResponse({ message: 'Rework updated' });
        }
        if (method === 'DELETE') {
            const id = parseInt(localPath.split('/').pop() || '0');
            const rework = internalReworks.find(p => p.id === id);
            if (!rework) {
                return createResponse({ error: 'Rework not found' }, 404);
            }
            
            const hasNewerRework = internalReworks.some(r => r.pcb_id === rework.pcb_id && r.id > id);
            if (hasNewerRework) {
                return createResponse({ error: 'Cannot delete rework because there are newer rework logs after it on this board.' }, 400);
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
                return createResponse({ error: 'Cannot delete rework because it was created more than 3 days ago.' }, 400);
            }

            internalReworks = internalReworks.filter(p => p.id !== id);
            return createResponse({ message: 'Rework deleted' });
        }
    }
    
    if (localPath.startsWith('/tags')) {
        if (method === 'GET') {
            const parts = localPath.split('/');
            // Check for /tags/:id/pcbs
            if (parts.length === 4 && parts[3] === 'pcbs') {
                const tagId = parseInt(parts[2]);
                const matchingPcbIds = Object.keys(internalPcbTags)
                    .filter(pcbIdStr => internalPcbTags[parseInt(pcbIdStr)].includes(tagId))
                    .map(Number);
                
                const returnPcbs = internalPcbs.filter(p => matchingPcbIds.includes(p.id))
                    .map(p => {
                        const project = internalProjects.find(proj => proj.id === p.project_id);
                        return { ...p, project_name: project?.name, project_key: project?.project_key };
                    });
                return createResponse(returnPcbs);
            }

            if (parts.length === 3 && parts[2]) {
                const id = parseInt(parts[2]);
                const t = internalTags.find(x => x.id === id);
                return createResponse(t || { error: 'Not found' }, t ? 200 : 404);
            }

            const tagsWithOwners = internalTags.map(tag => {
                const owner = internalOwners.find(o => String(o.id) === String(tag.owner_id));
                const pcb_count = Object.values(internalPcbTags).filter((tags: any) => tags.includes(tag.id)).length;
                return { 
                    ...tag, 
                    pcb_count,
                    ...(owner ? { owner_name: owner.name, owner_username: owner.username } : {})
                };
            });
            return createResponse(tagsWithOwners);
        }
        if (method === 'POST') {
            const newTag = { id: Date.now(), ...body, pcb_count: 0 };
            internalTags.push(newTag);
            return createResponse(newTag, 201);
        }
        if (method === 'PUT') {
            const id = parseInt(localPath.split('/').pop() || '0');
            internalTags = internalTags.map(p => p.id === id ? { ...p, ...body } : p);
            return createResponse({ message: 'Tag updated' });
        }
        if (method === 'DELETE') {
            const id = parseInt(localPath.split('/').pop() || '0');
            internalTags = internalTags.filter(p => p.id !== id);
            return createResponse({ message: 'Tag deleted' });
        }
    }

    if (localPath.startsWith('/settings')) {
        if (method === 'GET') {
            return createResponse({
                allowGuestMinorRework: 'true',
                crcFormat: 'letter',
                'priority_Silicon Swap': 'High',
                'priority_Major Rework': 'High',
                'priority_Minor Rework': 'Low',
                'priority_Resistor Swap': 'Low',
                db_mode: 'demo',
                db_backup_path: '/src/store/serverDataBase/backups'
            });
        }
        if (method === 'POST') {
            return createResponse({ success: true });
        }
    }

    if (localPath.startsWith('/db/settings')) {
        if (method === 'GET') {
            return createResponse({
                backup_path: '/src/store/serverDataBase/backups',
                default_backup_path: '/src/store/serverDataBase/backups',
                current_mode: 'demo',
                backups: [
                    {
                        filename: 'pcb_tracker_backup_demo.db',
                        path: '/src/store/serverDataBase/backups/pcb_tracker_backup_demo.db',
                        size: 45056,
                        createdAt: new Date().toISOString()
                    }
                ]
            });
        }
        if (method === 'POST') {
            return createResponse({ success: true, backup_path: body?.backup_path || '/src/store/serverDataBase/backups' });
        }
    }

    if (localPath.startsWith('/db/backup')) {
        return createResponse({
            success: true,
            backup: {
                filename: `pcb_tracker_backup_${new Date().toISOString().replace(/[:.]/g, '-')}.db`,
                path: `/src/store/serverDataBase/backups/pcb_tracker_backup_${Date.now()}.db`,
                size: 45056,
                createdAt: new Date().toISOString()
            }
        });
    }

    if (localPath.startsWith('/db/mode')) {
        return createResponse({
            success: true,
            mode: body?.mode || 'demo',
            message: `Database successfully switched to ${body?.mode || 'demo'} mode.`
        });
    }

    if (localPath.startsWith('/otp/verify')) {
        return createResponse({ valid: true, token: 'demo-session-token' });
    }
    if (localPath.startsWith('/otp/setup')) {
        return createResponse({ secret: 'JBSWY3DPEHPK3PXP', otpauthUrl: 'otpauth://totp/ReworkTracker:demo?secret=JBSWY3DPEHPK3PXP&issuer=ReworkTracker' });
    }
    if (localPath.startsWith('/otp/reset-info')) {
        return createResponse({ valid: true, owner: { id: 1, name: 'Demo User', username: 'demo' } });
    }
    if (localPath.startsWith('/otp/reset-confirm')) {
        return createResponse({ success: true });
    }

    return createResponse({ error: 'Not found in demo mode' }, 404);
}
