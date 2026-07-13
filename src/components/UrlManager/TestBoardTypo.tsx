import { useState } from 'react';
import { generateCRC } from './crc';
import { COLORS } from '../../store/storeStyles';

export function TestBoardTypo() {
    const [genInput, setGenInput] = useState('MAP-0001');

    // Generate logic
    const cleanGen = genInput.trim().toUpperCase();
    const generatedCrc = cleanGen ? generateCRC(cleanGen) : '';

    return (
        <div style={{ maxWidth: '600px', margin: '40px auto', padding: '0 16px' }}>
            <div style={{ 
                padding: '32px', 
                backgroundColor: 'var(--bg-panel)', 
                borderRadius: '16px', 
                border: '1px solid var(--border)', 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '20px',
                boxShadow: '0 10px 30px -10px rgba(0,0,0,0.15)',
                backdropFilter: 'blur(8px)'
            }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, color: 'var(--accent)' }}>
                    Generate Checksum
                </h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
                    Enter a base name (e.g. PROJECT-NUMBER) to calculate its unique CRC letter.
                </p>
                <input 
                    type="text" 
                    value={genInput}
                    onChange={e => setGenInput(e.target.value)}
                    placeholder="e.g. MAP-0001"
                    style={{ 
                        padding: '14px 16px', 
                        borderRadius: '10px', 
                        border: '1px solid var(--border)', 
                        background: 'var(--bg-element)', 
                        color: 'var(--text)', 
                        fontSize: '1.05rem', 
                        width: '100%', 
                        boxSizing: 'border-box',
                        outline: 'none',
                        transition: 'border-color 0.2s ease, box-shadow 0.2s ease'
                    }}
                />
                {cleanGen && (
                    <div style={{ 
                        marginTop: '12px', 
                        paddingTop: '24px', 
                        borderTop: '1px solid var(--border)', 
                        display: 'flex', 
                        flexDirection: 'column', 
                        alignItems: 'center', 
                        gap: '8px' 
                    }}>
                        <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '1px' }}>
                            Resulting Board Name
                        </span>
                        <div style={{ fontSize: '2.2rem', fontWeight: 800, letterSpacing: '1.5px', color: 'var(--text)' }}>
                            {cleanGen}<span style={{ color: COLORS.purple, fontWeight: 900 }}>{generatedCrc}</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
