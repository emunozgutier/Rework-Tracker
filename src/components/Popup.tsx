import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface PopupProps {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
    title?: string | React.ReactNode;
    maxWidth?: string;
}

export function Popup({ isOpen, onClose, children, title, maxWidth = '500px' }: PopupProps) {
    // Close on escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        if (isOpen) {
            window.addEventListener('keydown', handleKeyDown);
            // Prevent body scroll when modal is open
            document.body.style.overflow = 'hidden';
        }

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = '';
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return createPortal(
        <div 
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(15, 23, 42, 0.85)',
                backdropFilter: 'blur(4px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 9999,
                padding: '24px'
            }}
            onClick={onClose}
        >
            <div 
                className="item-card"
                style={{
                    background: '#1e293b',
                    border: '1px solid var(--border)',
                    borderRadius: '16px',
                    padding: '32px',
                    maxWidth: maxWidth,
                    width: '100%',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75)',
                    position: 'relative',
                    cursor: 'default'
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Close Button */}
                <button 
                    onClick={onClose}
                    style={{
                        position: 'absolute',
                        top: '16px',
                        right: '16px',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid var(--border)',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                        padding: '8px',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s ease',
                        outline: 'none'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.color = '#fff';
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.color = 'var(--text-muted)';
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                    }}
                    title="Close"
                >
                    <X size={18} />
                </button>

                {title && (
                    <div style={{ margin: '0 0 20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {typeof title === 'string' ? (
                            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: 'var(--text)' }}>
                                {title}
                            </h2>
                        ) : title}
                    </div>
                )}

                {children}
            </div>
        </div>,
        document.body
    );
}
