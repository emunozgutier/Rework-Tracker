import { create } from 'zustand';
import { API_BASE } from '../store/database/apiBridge';
import { apiFetch } from '../store/database/apiBridge';

export interface Tag {
    id: number;
    name: string;
    color: string;
    owner_id?: number | null;
    owner_name?: string | null;
    owner_username?: string | null;
    pcb_count?: number;
    type?: 'public' | 'personal';
}

interface TagState {
    tags: Tag[];
    loading: boolean;
    error: string | null;
    fetchTags: () => Promise<void>;
    addTag: (data: { name: string; color: string; owner_id?: number | string | null; type?: 'public' | 'personal' }) => Promise<boolean>;
    updateTag: (id: number | string, data: { name: string; color: string; owner_id?: number | string | null; type?: 'public' | 'personal' }) => Promise<boolean>;
    deleteTag: (id: number | string) => Promise<boolean>;
    
    selectedTagTypes: string[];
    selectedTagOwners: string[];
    setSelectedTagTypes: (types: string[]) => void;
    setSelectedTagOwners: (owners: string[]) => void;
    resetFilters: () => void;
}

export const useTagStore = create<TagState>((set, get) => ({
    tags: [],
    loading: false,
    error: null,
    selectedTagTypes: [],
    selectedTagOwners: [],

    setSelectedTagTypes: (types) => set({ selectedTagTypes: types }),
    setSelectedTagOwners: (owners) => set({ selectedTagOwners: owners }),
    resetFilters: () => set({ selectedTagTypes: [], selectedTagOwners: [] }),

    fetchTags: async () => {
        set({ loading: true, error: null });
        try {
            const res = await apiFetch(`${API_BASE}/tags`);
            if (!res.ok) throw new Error('Failed to fetch tags');
            const data = await res.json();
            set({ tags: data, loading: false });
        } catch (err: any) {
            set({ error: err.message, loading: false });
        }
    },

    addTag: async (data) => {
        set({ loading: true, error: null });
        try {
            const res = await apiFetch(`${API_BASE}/tags`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await res.json();
            
            if (!res.ok) {
                set({ error: result.error || 'Failed to add tag', loading: false });
                return false;
            }
            
            await get().fetchTags();
            return true;
        } catch (err: any) {
            set({ error: err.message, loading: false });
            return false;
        }
    },

    updateTag: async (id, data) => {
        set({ loading: true, error: null });
        try {
            const res = await apiFetch(`${API_BASE}/tags/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await res.json();
            
            if (!res.ok) {
                set({ error: result.error || 'Failed to update tag', loading: false });
                return false;
            }

            await get().fetchTags();
            return true;
        } catch (err: any) {
            set({ error: err.message, loading: false });
            return false;
        }
    },

    deleteTag: async (id) => {
        set({ loading: true, error: null });
        try {
            const res = await apiFetch(`${API_BASE}/tags/${id}`, { method: 'DELETE' });
            if (!res.ok) {
                set({ error: 'Failed to delete tag', loading: false });
                return false;
            }

            const newTags = get().tags.filter(p => p.id.toString() !== id.toString());
            set({ tags: newTags, loading: false });
            return true;
        } catch (err: any) {
            set({ error: err.message, loading: false });
            return false;
        }
    }
}));

export const formatTagName = (tag: any): string => {
    if (!tag || !tag.name) return '';
    const cleanName = tag.name.trim().replace(/\s+/g, '-');
    
    if (tag.type === 'public') return cleanName;

    if (tag.owner_username) return `${tag.owner_username}/${cleanName}`;
    if (tag.owner_name) return `${tag.owner_name}/${cleanName}`;
    return cleanName;
};
