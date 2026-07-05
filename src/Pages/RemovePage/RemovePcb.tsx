import { useState, useEffect } from 'react';
import { BoardName } from '../../components/BoardName';
import { Popup } from '../../components/Popup';

interface RemovePcbProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    pcb: any;
}

export function RemovePcb({ isOpen, onClose, onConfirm, pcb }: RemovePcbProps) {
    const [inputValue, setInputValue] = useState('');
    
    // Reset state when opened or closed
    useEffect(() => {
        if (isOpen) setInputValue('');
    }, [isOpen]);

    if (!isOpen || !pcb) return null;

    const expectedText = pcb.board_number;
    
    // Support either full board number (with CRC) or base board number (without CRC)
    let expectedTextWithoutCrc = expectedText;
    if (expectedText.length > 5 && expectedText.includes('-')) {
        const parts = expectedText.split('-');
        if (parts.length >= 2) {
            const lastPart = parts[parts.length - 1];
            if (lastPart.length > 1 && /^[a-zA-Z]$/.test(lastPart.slice(-1))) {
                expectedTextWithoutCrc = expectedText.slice(0, -1);
            }
        }
    }

    const cleanInput = inputValue.trim().toLowerCase();
    const isValid = cleanInput === expectedText.trim().toLowerCase() || 
                    cleanInput === expectedTextWithoutCrc.trim().toLowerCase();

    const handleConfirm = () => {
        if (isValid) {
            onConfirm();
            onClose();
        }
    };

    const titleElement = (
        <h2 style={{ margin: 0, color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18"></path>
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
            </svg>
            Remove PCB
        </h2>
    );

    return (
        <Popup isOpen={isOpen} onClose={onClose} title={titleElement} maxWidth="500px">
            <p style={{ color: 'var(--text-muted)', marginBottom: '24px', lineHeight: '1.6' }}>
                You are about to permanently remove PCB <span className="board-num" style={{ fontWeight: 700, color: 'var(--text)' }}><BoardName name={pcb.board_number} isHex={pcb.number_format === 'hex'} /></span>. This action cannot be undone.
            </p>

            <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text)' }}>
                    Please type <span className="board-num" style={{ fontWeight: 700, color: 'var(--text)' }}><BoardName name={expectedText} isHex={pcb.number_format === 'hex'} /></span> to confirm:
                </label>
                <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder={expectedText}
                    style={{
                        width: '100%',
                        padding: '12px 16px',
                        borderRadius: '8px',
                        border: `1px solid ${inputValue && !isValid ? '#ef4444' : 'var(--border)'}`,
                        background: 'rgba(255, 255, 255, 0.05)',
                        color: 'var(--text)',
                        fontSize: '1rem',
                        outline: 'none',
                        fontFamily: 'monospace'
                    }}
                    autoFocus
                />
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button
                    onClick={onClose}
                    style={{
                        padding: '10px 20px',
                        background: 'transparent',
                        border: '1px solid var(--border)',
                        color: 'var(--text)',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: 600
                    }}
                >
                    Cancel
                </button>
                <button
                    onClick={handleConfirm}
                    disabled={!isValid}
                    style={{
                        padding: '10px 20px',
                        background: isValid ? '#ef4444' : 'rgba(239, 68, 68, 0.2)',
                        border: 'none',
                        color: isValid ? '#fff' : 'rgba(255, 255, 255, 0.5)',
                        borderRadius: '8px',
                        cursor: isValid ? 'pointer' : 'not-allowed',
                        fontWeight: 600,
                        transition: 'all 0.2s'
                    }}
                >
                    Remove PCB
                </button>
            </div>
        </Popup>
    );
}
