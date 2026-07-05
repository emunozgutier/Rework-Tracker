/**
 * @vitest-environment node
 */
import { describe, it, expect, afterAll } from 'vitest';
import { cleanupTestData, updateCreatedAt } from './cleanup';

const API_URL = 'http://localhost:5002/api';

describe('Reworks API - Silicon Swap', () => {
    let projectId;
    let pcbId;

    it('should create a project and pcb', async () => {
        // Create project
        const resProj = await fetch(`${API_URL}/projects`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Test Project For Rework',
                description: 'Test',
                revisions: 'A0, B0',
                project_key: 'TPR',
                number_format: 'decimal',
                flavors: [{ name: 'Flavor1', revisions: 'A0, B0' }]
            })
        });
        const projData = await resProj.json();
        projectId = projData.id;

        // Create PCB
        const resPcb = await fetch(`${API_URL}/pcbs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                project_id: projectId,
                board_number: '1',
                board_flavor: 'Flavor1',
                silicon_rev: 'A0'
            })
        });
        const pcbData = await resPcb.json();
        pcbId = pcbData.id;
    });

    it('should add a Silicon Swap rework', async () => {
        const formData = new FormData();
        formData.append('pcb_id', pcbId);
        formData.append('title', 'Silicon Swap to B0');
        formData.append('description', 'Swapping silicon');
        formData.append('rework_type', 'Silicon Swap');
        formData.append('new_product', 'Flavor1 B0');
        formData.append('new_silicon_rev', 'B0');
        formData.append('new_silicon_corner', '');

        const res = await fetch(`${API_URL}/reworks`, {
            method: 'POST',
            body: formData
        });
        
        const text = await res.text();
        console.log("Response:", res.status, text);
        expect(res.status).toBe(201);
    });

    it('should check if PCB was updated', async () => {
        const res = await fetch(`${API_URL}/pcbs`);
        const pcbs = await res.json();
        const pcb = pcbs.find((p: any) => p.id === pcbId);
        expect(pcb.product).toBe('Flavor1 B0');
    });

    it('should block deleting PCB if it has rework logs', async () => {
        const deleteRes = await fetch(`${API_URL}/pcbs/${pcbId}`, { method: 'DELETE' });
        expect(deleteRes.status).toBe(400);
        const data = await deleteRes.json();
        expect(data.error).toContain('rework logs');
    });

    it('should block deleting PCB if created more than 3 days ago', async () => {
        // Create a new PCB without any rework logs
        const resPcb = await fetch(`${API_URL}/pcbs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                project_id: projectId,
                board_number: '9999',
                board_flavor: 'Flavor1',
                silicon_rev: 'A0'
            })
        });
        expect(resPcb.status).toBe(201);
        const pcbData = await resPcb.json();
        const tempPcbId = pcbData.id;

        // Update its created_at to 4 days ago
        await updateCreatedAt(tempPcbId, 4);

        // Verify delete request now fails with 400
        const deleteRes = await fetch(`${API_URL}/pcbs/${tempPcbId}`, { method: 'DELETE' });
        expect(deleteRes.status).toBe(400);
        const data = await deleteRes.json();
        expect(data.error).toContain('3 days');
    });

    afterAll(async () => {
        try {
            await cleanupTestData();
        } catch (e) {
            console.error('Failed to run database cleanup:', e);
        }
    });
});
