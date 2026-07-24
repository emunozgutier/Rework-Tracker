import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Request, Response, NextFunction } from 'express';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logDir = path.join(__dirname, 'logs');

// Ensure log directory exists
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
}

interface UserAgentInfo {
    browser: string;
    os: string;
}

// Basic User-Agent parser (very lightweight)
const parseUserAgent = (ua: string | undefined): UserAgentInfo => {
    if (!ua) return { browser: 'Unknown', os: 'Unknown' };
    
    let browser = 'Unknown';
    if (ua.includes('Firefox/')) browser = 'Firefox';
    else if (ua.includes('Edg/')) browser = 'Edge';
    else if (ua.includes('Chrome/')) browser = 'Chrome';
    else if (ua.includes('Safari/')) browser = 'Safari';
    
    let os = 'Unknown';
    if (ua.includes('Windows NT 10.0')) os = 'Windows 10/11';
    else if (ua.includes('Windows')) os = 'Windows';
    else if (ua.includes('Mac OS X')) os = 'macOS';
    else if (ua.includes('Linux')) os = 'Linux';
    else if (ua.includes('Android')) os = 'Android';
    else if (ua.includes('iOS') || ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
    
    return { browser, os };
};

// 48-hour rotation cleanup
export const cleanupOldLogs = (): void => {
    try {
        const files = fs.readdirSync(logDir);
        const now = Date.now();
        const MAX_AGE_MS = 48 * 60 * 60 * 1000; // 48 hours
        
        let deletedCount = 0;
        files.forEach(file => {
            if (file.startsWith('access-') && file.endsWith('.log')) {
                const filePath = path.join(logDir, file);
                const stats = fs.statSync(filePath);
                if (now - stats.mtimeMs > MAX_AGE_MS) {
                    fs.unlinkSync(filePath);
                    deletedCount++;
                }
            }
        });
        if (deletedCount > 0) {
            console.log(`[Logger] Deleted ${deletedCount} log files older than 48 hours.`);
        }
    } catch (err) {
        console.error('[Logger] Error cleaning up old logs:', err);
    }
};

// Start the cleanup interval (every 1 hour)
setInterval(cleanupOldLogs, 60 * 60 * 1000);

export const apiLoggerMiddleware = (req: Request, res: Response, next: NextFunction): void => {
    // Only log API data requests (ignore static picture fetches)
    if (!req.path.startsWith('/api') || req.path.startsWith('/api/pictures')) {
        return next();
    }

    const startTime = Date.now();
    const { browser, os } = parseUserAgent(req.get('User-Agent'));
    
    // Intercept response
    const originalJson = res.json;
    const originalSend = res.send;
    let responseBody: any = null;

    res.json = function (body: any) {
        responseBody = body;
        return originalJson.call(this, body);
    };

    res.send = function (body: any) {
        if (!responseBody) responseBody = body; // capture if json wasn't called
        return originalSend.call(this, body);
    };

    res.on('finish', () => {
        const duration = Date.now() - startTime;
        const now = new Date();
        const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
        const logFile = path.join(logDir, `access-${dateStr}.log`);
        
        const logEntry = {
            timestamp: now.toISOString(),
            ip: req.headers['x-forwarded-for'] || req.socket.remoteAddress,
            method: req.method,
            url: req.originalUrl,
            os,
            browser,
            statusCode: res.statusCode,
            durationMs: duration,
            requestBody: req.method !== 'GET' ? req.body : undefined,
            responseBody: responseBody,
            error: res.statusCode >= 400 ? responseBody : undefined
        };

        try {
            fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n');
        } catch (err) {
            console.error('[Logger] Failed to write to log file:', err);
        }
    });

    next();
};
