import express, { type Request, type Response } from 'express';
import crypto from 'crypto';
import { db } from '../store/database/db.js';
import { sendOtpEmail, getResendApiKey, saveResendApiKey, deleteResendApiKey } from './email.js';

export const loginRouter = express.Router();

// Helper: Generate a unique username from email
function generateUniqueUsername(email: string, attempt = 0): Promise<string> {
    return new Promise((resolve, reject) => {
        const prefix = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        let baseUsername = prefix.substring(0, 6);
        if (attempt > 0) {
            baseUsername = baseUsername.substring(0, 4) + attempt;
        }
        
        db.get("SELECT COUNT(*) as count FROM owners WHERE username = ?", [baseUsername], (err: any, row: any) => {
            if (err) return reject(err);
            if (row && row.count > 0) {
                // Username collision, try another
                resolve(generateUniqueUsername(email, attempt + 1));
            } else {
                resolve(baseUsername);
            }
        });
    });
}

// Helper: Generate a clean human-readable name from email
function cleanNameFromEmail(email: string): string {
    const prefix = email.split('@')[0];
    // Split by dot, hyphen, underscore
    const parts = prefix.split(/[._-]/);
    const capitalizedParts = parts.map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase());
    return capitalizedParts.join(' ');
}

// 1. Request OTP Code
loginRouter.post('/request-otp', (req: Request, res: Response) => {
    const { email } = req.body;
    if (!email || !email.includes('@')) {
        return res.status(400).json({ error: "A valid email address is required." });
    }

    const cleanEmail = email.trim().toLowerCase();
    
    // Generate a random 6-digit OTP passcode
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Valid for 15 minutes
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    db.run(
        "INSERT OR REPLACE INTO login_otps (email, otp, expires_at) VALUES (?, ?, ?)",
        [cleanEmail, otp, expiresAt],
        async function(err: any) {
            if (err) {
                console.error("[Auth API] Failed to store OTP:", err.message);
                return res.status(500).json({ error: "Failed to generate passcode. Try again." });
            }

            try {
                await sendOtpEmail(cleanEmail, otp);
                res.json({ message: "Passcode successfully dispatched to email." });
            } catch (emailErr: any) {
                console.error("[Auth API] Email sending warning:", emailErr.message);
                res.status(400).json({ error: emailErr.message || "Failed to dispatch email." });
            }
        }
    );
});

// 2. Verify OTP Code & Establish Session (1 Week)
loginRouter.post('/verify-otp', (req: Request, res: Response) => {
    const { email, otp } = req.body;
    if (!email || !otp) {
        return res.status(400).json({ error: "Email and verification passcode are required." });
    }

    const cleanEmail = email.trim().toLowerCase();
    
    db.get(
        "SELECT * FROM login_otps WHERE email = ?",
        [cleanEmail],
        (err: any, row: any) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            if (!row) {
                return res.status(400).json({ error: "No login request found for this email address." });
            }
            
            // Validate expiration (ISO comparison)
            if (new Date(row.expires_at).getTime() < Date.now()) {
                db.run("DELETE FROM login_otps WHERE email = ?", [cleanEmail]);
                return res.status(400).json({ error: "Your passcode has expired. Please request a new one." });
            }

            // Validate code matches
            if (row.otp !== otp.trim()) {
                return res.status(400).json({ error: "Invalid passcode. Please check and try again." });
            }

            // OTP verified! Delete code to prevent reuse
            db.run("DELETE FROM login_otps WHERE email = ?", [cleanEmail]);

            // Check if Owner profile exists for this email
            db.get("SELECT * FROM owners WHERE email = ?", [cleanEmail], async (errOwner: any, ownerRow: any) => {
                if (errOwner) return res.status(500).json({ error: errOwner.message });

                let activeOwner = ownerRow;

                // Auto-create owner if not registered
                if (!activeOwner) {
                    try {
                        const generatedUsername = await generateUniqueUsername(cleanEmail);
                        const generatedName = cleanNameFromEmail(cleanEmail);
                        
                        // Check if first user in database to assign superuser
                        const countRow: any = await new Promise((resCount, rejCount) => {
                            db.get("SELECT COUNT(*) as count FROM owners", [], (e: any, r: any) => e ? rejCount(e) : resCount(r));
                        });
                        
                        const isFirst = !countRow || countRow.count === 0;
                        const superuserVal = isFirst ? 1 : 0;

                        activeOwner = await new Promise((resInsert, rejInsert) => {
                            db.run(
                                "INSERT INTO owners (name, username, email, superuser) VALUES (?, ?, ?, ?)",
                                [generatedName, generatedUsername, cleanEmail, superuserVal],
                                function(this: any, insertErr: any) {
                                    if (insertErr) return rejInsert(insertErr);
                                    resInsert({
                                        id: this.lastID,
                                        name: generatedName,
                                        username: generatedUsername,
                                        email: cleanEmail,
                                        superuser: superuserVal
                                    });
                                }
                            );
                        });
                        console.log(`[Auth API] Automatically registered owner profile for new email: ${cleanEmail}`);
                    } catch (createErr: any) {
                        console.error("[Auth API] Failed to auto-create owner profile:", createErr.message);
                        return res.status(500).json({ error: "Failed to establish user profile." });
                    }
                }

                // Create user session valid for 1 week
                const token = crypto.randomUUID();
                const sessionExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 1 week

                db.run(
                    "INSERT INTO user_sessions (token, email, expires_at) VALUES (?, ?, ?)",
                    [token, cleanEmail, sessionExpires],
                    (sessionErr: any) => {
                        if (sessionErr) {
                            return res.status(500).json({ error: "Failed to create user session." });
                        }
                        
                        res.json({
                            token,
                            email: cleanEmail,
                            expiresAt: sessionExpires,
                            owner: activeOwner
                        });
                    }
                );
            });
        }
    );
});

// 3. Verify Active Session Token
loginRouter.post('/verify-session', (req: Request, res: Response) => {
    const { token } = req.body;
    if (!token) {
        return res.status(401).json({ valid: false, error: "No token provided." });
    }

    db.get(
        "SELECT * FROM user_sessions WHERE token = ?",
        [token],
        (err: any, sessionRow: any) => {
            if (err || !sessionRow) {
                return res.json({ valid: false });
            }

            // Check session expiration
            if (new Date(sessionRow.expires_at).getTime() < Date.now()) {
                db.run("DELETE FROM user_sessions WHERE token = ?", [token]);
                return res.json({ valid: false });
            }

            // Fetch active owner profile associated with session email
            db.get(
                "SELECT * FROM owners WHERE email = ?",
                [sessionRow.email],
                (errOwner: any, ownerRow: any) => {
                    if (errOwner || !ownerRow) {
                        return res.json({ valid: false });
                    }

                    res.json({
                        valid: true,
                        email: sessionRow.email,
                        owner: ownerRow
                    });
                }
            );
        }
    );
});

// 4. Logout Session
loginRouter.post('/logout', (req: Request, res: Response) => {
    const { token } = req.body;
    if (token) {
        db.run("DELETE FROM user_sessions WHERE token = ?", [token]);
    }
    res.json({ message: "Successfully logged out." });
});

// 5. Resend API Configuration Management
loginRouter.get('/resend-config', (_req: Request, res: Response) => {
    const key = getResendApiKey();
    if (!key) {
        return res.json({ configured: false, maskedKey: null });
    }
    const maskedKey = key.length > 8 ? `${key.substring(0, 5)}...${key.substring(key.length - 4)}` : 're_****';
    res.json({ configured: true, maskedKey });
});

loginRouter.post('/resend-config', (req: Request, res: Response) => {
    const { apiKey } = req.body;
    if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim().startsWith('re_')) {
        return res.status(400).json({ error: "Invalid Resend API Key format. Key must start with 're_'." });
    }
    try {
        saveResendApiKey(apiKey.trim());
        res.json({ success: true, message: "Resend API key securely saved in private/resend_key.json" });
    } catch (err: any) {
        res.status(500).json({ error: err.message || "Failed to save API key" });
    }
});

loginRouter.delete('/resend-config', (_req: Request, res: Response) => {
    try {
        deleteResendApiKey();
        res.json({ success: true, message: "Resend API key removed." });
    } catch (err: any) {
        res.status(500).json({ error: err.message || "Failed to delete API key" });
    }
});
