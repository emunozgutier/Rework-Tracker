import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Target file in workspace root for easy user inspection
const emailLogPath = path.resolve(__dirname, './email_sent.txt');

/**
 * Sends an email using SMTP if available (defaults to Mailhog/Mailpit at localhost:1025),
 * and always logs to console and a local workspace file as fallback.
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
        console.log(`[Email Mock] Successfully logged passcode to ${emailLogPath}`);
    } catch (err: any) {
        console.error('[Email Mock] Failed to write code to file:', err.message);
    }

    // 2. Determine SMTP configuration (environment variables or local Mailhog/Mailpit fallback)
    const host = process.env.SMTP_HOST || 'localhost';
    const port = parseInt(process.env.SMTP_PORT || '1025', 10);
    const user = process.env.SMTP_USER || '';
    const pass = process.env.SMTP_PASS || '';
    const from = process.env.SMTP_FROM || '"PCB Rework Tracker" <noreply@reworktracker.local>';

    const smtpConfig: any = {
        host,
        port,
        secure: port === 465, // true for 465, false for other ports
        tls: {
            rejectUnauthorized: false // Allow self-signed certs (e.g. on localhost)
        }
    };

    if (user && pass) {
        smtpConfig.auth = { user, pass };
    }

    try {
        const transporter = nodemailer.createTransport(smtpConfig);
        
        await transporter.sendMail({
            from,
            to: email,
            subject: 'PCB Rework Tracker - Verification Code',
            text: `Your 6-digit passcode to log in to the PCB Rework Tracker is: ${otp}\n\nThis code is valid for 15 minutes.`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff; color: #1a202c;">
                    <h2 style="color: #6366f1; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">Verification Code</h2>
                    <p style="font-size: 1rem; line-height: 1.5; color: #4a5568;">Hello,</p>
                    <p style="font-size: 1rem; line-height: 1.5; color: #4a5568;">You requested a login to the <strong>PCB Rework Tracker</strong>. Use the 6-digit passcode below to verify your identity:</p>
                    <div style="text-align: center; margin: 30px 0;">
                        <span style="display: inline-block; font-family: monospace; font-size: 2.2rem; font-weight: bold; background-color: #f7fafc; border: 1px dashed #cbd5e0; padding: 12px 30px; border-radius: 6px; letter-spacing: 4px; color: #2d3748;">${otp}</span>
                    </div>
                    <p style="font-size: 0.9rem; color: #718096; line-height: 1.5;">This passcode is valid for <strong>15 minutes</strong>. If you did not request a login, you can safely ignore this email.</p>
                    <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
                    <p style="font-size: 0.8rem; color: #a0aec0; text-align: center;">PCB Rework Tracker &copy; 2026. Built by Google DeepMind Antigravity.</p>
                </div>
            `
        });
        
        console.log(`[SMTP Email] Successfully dispatched actual email to ${email} via SMTP (${host}:${port})`);
    } catch (err: any) {
        if (err.code === 'ECONNREFUSED') {
            console.log(`[SMTP Email] Notice: Local SMTP server (Mailhog/Mailpit) not running on ${host}:${port}. Using printed/file logs.`);
        } else {
            console.error('[SMTP Email] Error attempting to send email via SMTP:', err.message);
        }
    }
}
