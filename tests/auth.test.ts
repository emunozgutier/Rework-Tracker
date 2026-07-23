import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { useAuthStore } from '../src/login/client';
import { useOwnerStore } from '../src/store/useOwnerStore';
import sqlite3 from 'sqlite3';
import path from 'path';

describe('OTP Authentication Integration Tests', () => {
    const testEmail = 'auth.tester@company.com';
    let otpCode = '';

    beforeAll(async () => {
        // Manually delete any existing user with testEmail to ensure a clean slate
        const dbPath = path.resolve('src/store/database/pcb_tracker.db');
        const db = new sqlite3.Database(dbPath);
        await new Promise<void>((resolve) => {
            db.serialize(() => {
                db.run("DELETE FROM owners WHERE email = ?", [testEmail]);
                db.run("DELETE FROM login_otps WHERE email = ?", [testEmail]);
                db.run("DELETE FROM user_sessions WHERE email = ?", [testEmail]);
                db.close(() => resolve());
            });
        });
    });

    afterAll(async () => {
        // Cleanup after tests
        const dbPath = path.resolve('src/store/database/pcb_tracker.db');
        const db = new sqlite3.Database(dbPath);
        await new Promise<void>((resolve) => {
            db.serialize(() => {
                db.run("DELETE FROM owners WHERE email = ?", [testEmail]);
                db.run("DELETE FROM login_otps WHERE email = ?", [testEmail]);
                db.run("DELETE FROM user_sessions WHERE email = ?", [testEmail]);
                db.close(() => resolve());
            });
        });
    });

    it('should successfully request an OTP passcode', async () => {
        const store = useAuthStore.getState();
        const success = await store.requestOtp(testEmail);
        expect(success).toBe(true);
        expect(useAuthStore.getState().otpSent).toBe(true);
        expect(useAuthStore.getState().email).toBe(testEmail);

        // Fetch the generated passcode directly from the database for verification
        const dbPath = path.resolve('src/store/database/pcb_tracker.db');
        const db = new sqlite3.Database(dbPath);
        otpCode = await new Promise<string>((resolve, reject) => {
            db.get("SELECT otp FROM login_otps WHERE email = ?", [testEmail], (err, row: any) => {
                if (err) return reject(err);
                resolve(row ? row.otp : '');
                db.close();
            });
        });
        expect(otpCode).toMatch(/^\d{6}$/); // Assert 6-digit code
    });

    it('should reject verification with an incorrect passcode', async () => {
        const store = useAuthStore.getState();
        const success = await store.verifyOtp(testEmail, '000000'); // wrong code
        expect(success).toBe(false);
        expect(useAuthStore.getState().token).toBeNull();
        expect(useAuthStore.getState().error).toMatch(/Invalid passcode/i);
    });

    it('should verify with correct passcode, auto-create owner, and return session token', async () => {
        const store = useAuthStore.getState();
        const success = await store.verifyOtp(testEmail, otpCode);
        expect(success).toBe(true);
        expect(useAuthStore.getState().token).not.toBeNull();
        expect(useAuthStore.getState().owner).not.toBeNull();
        expect(useAuthStore.getState().owner?.email).toBe(testEmail);

        // Verify owner is added in owners store
        await useOwnerStore.getState().fetchOwners();
        const createdOwner = useOwnerStore.getState().owners.find(o => o.email === testEmail);
        expect(createdOwner).toBeDefined();
        expect(createdOwner?.name).toBe('Auth Tester');
    });

    it('should validate an active session token', async () => {
        const store = useAuthStore.getState();
        const success = await store.verifySession();
        expect(success).toBe(true);
        expect(useAuthStore.getState().email).toBe(testEmail);
    });

    it('should clear session on logout', async () => {
        const store = useAuthStore.getState();
        await store.logout();
        expect(useAuthStore.getState().token).toBeNull();
        expect(useAuthStore.getState().owner).toBeNull();

        // verifySession should now return false
        const sessionValid = await useAuthStore.getState().verifySession();
        expect(sessionValid).toBe(false);
    });
});
