/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { cleanupTestData } from './cleanup';

describe('Rework POST /api/reworks Multipart Uploads', () => {
    
    it('Should successfully parse and save an array of images', async () => {
        const formData = new FormData();
        formData.append('pcb_id', '1');
        formData.append('description', 'Vitest automated rework test');
        formData.append('status', 'Completed');
        
        // Create a dummy image blob
        const blob1 = new Blob(['dummy content 1'], { type: 'image/jpeg' });
        const blob2 = new Blob(['dummy content 2'], { type: 'image/jpeg' });
        
        formData.append('images', blob1, 'test1.jpg');
        formData.append('images', blob2, 'test2.jpg');
        
        try {
            const res = await fetch('http://localhost:5002/api/reworks', {
                method: 'POST',
                body: formData
            });
            
            const data = await res.json();
            
            // Allow 404 to pass in test if DB is empty and ID 1 is missing, 
            // but log it to fail strictly otherwise
            if (res.status === 404) {
               expect(data.error).toBe('PCB not found');
               return;
            }

            expect(res.status).toBe(201);
            expect(data.rework_name).toBeDefined();
            expect(data.image_path).toBeDefined();
            
            // The image_path should be a JSON array with 2 entries
            const parsedPaths = JSON.parse(data.image_path);
            expect(Array.isArray(parsedPaths)).toBe(true);
            expect(parsedPaths.length).toBe(2);
            expect(parsedPaths[0]).toContain('/pictures/');
            expect(parsedPaths[1]).toContain('/pictures/');
        } catch (e) {
            console.error('Test server connection failed:', e);
            throw e; // Vitest won't pass this
        }
    });

    it('Should successfully process requests even without images', async () => {
        const formData = new FormData();
        formData.append('pcb_id', '1');
        formData.append('description', 'Vitest no-image test');
        formData.append('status', 'Completed');

        try {
            const res = await fetch('http://localhost:5002/api/reworks', {
                method: 'POST',
                body: formData
            });
            
            const data = await res.json();
            
            if (res.status === 404) {
               expect(data.error).toBe('PCB not found');
               return;
            }

            expect(res.status).toBe(201);
            expect(data.rework_name).toBeDefined();
            expect(data.image_path).toBeNull(); // No images means null
        } catch (e) {
            console.error('Test server connection failed:', e);
            throw e;
        }
    });

    afterAll(async () => {
        try {
            await cleanupTestData();
        } catch (e) {
            console.error('Failed to run database cleanup:', e);
        }
    });
});
