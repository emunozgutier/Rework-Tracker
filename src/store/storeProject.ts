import { create } from 'zustand';
import { API_BASE } from '../store/database/apiBridge';
import { apiFetch } from '../store/database/apiBridge';

export interface Formfactor {
    name: string;
    revisions: string[];
    boms?: string[];
}

export interface Project {
    id: number;
    name: string;
    description: string;
    pcb_count: number;
    pcbs: string[];
    revisions: string[];
    project_key: string;
    formfactors: Formfactor[];
    silicon_corners?: string;
    number_format?: string;
}

interface ProjectState {
    projects: Project[];
    loading: boolean;
    error: string | null;
    fetchProjects: () => Promise<void>;
    addProject: (data: { name: string; description: string; revisions: string; project_key: string; formfactors?: Formfactor[]; silicon_corners?: string; number_format?: string }) => Promise<boolean>;
    updateProject: (id: number | string, data: { name: string; description: string; revisions: string; project_key: string; formfactors?: Formfactor[]; silicon_corners?: string; number_format?: string }) => Promise<boolean>;
    deleteProject: (id: number | string) => Promise<boolean>;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
    projects: [],
    loading: false,
    error: null,

    fetchProjects: async () => {
        set({ loading: true, error: null });
        try {
            const res = await apiFetch(`${API_BASE}/projects`);
            if (!res.ok) throw new Error('Failed to fetch projects');
            const data = await res.json();
            set({ projects: data, loading: false });
        } catch (err: any) {
            set({ error: err.message, loading: false });
        }
    },

    addProject: async (data) => {
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
            
            // Re-fetch to get complete updated state with arrays correctly parsed
            await get().fetchProjects();
            return true;
        } catch (err: any) {
            set({ error: err.message, loading: false });
            return false;
        }
    },

    updateProject: async (id, data) => {
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

            // Re-fetch to get complete updated state
            await get().fetchProjects();
            return true;
        } catch (err: any) {
            set({ error: err.message, loading: false });
            return false;
        }
    },

    deleteProject: async (id) => {
        set({ loading: true, error: null });
        try {
            const res = await apiFetch(`${API_BASE}/projects/${id}`, { method: 'DELETE' });
            if (!res.ok) {
                set({ error: 'Failed to delete project', loading: false });
                return false;
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
