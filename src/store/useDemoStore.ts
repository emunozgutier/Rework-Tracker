import { create } from 'zustand';

interface DemoState {
    isDemoMode: boolean;
    toggleDemoMode: () => void;
    setDemoMode: (val: boolean) => void;
}

const initialDemoState = typeof window !== 'undefined' 
    ? window.location.hostname.includes('github.io') || window.location.hostname.includes('localhost') || window.location.pathname.includes('/demo') || window.location.search.includes('demo')
    : false;

export const useDemoStore = create<DemoState>()(
    (set) => ({
        isDemoMode: initialDemoState,
        toggleDemoMode: () => set((state) => ({ isDemoMode: !state.isDemoMode })),
        setDemoMode: (val) => set({ isDemoMode: val }),
    })
);
