import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';

// Assuming server is running on localhost:5002, or we could just use a fetch test
// Let's use standard fetch to hit the running dev server on localhost:5002

const API_URL = 'http://localhost:5002/api';

describe('Projects API - Silicon Version', () => {
    let projectId;

    it('should create a test project', async () => {
        const res = await fetch(`${API_URL}/projects`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Test Project Dione',
                description: 'Test',
                revisions: 'A0',
                project_key: 'DIO',
                number_format: 'decimal',
                flavors: []
            })
        });
        const data = await res.json();
        expect(res.status).toBe(201);
        projectId = data.id;
        expect(projectId).toBeDefined();
    });

    it('should update the project by adding B0 silicon version', async () => {
        const res = await fetch(`${API_URL}/projects/${projectId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Test Project Dione',
                description: 'Test',
                revisions: 'A0, B0', // Adding B0
                project_key: 'DIO',
                number_format: 'decimal',
                flavors: [{ name: 'Flavor1', revisions: 'A0' }]
            })
        });
        const data = await res.json();
        expect(res.status).toBe(200);
        expect(data.updated).toBeDefined();
    });

    it('should delete the test project', async () => {
        if (!projectId) return;
        const res = await fetch(`${API_URL}/projects/${projectId}`, {
            method: 'DELETE'
        });
        expect(res.status).toBe(200);
    });
});
