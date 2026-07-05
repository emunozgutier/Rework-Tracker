import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { cleanupTestData } from './cleanup';
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

    it('should verify the API returns revisions as an array correctly parsed', async () => {
        const res = await fetch(`${API_URL}/projects`);
        const projects = await res.json();
        const project = projects.find((p: any) => p.id === projectId);
        expect(project).toBeDefined();
        expect(Array.isArray(project.revisions)).toBe(true);
        expect(project.revisions).toContain('B0');
        expect(project.revisions).toContain('A0');

        // Verify that the PCB flavors are correctly parsed and returned
        expect(Array.isArray(project.flavors)).toBe(true);
        expect(project.flavors.length).toBe(1);
        expect(project.flavors[0].name).toBe('Flavor1');
    });

    it('should delete the test project', async () => {
        if (!projectId) return;
        const res = await fetch(`${API_URL}/projects/${projectId}`, {
            method: 'DELETE'
        });
        expect(res.status).toBe(200);
    });

    afterAll(async () => {
        try {
            await cleanupTestData();
        } catch (e) {
            console.error('Failed to run database cleanup:', e);
        }
    });
});
