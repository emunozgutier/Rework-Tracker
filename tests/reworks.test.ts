/**
 * @vitest-environment node
 */
import { describe, it, expect, afterAll } from 'vitest';
import { cleanupTestData, updateCreatedAt, updateReworkTimestamp } from './cleanup';

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

    it('should verify rework deletion constraints', async () => {
        // 1. Create a fresh PCB
        const resPcb = await fetch(`${API_URL}/pcbs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                project_id: projectId,
                board_number: '5555_test_del',
                board_flavor: 'Flavor1',
                silicon_rev: 'A0'
            })
        });
        const pcbData = await resPcb.json();
        const testPcbId = pcbData.id;

        // 2. Add first rework log
        const fd1 = new FormData();
        fd1.append('pcb_id', testPcbId);
        fd1.append('title', 'Rework 1');
        fd1.append('description', 'First rework log');
        fd1.append('rework_type', 'Minor');
        const resRw1 = await fetch(`${API_URL}/reworks`, { method: 'POST', body: fd1 });
        const rw1Data = await resRw1.json();
        const rw1Id = rw1Data.id;

        // 3. Add second rework log (now rw1 is NOT the latest)
        const fd2 = new FormData();
        fd2.append('pcb_id', testPcbId);
        fd2.append('title', 'Rework 2');
        fd2.append('description', 'Second rework log');
        fd2.append('rework_type', 'Minor');
        const resRw2 = await fetch(`${API_URL}/reworks`, { method: 'POST', body: fd2 });
        const rw2Data = await resRw2.json();
        const rw2Id = rw2Data.id;

        // 4. Try to delete the first rework (rw1). Should fail because rw2 is after it.
        const delRw1Res = await fetch(`${API_URL}/reworks/${rw1Id}`, { method: 'DELETE' });
        expect(delRw1Res.status).toBe(400);
        const delRw1Data = await delRw1Res.json();
        expect(delRw1Data.error).toContain('newer rework logs');

        // 5. Update rw2 timestamp to 4 days ago
        await updateReworkTimestamp(rw2Id, 4);

        // 6. Try to delete the second rework (rw2). Should fail because it is older than 3 days.
        const delRw2OldRes = await fetch(`${API_URL}/reworks/${rw2Id}`, { method: 'DELETE' });
        expect(delRw2OldRes.status).toBe(400);
        const delRw2OldData = await delRw2OldRes.json();
        expect(delRw2OldData.error).toContain('3 days');

        // 7. Reset timestamp of rw2 to now (0 days ago) so it is deletable
        await updateReworkTimestamp(rw2Id, 0);

        // 8. Try to delete rw2 again. Should succeed.
        const delRw2OkRes = await fetch(`${API_URL}/reworks/${rw2Id}`, { method: 'DELETE' });
        expect(delRw2OkRes.status).toBe(200);

        // 9. Now rw1 is the latest again! Let's delete rw1. Should succeed.
        const delRw1OkRes = await fetch(`${API_URL}/reworks/${rw1Id}`, { method: 'DELETE' });
        expect(delRw1OkRes.status).toBe(200);
    });

    it('should verify rework edit constraints', async () => {
        // 1. Create a fresh PCB
        const resPcb = await fetch(`${API_URL}/pcbs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                project_id: projectId,
                board_number: '7777_test_edit',
                board_flavor: 'Flavor1',
                silicon_rev: 'A0'
            })
        });
        const pcbData = await resPcb.json();
        const testPcbId = pcbData.id;

        // 2. Add a rework log
        const fd = new FormData();
        fd.append('pcb_id', testPcbId);
        fd.append('title', 'Original Title');
        fd.append('description', 'Original Description');
        fd.append('rework_type', 'Minor');
        const resRw = await fetch(`${API_URL}/reworks`, { method: 'POST', body: fd });
        const rwData = await resRw.json();
        const rwId = rwData.id;

        // 3. Edit should succeed normally
        const updateResOk = await fetch(`${API_URL}/reworks/${rwId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                pcb_id: testPcbId,
                title: 'Updated Title',
                description: 'Updated Description',
                rework_type: 'Minor'
            })
        });
        console.log("rwId is:", rwId);
        expect(updateResOk.status).toBe(200);

        // 4. Update its timestamp to 15 days ago (older than 2 weeks)
        await updateReworkTimestamp(rwId, 15);

        // 5. Try to edit it. Should fail with 400.
        const updateResFail = await fetch(`${API_URL}/reworks/${rwId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                pcb_id: testPcbId,
                title: 'Failed Update Title',
                description: 'Failed Update Description',
                rework_type: 'Minor'
            })
        });
        const data = await updateResFail.json();
        console.log("updateResFail status:", updateResFail.status, "data:", data);
        expect(updateResFail.status).toBe(400);
        expect(data.error).toContain('2 weeks');

        // 6. Clean up: reset timestamp and delete
        await updateReworkTimestamp(rwId, 0);
        const delRes = await fetch(`${API_URL}/reworks/${rwId}`, { method: 'DELETE' });
        expect(delRes.status).toBe(200);
    });

    afterAll(async () => {
        try {
            await cleanupTestData();
        } catch (e) {
            console.error('Failed to run database cleanup:', e);
        }
    });
});
