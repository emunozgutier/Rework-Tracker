import { create } from 'zustand';
import { usePcbStore } from './usePcbStore';
import { useReworkStore } from './useReworkStore';
import { useTagStore } from './useTagStore';

type Page = 
    | 'projects' | 'projects_add' | 'projects_edit'
    | 'pcbs' | 'pcbs_add' | 'pcbs_edit'
    | 'reworks' | 'reworks_add' | 'reworks_edit'
    | 'owners' | 'owners_add' | 'owners_edit'
    | 'tags' | 'tags_add' | 'tags_edit'
    | 'wrong_url' | 'fixed_url'
    | 'sandbox';

interface NavigationState {
    page: Page;
    activeTab: string;
    selectedId: string | number | null;
    isMobile: boolean;
    expandedProject: string | null;
    expandedPcb: string | null;
    expandedRework: string | null;
    isolatedView: boolean;
    qrModalBoard: string | null;
    mistypedUrl: string | null;
    correctedUrl: string | null;
    
    // Search and filter states for top header buttons
    searchQuery: string;
    showFilters: boolean;
    showMobileSearch: boolean;
    
    // Actions
    setPage: (page: Page) => void;
    setActiveTab: (tab: string) => void;
    editItem: (page: Page, id: string | number) => void;
    addItem: (page: Page, prefillId?: string | number) => void;
    goBack: () => void;
    setIsMobile: (isMobile: boolean) => void;
    setExpandedProject: (name: string | null) => void;
    setExpandedPcb: (name: string | null) => void;
    setExpandedRework: (id: string | null) => void;
    setIsolatedView: (isolatedView: boolean) => void;
    setQrModalBoard: (board: string | null) => void;
    setMistypedUrl: (url: string | null) => void;
    setCorrectedUrl: (url: string | null) => void;
    setSearchQuery: (query: string) => void;
    setShowFilters: (show: boolean) => void;
    setShowMobileSearch: (show: boolean) => void;
}

export const useStore = create<NavigationState>((set) => ({
    page: 'projects',
    activeTab: 'projects',
    selectedId: null,
    isMobile: typeof window !== 'undefined' ? window.innerWidth <= 768 : false,
    expandedProject: null,
    expandedPcb: null,
    expandedRework: null,
    isolatedView: false,
    qrModalBoard: null,
    mistypedUrl: null,
    correctedUrl: null,
    searchQuery: '',
    showFilters: false,
    showMobileSearch: false,

    setPage: (page) => set({ page }),
    setIsolatedView: (isolatedView) => set({ isolatedView }),
    
    setExpandedProject: (name) => {
        set({ expandedProject: name });
    },

    setExpandedPcb: (name) => {
        set({ expandedPcb: name });
    },

    setExpandedRework: (id) => {
        set({ expandedRework: id });
    },

    setQrModalBoard: (name) => set({ qrModalBoard: name }),
    setMistypedUrl: (url) => set({ mistypedUrl: url }),
    setCorrectedUrl: (url) => set({ correctedUrl: url }),
    setSearchQuery: (searchQuery) => set({ searchQuery }),
    setShowFilters: (showFilters) => set({ showFilters }),
    setShowMobileSearch: (showMobileSearch) => set({ showMobileSearch }),

    setActiveTab: (tab) => {
        usePcbStore.getState().resetFilters();
        useReworkStore.getState().resetFilters();
        useTagStore.getState().resetFilters();

        set({ 
            activeTab: tab, 
            page: tab as Page, // When we switch tabs, we go to the main list page
            selectedId: null,
            expandedProject: null,
            expandedPcb: null,
            expandedRework: null,
            searchQuery: '',
            showFilters: false,
            showMobileSearch: false
        });
    },

    editItem: (page, id) => set({ 
        page, 
        selectedId: id 
    }),

    addItem: (page, prefillId) => {
        const baseTab = page.split('_')[0];
        if (typeof window !== 'undefined' && useStore.getState().activeTab !== baseTab) {
            set({ 
                activeTab: baseTab,
                page, 
                selectedId: prefillId || null 
            });
            return;
        }
        set({ 
            page, 
            selectedId: prefillId || null 
        });
    },

    goBack: () => set((state) => ({ 
        page: state.activeTab as Page, 
        selectedId: null 
    })),

    setIsMobile: (isMobile) => set({ isMobile }),
}));

// Initialize listener
if (typeof window !== 'undefined') {
    window.addEventListener('resize', () => {
        const mobile = window.innerWidth <= 768;
        if (useStore.getState().isMobile !== mobile) {
            useStore.getState().setIsMobile(mobile);
        }
    });
}
