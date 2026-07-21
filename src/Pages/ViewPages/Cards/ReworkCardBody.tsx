import { useState } from 'react';
import { PictureCard } from './PictureCard';
import { useAppState } from '../../../store/useAppState';
import { useReworkStore } from '../../../store/useReworkStore';
import { usePcbStore } from '../../../store/usePcbStore';
import { EditButton, DeleteButton } from '../../../components/forms/ActionButtons';
import { COLORS } from '../../../store/useStyles';
import { RemoveRework } from '../../RemovePage/RemoveRework';
import { useDeleteEditRequirements } from '../../../store/useDeleteEditRequirements';

interface ReworkCardBodyProps {
    rework: any;
}

export function ReworkCardBody({ rework }: ReworkCardBodyProps) {
    const [showGallery, setShowGallery] = useState(false);
    const [showDescriptionModal, setShowDescriptionModal] = useState(false);
    const [isRemoveOpen, setIsRemoveOpen] = useState(false);
    const { deleteRework } = useReworkStore();
    const { editItem, isMobile } = useAppState();
    const { checkReworkEditRequirements } = useDeleteEditRequirements();

    const confirmRemoveRework = async () => {
        const success = await deleteRework(rework.id);
        if (success) {
            usePcbStore.getState().fetchPcbs();
        } else {
            const currentError = useReworkStore.getState().error;
            alert(currentError || "Failed to delete rework log.");
        }
    };


    let imagePaths: string[] = [];
    if (rework.image_path) {
        try {
            imagePaths = JSON.parse(rework.image_path);
        } catch (e) {
            imagePaths = [rework.image_path];
        }
    }

    return (
        <div className="card-expanded-content" style={{ marginTop: '6px', paddingTop: '6px' }}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                <EditButton 
                    onClick={(e) => { 
                        e.stopPropagation(); 
                        const { requirementsMet, daysOld } = checkReworkEditRequirements(rework);
                        if (!requirementsMet) {
                            alert(`This rework log is older than 2 weeks (Age: ${daysOld.toFixed(1)} days) and cannot be edited.`);
                            return;
                        }
                        editItem('reworks_edit', rework.id); 
                    }}
                    label={isMobile ? "Edit" : "Edit Rework"}
                />
                <DeleteButton 
                    onClick={(e) => { e.stopPropagation(); setIsRemoveOpen(true); }}
                    label={isMobile ? "Delete" : "Delete Rework"}
                />
            </div>

            <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0, width: '100%' }}>
                    
                    <div className="rework-body-row">
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: isMobile ? '8px' : '16px',
                            width: '100%',
                            justifyContent: 'space-between',
                            minWidth: 0
                        }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', justifyContent: 'center', width: isMobile ? '100%' : '115px', flex: '1 1 0', minWidth: 0 }}>
                                <span style={{ fontSize: '0.9rem', color: 'var(--text)', fontWeight: 600 }}>
                                    {new Date(rework.timestamp).toLocaleDateString()}
                                </span>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                    {new Date(rework.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>

                            <div className="rework-body-divider"></div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', justifyContent: 'center', width: isMobile ? '100%' : '115px', flex: '1 1 0', minWidth: 0 }}>
                                <div style={{ 
                                    display: 'inline-flex', 
                                    alignItems: 'center', 
                                    justifyContent: 'center',
                                    padding: '4px 12px', 
                                    background: rework.rework_type === 'Major' ? 'rgba(239, 68, 68, 0.1)' 
                                              : rework.rework_type === 'Silicon Swap' ? COLORS.purpleLight 
                                    : rework.rework_type === 'Resistor Option Swap' || rework.rework_type === 'Resistor Swap' || rework.rework_type === 'R swap' ? COLORS.orangeLight
                                              : 'rgba(59, 130, 246, 0.1)', 
                                    color: rework.rework_type === 'Major' ? '#ef4444' 
                                         : rework.rework_type === 'Silicon Swap' ? COLORS.purple 
                                         : rework.rework_type === 'Resistor Option Swap' || rework.rework_type === 'Resistor Swap' || rework.rework_type === 'R swap' ? COLORS.orange
                                         : '#3b82f6', 
                                    borderRadius: '16px', 
                                    fontSize: '0.75rem', 
                                    fontWeight: 700,
                                    border: `1px solid ${
                                        rework.rework_type === 'Major' ? 'rgba(239, 68, 68, 0.2)' 
                                      : rework.rework_type === 'Silicon Swap' ? COLORS.purpleDark 
                                      : rework.rework_type === 'Resistor Option Swap' || rework.rework_type === 'Resistor Swap' || rework.rework_type === 'R swap' ? COLORS.orangeDark
                                      : 'rgba(59, 130, 246, 0.2)'
                                    }`,
                                    whiteSpace: 'nowrap',
                                    alignSelf: 'flex-start'
                                }}>
                                    {rework.rework_type === 'Resistor Option Swap' || rework.rework_type === 'Resistor Swap' || rework.rework_type === 'R swap' ? 'R swap' : (rework.rework_type || 'Minor')}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: '6px' }}>
                                    <span style={{ 
                                        background: 'rgba(255, 255, 255, 0.1)',
                                        color: 'var(--text)',
                                        padding: '2px 8px',
                                        borderRadius: '12px',
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                        border: '1px solid rgba(255, 255, 255, 0.15)',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        whiteSpace: 'nowrap',
                                        textOverflow: 'ellipsis',
                                        overflow: 'hidden',
                                        width: '100%',
                                        boxSizing: 'border-box'
                                    }}>
                                        @{rework.owner_username || rework.owner_name || rework.owner || 'System'}
                                    </span>
                                </div>
                            </div>

                            <div className="rework-body-divider"></div>

                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: isMobile ? '100%' : '115px', flex: '1 1 0', minWidth: 0, flexShrink: 0 }}>
                                {imagePaths.length > 0 ? (
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); setShowGallery(true); }}
                                        style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            gap: '6px',
                                            background: 'rgba(99, 102, 241, 0.08)',
                                            border: '1px solid rgba(99, 102, 241, 0.25)',
                                            color: '#818cf8',
                                            padding: '8px 12px',
                                            borderRadius: '8px',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                            width: '100%',
                                            boxSizing: 'border-box'
                                        }}
                                        className="action-btn-hover"
                                        title="Click to view photos"
                                    >
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                            <circle cx="8.5" cy="8.5" r="1.5"></circle>
                                            <polyline points="21 15 16 10 5 21"></polyline>
                                        </svg>
                                        <span style={{ fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                                            {imagePaths.length} Photo{imagePaths.length !== 1 ? 's' : ''}
                                        </span>
                                    </button>
                                ) : (
                                    <div style={{ width: '100%' }} />
                                )}
                            </div>
                        </div>

                        <div className="rework-body-divider mobile-hide"></div>

                        <div className="rework-description-col">
                            {rework.description && rework.description.trim() ? (
                                <p 
                                    style={{ 
                                        margin: 0, 
                                        fontSize: '0.85rem', 
                                        color: 'var(--text)', 
                                        display: '-webkit-box',
                                        WebkitLineClamp: 3,
                                        WebkitBoxOrient: 'vertical',
                                        overflow: 'hidden',
                                        whiteSpace: 'pre-wrap',
                                        wordBreak: 'break-word',
                                        cursor: 'pointer',
                                        transition: 'color 0.2s',
                                        maxWidth: '100%'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent)'}
                                    onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text)'}
                                    onClick={(e) => { e.stopPropagation(); setShowDescriptionModal(true); }}
                                    title="Click to view full description"
                                >
                                    {rework.description}
                                </p>
                            ) : (
                                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No Description</span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {showDescriptionModal && rework.description && (
                <div style={{
                    position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.75)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: '24px'
                }} onClick={() => setShowDescriptionModal(false)}>
                    <div style={{
                        backgroundColor: '#1e293b',
                        border: '1px solid var(--border)',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75)',
                        borderRadius: '12px',
                        padding: '24px',
                        maxWidth: '500px',
                        width: '100%',
                        position: 'relative',
                        cursor: 'default'
                    }} onClick={(e) => e.stopPropagation()}>
                        <button
                            onClick={() => setShowDescriptionModal(false)}
                            style={{
                                position: 'absolute', top: '16px', right: '16px',
                                background: 'rgba(255,255,255,0.05)', border: 'none', color: 'var(--text-muted)',
                                cursor: 'pointer', padding: '6px', borderRadius: '50%',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s'
                            }}
                            onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
                            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                        <h3 style={{ margin: '0 0 16px 0', fontSize: '1.2rem', color: 'var(--text)', fontWeight: 600 }}>Rework Description</h3>
                        <div style={{ maxHeight: '60vh', overflowY: 'auto', paddingRight: '8px' }}>
                            <p style={{ margin: 0, fontSize: '0.95rem', color: 'var(--text)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: '1.6' }}>
                                {rework.description}
                            </p>
                        </div>
                    </div>
                </div>
            )}
            {showGallery && imagePaths.length > 0 && (
                <PictureCard 
                    images={imagePaths} 
                    title={`${rework.board_number || rework.pcb_board_number || 'UNKNOWN'}-R${String(rework.rework_number || rework.id).padStart(3, '0')}`} 
                    onClose={() => setShowGallery(false)} 
                />
            )}
            <RemoveRework
                isOpen={isRemoveOpen}
                onClose={() => setIsRemoveOpen(false)}
                onConfirm={confirmRemoveRework}
                rework={rework}
            />
        </div>
    );
}
