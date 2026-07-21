import React from 'react';
import { useAppState } from '../../store/useAppState';
import { BoardName } from '../../components/BoardName';

export function FixedUrl() {
    const { mistypedUrl, correctedUrl, setExpandedPcb, setActiveTab } = useAppState();

    const proceed = React.useCallback(() => {
        if (correctedUrl) {
            setActiveTab('pcbs');
            setExpandedPcb(correctedUrl);
        } else {
            setActiveTab('projects');
        }
    }, [correctedUrl, setActiveTab, setExpandedPcb]);

    return (
        <div style={{ padding: '3rem 2rem', textAlign: 'center', color: 'var(--text)', maxWidth: '600px', margin: '0 auto' }}>
            <div style={{ backgroundColor: 'rgba(99, 102, 241, 0.1)', border: '1px solid var(--accent)', padding: '2rem', borderRadius: '16px' }}>
                <h2 style={{ color: 'var(--accent)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                    URL Auto-Corrected
                </h2>
                
                <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
                    The URL you provided was slightly misspelled. <br/>
                    We used the mathematical CRC checksum to fix it!
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', backgroundColor: 'var(--bg-panel)', padding: '1.5rem', borderRadius: '8px', marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: 'var(--text-muted)' }}>You typed:</span>
                        <span style={{ color: '#ef4444', fontWeight: 'bold', textDecoration: 'line-through' }}>{mistypedUrl}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: 'var(--text-muted)' }}>We fixed it to:</span>
                        <span style={{ fontWeight: 'bold' }}>{correctedUrl ? <BoardName name={correctedUrl} /> : 'Unknown'}</span>
                    </div>
                </div>

                <button 
                    onClick={proceed}
                    style={{
                        backgroundColor: 'var(--accent)',
                        color: 'white',
                        padding: '12px 24px',
                        borderRadius: '8px',
                        border: 'none',
                        cursor: 'pointer',
                        fontWeight: 600,
                        width: '100%'
                    }}
                >
                    Click to Continue
                </button>
            </div>
        </div>
    );
}
