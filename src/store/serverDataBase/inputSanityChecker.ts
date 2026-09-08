import fs from 'fs';
import path from 'path';
import type { Request, Response, NextFunction } from 'express';

// Define maximum size limits
export const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10 MB
export const MAX_DOC_SIZE = 100 * 1024 * 1024; // 100 MB

export const ALLOWED_EXTENSIONS = ['.pdf', '.brd', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.csv', '.xlsx', '.xls', '.txt'];

/**
 * Checks if a string contains potentially malicious scripts, event handlers, or HTML tags.
 */
export function isSafeText(text: string): boolean {
    // Check for script tags
    const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
    
    // Check for dangerous HTML elements
    const htmlTagRegex = /<\/?(?:iframe|object|embed|applet|meta|link|style)\b[^>]*>/gi;
    
    // Check for javascript: URI scheme
    const javascriptUriRegex = /javascript:/i;
    
    // Check for inline event handlers (e.g., onload=, onerror=)
    const inlineEventRegex = /\bon(?:abort|afterprint|beforeprint|beforeunload|blur|canplay|canplaythrough|change|click|contextmenu|copy|cut|dblclick|drag|dragend|dragenter|dragleave|dragover|dragstart|drop|durationchange|emptied|ended|error|focus|focusin|focusout|hashchange|input|invalid|keydown|keypress|keyup|load|loadeddata|loadedmetadata|loadstart|message|mousedown|mouseenter|mouseleave|mousemove|mouseout|mouseover|mouseup|mousewheel|offline|online|pagehide|pageshow|paste|pause|play|playing|popstate|progress|ratechange|resize|reset|scroll|search|seeked|seeking|select|show|stalled|submit|suspend|timeupdate|toggle|unload|volumechange|waiting|wheel)\s*=/i;
    
    // Check for PHP tags
    const phpTagRegex = /<\?php|<\?=/i;

    return !(
        scriptRegex.test(text) ||
        htmlTagRegex.test(text) ||
        javascriptUriRegex.test(text) ||
        phpTagRegex.test(text) ||
        inlineEventRegex.test(text)
    );
}

/**
 * Recursively scans any object or value to ensure all string fields are safe from code/script injection.
 */
export function validateInputRecursive(val: any): { isValid: boolean; error?: string } {
    if (typeof val === 'string') {
        if (!isSafeText(val)) {
            return { isValid: false, error: 'Potential malicious code or script detected in input text.' };
        }
    } else if (typeof val === 'object' && val !== null) {
        for (const key in val) {
            if (Object.prototype.hasOwnProperty.call(val, key)) {
                const res = validateInputRecursive(val[key]);
                if (!res.isValid) {
                    return res;
                }
            }
        }
    }
    return { isValid: true };
}

/**
 * Validates a file's metadata and contents for size limits and virus/executable patterns.
 */
export function validateFile(filePath: string, originalName: string, size: number): { isValid: boolean; error?: string } {
    const ext = path.extname(originalName).toLowerCase();
    
    // 1. Check extension
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
        return { isValid: false, error: `File type ${ext} is not allowed.` };
    }

    // 2. Check path traversal in filename
    if (originalName.includes('..') || originalName.includes('/') || originalName.includes('\\')) {
        return { isValid: false, error: 'Invalid file name sequence detected.' };
    }

    // 3. Check file size
    const isImage = ['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext);
    const maxSize = isImage ? MAX_IMAGE_SIZE : MAX_DOC_SIZE;
    if (size > maxSize) {
        return { isValid: false, error: `File exceeds maximum allowed size of ${maxSize / (1024 * 1024)}MB.` };
    }

    // Read file contents for signature/magic number inspection
    let buffer: Buffer;
    try {
        buffer = fs.readFileSync(filePath);
    } catch (err: any) {
        return { isValid: false, error: `Failed to read file for sanity check: ${err.message}` };
    }

    // Double check size of buffer
    if (buffer.length > maxSize) {
        return { isValid: false, error: `File buffer exceeds maximum allowed size.` };
    }

    // 4. Check for Executable Headers
    // PE/MZ: 4D 5A
    if (buffer.length >= 2 && buffer[0] === 0x4D && buffer[1] === 0x5A) {
        return { isValid: false, error: 'Executable files (PE/MZ) are not allowed.' };
    }
    // ELF: 7F 45 4C 46
    if (buffer.length >= 4 && buffer[0] === 0x7F && buffer[1] === 0x45 && buffer[2] === 0x4C && buffer[3] === 0x46) {
        return { isValid: false, error: 'Executable files (ELF) are not allowed.' };
    }
    // Java class/JAR: CA FE BA BE
    if (buffer.length >= 4 && buffer[0] === 0xCA && buffer[1] === 0xFE && buffer[2] === 0xBA && buffer[3] === 0xBE) {
        return { isValid: false, error: 'Java executables are not allowed.' };
    }

    // 5. Check for EICAR anti-virus test signature (checks the first 2KB for efficiency)
    const contentStrPrefix = buffer.toString('utf8', 0, Math.min(buffer.length, 2048));
    if (contentStrPrefix.includes('X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*')) {
        return { isValid: false, error: 'Malware test signature (EICAR) detected.' };
    }

    // 6. PDF-Specific Checks
    if (ext === '.pdf') {
        // PDF magic bytes: %PDF (25 50 44 46)
        if (buffer.length < 4 || buffer[0] !== 0x25 || buffer[1] !== 0x50 || buffer[2] !== 0x44 || buffer[3] !== 0x46) {
            return { isValid: false, error: 'Invalid PDF magic signature.' };
        }
        
        // Scan PDF binary content for embedded scripting or commands
        const fullContentStr = buffer.toString('binary');
        if (/\/JavaScript\b/i.test(fullContentStr) || /\/JS\b/i.test(fullContentStr)) {
            return { isValid: false, error: 'PDF files with embedded JavaScript are not allowed for security reasons.' };
        }
        if (/\/Launch\b/i.test(fullContentStr)) {
            return { isValid: false, error: 'PDF files with execution Launch commands are not allowed.' };
        }
        if (/\/EmbeddedFiles\b/i.test(fullContentStr) || /\/EmbeddedFile\b/i.test(fullContentStr)) {
            return { isValid: false, error: 'PDF files containing embedded attachments are not allowed.' };
        }
    }

    // 7. BRD-Specific Checks (Eagle/Allegro)
    if (ext === '.brd') {
        const fullContentStr = buffer.toString('utf8');
        // Prevent html script injection or PHP embedded logic
        if (/<script\b[^>]*>([\s\S]*?)<\/script>/gi.test(fullContentStr) || 
            /<\?php|<\?=/i.test(fullContentStr) ||
            /javascript:/i.test(fullContentStr) ||
            /eval\s*\(/i.test(fullContentStr)) {
            return { isValid: false, error: 'BRD board file contains forbidden code/script patterns.' };
        }
    }

    // 8. Image-Specific Checks
    if (isImage) {
        let isCorrectHeader = false;
        if (ext === '.png' && buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
            isCorrectHeader = true;
        } else if ((ext === '.jpg' || ext === '.jpeg') && buffer.length >= 3 && buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
            isCorrectHeader = true;
        } else if (ext === '.gif' && buffer.length >= 4 && buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) {
            isCorrectHeader = true;
        } else if (ext === '.webp' && buffer.length >= 12 && buffer.toString('utf8', 8, 12) === 'WEBP') {
            isCorrectHeader = true;
        }
        
        if (!isCorrectHeader) {
            return { isValid: false, error: `Invalid image signature for extension ${ext}.` };
        }

        // Quick check for embedded scripting tags in image file header/metadata (first 8KB)
        const partialStr = buffer.toString('utf8', 0, Math.min(buffer.length, 8192));
        if (/<script\b[^>]*>([\s\S]*?)<\/script>/gi.test(partialStr) || 
            /<\?php|<\?=/i.test(partialStr) ||
            /javascript:/i.test(partialStr)) {
            return { isValid: false, error: 'Image file contains executable script payloads.' };
        }
    }

    // 9. CSV and Text Checks (BOM / Notes)
    if (ext === '.csv' || ext === '.txt') {
        const textContent = buffer.toString('utf8');
        if (/<script\b[^>]*>([\s\S]*?)<\/script>/gi.test(textContent) ||
            /<\?php|<\?=/i.test(textContent) ||
            /javascript:/i.test(textContent)) {
            return { isValid: false, error: 'CSV/Text file contains forbidden script payloads.' };
        }
    }

    // 10. Excel Spreadsheet Checks (.xlsx, .xls)
    if (ext === '.xlsx') {
        // Zip container header: PK (50 4B)
        if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4B) {
            return { isValid: false, error: 'Invalid XLSX document header.' };
        }
    } else if (ext === '.xls') {
        // OLE Compound File header: D0 CF 11 E0
        if (buffer.length < 4 || buffer[0] !== 0xD0 || buffer[1] !== 0xCF) {
            return { isValid: false, error: 'Invalid XLS document header.' };
        }
    }

    return { isValid: true };
}

/**
 * Restricts file permissions to prevent execution.
 */
export function lockFileExecution(filePath: string): void {
    try {
        if (fs.existsSync(filePath)) {
            fs.chmodSync(filePath, 0o644); // read/write for owner, read-only for others, no execute permissions
        }
    } catch (err) {
        console.error(`Failed to set non-executable permissions (chmod 0644) for file: ${filePath}`, err);
    }
}

/**
 * Recursively locks all files in a directory.
 */
export function lockDirectoryFiles(dirPath: string): void {
    try {
        if (!fs.existsSync(dirPath)) return;
        const items = fs.readdirSync(dirPath);
        for (const item of items) {
            const fullPath = path.join(dirPath, item);
            const stat = fs.statSync(fullPath);
            if (stat.isDirectory()) {
                lockDirectoryFiles(fullPath);
            } else if (stat.isFile()) {
                lockFileExecution(fullPath);
            }
        }
    } catch (err) {
        console.error(`Failed to lock files in directory ${dirPath}:`, err);
    }
}

/**
 * Express middleware for global input sanitization.
 */
export function inputSanityCheckMiddleware(req: Request, res: Response, next: NextFunction): void {
    if (req.body) {
        const check = validateInputRecursive(req.body);
        if (!check.isValid) {
            res.status(400).json({ error: check.error });
            return;
        }
    }
    if (req.query) {
        const check = validateInputRecursive(req.query);
        if (!check.isValid) {
            res.status(400).json({ error: check.error });
            return;
        }
    }
    if (req.params) {
        const check = validateInputRecursive(req.params);
        if (!check.isValid) {
            res.status(400).json({ error: check.error });
            return;
        }
    }
    next();
}

/**
 * Express middleware for file sanity checking post-upload.
 */
export function fileSanityCheckMiddleware(req: Request, res: Response, next: NextFunction): void {
    const files = req.files as Express.Multer.File[] | undefined;
    if (!files || files.length === 0) {
        next();
        return;
    }

    for (const file of files) {
        const check = validateFile(file.path, file.originalname, file.size);
        if (!check.isValid) {
            // Delete all uploaded files in this request session to prevent orphaned temp files
            for (const f of files) {
                try {
                    if (fs.existsSync(f.path)) {
                        fs.unlinkSync(f.path);
                    }
                } catch (err) {
                    console.error(`Failed to delete temporary file ${f.path}:`, err);
                }
            }
            res.status(400).json({ error: check.error || 'Invalid file content detected.' });
            return;
        }
    }

    next();
}
