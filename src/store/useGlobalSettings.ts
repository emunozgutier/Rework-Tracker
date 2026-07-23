import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type CrcFormatOption = 'letter' | 'nato';
export type UserRole = 'superuser' | 'user' | 'guest';

export interface PagePermissions {
    view: boolean;
    create: boolean;
    edit: boolean;
    delete: boolean;
}

export type PageName = 'projects' | 'pcbs' | 'reworks' | 'owners' | 'tags' | 'sandbox' | 'settings';

export interface GlobalSettingsProperties {
    crcFormat: CrcFormatOption;
    activeRole: UserRole;
    permissions: Record<UserRole, Record<PageName, PagePermissions>>;
}

export interface GlobalSettingsActions {
    setCrcFormat: (crcFormat: CrcFormatOption) => void;
    toggleCrcFormat: () => void;
    resetSettings: () => void;
    setActiveRole: (role: UserRole) => void;
    togglePermission: (role: UserRole, page: PageName, right: keyof PagePermissions) => void;
    hasPermission: (page: PageName, right: keyof PagePermissions) => boolean;
}

export type GlobalSettingsState = GlobalSettingsProperties & GlobalSettingsActions;

const initialPagePermissions = (view: boolean, create: boolean, edit: boolean, del: boolean): PagePermissions => ({
    view,
    create,
    edit,
    delete: del,
});

export const DEFAULT_GLOBAL_SETTINGS: GlobalSettingsProperties = {
    crcFormat: 'letter',
    activeRole: 'guest',
    permissions: {
        superuser: {
            projects: initialPagePermissions(true, true, true, true),
            pcbs: initialPagePermissions(true, true, true, true),
            reworks: initialPagePermissions(true, true, true, true),
            owners: initialPagePermissions(true, true, true, true),
            tags: initialPagePermissions(true, true, true, true),
            sandbox: initialPagePermissions(true, true, true, true), // CRC
            settings: initialPagePermissions(true, true, true, true),
        },
        user: {
            projects: initialPagePermissions(true, true, true, false),
            pcbs: initialPagePermissions(true, true, true, false),
            reworks: initialPagePermissions(true, true, true, false),
            owners: initialPagePermissions(true, false, false, false),
            tags: initialPagePermissions(true, true, true, false),
            sandbox: initialPagePermissions(true, true, true, true), // CRC open for all
            settings: initialPagePermissions(true, false, true, false),
        },
        guest: {
            projects: initialPagePermissions(true, false, false, false),
            pcbs: initialPagePermissions(true, false, false, false),
            reworks: initialPagePermissions(true, false, false, false),
            owners: initialPagePermissions(true, false, false, false),
            tags: initialPagePermissions(true, false, false, false),
            sandbox: initialPagePermissions(true, true, true, true), // CRC open for all
            settings: initialPagePermissions(true, false, false, false),
        },
    },
};

export const useGlobalSettings = create<GlobalSettingsState>()(
    persist(
        (set, get) => ({
            ...DEFAULT_GLOBAL_SETTINGS,

            setCrcFormat: (crcFormat) => set({ crcFormat }),

            toggleCrcFormat: () =>
                set((state) => ({
                    crcFormat: state.crcFormat === 'letter' ? 'nato' : 'letter',
                })),

            setActiveRole: (activeRole) => set({ activeRole }),

            togglePermission: (role, page, right) => {
                // CRC is always open for all, do not toggle
                if (page === 'sandbox') return;

                set((state) => {
                    const rolePerms = state.permissions[role];
                    const pagePerms = rolePerms[page];
                    const updatedPagePerms = {
                        ...pagePerms,
                        [right]: !pagePerms[right],
                    };
                    const updatedRolePerms = {
                        ...rolePerms,
                        [page]: updatedPagePerms,
                    };
                    return {
                        permissions: {
                            ...state.permissions,
                            [role]: updatedRolePerms,
                        },
                    };
                });
            },

            hasPermission: (page, right) => {
                // CRC is open for all
                if (page === 'sandbox') return true;

                const { activeRole, permissions } = get();
                const rolePerms = permissions[activeRole];
                if (!rolePerms) return false;
                const pagePerms = rolePerms[page];
                if (!pagePerms) return false;
                return !!pagePerms[right];
            },

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
