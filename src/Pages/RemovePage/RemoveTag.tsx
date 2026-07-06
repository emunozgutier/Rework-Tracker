import { useState, useEffect, useRef } from 'react';
import { BoardName } from '../../components/BoardName';
import { Popup } from '../../components/Popup';

interface RemoveTagProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    tag: any;
    pcb: any;
}

export function RemoveTag({ isOpen, onClose, onConfirm, tag, pcb }: RemoveTagProps) {
    const [inputValue, setInputValue] = useState('');
    const [isFocused, setIsFocused] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    
    useEffect(() => {
        if (isOpen) {
            setInputValue('');
            const timer = setTimeout(() => {
                inputRef.current?.focus();
            }, 80);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    if (!isOpen || !tag || !pcb) return null;

    const expectedText = `${tag.name}-${pcb.board_number}`;
    const cleanInput = inputValue.trim().toLowerCase();
    const isValid = cleanInput === expectedText.trim().toLowerCase();

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
            Remove Tag
        </h2>
    );

    let borderStyle = '1px solid var(--border)';
    let boxShadowStyle = 'none';
    
    if (inputValue) {
        if (isValid) {
            borderStyle = '1px solid #10b981';
            boxShadowStyle = '0 0 10px rgba(16, 185, 129, 0.3)';
        } else {
            borderStyle = '1px solid #ef4444';
            boxShadowStyle = '0 0 10px rgba(239, 68, 68, 0.3)';
        }
    } else if (isFocused) {
        borderStyle = '1px solid var(--accent)';
        boxShadowStyle = '0 0 0 2px rgba(99, 102, 241, 0.2)';
    }

    return (
        <Popup isOpen={isOpen} onClose={onClose} title={titleElement} maxWidth="500px">
            <p style={{ color: 'var(--text-muted)', marginBottom: '24px', lineHeight: '1.6' }}>
                You are about to permanently remove the tag <strong style={{color: 'var(--text)'}}>{tag.name}</strong> from PCB <span className="board-num" style={{ fontWeight: 700, color: 'var(--text)' }}><BoardName name={pcb.board_number} isHex={pcb.number_format === 'hex'} /></span>. This action cannot be undone.
            </p>

            <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text)' }}>
                    Please type <strong>{expectedText}</strong> to confirm:
                </label>
                <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && isValid) {
                            handleConfirm();
                        }
                    }}
                    placeholder={expectedText}
                    style={{
                        width: '100%',
                        padding: '12px 16px',
                        borderRadius: '8px',
                        border: borderStyle,
                        boxShadow: boxShadowStyle,
                        background: 'rgba(255, 255, 255, 0.05)',
                        color: 'var(--text)',
                        fontSize: '1rem',
                        outline: 'none',
                        fontFamily: 'monospace',
                        transition: 'border-color 0.2s, box-shadow 0.2s'
                    }}
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
                    Remove Tag
                </button>
            </div>
        </Popup>
    );
}
