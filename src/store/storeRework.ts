import { create } from 'zustand';
import { API_BASE } from '../store/database/apiBridge';
import { apiFetch } from '../store/database/apiBridge';

export interface Rework {
    id: number;
    pcb_id: number;
    title?: string;
    description: string;
    timestamp: string;
    owner_id: number | null;
    owner_name: string | null;
    owner_username?: string;
    pcb_board_number: string;
    image_path?: string;
    rework_number?: number;
    rework_type?: string;
}

interface ReworkState {
    reworks: Rework[];
    loading: boolean;
    error: string | null;
    fetchReworks: () => Promise<void>;
    addRework: (data: FormData | { pcb_id: number | null; title?: string; description: string; owner_id: string | null; rework_type?: string; new_product?: string }) => Promise<boolean>;
    updateRework: (id: number | string, data: { pcb_id: number | null; title?: string; description: string; owner_id: string | null; rework_type?: string; new_product?: string }) => Promise<boolean>;
    deleteRework: (id: number | string) => Promise<boolean>;
    selectedBoards: string[];
    setSelectedBoards: (boards: string[]) => void;
    resetFilters: () => void;
}

export const useReworkStore = create<ReworkState>((set, get) => ({
    reworks: [],
    loading: false,
    error: null,
    selectedBoards: [],

    setSelectedBoards: (boards) => set({ selectedBoards: boards }),
    resetFilters: () => set({ selectedBoards: [] }),

    fetchReworks: async () => {
        set({ loading: true, error: null });
        try {
            const res = await apiFetch(`${API_BASE}/reworks`);
            if (!res.ok) throw new Error('Failed to fetch reworks');
            const data = await res.json();
            set({ reworks: data, loading: false });
        } catch (err: any) {
            set({ error: err.message, loading: false });
        }
    },

    addRework: async (data: any) => {
        set({ loading: true, error: null });
        try {
            const isFormData = data instanceof FormData;
            const res = await apiFetch(`${API_BASE}/reworks`, {
                method: 'POST',
                ...(isFormData ? {} : { headers: { 'Content-Type': 'application/json' } }),
                body: isFormData ? data : JSON.stringify(data)
            });
            const result = await res.json();
            
            if (!res.ok) {
                set({ error: result.error || 'Failed to add rework', loading: false });
                return false;
            }
            
            await get().fetchReworks();
            return true;
        } catch (err: any) {
            set({ error: err.message, loading: false });
            return false;
        }
    },

    updateRework: async (id, data) => {
        set({ loading: true, error: null });
        try {
            const res = await apiFetch(`${API_BASE}/reworks/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await res.json();
            
            if (!res.ok) {
                set({ error: result.error || 'Failed to update rework', loading: false });
                return false;
            }

            await get().fetchReworks();
            return true;
        } catch (err: any) {
            set({ error: err.message, loading: false });
            return false;
        }
    },

    deleteRework: async (id) => {
        set({ loading: true, error: null });
        try {
            const res = await apiFetch(`${API_BASE}/reworks/${id}`, { method: 'DELETE' });
            if (!res.ok) {
                const result = await res.json().catch(() => ({}));
                set({ error: result.error || 'Failed to delete rework', loading: false });
                return false;
            }

            const newReworks = get().reworks.filter(p => p.id.toString() !== id.toString());
            set({ reworks: newReworks, loading: false });
            return true;
        } catch (err: any) {
            set({ error: err.message, loading: false });
            return false;
        }
    }
}));
