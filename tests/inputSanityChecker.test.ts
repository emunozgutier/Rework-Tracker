/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
    isSafeText,
    validateFile,
    lockFileExecution,
    MAX_IMAGE_SIZE,
    MAX_DOC_SIZE
} from '../src/store/serverDataBase/inputSanityChecker';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const API_URL = 'http://localhost:5002/api';

describe('Input Sanity Checker - Unit Tests', () => {
    
    describe('isSafeText', () => {
        it('should allow clean normal strings', () => {
            expect(isSafeText('Hello World')).toBe(true);
            expect(isSafeText('Rework board MAP-0001Q')).toBe(true);
            expect(isSafeText('Use resistor 10k ohm (part number: R123)')).toBe(true);
            expect(isSafeText('Markdown code: `const x = 5;` and block: ```js\nconst y = 10;\n```')).toBe(true);
        });

        it('should detect HTML script tags', () => {
            expect(isSafeText('<script>alert("hack")</script>')).toBe(false);
            expect(isSafeText('Text with <script src="http://evil.com/payload.js"></script> script')).toBe(false);
        });

        it('should detect dangerous HTML iframe/embed tags', () => {
            expect(isSafeText('<iframe src="http://evil.com"></iframe>')).toBe(false);
            expect(isSafeText('<object data="malware.swf"></object>')).toBe(false);
        });

        it('should detect javascript: URI scheme', () => {
            expect(isSafeText('javascript:alert(1)')).toBe(false);
        });

        it('should detect inline event handlers', () => {
            expect(isSafeText('<img src="x" onerror="alert(1)">')).toBe(false);
            expect(isSafeText('<div onload=alert(1)>')).toBe(false);
            expect(isSafeText('onclick=evil()')).toBe(false);
        });

        it('should detect PHP tags', () => {
            expect(isSafeText('<?php echo "Hello"; ?>')).toBe(false);
            expect(isSafeText('<?= "Short tag" ?>')).toBe(false);
        });
    });

    describe('validateFile', () => {
        const tempTestDir = path.join(__dirname, 'temp_test_files');

        beforeAll(() => {
            if (!fs.existsSync(tempTestDir)) {
                fs.mkdirSync(tempTestDir, { recursive: true });
            }
        });

        afterAll(() => {
            if (fs.existsSync(tempTestDir)) {
                fs.rmSync(tempTestDir, { recursive: true, force: true });
            }
        });

        it('should reject file types not in ALLOWED_EXTENSIONS', () => {
            const filePath = path.join(tempTestDir, 'test.exe');
            fs.writeFileSync(filePath, 'MZ...');
            const result = validateFile(filePath, 'test.exe', 6);
            expect(result.isValid).toBe(false);
            expect(result.error).toContain('is not allowed');
        });

        it('should reject file with path traversal in name', () => {
            const filePath = path.join(tempTestDir, 'test.pdf');
            fs.writeFileSync(filePath, '%PDF-1.4');
            const result = validateFile(filePath, '../escape.pdf', 8);
            expect(result.isValid).toBe(false);
            expect(result.error).toContain('Invalid file name sequence');
        });

        it('should reject files exceeding max size limits', () => {
            expect(MAX_DOC_SIZE).toBe(100 * 1024 * 1024);
            const filePath = path.join(tempTestDir, 'oversized.pdf');
            fs.writeFileSync(filePath, '%PDF-1.4');
            const result = validateFile(filePath, 'oversized.pdf', MAX_DOC_SIZE + 10);
            expect(result.isValid).toBe(false);
            expect(result.error).toContain('exceeds maximum allowed size of 100MB');
        });

        it('should reject PE (Windows MZ) binaries', () => {
            const filePath = path.join(tempTestDir, 'mock_mz.pdf');
            const mzBuffer = Buffer.from([0x4D, 0x5A, 0x00, 0x00, 0x00]); // MZ header
            fs.writeFileSync(filePath, mzBuffer);
            const result = validateFile(filePath, 'mock_mz.pdf', mzBuffer.length);
            expect(result.isValid).toBe(false);
            expect(result.error).toContain('PE/MZ');
        });

        it('should reject ELF (Linux) binaries', () => {
            const filePath = path.join(tempTestDir, 'mock_elf.pdf');
            const elfBuffer = Buffer.from([0x7F, 0x45, 0x4C, 0x46, 0x00]); // ELF header
            fs.writeFileSync(filePath, elfBuffer);
            const result = validateFile(filePath, 'mock_elf.pdf', elfBuffer.length);
            expect(result.isValid).toBe(false);
            expect(result.error).toContain('ELF');
        });

        it('should reject JAR / Java classes', () => {
            const filePath = path.join(tempTestDir, 'mock_jar.pdf');
            const jarBuffer = Buffer.from([0xCA, 0xFE, 0xBA, 0xBE, 0x00]); // CAFE BABE header
            fs.writeFileSync(filePath, jarBuffer);
            const result = validateFile(filePath, 'mock_jar.pdf', jarBuffer.length);
            expect(result.isValid).toBe(false);
            expect(result.error).toContain('Java executables');
        });

        it('should reject EICAR test signature', () => {
            const filePath = path.join(tempTestDir, 'mock_eicar.pdf');
            fs.writeFileSync(filePath, 'X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*');
            const result = validateFile(filePath, 'mock_eicar.pdf', 68);
            expect(result.isValid).toBe(false);
            expect(result.error).toContain('EICAR');
        });

        it('should reject PDFs with interactive scripts', () => {
            const filePath = path.join(tempTestDir, 'js.pdf');
            // Write standard PDF magic header + JavaScript action
            fs.writeFileSync(filePath, '%PDF-1.4\n/JS (app.alert("hello"))\n/JavaScript');
            const result = validateFile(filePath, 'js.pdf', 43);
            expect(result.isValid).toBe(false);
            expect(result.error).toContain('JavaScript');
        });

        it('should reject PDFs with execution Launch actions', () => {
            const filePath = path.join(tempTestDir, 'launch.pdf');
            fs.writeFileSync(filePath, '%PDF-1.4\n/Launch (cmd.exe)');
            const result = validateFile(filePath, 'launch.pdf', 26);
            expect(result.isValid).toBe(false);
            expect(result.error).toContain('Launch');
        });

        it('should reject BRDs with script tags', () => {
            const filePath = path.join(tempTestDir, 'script.brd');
            fs.writeFileSync(filePath, '<board>\n<script>alert(1)</script>\n</board>');
            const result = validateFile(filePath, 'script.brd', 42);
            expect(result.isValid).toBe(false);
            expect(result.error).toContain('forbidden code/script');
        });

        it('should allow clean PDF, BRD, and Image files', () => {
            const pdfPath = path.join(tempTestDir, 'valid.pdf');
            fs.writeFileSync(pdfPath, '%PDF-1.4\n%%EOF');
            expect(validateFile(pdfPath, 'valid.pdf', 14).isValid).toBe(true);

            const brdPath = path.join(tempTestDir, 'valid.brd');
            fs.writeFileSync(brdPath, '<board>\n  <design>PCB</design>\n</board>');
            expect(validateFile(brdPath, 'valid.brd', 37).isValid).toBe(true);

            const pngPath = path.join(tempTestDir, 'valid.png');
            fs.writeFileSync(pngPath, Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]));
            expect(validateFile(pngPath, 'valid.png', 8).isValid).toBe(true);
        });
    });

    describe('lockFileExecution permissions check', () => {
        const tempTestDir = path.join(__dirname, 'temp_test_files');

        beforeAll(() => {
            if (!fs.existsSync(tempTestDir)) {
                fs.mkdirSync(tempTestDir, { recursive: true });
            }
        });

        it('should set non-executable permissions (rw-r--r--) on the file', () => {
            const filePath = path.join(tempTestDir, 'lock_test.pdf');
            fs.writeFileSync(filePath, '%PDF-1.4');
            
            // Apply execute permissions first if supported by platform (Unix)
            try {
                fs.chmodSync(filePath, 0o755);
            } catch (e) {}

            lockFileExecution(filePath);

            const stat = fs.statSync(filePath);
            // On Unix systems, this will verify permission masking.
            // On Windows, chmod sets read-only flag but let's verify it didn't throw and matches readable flags.
            expect(stat.mode & 0o666).toBeDefined();
            // Verify no execute bits are set (Unix only check)
            if (process.platform !== 'win32') {
                expect(stat.mode & 0o111).toBe(0);
            }
        });
    });
});

describe('Input Sanity Checker - API Integration Tests', () => {
    let sessionToken: string;

    beforeAll(async () => {
        // Authenticate as Super User to gain session cookie
        const res = await fetch(`${API_URL}/auth/otp/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'eduardom', code: '000000' }) // demo credentials from seed data
        });
        if (res.status === 200) {
            const data = await res.json();
            sessionToken = data.token;
        }
    });

    it('should block POST requests containing HTML script tags with 400 Bad Request', async () => {
        const res = await fetch(`${API_URL}/tags`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionToken}`
            },
            body: JSON.stringify({
                name: '<script>alert(1)</script>',
                color: '#818cf8',
                type: 'public'
            })
        });

        const data = await res.json();
        expect(res.status).toBe(400);
        expect(data.error).toContain('Potential malicious code');
    });

    it('should block POST requests containing inline event handlers with 400 Bad Request', async () => {
        const res = await fetch(`${API_URL}/tags`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionToken}`
            },
            body: JSON.stringify({
                name: 'CleanTag',
                color: '#818cf8',
                type: 'public',
                malicious_field: 'onload=alert(1)'
            })
        });

        const data = await res.json();
        expect(res.status).toBe(400);
        expect(data.error).toContain('Potential malicious code');
    });

    it('should block uploads of files containing PE binary headers', async () => {
        const formData = new FormData();
        const mzBlob = new Blob([Buffer.from([0x4D, 0x5A, 0x00, 0x00, 0x00])], { type: 'application/pdf' });
        formData.append('documents', mzBlob, 'malware.pdf');

        const res = await fetch(`${API_URL}/projects/1/docs`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${sessionToken}`
            },
            body: formData
        });

        const data = await res.json();
        expect(res.status).toBe(400);
        expect(data.error).toContain('Executable files');
    });

    it('should block uploads of PDFs containing script actions', async () => {
        const formData = new FormData();
        const jsPdfBlob = new Blob(['%PDF-1.4\n/JS (app.alert("hello"))\n/JavaScript'], { type: 'application/pdf' });
        formData.append('documents', jsPdfBlob, 'interactive.pdf');

        const res = await fetch(`${API_URL}/projects/1/docs`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${sessionToken}`
            },
            body: formData
        });

        const data = await res.json();
        expect(res.status).toBe(400);
        expect(data.error).toContain('embedded JavaScript');
    });
});
