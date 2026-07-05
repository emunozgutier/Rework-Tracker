import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { useProjectStore } from '../src/store/storeProject';
import { usePcbStore } from '../src/store/storePcb';
import { useOwnerStore } from '../src/store/storeOwner';
import { useTagStore } from '../src/store/storeTag';
import { useReworkStore } from '../src/store/storeRework';

describe('Store and Database Integration Tests', () => {
    let projectId: number;
    let projectId2: number;
    let pcbId: number;
    let ownerId: number;
    let tagId: number;

    const testProjectName = 'VitestUniqueProject123';
    const testPcbName = 'VITEST-PCB-001';
    const testOwnerName = 'Vitest Owner';
    const testTagName = 'VITEST-TAG';

    it('should add a project', async () => {
        const store = useProjectStore.getState();
        const success = await store.addProject({
            name: testProjectName,
            description: 'A test project',
            revisions: 'A1',
            project_key: 'VTT'
        });
        expect(success).toBe(true);
        const updatedStore = useProjectStore.getState();
        expect(updatedStore.error).toBeNull();
        
        const added = updatedStore.projects.find(p => p.name.toLowerCase() === testProjectName.toLowerCase());
        expect(added).toBeDefined();
        if (added) projectId = added.id;
    });

    it('should fail to add a project with the same name (case-insensitive)', async () => {
        const store = useProjectStore.getState();
        const success = await store.addProject({
            name: testProjectName.toLowerCase(),
            description: 'Duplicate',
            revisions: 'A1',
            project_key: 'VVV'
        });
        expect(success).toBe(false);
        const updatedStore = useProjectStore.getState();
        expect(String(updatedStore.error)).toMatch(/already exists|UNIQUE constraint failed/i);
    });

    it('should add an owner (user)', async () => {
        const store = useOwnerStore.getState();
        const success = await store.addOwner({ name: testOwnerName });
        expect(success).toBe(true);
        
        const updatedStore = useOwnerStore.getState();
        const added = updatedStore.owners.find(o => o.name === testOwnerName);
        expect(added).toBeDefined();
        if (added) ownerId = added.id;
    });

    it('should fail to add an owner with the same name (case-insensitive)', async () => {
        const store = useOwnerStore.getState();
        const success = await store.addOwner({ name: testOwnerName.toLowerCase() });
        expect(success).toBe(false);
    });

    it('should add a PCB', async () => {
        const store = usePcbStore.getState();
        const success = await store.addPcb({
            board_number: testPcbName,
            status: 'In Progress',
            product_name_and_rev: 'RevA',
            project_id: projectId,
            owner_id: ownerId
        });
        expect(success).toBe(true);
        
        const updatedStore = usePcbStore.getState();
        const added = updatedStore.pcbs.find(p => p.board_number === testPcbName);
        expect(added).toBeDefined();
        if (added) pcbId = added.id;
    });

    it('should fail to add a PCB with the same board_number in the SAME project (case-insensitive)', async () => {
        const store = usePcbStore.getState();
        const success = await store.addPcb({
            board_number: testPcbName.toLowerCase(),
            status: 'Done',
            product_name_and_rev: 'RevB',
            project_id: projectId,
            owner_id: ownerId
        });
        expect(success).toBe(false);
    });

    it('should add a PCB with the same board_number to a DIFFERENT project', async () => {
        const storeProject = useProjectStore.getState();
        await storeProject.addProject({
            name: 'VitestProjectTwo',
            description: 'Second project',
            revisions: 'A1',
            project_key: 'VT2'
        });
        const p2 = useProjectStore.getState().projects.find(p => p.name.toLowerCase() === 'VitestProjectTwo'.toLowerCase());
        expect(p2).toBeDefined();
        if (p2) projectId2 = p2.id;

        const store = usePcbStore.getState();
        const success = await store.addPcb({
            board_number: testPcbName, // Same board number
            status: 'Done',
            product_name_and_rev: 'RevC',
            project_id: projectId2, // Different project
            owner_id: ownerId
        });
        expect(success).toBe(true);
    });

    it('should fail to delete a Project if it has PCBs (Foreign Key restriction)', async () => {
        const store = useProjectStore.getState();
        const success = await store.deleteProject(projectId);
        expect(success).toBe(false);
        const updatedStore = useProjectStore.getState();
        expect(String(updatedStore.error)).toMatch(/Failed to delete/i);
    });

    it('should add a tag', async () => {
        const store = useTagStore.getState();
        const success = await store.addTag({ name: testTagName, color: '#000' });
        expect(success).toBe(true);
        
        const updatedStore = useTagStore.getState();
        const added = updatedStore.tags.find(t => t.name === testTagName);
        expect(added).toBeDefined();
        if (added) tagId = added.id;
    });

    it('should fail to add a tag with the same name (case-insensitive)', async () => {
        const store = useTagStore.getState();
        const success = await store.addTag({ name: testTagName.toLowerCase(), color: '#fff' });
        expect(success).toBe(false);
    });

    it('should add a rework', async () => {
        const store = useReworkStore.getState();
        const success = await store.addRework({
            pcb_id: pcbId,
            description: 'Test rework action',
            owner_id: ownerId ? ownerId.toString() : '-1'
        });
        expect(success).toBe(true);
    });

    afterAll(async () => {
        // Centralized API cleanup
        try {
            await fetch('http://localhost:5002/api/test/cleanup', { method: 'POST' });
        } catch (e) {
            console.error('Failed to run test database cleanup:', e);
        }
    });
});
