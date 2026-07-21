import { create } from 'zustand';
import { API_BASE } from '../store/database/apiBridge';
import { apiFetch } from '../store/database/apiBridge';
import { useAppState } from './useAppState';

export interface Pcb {
    id: number;
    board_number: string;
    status: string;
    project: string;
    project_id?: number;
    number_format?: 'hex' | 'decimal';
    owner: string;
    owner_username?: string;
    product: string;
    board_flavor?: string;
    board_rev?: string;
    silicon_rev?: string;
    silicon_corner?: string;
    bom?: string;
    tag_ids?: number[];
    short_code?: string;
    created_at?: string;
}

interface PcbState {
    pcbs: Pcb[];
    loading: boolean;
    hasFetched: boolean;
    error: string | null;
    fetchPcbs: () => Promise<void>;
    addPcb: (data: { board_number: string; status: string; board_flavor: string; board_rev: string; silicon_rev: string; silicon_corner: string; bom?: string; project_id: number | null; owner_id: number | null }) => Promise<boolean>;
    updatePcb: (id: number | string, data: { board_number: string; status: string; board_flavor: string; board_rev: string; silicon_rev: string; silicon_corner: string; bom?: string; project_id: number | null; owner_id: number | null }) => Promise<boolean>;
    deletePcb: (id: number | string) => Promise<boolean>;
    selectedProjects: string[];
    selectedRevisions: string[];
    selectedFlavors: string[];
    selectedPcbRevs: string[];
    selectedCorners: string[];
    selectedTags: string[];
    selectedOwners: string[];
    selectedBoardNumbers: string[];
    selectedBoms: string[];
    setSelectedProjects: (projects: string[]) => void;
    setSelectedRevisions: (revisions: string[]) => void;
    setSelectedFlavors: (flavors: string[]) => void;
    setSelectedPcbRevs: (revs: string[]) => void;
    setSelectedCorners: (corners: string[]) => void;
    setSelectedTags: (tags: string[]) => void;
    setSelectedOwners: (owners: string[]) => void;
    setSelectedBoardNumbers: (boardNumbers: string[]) => void;
    setSelectedBoms: (boms: string[]) => void;
    resetFilters: () => void;
}

export const usePcbStore = create<PcbState>((set, get) => ({
    pcbs: [],
    loading: false,
    hasFetched: false,
    error: null,
    selectedProjects: [],
    selectedRevisions: [],
    selectedFlavors: [],
    selectedPcbRevs: [],
    selectedCorners: [],
    selectedTags: [],
    selectedOwners: [],
    selectedBoardNumbers: [],
    selectedBoms: [],

    setSelectedProjects: (projects) => set({ selectedProjects: projects }),
    setSelectedRevisions: (revisions) => set({ selectedRevisions: revisions }),
    setSelectedFlavors: (flavors) => set({ selectedFlavors: flavors }),
    setSelectedPcbRevs: (revs) => set({ selectedPcbRevs: revs }),
    setSelectedCorners: (corners) => set({ selectedCorners: corners }),
    setSelectedTags: (tags) => set({ selectedTags: tags }),
    setSelectedOwners: (owners) => set({ selectedOwners: owners }),
    setSelectedBoardNumbers: (boardNumbers) => set({ selectedBoardNumbers: boardNumbers }),
    setSelectedBoms: (boms) => set({ selectedBoms: boms }),
    resetFilters: () => set({
        selectedProjects: [],
        selectedRevisions: [],
        selectedFlavors: [],
        selectedPcbRevs: [],
        selectedCorners: [],
        selectedTags: [],
        selectedOwners: [],
        selectedBoardNumbers: [],
        selectedBoms: []
    }),

    fetchPcbs: async () => {
        set({ loading: true, error: null });
        try {
            const res = await apiFetch(`${API_BASE}/pcbs`);
            if (!res.ok) throw new Error('Failed to fetch pcbs');
            const data = await res.json();
            set({ pcbs: data, loading: false, hasFetched: true });
        } catch (err: any) {
            set({ error: err.message, loading: false, hasFetched: true });
        }
    },

    addPcb: async (data) => {
        set({ loading: true, error: null });
        try {
            const res = await apiFetch(`${API_BASE}/pcbs`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await res.json();
            
            if (!res.ok) {
                set({ error: result.error || 'Failed to add pcb', loading: false });
                return false;
            }
            
            await get().fetchPcbs();
            return true;
        } catch (err: any) {
            set({ error: err.message, loading: false });
            return false;
        }
    },

    updatePcb: async (id, data) => {
        set({ loading: true, error: null });
        try {
            const res = await apiFetch(`${API_BASE}/pcbs/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await res.json();
            
            if (!res.ok) {
                set({ error: result.error || 'Failed to update pcb', loading: false });
                return false;
            }

            await get().fetchPcbs();
            return true;
        } catch (err: any) {
            set({ error: err.message, loading: false });
            return false;
        }
    },

    deletePcb: async (id) => {
        set({ loading: true, error: null });
        try {
            const pcbToDelete = get().pcbs.find(p => p.id.toString() === id.toString());
            const boardNumber = pcbToDelete?.board_number;

            const res = await apiFetch(`${API_BASE}/pcbs/${id}`, { method: 'DELETE' });
            if (!res.ok) {
                set({ error: 'Failed to delete pcb', loading: false });
                return false;
            }

            if (boardNumber && useAppState.getState().expandedPcb === boardNumber) {
                useAppState.getState().setExpandedPcb(null);
            }

            const newPcbs = get().pcbs.filter(p => p.id.toString() !== id.toString());
            set({ pcbs: newPcbs, loading: false });
            return true;
        } catch (err: any) {
            set({ error: err.message, loading: false });
            return false;
        }
    }
}));
