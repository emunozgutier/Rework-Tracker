import { create } from 'zustand';
import { API_BASE } from '../serverDataBase/apiBridge';
import { apiFetch } from '../serverDataBase/apiBridge';
import { useAppState } from '../useAppState';

export interface RevisionDocument {
    id?: number;
    formfactor_revision_id?: number;
    doc_type: 'schematic' | 'board_file' | 'bom_csv' | 'datasheet' | string;
    filename: string;
    path: string;
    uploaded_at?: string;
}

export interface BomFlavor {
    id?: number;
    formfactor_revision_id?: number;
    name: string;
    description?: string;
}

export interface BoardFormFactorRevision {
    id?: number;
    board_formfactor_id?: number;
    name: string;
    description?: string;
    boms: string[];
    bom_flavors?: BomFlavor[];
    documents?: RevisionDocument[];
    schematic?: string | null;
    board_file?: string | null;
    bom_csv?: string | null;
    datasheet?: string | null;
    doc?: string | null;
}

export interface BoardFormFactor {
    id?: number;
    package_id?: number;
    silicon_version_id?: number;
    name: string;
    description?: string;
    revisions: BoardFormFactorRevision[];
    revisionDetails?: BoardFormFactorRevision[];
}

export interface SiliconVersion {
    id?: number;
    project_id?: number;
    package_id?: number;
    name: string;
    silicon_corners: string[];
    description?: string;
    formfactors?: BoardFormFactor[];
}

export interface Package {
    id?: number;
    project_id?: number;
    name: string;
    description?: string;
    formfactors?: BoardFormFactor[];
    board_formfactors?: BoardFormFactor[];
    silicon_versions?: SiliconVersion[];
}

// Backward compatibility helper interfaces
export interface PcbRevisionDetail {
    name: string;
    boms: string[];
    doc?: string | null;
    schematic?: string | null;
    board_file?: string | null;
    bom_csv?: string | null;
    datasheet?: string | null;
}

export interface PcbFlavor {
    id?: number;
    name: string;
    revisions: string[];
    boms?: string[];
    revisionDetails?: PcbRevisionDetail[];
}

export interface Project {
    id: number;
    name: string;
    description: string;
    project_key: string;
    number_format?: 'hex' | 'decimal' | string;
    packages: Package[];
    silicon_versions?: SiliconVersion[];
    pcb_count: number;
    doc_count?: number;
    pcbs: string[];
    revisions: string[];
    flavors: PcbFlavor[];
    silicon_corners?: string;
    created_at?: string;
    created_by?: string;
    updated_by?: string;
}

interface ProjectState {
    projects: Project[];
    projectDocs: Record<string, any[]>;
    loading: boolean;
    error: string | null;
    fetchProjects: () => Promise<void>;
    fetchDocs: (projectId: number | string) => Promise<void>;
    uploadDocs: (projectId: number | string, files: File[]) => Promise<boolean>;
    deleteDoc: (projectId: number | string, docId: number | string) => Promise<boolean>;
    addProject: (data: { name: string; description?: string; project_key: string; number_format?: string; packages?: Package[]; silicon_versions?: SiliconVersion[]; revisions?: string; flavors?: any[]; silicon_corners?: string }, files?: File[]) => Promise<boolean>;
    updateProject: (id: number | string, data: { name: string; description?: string; project_key: string; number_format?: string; packages?: Package[]; silicon_versions?: SiliconVersion[]; revisions?: string; flavors?: any[]; silicon_corners?: string }, files?: File[]) => Promise<boolean>;
    deleteProject: (id: number | string) => Promise<boolean>;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
    projects: [],
    projectDocs: {},
    loading: false,
    error: null,

    fetchProjects: async () => {
        set({ loading: true, error: null });
        try {
            const res = await apiFetch(`${API_BASE}/projects`);
            if (!res.ok) throw new Error('Failed to fetch projects');
            const data = await res.json();
            const normalizedData = data.map((p: any) => ({
                ...p,
                packages: p.packages || [],
                flavors: (p.flavors || []).map((f: any) => {
                    let rawRevs = f.revisions || [];
                    if (!Array.isArray(rawRevs)) {
                        rawRevs = typeof rawRevs === 'string' ? (rawRevs as string).split(',').map((s: string) => s.trim()) : [rawRevs];
                    }
                    const isDetailed = rawRevs.length > 0 && typeof rawRevs[0] === 'object';
                    const revisionDetails = isDetailed 
                        ? rawRevs.map((r: any) => ({ 
                            name: r.name, 
                            boms: Array.isArray(r.boms) ? r.boms : (r.boms ? String(r.boms).split(',').map((b: string) => b.trim()) : []), 
                            doc: r.doc || r.schematic || null,
                            schematic: r.schematic || r.doc || null,
                            board_file: r.board_file || null,
                            bom_csv: r.bom_csv || null,
                            datasheet: r.datasheet || null
                          })) 
                        : (f.revisionDetails || rawRevs.map((r: string) => ({ 
                            name: r, 
                            boms: Array.isArray(f.boms) ? f.boms : (f.boms ? String(f.boms).split(',').map((b: string) => b.trim()) : []), 
                            doc: null,
                            schematic: null,
                            board_file: null,
                            bom_csv: null,
                            datasheet: null
                          })));
                    const revisionNames = isDetailed 
                        ? rawRevs.map((r: any) => r.name) 
                        : (Array.isArray(rawRevs) ? rawRevs.map((r: any) => typeof r === 'string' ? r : r.name) : []);
                    return {
                        ...f,
                        revisions: revisionNames,
                        revisionDetails
                    };
                })
            }));
            set({ projects: normalizedData, loading: false });
        } catch (err: any) {
            set({ error: err.message, loading: false });
        }
    },

    fetchDocs: async (projectId) => {
        try {
            const res = await apiFetch(`${API_BASE}/projects/${projectId}/docs`);
            if (!res.ok) throw new Error('Failed to fetch docs');
            const data = await res.json();
            set(state => ({
                projectDocs: {
                    ...state.projectDocs,
                    [projectId.toString()]: data
                }
            }));
        } catch (err: any) {
            console.error("fetchDocs error:", err);
        }
    },

    uploadDocs: async (projectId, files) => {
        if (files.length === 0) return true;
        try {
            const formData = new FormData();
            files.forEach((file) => {
                formData.append('docs', file);
            });
            const res = await apiFetch(`${API_BASE}/projects/${projectId}/docs`, {
                method: 'POST',
                body: formData
            });
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                const errMsg = errData.error || `Failed to upload documents (HTTP ${res.status})`;
                throw new Error(errMsg);
            }
            await get().fetchDocs(projectId);
            return true;
        } catch (err: any) {
            console.error("uploadDocs error:", err);
            set({ error: err.message });
            return false;
        }
    },

    deleteDoc: async (projectId, docId) => {
        try {
            const res = await apiFetch(`${API_BASE}/projects/${projectId}/docs/${docId}`, {
                method: 'DELETE'
            });
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || 'Failed to delete doc');
            }
            await get().fetchDocs(projectId);
            return true;
        } catch (err: any) {
            console.error("deleteDoc error:", err);
            set({ error: err.message });
            return false;
        }
    },

    addProject: async (data, files) => {
        set({ loading: true, error: null });
        try {
            const res = await apiFetch(`${API_BASE}/projects`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await res.json();
            
            if (!res.ok) {
                set({ error: result.error || 'Failed to add project', loading: false });
                return false;
            }

            const newProjectId = result.id;
            if (files && files.length > 0 && newProjectId) {
                const uploadOk = await get().uploadDocs(newProjectId, files);
                if (!uploadOk) {
                    await get().fetchProjects();
                    set({ loading: false });
                    return false;
                }
            }
            
            // Re-fetch to get complete updated state with arrays correctly parsed
            await get().fetchProjects();
            set({ loading: false, error: null });
            return true;
        } catch (err: any) {
            set({ error: err.message, loading: false });
            return false;
        }
    },

    updateProject: async (id, data, files) => {
        set({ loading: true, error: null });
        try {
            const res = await apiFetch(`${API_BASE}/projects/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await res.json();
            
            if (!res.ok) {
                set({ error: result.error || 'Failed to update project', loading: false });
                return false;
            }

            if (files && files.length > 0) {
                const uploadOk = await get().uploadDocs(id, files);
                if (!uploadOk) {
                    await get().fetchProjects();
                    set({ loading: false });
                    return false;
                }
            }

            // Re-fetch to get complete updated state
            await get().fetchProjects();
            set({ loading: false, error: null });
            return true;
        } catch (err: any) {
            set({ error: err.message, loading: false });
            return false;
        }
    },

    deleteProject: async (id) => {
        set({ loading: true, error: null });
        try {
            const projectToDelete = get().projects.find(p => p.id.toString() === id.toString());
            const projectName = projectToDelete?.name;

            const res = await apiFetch(`${API_BASE}/projects/${id}`, { method: 'DELETE' });
            if (!res.ok) {
                set({ error: 'Failed to delete project', loading: false });
                return false;
            }

            if (projectName && useAppState.getState().expandedProject === projectName) {
                useAppState.getState().setExpandedProject(null);
            }

            // Update state locally or re-fetch
            const newProjects = get().projects.filter(p => p.id.toString() !== id.toString());
            set({ projects: newProjects, loading: false });
            return true;
        } catch (err: any) {
            set({ error: err.message, loading: false });
            return false;
        }
    }
}));
