import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type CrcFormatOption = 'letter' | 'nato';

export interface GlobalSettingsProperties {
    crcFormat: CrcFormatOption;
}

export interface GlobalSettingsActions {
    setCrcFormat: (crcFormat: CrcFormatOption) => void;
    toggleCrcFormat: () => void;
    resetSettings: () => void;
}

export type GlobalSettingsState = GlobalSettingsProperties & GlobalSettingsActions;

export const DEFAULT_GLOBAL_SETTINGS: GlobalSettingsProperties = {
    crcFormat: 'letter',
};

export const useGlobalSettings = create<GlobalSettingsState>()(
    persist(
        (set) => ({
            ...DEFAULT_GLOBAL_SETTINGS,

            setCrcFormat: (crcFormat) => set({ crcFormat }),

            toggleCrcFormat: () =>
                set((state) => ({
                    crcFormat: state.crcFormat === 'letter' ? 'nato' : 'letter',
                })),

            resetSettings: () => set(DEFAULT_GLOBAL_SETTINGS),
        }),
        {
            name: 'pcb-rework-tracker-global-settings',
            storage: createJSONStorage(() => {
                if (typeof window !== 'undefined' && window.localStorage) {
                    return window.localStorage;
                }
                // Fallback dummy storage for Node / test environments
                return {
                    getItem: () => null,
                    setItem: () => {},
                    removeItem: () => {},
                };
            }),
        }
    )
);
