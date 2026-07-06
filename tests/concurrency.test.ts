import { describe, it, expect, afterAll } from 'vitest';
import { cleanupTestData } from './cleanup';

const API_URL = 'http://localhost:5002/api';

describe('Concurrency and Deduplication API tests', () => {

    it('should deduplicate identical concurrent write requests', async () => {
        const body = {
            name: 'Vitest Concurrency Alpha',
            description: 'Deduplicated concurrent project test',
            revisions: 'A0',
            project_key: 'CTA',
            number_format: 'decimal',
            flavors: []
        };

        // Send two identical POST requests concurrently
        const [res1, res2] = await Promise.all([
            fetch(`${API_URL}/projects`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            }),
            fetch(`${API_URL}/projects`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            })
        ]);

        const data1 = await res1.json();
        const data2 = await res2.json();

        if (res1.status !== 201 || res2.status !== 201) {
            console.log("FAIL DETAILS - res1:", res1.status, data1, "res2:", res2.status, data2);
        }

        // Both should succeed and return the exact same project details and ID
        expect(res1.status).toBe(201);
        expect(res2.status).toBe(201);
        expect(data1.id).toBeDefined();
        expect(data2.id).toBeDefined();
        expect(data1.id).toBe(data2.id);
        expect(data1.name).toBe(data2.name);
        expect(data1.project_key).toBe(data2.project_key);
    });

    it('should process concurrent non-identical write requests sequentially without conflict', async () => {
        const body1 = {
            name: 'Vitest Concurrency Beta',
            description: 'Distinct concurrent project test 1',
            revisions: 'A0',
            project_key: 'CTB',
            number_format: 'decimal',
            flavors: []
        };

        const body2 = {
            name: 'Vitest Concurrency Gamma',
            description: 'Distinct concurrent project test 2',
            revisions: 'A0',
            project_key: 'CTG',
            number_format: 'decimal',
            flavors: []
        };

        // Send two distinct POST requests concurrently
        const [res1, res2] = await Promise.all([
            fetch(`${API_URL}/projects`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body1)
            }),
            fetch(`${API_URL}/projects`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body2)
            })
        ]);

        const data1 = await res1.json();
        const data2 = await res2.json();

        // Both should succeed with distinct project IDs
        expect(res1.status).toBe(201);
        expect(res2.status).toBe(201);
        expect(data1.id).toBeDefined();
        expect(data2.id).toBeDefined();
        expect(data1.id).not.toBe(data2.id);
    });

    afterAll(async () => {
        try {
            await cleanupTestData();
        } catch (e) {
            console.error('Failed to run database cleanup:', e);
        }
    });
});
