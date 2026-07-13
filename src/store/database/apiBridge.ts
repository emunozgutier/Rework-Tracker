import { useDemoStore } from '../useDemoStore';
import demoData from './demoData.json';

export const API_BASE = `http://${window.location.hostname}:5002/api`;


let internalProjects = [...demoData.demoProjects] as any[];
let internalPcbs = [...demoData.demoPcbs] as any[];
let internalOwners = [...demoData.demoOwners] as any[];
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
        return fetch(fullUrl, options);
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
    if (localPath.startsWith('/projects')) {
        if (method === 'GET') {
            const parts = localPath.split('/');
            if (parts.length === 3 && parts[2]) {
                const id = parseInt(parts[2]);
                const p = internalProjects.find(x => x.id === id);
                return createResponse(p || { error: 'Not found' }, p ? 200 : 404);
            }
            return createResponse(internalProjects);
        }
        if (method === 'POST') {
            const newProject = { id: Date.now(), ...body, pcb_count: 0, pcbs: [] };
            internalProjects.push(newProject);
            return createResponse(newProject, 201);
        }
        if (method === 'PUT') {
            const id = parseInt(localPath.split('/').pop() || '0');
            internalProjects = internalProjects.map(p => p.id === id ? { ...p, ...body } : p);
            return createResponse({ message: 'Project updated' });
        }
        if (method === 'DELETE') {
            const id = parseInt(localPath.split('/').pop() || '0');
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
            const newOwner = { id: Date.now(), ...body, pcb_count: 0, rework_count: 0, tag_count: 0 };
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
            internalOwners = internalOwners.filter(p => p.id !== id);
            return createResponse({ message: 'Owner deleted' });
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
            internalReworks = internalReworks.map(p => p.id === id ? { ...p, ...body } : p);
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

    return createResponse({ error: 'Not found in demo mode' }, 404);
}
