import React, { useState, useEffect } from 'react';
import { useAppState } from '../store/useAppState';
import { API_BASE, apiFetch } from '../store/database/apiBridge';
import { Mail, Key, ShieldCheck, CheckCircle2, AlertCircle, ArrowLeft, ExternalLink, Trash2, Send, RefreshCw } from 'lucide-react';
import './SetupResendEmail.css';

export function SetupResendEmail() {
    const { setPage } = useAppState();

    const [apiKey, setApiKey] = useState('');
    const [isConfigured, setIsConfigured] = useState(false);
    const [maskedKey, setMaskedKey] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Test email state
    const [testEmail, setTestEmail] = useState('');
    const [testLoading, setTestLoading] = useState(false);

    useEffect(() => {
        checkResendConfig();
    }, []);

    const checkResendConfig = async () => {
        setLoading(true);
        try {
            const res = await apiFetch(`${API_BASE}/auth/resend-config`);
            const data = await res.json();
            if (res.ok) {
                setIsConfigured(data.configured);
                setMaskedKey(data.maskedKey);
            }
        } catch (err: any) {
            console.error('Failed to check Resend configuration:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveKey = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!apiKey.trim()) return;

        if (!apiKey.trim().startsWith('re_')) {
            setStatusMessage({ type: 'error', text: "Invalid API Key. Resend keys always start with 're_'." });
            return;
        }

        setLoading(true);
        setStatusMessage(null);

        try {
            const res = await apiFetch(`${API_BASE}/auth/resend-config`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ apiKey: apiKey.trim() })
            });
            const data = await res.json();

            if (!res.ok) {
                setStatusMessage({ type: 'error', text: data.error || 'Failed to save API key.' });
            } else {
                setStatusMessage({ type: 'success', text: 'Resend API Key successfully configured and saved to private/resend_key.json!' });
                setApiKey('');
                await checkResendConfig();
            }
        } catch (err: any) {
            setStatusMessage({ type: 'error', text: err.message || 'Network error saving API key.' });
        } finally {
            setLoading(false);
        }
    };

    const handleRemoveKey = async () => {
        if (!confirm('Are you sure you want to remove the saved Resend API Key?')) return;
        setLoading(true);
        setStatusMessage(null);

        try {
            const res = await apiFetch(`${API_BASE}/auth/resend-config`, {
                method: 'DELETE'
            });
            if (res.ok) {
                setStatusMessage({ type: 'success', text: 'Resend API Key removed successfully.' });
                await checkResendConfig();
            }
        } catch (err: any) {
            setStatusMessage({ type: 'error', text: err.message || 'Failed to remove key.' });
        } finally {
            setLoading(false);
        }
    };

    const handleSendTestEmail = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!testEmail.trim() || !testEmail.includes('@')) return;

        setTestLoading(true);
        setStatusMessage(null);

        try {
            const res = await apiFetch(`${API_BASE}/auth/request-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: testEmail.trim() })
            });
            const data = await res.json();
            if (res.ok) {
                setStatusMessage({ type: 'success', text: `Test OTP email dispatched to ${testEmail}! Check your inbox.` });
            } else {
                setStatusMessage({ type: 'error', text: data.error || 'Failed to send test email.' });
            }
        } catch (err: any) {
            setStatusMessage({ type: 'error', text: err.message || 'Error sending test email.' });
        } finally {
            setTestLoading(false);
        }
    };

    return (
        <div className="setup-resend-wrapper">
            <div className="setup-resend-glass-panel">
                <div className="setup-header">
                    <button className="back-btn" onClick={() => setPage('login')}>
                        <ArrowLeft size={16} />
                        <span>Back to Login</span>
                    </button>
                    <div className="setup-title">
                        <Mail className="title-icon glow-pulse" size={32} />
                        <h2>Setup Resend Email Delivery</h2>
                        <p className="subtitle">Configure real OTP email dispatching for PCB Rework Tracker</p>
                    </div>
                </div>

                {statusMessage && (
                    <div className={`status-toast ${statusMessage.type}`}>
                        {statusMessage.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                        <span>{statusMessage.text}</span>
                    </div>
                )}

                {/* Status Indicator */}
                <div className={`config-status-badge ${isConfigured ? 'configured' : 'not-configured'}`}>
                    <div className="status-indicator-dot"></div>
                    <div className="status-text">
                        <strong>Status: </strong>
                        {isConfigured ? (
                            <span>Resend API Key Configured <code>({maskedKey})</code></span>
                        ) : (
                            <span>Not Configured (Fallback: Terminal logs & <code>src/login/email_sent.txt</code>)</span>
                        )}
                    </div>
                </div>

                {/* API Key Form */}
                <form onSubmit={handleSaveKey} className="resend-form">
                    <div className="input-group">
                        <label htmlFor="apiKey">
                            <Key size={16} />
                            <span>Resend API Key</span>
                        </label>
                        <input
                            type="password"
                            id="apiKey"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder="re_123456789..."
                            required={!isConfigured}
                            disabled={loading}
                        />
                    </div>

                    <div className="form-actions">
                        <button type="submit" className="save-key-btn" disabled={loading || !apiKey.trim()}>
                            {loading ? <RefreshCw className="spinner" size={16} /> : <ShieldCheck size={16} />}
                            <span>{isConfigured ? 'Update API Key' : 'Save Resend API Key'}</span>
                        </button>

                        {isConfigured && (
                            <button type="button" className="remove-key-btn" onClick={handleRemoveKey} disabled={loading}>
                                <Trash2 size={16} />
                                <span>Remove Key</span>
                            </button>
                        )}
                    </div>
                </form>

                {/* Instructions & Help */}
                <div className="help-box">
                    <h4>
                        <ExternalLink size={16} />
                        <span>How to get a Free Resend API Key (30 Seconds)</span>
                    </h4>
                    <ol>
                        <li>Sign up for a free account at <a href="https://resend.com" target="_blank" rel="noreferrer">resend.com</a> (Includes 3,000 free emails/month).</li>
                        <li>Navigate to <a href="https://resend.com/api-keys" target="_blank" rel="noreferrer">API Keys</a> and click <strong>Create API Key</strong>.</li>
                        <li>Paste your key starting with <code>re_</code> in the box above and click Save.</li>
                    </ol>
                </div>

                {/* Test Email Section */}
                {isConfigured && (
                    <div className="test-email-box">
                        <h4>
                            <Send size={16} />
                            <span>Send Test Passcode Email</span>
                        </h4>
                        <form onSubmit={handleSendTestEmail} className="test-email-form">
                            <input
                                type="email"
                                value={testEmail}
                                onChange={(e) => setTestEmail(e.target.value)}
                                placeholder="your.email@company.com"
                                required
                                disabled={testLoading}
                            />
                            <button type="submit" className="test-send-btn" disabled={testLoading || !testEmail.includes('@')}>
                                {testLoading ? <RefreshCw className="spinner" size={16} /> : <Send size={16} />}
                                <span>Dispatch Test Email</span>
                            </button>
                        </form>
                    </div>
                )}

                {/* Security Guarantee Notice */}
                <div className="security-notice">
                    <ShieldCheck size={16} className="security-icon" />
                    <span>
                        <strong>Server-Only Security Protection:</strong> Your Resend API key is stored strictly on the server in <code>private/resend_key.json</code> (outside client static assets) and is explicitly excluded from version control in <code>.gitignore</code>. It is completely inaccessible to browser clients and only read by backend Node.js functions.
                    </span>
                </div>
            </div>
        </div>
    );
}
