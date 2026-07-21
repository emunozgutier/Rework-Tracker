import { useAppState } from '../../store/useAppState';

export function WrongUrl() {
    const { setActiveTab } = useAppState();

    return (
        <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text)' }}>
            <h1 style={{ color: '#ef4444', marginBottom: '1rem', fontSize: '2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                Board Not Found
            </h1>
            <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', fontSize: '1.1rem' }}>We couldn't find a PCB matching the requested URL, and the Checksum was invalid.</p>
            <button 
                onClick={() => setActiveTab('projects')}
                style={{
                    backgroundColor: 'var(--bg-element)',
                    color: 'var(--text)',
                    padding: '10px 20px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    cursor: 'pointer',
                    fontWeight: 600
                }}
            >
                Return to Home
            </button>
        </div>
    );
}
