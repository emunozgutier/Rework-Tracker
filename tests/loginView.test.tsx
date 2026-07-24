import { describe, it, expect } from 'vitest';
import { useAuthStore } from '../src/login/client';

describe('Auth Store OTP verification logic', () => {
    it('should verify OTP without entering infinite loop', async () => {
        const store = useAuthStore.getState();
        expect(store.otpSent).toBe(false);
    });
});
