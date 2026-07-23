import { create } from 'zustand';
import { API_BASE } from '../store/database/apiBridge';
import { apiFetch } from '../store/database/apiBridge';

export interface Owner {
    id: number;
    name: string;
    username: string;
    email?: string;
    superuser?: number;
    pcb_count?: number;
    rework_count?: number;
    tag_count?: number;
}

interface OwnerState {
    owners: Owner[];
    loading: boolean;
    error: string | null;
    fetchOwners: () => Promise<void>;
    addOwner: (data: { name: string; username: string; email?: string; superuser?: number }) => Promise<boolean>;
    updateOwner: (id: number | string, data: { name: string; username: string; email?: string; superuser?: number }) => Promise<boolean>;
    deleteOwner: (id: number | string) => Promise<boolean>;
}

export const useOwnerStore = create<OwnerState>((set, get) => ({
    owners: [],
    loading: false,
    error: null,

    fetchOwners: async () => {
        set({ loading: true, error: null });
        try {
            const res = await apiFetch(`${API_BASE}/owners?t=${Date.now()}`);
            if (!res.ok) throw new Error('Failed to fetch owners');
            const data = await res.json();
            set({ owners: data, loading: false });
        } catch (err: any) {
            set({ error: err.message, loading: false });
        }
    },

    addOwner: async (data) => {
        set({ loading: true, error: null });
        try {
            const res = await apiFetch(`${API_BASE}/owners`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await res.json();
            
            if (!res.ok) {
                set({ error: result.error || 'Failed to add owner', loading: false });
                return false;
            }
            
            await get().fetchOwners();
            return true;
        } catch (err: any) {
            set({ error: err.message, loading: false });
            return false;
        }
    },

    updateOwner: async (id, data) => {
        set({ loading: true, error: null });
        try {
            const res = await apiFetch(`${API_BASE}/owners/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await res.json();
            
            if (!res.ok) {
                set({ error: result.error || 'Failed to update owner', loading: false });
                return false;
            }

            await get().fetchOwners();
            return true;
        } catch (err: any) {
            set({ error: err.message, loading: false });
            return false;
        }
    },

    deleteOwner: async (id) => {
        set({ loading: true, error: null });
        try {
            const res = await apiFetch(`${API_BASE}/owners/${id}`, { method: 'DELETE' });
            if (!res.ok) {
                set({ error: 'Failed to delete owner', loading: false });
                return false;
            }

            const newOwners = get().owners.filter(p => p.id.toString() !== id.toString());
            set({ owners: newOwners, loading: false });
            return true;
        } catch (err: any) {
            set({ error: err.message, loading: false });
            return false;
        }
    }
}));
