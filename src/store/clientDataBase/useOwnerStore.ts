import { create } from 'zustand';
import { API_BASE } from '../serverDataBase/apiBridge';
import { apiFetch } from '../serverDataBase/apiBridge';

export interface Owner {
    id: number;
    name: string;
    username: string;
    email?: string;
    pcb_count?: number;
    rework_count?: number;
    tag_count?: number;
    has_otp?: number | boolean;
    otp_secret?: string;
    is_super_user?: number;
    crc_format?: string;
}

interface OwnerState {
    owners: Owner[];
    loading: boolean;
    error: string | null;
    fetchOwners: () => Promise<void>;
    addOwner: (data: { name: string; username: string; email?: string; otp_secret?: string; is_super_user?: number; role?: string }) => Promise<boolean>;
    updateOwner: (id: number | string, data: { name: string; username: string; email?: string }) => Promise<boolean>;
    updateOwnerRole: (id: number | string, role: 'Super User' | 'User') => Promise<boolean>;
    deleteOwner: (id: number | string) => Promise<boolean>;
}

export const useOwnerStore = create<OwnerState>((set, get) => ({
    owners: [],
    loading: false,
    error: null,

    fetchOwners: async () => {
        set({ loading: true, error: null });
        try {
            const res = await apiFetch(`${API_BASE}/owners`);
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

    updateOwnerRole: async (id, role) => {
        try {
            const res = await apiFetch(`${API_BASE}/owners/${id}/role`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role })
            });
            if (!res.ok) {
                const result = await res.json();
                set({ error: result.error || 'Failed to update role' });
                return false;
            }
            await get().fetchOwners();
            return true;
        } catch (err: any) {
            set({ error: err.message });
            return false;
        }
    },

    deleteOwner: async (id) => {
        set({ loading: true, error: null });
        try {
            const res = await apiFetch(`${API_BASE}/owners/${id}`, { method: 'DELETE' });
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                set({ error: data.error || 'Failed to delete owner', loading: false });
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
