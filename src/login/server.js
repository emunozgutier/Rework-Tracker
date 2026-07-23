import express from 'express';
import crypto from 'crypto';
import { db } from '../store/database/db.js';
import { sendOtpEmail } from './email.js';

export const loginRouter = express.Router();

// Helper: Generate a unique username from email
function generateUniqueUsername(email, attempt = 0) {
    return new Promise((resolve, reject) => {
        const prefix = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        let baseUsername = prefix.substring(0, 6);
        if (attempt > 0) {
            baseUsername = baseUsername.substring(0, 4) + attempt;
        }
        
        db.get("SELECT COUNT(*) as count FROM owners WHERE username = ?", [baseUsername], (err, row) => {
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
function cleanNameFromEmail(email) {
    const prefix = email.split('@')[0];
    // Split by dot, hyphen, underscore
    const parts = prefix.split(/[._-]/);
    const capitalizedParts = parts.map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase());
    return capitalizedParts.join(' ');
}

// 1. Request OTP Code
loginRouter.post('/request-otp', (req, res) => {
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
        async function(err) {
            if (err) {
                console.error("[Auth API] Failed to store OTP:", err.message);
                return res.status(500).json({ error: "Failed to generate passcode. Try again." });
            }

            try {
                await sendOtpEmail(cleanEmail, otp);
                res.json({ message: "Passcode successfully dispatched to email." });
            } catch (emailErr) {
                console.error("[Auth API] Email sending warning:", emailErr.message);
                res.json({ message: "Passcode generated (please check console/file)." });
            }
        }
    );
});

// 2. Verify OTP Code & Establish Session (1 Week)
loginRouter.post('/verify-otp', (req, res) => {
    const { email, otp } = req.body;
    if (!email || !otp) {
        return res.status(400).json({ error: "Email and verification passcode are required." });
    }

    const cleanEmail = email.trim().toLowerCase();
    
    db.get(
        "SELECT * FROM login_otps WHERE email = ?",
        [cleanEmail],
        (err, row) => {
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
            db.get("SELECT * FROM owners WHERE email = ?", [cleanEmail], async (errOwner, ownerRow) => {
                if (errOwner) return res.status(500).json({ error: errOwner.message });

                let activeOwner = ownerRow;

                // Auto-create owner if not registered
                if (!activeOwner) {
                    try {
                        const generatedUsername = await generateUniqueUsername(cleanEmail);
                        const generatedName = cleanNameFromEmail(cleanEmail);
                        
                        // Check if first user in database to assign superuser
                        const countRow = await new Promise((resCount, rejCount) => {
                            db.get("SELECT COUNT(*) as count FROM owners", [], (e, r) => e ? rejCount(e) : resCount(r));
                        });
                        
                        const isFirst = !countRow || countRow.count === 0;
                        const superuserVal = isFirst ? 1 : 0;

                        activeOwner = await new Promise((resInsert, rejInsert) => {
                            db.run(
                                "INSERT INTO owners (name, username, email, superuser) VALUES (?, ?, ?, ?)",
                                [generatedName, generatedUsername, cleanEmail, superuserVal],
                                function(insertErr) {
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
                    } catch (createErr) {
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
                    (sessionErr) => {
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
loginRouter.post('/verify-session', (req, res) => {
    const { token } = req.body;
    if (!token) {
        return res.status(401).json({ valid: false, error: "No token provided." });
    }

    db.get(
        "SELECT * FROM user_sessions WHERE token = ?",
        [token],
        (err, sessionRow) => {
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
                (errOwner, ownerRow) => {
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
loginRouter.post('/logout', (req, res) => {
    const { token } = req.body;
    if (token) {
        db.run("DELETE FROM user_sessions WHERE token = ?", [token]);
    }
    res.json({ message: "Successfully logged out." });
});
