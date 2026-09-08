import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db, initDb } from '../src/store/serverDataBase/db';
import { useDemoStore } from '../src/store/useDemoStore';
import path from 'path';
import fs from 'fs';

const API_URL = 'http://localhost:5002/api';

describe('Project Documents and Count Accuracy', () => {
    let projectId: number;
    const testProjectKey = 'TST';
    const testProjectName = 'DocCountTest_' + Date.now();

    beforeAll(async () => {
        useDemoStore.getState().setDemoMode(false);
        await initDb();
    });

    it('should create a project with revision details referencing schematic and board file', async () => {
        const res = await fetch(`${API_URL}/projects`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-User-Username': 'test_admin'
            },
            body: JSON.stringify({
                name: testProjectName,
                description: 'Test project for doc count',
                project_key: testProjectKey,
                number_format: 'decimal',
                packages: [
                    {
                        name: 'Test Package',
                        formfactors: [
                            {
                                name: 'Default FF',
                                revisions: ['1.0'],
                                revisionDetails: [
                                    {
                                        name: '1.0',
                                        boms: ['BOM1'],
                                        schematic: 'sample_schematic.pdf',
                                        board_file: 'sample_board.brd'
                                    }
                                ]
                            }
                        ]
                    }
                ]
            })
        });

        expect(res.status).toBe(201);
        const data = await res.json();
        projectId = data.id;
        expect(projectId).toBeDefined();
    });

    it('should report exactly 2 documents (not 4 or doubled) for the project', async () => {
        // Now simulate file upload for the 2 files
        const formData = new FormData();
        const dummyPdf = new Blob(['%PDF-1.4 dummy pdf content'], { type: 'application/pdf' });
        const dummyBrd = new Blob(['dummy board file content'], { type: 'application/octet-stream' });
        formData.append('docs', dummyPdf, 'sample_schematic.pdf');
        formData.append('docs', dummyBrd, 'sample_board.brd');

        const uploadRes = await fetch(`${API_URL}/projects/${projectId}/docs`, {
            method: 'POST',
            headers: {
                'X-User-Username': 'test_admin'
            },
            body: formData
        });

        expect(uploadRes.status).toBe(201);
        const uploadedDocs = await uploadRes.json();
        expect(uploadedDocs.length).toBe(2);

        // Fetch projects hierarchy from server
        const projRes = await fetch(`${API_URL}/projects`);
        const projects = await projRes.json();
        const createdProject = projects.find((p: any) => p.id === projectId);

        expect(createdProject).toBeDefined();
        // Crucial verification: doc_count must be exactly 2 (number of distinct documents), not doubled (4)
        expect(createdProject.doc_count).toBe(2);
    });

    it('should serve the uploaded files via static /api/docs endpoint', async () => {
        const docsRes = await fetch(`${API_URL}/projects/${projectId}/docs`);
        const docs = await docsRes.json();
        expect(docs.length).toBe(2);

        for (const doc of docs) {
            // doc.path is like /docs/TST/timestamp-sample_schematic.pdf
            const directUrl = `http://localhost:5002/api${doc.path}`;
            const fileRes = await fetch(directUrl);
            expect(fileRes.status).toBe(200);

            // Test fallback: requesting by clean filename /api/docs/sample_schematic.pdf should also resolve
            const fallbackUrl = `http://localhost:5002/api/docs/${doc.filename}`;
            const fallbackRes = await fetch(fallbackUrl);
            expect(fallbackRes.status).toBe(200);
        }
    });

    afterAll(async () => {
        if (projectId) {
            await fetch(`${API_URL}/projects/${projectId}`, {
                method: 'DELETE',
                headers: { 'X-User-Username': 'test_admin' }
            });
        }
    });
});
