import { useState, useEffect, useRef } from 'react';
import { Popup } from '../../components/Popup';
import { useDeleteEditRequirements } from '../../store/useDeleteEditRequirements';

interface RemoveProjectProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    project: any;
}

export function RemoveProject({ isOpen, onClose, onConfirm, project }: RemoveProjectProps) {
    const [inputValue, setInputValue] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const [isFocused, setIsFocused] = useState(false);
    
    const { checkProjectDeleteRequirements } = useDeleteEditRequirements();
    
    useEffect(() => {
        if (isOpen) {
            setInputValue('');
            const timer = setTimeout(() => {
                inputRef.current?.focus();
            }, 80);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    if (!isOpen || !project) return null;

    const expectedText = project.name;
    const cleanInput = inputValue.trim().toLowerCase();
    const isValid = cleanInput === expectedText.trim().toLowerCase();

    // Safety requirements checks from hook
    const { isPcbCountValid, pcbCount, requirementsMet } = checkProjectDeleteRequirements(project);

    const handleConfirm = () => {
        if (isValid && requirementsMet) {
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
            Remove Project
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

    const checkIcon = (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
    );

    const crossIcon = (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
    );

    return (
        <Popup isOpen={isOpen} onClose={onClose} title={titleElement} maxWidth="500px">
            <p style={{ color: 'var(--text-muted)', marginBottom: '20px', lineHeight: '1.6' }}>
                You are about to permanently remove Project <strong style={{ color: 'var(--text)' }}>{project.name}</strong>. This action cannot be undone.
            </p>

            {/* Requirements Display */}
            <div style={{
                background: 'rgba(0, 0, 0, 0.2)',
                padding: '16px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                marginBottom: '20px'
            }}>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 600 }}>Deletion Safety Requirements:</h4>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <li style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem', color: isPcbCountValid ? '#10b981' : '#ef4444' }}>
                        {isPcbCountValid ? checkIcon : crossIcon}
                        <span>
                            No active PCBs assigned ({pcbCount} found)
                        </span>
                    </li>
                </ul>
            </div>

            {!requirementsMet && (
                <div style={{ 
                    color: '#ef4444', 
                    backgroundColor: 'rgba(239, 68, 68, 0.1)', 
                    border: '1px solid rgba(239, 68, 68, 0.2)', 
                    borderRadius: '8px', 
                    padding: '12px 16px', 
                    fontSize: '0.9rem', 
                    marginBottom: '24px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px', 
                    lineHeight: '1.4' 
                }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    <span>This project cannot be deleted because it does not meet all safety requirements.</span>
                </div>
            )}

            {requirementsMet && (
                <div style={{ marginBottom: '24px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text)' }}>
                        Please type <strong style={{ color: 'var(--text)' }}>{expectedText}</strong> to confirm:
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
                            transition: 'border-color 0.2s, box-shadow 0.2s'
                        }}
                    />
                </div>
            )}

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
                    {requirementsMet ? 'Cancel' : 'Close'}
                </button>
                {requirementsMet && (
                    <button
                        onClick={handleConfirm}
                        disabled={!isValid}
                        style={{
                            padding: '10px 20px',
                            background: isValid ? '#ef4444' : 'rgba(239, 68, 68, 0.15)',
                            border: 'none',
                            color: isValid ? '#fff' : 'rgba(255, 255, 255, 0.3)',
                            borderRadius: '8px',
                            cursor: isValid ? 'pointer' : 'not-allowed',
                            fontWeight: 600,
                            transition: 'all 0.2s'
                        }}
                    >
                        Remove Project
                    </button>
                )}
            </div>
        </Popup>
    );
}
