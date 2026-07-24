import { useState, useEffect } from 'react';
import { useAppState } from '../store/useAppState';
import { API_BASE, apiFetch } from '../store/database/apiBridge';
import { AlertTriangle, Key, X } from 'lucide-react';
import './GlobalResendWarningModal.css';

export function GlobalResendWarningModal() {
    const { page, setPage } = useAppState();

    const [isConfigured, setIsConfigured] = useState<boolean | null>(null);
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        // Do not check/display modal if already on the setup page itself
        if (page === 'setup_resend') return;

        apiFetch(`${API_BASE}/auth/resend-config`)
            .then(res => res.json())
            .then(data => {
                setIsConfigured(data.configured);
            })
            .catch(err => {
                console.error('Failed to check Resend configuration:', err);
            });
    }, [page]);

    // Don't show modal if configured, dismissed, or on setup_resend page
    if (isConfigured !== false || dismissed || page === 'setup_resend') {
        return null;
    }

    return (
        <div className="global-resend-modal-overlay">
            <div className="global-resend-modal">
                <button 
                    className="modal-close-btn" 
                    onClick={() => setDismissed(true)}
                    title="Dismiss warning"
                >
                    <X size={18} />
                </button>

                <div className="modal-icon-header">
                    <AlertTriangle className="warning-icon glow-amber" size={44} />
                </div>

                <h3>Resend Email API Not Configured</h3>

                <p>
                    Real OTP passcode email delivery is currently inactive across the project. 
                    Passcodes will be logged locally to <code>src/login/email_sent.txt</code> and terminal logs until a free Resend API key is configured.
                </p>

                <div className="modal-actions">
                    <button 
                        className="primary-setup-btn"
                        onClick={() => {
                            setDismissed(true);
                            setPage('setup_resend');
                        }}
                    >
                        <Key size={16} />
                        <span>Set Up Resend Email API Key</span>
                    </button>
                    <button 
                        className="secondary-dismiss-btn"
                        onClick={() => setDismissed(true)}
                    >
                        Continue with Local Logs
                    </button>
                </div>
            </div>
        </div>
    );
}

export function ResendTopBarBadge() {
    const { page, setPage } = useAppState();
    const [isConfigured, setIsConfigured] = useState<boolean | null>(null);

    useEffect(() => {
        apiFetch(`${API_BASE}/auth/resend-config`)
            .then(res => res.json())
            .then(data => setIsConfigured(data.configured))
            .catch(() => {});
    }, [page]);

    if (isConfigured !== false || page === 'setup_resend') {
        return null;
    }

    return (
        <button 
            className="resend-topbar-badge"
            onClick={() => setPage('setup_resend')}
            title="Resend Email API is not configured. Click to set up."
        >
            <AlertTriangle size={14} />
            <span>Setup Resend Email</span>
        </button>
    );
}
