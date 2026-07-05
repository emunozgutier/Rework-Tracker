interface OwnerCardBodyProps {
    owner: any;
}

export function OwnerCardBody({ owner }: OwnerCardBodyProps) {

    return (
        <div className="card-expanded-content" style={{ padding: '16px', borderTop: '1px solid var(--border-color)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <tbody>
                    <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                        <td style={{ 
                            padding: '10px 0', 
                            fontWeight: 600, 
                            color: 'var(--text-muted)', 
                            width: '80px', 
                            textTransform: 'uppercase', 
                            fontSize: '0.75rem', 
                            letterSpacing: '0.05em' 
                        }}>
                            Name
                        </td>
                        <td style={{ padding: '10px 12px', color: 'var(--text)', fontWeight: 500 }}>
                            {owner.name || 'No full name provided'}
                        </td>
                    </tr>
                    <tr>
                        <td style={{ 
                            padding: '10px 0', 
                            fontWeight: 600, 
                            color: 'var(--text-muted)', 
                            width: '80px', 
                            textTransform: 'uppercase', 
                            fontSize: '0.75rem', 
                            letterSpacing: '0.05em' 
                        }}>
                            Email
                        </td>
                        <td style={{ padding: '10px 12px', color: 'var(--text)', fontFamily: 'monospace' }}>
                            {owner.email || 'No email address'}
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
}
