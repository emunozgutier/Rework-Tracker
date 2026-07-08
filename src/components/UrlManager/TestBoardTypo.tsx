import { useState } from 'react';
import { generateCRC } from './crc';
import { COLORS } from '../../store/storeStyles';

export function TestBoardTypo() {
    const [genInput, setGenInput] = useState('MAP-0001');
    const [valInput, setValInput] = useState('MAP-0001U');

    // Generate logic
    const cleanGen = genInput.trim().toUpperCase();
    const generatedCrc = cleanGen ? generateCRC(cleanGen) : '';

    // Validate logic
    const cleanVal = valInput.trim().toUpperCase();
    let valResult = null;

    if (cleanVal.length >= 2) {
        const prefix = cleanVal.slice(0, -1);
        const lastChar = cleanVal.slice(-1);
        const expectedCrc = generateCRC(prefix);
        const isValid = lastChar === expectedCrc;

        valResult = {
            isValid,
            prefix,
            lastChar,
            expectedCrc
        };
    }

    return (
        <div style={{ maxWidth: '800px', margin: '20px auto', padding: '0 16px' }}>
            <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <h2 style={{ fontSize: '1.75rem', fontWeight: 700, margin: '0 0 8px 0', color: 'var(--text)' }}>
                    CRC Checksum Tool
                </h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', margin: 0 }}>
                    Calculate or verify the visually unambiguous checksum character appended to board names.
                </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
                {/* Generator Section */}
                <div style={{ padding: '24px', backgroundColor: 'var(--bg-panel)', borderRadius: '12px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0, color: 'var(--accent)' }}>
                        Generate Checksum
                    </h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
                        Enter a base name (e.g. PROJECT-NUMBER) to calculate its unique CRC letter.
                    </p>
                    <input 
                        type="text" 
                        value={genInput}
                        onChange={e => setGenInput(e.target.value)}
                        placeholder="e.g. MAP-0001"
                        style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-element)', color: 'var(--text)', fontSize: '1rem', width: '100%', boxSizing: 'border-box' }}
                    />
                    {cleanGen && (
                        <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Resulting Board Name</span>
                            <div style={{ fontSize: '1.8rem', fontWeight: 700, letterSpacing: '1px', color: 'var(--text)' }}>
                                {cleanGen}<span style={{ color: COLORS.purple, fontWeight: 900 }}>{generatedCrc}</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Validator Section */}
                <div style={{ padding: '24px', backgroundColor: 'var(--bg-panel)', borderRadius: '12px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0, color: 'var(--accent)' }}>
                        Verify Checksum
                    </h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
                        Enter a full board name with checksum (e.g. MAP-0001K) to check its validity.
                    </p>
                    <input 
                        type="text" 
                        value={valInput}
                        onChange={e => setValInput(e.target.value)}
                        placeholder="e.g. MAP-0001K"
                        style={{ padding: '12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-element)', color: 'var(--text)', fontSize: '1rem', width: '100%', boxSizing: 'border-box' }}
                    />
                    {valResult && (
                        <div style={{ marginTop: 'auto', paddingTop: '16px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {valResult.isValid ? (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '12px', borderRadius: '8px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid #10b981', color: '#10b981' }}>
                                    <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>✓ VALID CHECKSUM</span>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                        CRC matches expected value '{valResult.expectedCrc}'.
                                    </span>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '12px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid #ef4444', color: '#ef4444' }}>
                                    <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>✗ INVALID CHECKSUM</span>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                                        Got '{valResult.lastChar}', but prefix '{valResult.prefix}' expects CRC '{valResult.expectedCrc}'.
                                    </span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
