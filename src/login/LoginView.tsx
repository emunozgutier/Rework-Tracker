import React, { useState, useRef, useEffect } from 'react';
import { useAuthStore } from './client';
import { useAppState } from '../store/useAppState';
import { useOwnerStore } from '../store/useOwnerStore';
import { Mail, ShieldCheck, ArrowLeft, RefreshCw, Key } from 'lucide-react';
import './LoginView.css';

export function LoginView() {
    const { 
        loading, 
        error, 
        otpSent, 
        requestOtp, 
        verifyOtp, 
        clearError, 
        setOtpSent 
    } = useAuthStore();
    const { owners, fetchOwners } = useOwnerStore();

    const [email, setEmail] = useState('');
    const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
    const [attempts, setAttempts] = useState(0);
    const digitRefs = [
        useRef<HTMLInputElement>(null),
        useRef<HTMLInputElement>(null),
        useRef<HTMLInputElement>(null),
        useRef<HTMLInputElement>(null),
        useRef<HTMLInputElement>(null),
        useRef<HTMLInputElement>(null),
    ];

    // Clear error on mount and fetch owners
    useEffect(() => {
        clearError();
        fetchOwners();
        setAttempts(0);
    }, [clearError, fetchOwners]);

    // Handle email request
    const handleEmailSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim() || !email.includes('@')) return;
        await requestOtp(email.trim());
        setAttempts(0); // Reset attempts when code is freshly requested
    };

    // Auto-verify once 6 digits are fully entered
    useEffect(() => {
        const verifyAndRedirect = async () => {
            if (otpSent && otpDigits.every(digit => digit !== '')) {
                const code = otpDigits.join('');
                const success = await verifyOtp(email, code);
                if (success) {
                    setAttempts(0);
                    useAppState.getState().setPage('projects');
                } else {
                    const nextAttempts = attempts + 1;
                    if (nextAttempts >= 3) {
                        setAttempts(0);
                        setOtpDigits(['', '', '', '', '', '']);
                        setOtpSent(false);
                        useAuthStore.setState({ error: 'Too many failed attempts. Please request a new passcode.' });
                    } else {
                        setAttempts(nextAttempts);
                        setOtpDigits(['', '', '', '', '', '']);
                        digitRefs[0].current?.focus();
                        useAuthStore.setState({ error: `Invalid passcode. ${3 - nextAttempts} attempts remaining.` });
                    }
                }
            }
        };
        verifyAndRedirect();
    }, [otpDigits, otpSent, email, verifyOtp, attempts, digitRefs, setOtpSent]);

    // Handle digit typing
    const handleDigitChange = (index: number, value: string) => {
        // Only accept numbers
        if (value && !/^\d$/.test(value)) return;

        const newDigits = [...otpDigits];
        newDigits[index] = value;
        setOtpDigits(newDigits);

        // Auto focus next box if we typed a digit
        if (value !== '' && index < 5) {
            digitRefs[index + 1].current?.focus();
        }
    };

    // Handle backspaces
    const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Backspace') {
            if (otpDigits[index] === '' && index > 0) {
                const newDigits = [...otpDigits];
                newDigits[index - 1] = '';
                setOtpDigits(newDigits);
                digitRefs[index - 1].current?.focus();
            } else {
                const newDigits = [...otpDigits];
                newDigits[index] = '';
                setOtpDigits(newDigits);
            }
        }
    };

    // Handle pasting the whole 6-digit code
    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
        e.preventDefault();
        const pasteData = e.clipboardData.getData('text').trim();
        if (/^\d{6}$/.test(pasteData)) {
            const digits = pasteData.split('');
            setOtpDigits(digits);
            digitRefs[5].current?.focus();
        }
    };

    return (
        <div className="login-wrapper">
            <div className="login-glass-panel">
                <div className="login-brand">
                    <div className="login-logo-circle">
                        {otpSent ? <Key className="logo-icon glow-pulse" size={28} /> : <ShieldCheck className="logo-icon animate-bounce-slow" size={32} />}
                    </div>
                    <h2>PCB Rework Tracker</h2>
                    {otpSent && <p className="subtitle">Verification Passcode</p>}
                </div>

                {error && (
                    <div className="login-error-toast" onClick={clearError}>
                        <span>{error}</span>
                    </div>
                )}

                {!otpSent ? (
                    <form onSubmit={handleEmailSubmit} className="login-form">
                        <div className="input-group">
                            <label htmlFor="email">Work Email</label>
                            <div className="input-with-icon">
                                <Mail className="input-icon" size={18} />
                                {owners && owners.filter(o => o.email).length > 0 ? (
                                    <select
                                        id="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        disabled={loading}
                                        style={{
                                            width: '100%',
                                            padding: '12px 12px 12px 40px',
                                            border: '1px solid var(--border)',
                                            background: 'var(--bg-app)',
                                            color: 'var(--text-main)',
                                            borderRadius: '8px',
                                            fontSize: '0.95rem',
                                            outline: 'none',
                                            cursor: 'pointer',
                                            appearance: 'auto'
                                        }}
                                    >
                                        <option value="">-- Select Owner --</option>
                                        {owners.filter(o => o.email).map(o => (
                                            <option key={o.id} value={o.email} style={{ background: 'var(--bg-panel)', color: 'var(--text-main)' }}>
                                                {o.name} ({o.email})
                                            </option>
                                        ))}
                                    </select>
                                ) : (
                                    <input
                                        type="email"
                                        id="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="your.name@company.com"
                                        required
                                        disabled={loading}
                                        autoFocus
                                    />
                                )}
                            </div>
                        </div>

                        <button 
                            type="submit" 
                            className="login-btn" 
                            disabled={loading || !email.includes('@')}
                        >
                            {loading ? (
                                <RefreshCw className="spinner" size={18} />
                            ) : (
                                'Request Secure Passcode'
                            )}
                        </button>
                        
                        <p className="login-note">
                            We will send a 6-digit verification code to your inbox. Valid for 15 minutes.
                        </p>
                    </form>
                ) : (
                    <div className="login-form">
                        <div className="otp-email-sent-badge">
                            <span>Code dispatched to <strong>{email}</strong></span>
                            <button 
                                className="change-email-btn"
                                onClick={() => {
                                    setOtpSent(false);
                                    setOtpDigits(['', '', '', '', '', '']);
                                    clearError();
                                }}
                            >
                                <ArrowLeft size={12} />
                                <span>Change email</span>
                            </button>
                        </div>

                        <div className="otp-digit-container">
                            <label className="otp-label">Enter 6-Digit Passcode</label>
                            <div className="otp-boxes">
                                {otpDigits.map((digit, idx) => (
                                    <input
                                        key={idx}
                                        ref={digitRefs[idx]}
                                        type="text"
                                        maxLength={1}
                                        value={digit}
                                        onChange={(e) => handleDigitChange(idx, e.target.value)}
                                        onKeyDown={(e) => handleKeyDown(idx, e)}
                                        onPaste={handlePaste}
                                        disabled={loading}
                                        placeholder="-"
                                        autoFocus={idx === 0}
                                    />
                                ))}
                            </div>
                        </div>

                        {loading && (
                            <div className="otp-verifying-loader">
                                <RefreshCw className="spinner" size={18} />
                                <span>Authorizing session...</span>
                            </div>
                        )}

                        <p className="login-note">
                            Please check your inbox, terminal logs, or <code>src/login/email_sent.txt</code> to copy the code.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
