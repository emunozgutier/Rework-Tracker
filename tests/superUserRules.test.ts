import { describe, it, expect, beforeAll, afterAll } from 'vitest';

const API_URL = 'http://localhost:5002/api';

describe('Super User Protection Rules API', () => {
    let superUserId: number;
    let secondUserId: number;
    const superUsername = `vitest_first_${Date.now()}`;
    const secondUsername = `vitest_second_${Date.now()}`;

    beforeAll(async () => {
        await fetch(`${API_URL}/test/cleanup`, { method: 'POST' }).catch(() => {});
    });

    afterAll(async () => {
        if (secondUserId) {
            await fetch(`${API_URL}/owners/${secondUserId}`, { method: 'DELETE' }).catch(() => {});
        }
        await fetch(`${API_URL}/test/cleanup`, { method: 'POST' }).catch(() => {});
    });

    it('should create subsequent users as regular users if a super user already exists', async () => {
        // Create user 2 without role / is_super_user
        const res = await fetch(`${API_URL}/owners`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Vitest Second User',
                username: secondUsername,
                email: 'second@vitest.test'
            })
        });
        expect(res.status).toBe(201);
        const data = await res.json();
        secondUserId = data.id;
        expect(data.is_super_user).toBe(0);
    });

    it('should prevent demoting the only super user', async () => {
        // Find existing super user or create one
        const ownersRes = await fetch(`${API_URL}/owners`);
        const owners = await ownersRes.json();
        const superUsers = owners.filter((o: any) => o.is_super_user === 1 || o.is_super_user === true);
        expect(superUsers.length).toBeGreaterThanOrEqual(1);

        const targetSuperUser = superUsers[0];
        superUserId = targetSuperUser.id;

        // If there is only 1 super user alive, trying to demote must return 400
        if (superUsers.length === 1) {
            const demoteRes = await fetch(`${API_URL}/owners/${targetSuperUser.id}/role`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'X-User-Role': 'Super User'
                },
                body: JSON.stringify({ role: 'User' })
            });
            expect(demoteRes.status).toBe(400);
            const errData = await demoteRes.json();
            expect(errData.error).toContain('only super user');
        }
    });

    it('should prevent deleting the only super user', async () => {
        const ownersRes = await fetch(`${API_URL}/owners`);
        const owners = await ownersRes.json();
        const superUsers = owners.filter((o: any) => o.is_super_user === 1 || o.is_super_user === true);

        if (superUsers.length === 1) {
            const delRes = await fetch(`${API_URL}/owners/${superUsers[0].id}`, {
                method: 'DELETE'
            });
            expect(delRes.status).toBe(400);
            const errData = await delRes.json();
            expect(errData.error).toContain('only super user');
        }
    });

    it('should allow demoting or deleting a super user when another super user exists', async () => {
        // Promote the second user to super user
        const promoteRes = await fetch(`${API_URL}/owners/${secondUserId}/role`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'X-User-Role': 'Super User'
            },
            body: JSON.stringify({ role: 'Super User' })
        });
        expect(promoteRes.status).toBe(200);

        // Now there are 2 super users. Demoting secondUserId back to 'User' must succeed
        const demoteRes = await fetch(`${API_URL}/owners/${secondUserId}/role`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'X-User-Role': 'Super User'
            },
            body: JSON.stringify({ role: 'User' })
        });
        expect(demoteRes.status).toBe(200);

        // Deleting secondUserId (now a normal user) must succeed
        const delRes = await fetch(`${API_URL}/owners/${secondUserId}`, {
            method: 'DELETE'
        });
        expect(delRes.status).toBe(200);
    });

    it('should enforce super user protection rules in demo mode', async () => {
        const { apiFetch, API_BASE: apiBase } = await import('../src/store/serverDataBase/apiBridge');
        const { useDemoStore } = await import('../src/store/useDemoStore');
        useDemoStore.getState().setDemoMode(true);

        // In demo mode, Alice Smith (id: 1) is Super User.
        // Try to demote when Alice is the only super user
        const demoteRes = await apiFetch(`${apiBase}/owners/1/role`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role: 'User' })
        });
        expect(demoteRes.status).toBe(400);
        const demoteData = await demoteRes.json();
        expect(demoteData.error).toContain('only super user');

        // Try to delete Alice when she is the only super user
        const delRes = await apiFetch(`${apiBase}/owners/1`, {
            method: 'DELETE'
        });
        expect(delRes.status).toBe(400);
        const delData = await delRes.json();
        expect(delData.error).toContain('only super user');

        // Reset demo mode
        useDemoStore.getState().setDemoMode(false);
    });
});
