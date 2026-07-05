import React from 'react';

import { useStore } from '../../store/useStore';

interface PcbFilterElementProps {
    title: string;
    value: string[];
    onChange: (selected: string[]) => void;
    width?: string;
    children: React.ReactNode;
}

export function PcbFilterElement({ title, value, onChange, width = 'auto', children }: PcbFilterElementProps) {
    const isMobile = useStore(state => state.isMobile);
    const [isElementExpanded, setIsElementExpanded] = React.useState(false);

    if (isMobile) {
        const activeCount = value ? value.length : 0;
        return (
            <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                width: '100%', 
                border: '1px solid rgba(255,255,255,0.05)',
                borderRadius: '6px',
                background: 'rgba(255,255,255,0.01)',
                boxSizing: 'border-box'
            }}>
                <button
                    onClick={(e) => { e.stopPropagation(); setIsElementExpanded(!isElementExpanded); }}
                    style={{
                        width: '100%',
                        padding: '10px 12px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text)',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        cursor: 'pointer'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: 'var(--text-muted)' }}>{title}</span>
                        {activeCount > 0 && (
                            <span style={{ color: 'var(--accent)', fontWeight: 700, fontSize: '0.85rem' }}>
                                #{activeCount}
                            </span>
                        )}
                    </div>
                    <span style={{ 
                        transition: 'transform 0.2s', 
                        transform: isElementExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                        color: 'var(--text-muted)',
                        display: 'flex',
                        alignItems: 'center'
                    }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    </span>
                </button>

                {isElementExpanded && (
                    <div style={{
                        padding: '8px 12px',
                        borderTop: '1px solid rgba(255,255,255,0.05)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        maxHeight: '180px',
                        overflowY: 'auto',
                        backgroundColor: 'rgba(0,0,0,0.15)',
                        boxSizing: 'border-box'
                    }}>
                        {React.Children.map(children, (child: any) => {
                            if (!child) return null;
                            const optionValue = child.props.value;
                            const isSelected = value.includes(optionValue);
                            return (
                                <div 
                                    onClick={(e) => {
                                        e.preventDefault();
                                        let newVal = [...value];
                                        if (isSelected) {
                                            newVal = newVal.filter(v => v !== optionValue);
                                        } else {
                                            newVal.push(optionValue);
                                        }
                                        onChange(newVal);
                                    }}
                                    style={{
                                        padding: '6px 8px',
                                        borderRadius: '4px',
                                        fontSize: '0.85rem',
                                        cursor: 'pointer',
                                        backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                                        color: isSelected ? 'var(--accent)' : 'var(--text)',
                                        userSelect: 'none',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        gap: '8px'
                                    }}
                                >
                                    <span style={{
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis'
                                    }}>
                                        {child.props.children}
                                    </span>
                                    <div style={{
                                        width: '16px',
                                        height: '16px',
                                        border: `1.5px solid ${isSelected ? 'var(--accent)' : 'var(--text-muted)'}`,
                                        borderRadius: '3px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        backgroundColor: isSelected ? 'var(--accent)' : 'transparent',
                                        flexShrink: 0
                                    }}>
                                        {isSelected && (
                                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="20 6 9 17 4 12"></polyline>
                                            </svg>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                        {value && value.length > 0 && (
                            <button 
                                onClick={() => onChange([])}
                                style={{ 
                                    background: 'none', 
                                    border: 'none', 
                                    color: 'var(--accent)', 
                                    fontSize: '0.75rem', 
                                    cursor: 'pointer',
                                    padding: '8px 0 4px 8px',
                                    alignSelf: 'flex-start',
                                    fontWeight: 600
                                }}
                            >
                                Clear All
                            </button>
                        )}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: width, minWidth: '110px', flexShrink: 0 }}>
            <span style={{ 
                fontSize: '0.85rem', 
                fontWeight: 600, 
                color: 'var(--text-muted)',
                whiteSpace: 'normal',
                wordBreak: 'break-word',
                minHeight: '2.4em',
                lineHeight: 1.2
            }}>
                {title}
            </span>
            <select 
                multiple 
                value={value}
                onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions, option => option.value);
                    onChange(selected);
                }}
                style={{ 
                    width: '100%', 
                    height: '140px', 
                    padding: '6px', 
                    borderRadius: '4px', 
                    backgroundColor: 'var(--bg-panel)', 
                    border: '1px solid var(--border-color)', 
                    color: 'var(--text)', 
                    outline: 'none',
                    fontFamily: 'inherit',
                    fontSize: '0.9rem'
                }}
            >
                {children}
            </select>
            <button 
                onClick={() => onChange([])}
                style={{ 
                    background: 'none', 
                    border: 'none', 
                    color: 'var(--accent)', 
                    fontSize: '0.75rem', 
                    cursor: value && value.length > 0 ? 'pointer' : 'default',
                    padding: '2px 0 0 0',
                    alignSelf: 'flex-start',
                    fontWeight: 500,
                    visibility: value && value.length > 0 ? 'visible' : 'hidden'
                }}
                disabled={!value || value.length === 0}
            >
                Clear
            </button>
        </div>
    );
}
