import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';
import { Resend } from 'resend';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Target file in workspace root for easy user inspection
const emailLogPath = path.resolve(__dirname, './email_sent.txt');

// Secure server-only storage directory (outside client-accessible src root)
const privateDir = path.resolve(__dirname, '../../private');
const primaryKeyPath = path.resolve(privateDir, 'resend_key.json');
const legacyKeyPath = path.resolve(__dirname, './resend_key.json');

/**
 * Returns the configured Resend API key from server-only private directory or environment variable.
 */
export function getResendApiKey(): string | null {
    if (process.env.RESEND_API_KEY && process.env.RESEND_API_KEY.trim()) {
        return process.env.RESEND_API_KEY.trim();
    }
    try {
        if (fs.existsSync(primaryKeyPath)) {
            const content = fs.readFileSync(primaryKeyPath, 'utf8');
            const data = JSON.parse(content);
            if (data && data.apiKey && typeof data.apiKey === 'string') {
                return data.apiKey.trim();
            }
        }
        if (fs.existsSync(legacyKeyPath)) {
            const content = fs.readFileSync(legacyKeyPath, 'utf8');
            const data = JSON.parse(content);
            if (data && data.apiKey && typeof data.apiKey === 'string') {
                return data.apiKey.trim();
            }
        }
    } catch (err) {}
    return null;
}

/**
 * Saves the Resend API key to ./private/resend_key.json (server-only storage, excluded from git)
 */
export function saveResendApiKey(apiKey: string): void {
    if (!fs.existsSync(privateDir)) {
        fs.mkdirSync(privateDir, { recursive: true });
    }
    const data = { apiKey: apiKey.trim(), updatedAt: new Date().toISOString() };
    fs.writeFileSync(primaryKeyPath, JSON.stringify(data, null, 2), 'utf8');

    // Remove legacy location if it exists
    if (fs.existsSync(legacyKeyPath)) {
        try { fs.unlinkSync(legacyKeyPath); } catch (e) {}
    }
}

/**
 * Deletes the Resend API key file from server-only private directory
 */
export function deleteResendApiKey(): void {
    if (fs.existsSync(primaryKeyPath)) {
        fs.unlinkSync(primaryKeyPath);
    }
    if (fs.existsSync(legacyKeyPath)) {
        try { fs.unlinkSync(legacyKeyPath); } catch (e) {}
    }
}

/**
 * Sends an OTP email using Resend API if configured,
 * otherwise falls back to SMTP / local file log.
 */
export async function sendOtpEmail(email: string, otp: string): Promise<void> {
    const timestamp = new Date().toLocaleString();
    
    const emailHeader = `==================================================
EMAIL NOTIFICATION - PCB REWORK TRACKER AUTH
==================================================
Timestamp: ${timestamp}
To:        ${email}
Subject:   Your 6-Digit Verification Code

Hello!

You have requested a login to the PCB Rework Tracker.
Please use the following 6-digit passcode to verify your identity:

                  [  ${otp}  ]

This code is valid for exactly 15 minutes.
If you did not request this, you can safely ignore this email.

Best regards,
The Antigravity Team
==================================================
`;

    // 1. Always log to console & file in all environments for developer convenience
    console.log('\n' + emailHeader);
    try {
        fs.writeFileSync(emailLogPath, emailHeader, 'utf8');
        console.log(`[Email Log] Logged passcode to ${emailLogPath}`);
    } catch (err: any) {
        console.error('[Email Log] Failed to write code to file:', err.message);
    }

    // 2. Try Resend API first if key is configured
    const resendApiKey = getResendApiKey();
    if (resendApiKey) {
        try {
            const resend = new Resend(resendApiKey);
            const from = process.env.RESEND_FROM || 'PCB Rework Tracker <onboarding@resend.dev>';

            const res = await resend.emails.send({
                from,
                to: email,
                subject: 'PCB Rework Tracker - Verification Code',
                text: `Your 6-digit passcode to log in to the PCB Rework Tracker is: ${otp}\n\nThis code is valid for 15 minutes.`,
                html: `
                    <div style="font-family: Arial, sans-serif; padding: 24px; background-color: #0f172a; color: #f8fafc; border-radius: 12px; max-width: 480px; margin: 0 auto; border: 1px solid #334155;">
                        <h2 style="color: #6366f1; margin-top: 0; text-align: center;">PCB Rework Tracker</h2>
                        <p style="font-size: 16px; color: #94a3b8; text-align: center;">Your Verification Passcode</p>
                        
                        <div style="background-color: #1e293b; padding: 18px; border-radius: 8px; text-align: center; margin: 24px 0; border: 1px solid #475569;">
                            <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #38bdf8;">${otp}</span>
                        </div>
                        
                        <p style="font-size: 14px; color: #94a3b8; line-height: 1.5;">This passcode is valid for <strong>15 minutes</strong>. Do not share this code with anyone.</p>
                        <hr style="border: 0; border-top: 1px solid #334155; margin: 20px 0;" />
                        <p style="font-size: 12px; color: #64748b; text-align: center; margin: 0;">If you did not request a passcode, you can safely ignore this email.</p>
                    </div>
                `
            });

            console.log(`[Resend Email] Successfully dispatched OTP email to ${email}. ID: ${res.data?.id}`);
            return;
        } catch (resendErr: any) {
            console.error('[Resend Email] Error sending email via Resend:', resendErr.message || resendErr);
        }
    }

    // 3. Fallback: SMTP transport
    try {
        const smtpHost = process.env.SMTP_HOST || 'localhost';
        const smtpPort = parseInt(process.env.SMTP_PORT || '1025', 10);
        
        const transporter = nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: false,
            tls: { rejectUnauthorized: false }
        });

        await transporter.sendMail({
            from: '"PCB Rework Tracker" <no-reply@pcbreworktracker.local>',
            to: email,
            subject: 'Your 6-Digit Verification Code',
            text: `Your verification code is: ${otp}`
        });

        console.log(`[SMTP Email] Successfully sent email to ${email}`);
    } catch (smtpErr: any) {
        console.warn(`[SMTP Email] Error attempting to send email via SMTP: ${smtpErr.message}`);
    }
}
