import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { API_BASE, apiFetch } from '../store/database/apiBridge';
import { useGlobalSettings } from '../store/useGlobalSettings';

export interface Owner {
    id: number;
    name: string;
    username: string;
    email: string;
    superuser: number;
}

interface AuthState {
    token: string | null;
    email: string | null;
    owner: Owner | null;
    loading: boolean;
    error: string | null;
    otpSent: boolean;
    
    requestOtp: (email: string) => Promise<boolean>;
    verifyOtp: (email: string, otp: string) => Promise<boolean>;
    verifySession: () => Promise<boolean>;
    logout: () => Promise<void>;
    clearError: () => void;
    setOtpSent: (val: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            token: null,
            email: null,
            owner: null,
            loading: false,
            error: null,
            otpSent: false,

            clearError: () => set({ error: null }),
            setOtpSent: (val) => set({ otpSent: val }),

            requestOtp: async (email) => {
                set({ loading: true, error: null });
                try {
                    const res = await apiFetch(`${API_BASE}/auth/request-otp`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email })
                    });
                    const data = await res.json();
                    if (!res.ok) {
                        set({ error: data.error || 'Failed to request code', loading: false });
                        return false;
                    }
                    set({ loading: false, otpSent: true, email });
                    return true;
                } catch (err: any) {
                    set({ error: err.message, loading: false });
                    return false;
                }
            },

            verifyOtp: async (email, otp) => {
                set({ loading: true, error: null });
                try {
                    const res = await apiFetch(`${API_BASE}/auth/verify-otp`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email, otp })
                    });
                    const data = await res.json();
                    if (!res.ok) {
                        set({ error: data.error || 'Verification failed', loading: false });
                        return false;
                    }
                    
                    const { token, owner } = data;
                    set({ token, email, owner, loading: false, otpSent: false });
                    
                    // Automatically update simulation mode role
                    const role = owner.superuser === 1 ? 'superuser' : 'user';
                    useGlobalSettings.getState().setActiveRole(role);
                    
                    return true;
                } catch (err: any) {
                    set({ error: err.message, loading: false });
                    return false;
                }
            },

            verifySession: async () => {
                const { token } = get();
                if (!token) return false;
                
                try {
                    const res = await apiFetch(`${API_BASE}/auth/verify-session`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ token })
                    });
                    const data = await res.json();
                    if (res.ok && data.valid) {
                        set({ owner: data.owner, email: data.email });
                        
                        // Sync role
                        const role = data.owner.superuser === 1 ? 'superuser' : 'user';
                        useGlobalSettings.getState().setActiveRole(role);
                        
                        return true;
                    } else {
                        // Session expired
                        set({ token: null, email: null, owner: null, otpSent: false });
                        useGlobalSettings.getState().setActiveRole('guest');
                        return false;
                    }
                } catch (e) {
                    // Network error, keep session local for offline/robustness
                    return true;
                }
            },

            logout: async () => {
                const { token } = get();
                if (token) {
                    try {
                        await apiFetch(`${API_BASE}/auth/logout`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ token })
                        });
                    } catch (e) {}
                }
                set({ token: null, email: null, owner: null, otpSent: false, error: null });
                useGlobalSettings.getState().setActiveRole('guest');
            }
        }),
        {
            name: 'pcb-rework-tracker-auth',
            partialize: (state) => ({ token: state.token, email: state.email, owner: state.owner })
        }
    )
);
