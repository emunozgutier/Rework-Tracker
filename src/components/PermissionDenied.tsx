import { ShieldAlert, Settings } from 'lucide-react';
import { useAppState } from '../store/useAppState';
import { useGlobalSettings } from '../store/useGlobalSettings';

interface PermissionDeniedProps {
    pageLabel: string;
}

export function PermissionDenied({ pageLabel }: PermissionDeniedProps) {
    const { activeRole } = useGlobalSettings();
    const { setActiveTab } = useAppState();

    const formattedRole = activeRole.charAt(0).toUpperCase() + activeRole.slice(1);

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px 20px',
            textAlign: 'center',
            backgroundColor: 'var(--bg-panel)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            maxWidth: '500px',
            margin: '40px auto',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        }}>
            <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '2px solid rgba(239, 68, 68, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '20px',
                color: '#ef4444',
            }}>
                <ShieldAlert size={36} />
            </div>

            <h3 style={{ margin: '0 0 10px 0', fontSize: '1.4rem', fontWeight: 700, color: 'var(--text)' }}>
                Access Denied
            </h3>

            <p style={{ margin: '0 0 24px 0', fontSize: '0.95rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                Your current role (<strong>{formattedRole}</strong>) does not have permission to view the <strong>{pageLabel}</strong> page.
            </p>

            <button
                onClick={() => setActiveTab('settings')}
                style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    backgroundColor: 'var(--accent)',
                    color: 'white',
                    border: 'none',
                    padding: '10px 20px',
                    borderRadius: '8px',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: '0 4px 12px var(--accent-glow)',
                }}
                onMouseOver={(e) => e.currentTarget.style.filter = 'brightness(1.1)'}
                onMouseOut={(e) => e.currentTarget.style.filter = 'brightness(1)'}
            >
                <Settings size={16} />
                <span>Go to Settings to Adjust Rights</span>
            </button>
        </div>
    );
}
