import { Edit2, ChevronDown, ChevronUp } from 'lucide-react';
import { useAppState } from '../../../store/useAppState';

interface OwnerCardHeaderProps {
    owner: any;
    isExpanded: boolean;
    onToggle: () => void;
    onEdit: (id: number | string) => void;
}

export function OwnerCardHeader({ owner, isExpanded, onToggle, onEdit }: OwnerCardHeaderProps) {
    const isMobile = useAppState(state => state.isMobile);

    return (
        <div 
            className="card-header-main" 
            onClick={onToggle}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', width: '100%', cursor: 'pointer' }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button 
                    className="edit-button" 
                    onClick={(e) => { e.stopPropagation(); onEdit(owner.id); }}
                    style={{ background: 'none', border: 'none', padding: 0, margin: 0, display: 'flex', alignItems: 'center', cursor: 'pointer', position: 'static' }}
                    title="Edit Owner"
                >
                    <Edit2 size={16} />
                </button>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--text)', margin: 0, fontFamily: 'monospace' }}>
                            {owner.username ? `@${owner.username}` : 'No username'}
                        </span>
                        {owner.superuser === 1 && (
                            <span style={{
                                padding: '2px 8px',
                                fontSize: '0.7rem',
                                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(168, 85, 247, 0.2) 100%)',
                                color: '#a855f7',
                                border: '1px solid rgba(168, 85, 247, 0.4)',
                                borderRadius: '20px',
                                fontWeight: 600,
                                letterSpacing: '0.05em',
                                textTransform: 'uppercase',
                                boxShadow: '0 2px 4px rgba(168, 85, 247, 0.1)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                            }}>
                                ✦ Superuser
                            </span>
                        )}
                        {(!isMobile && owner.name) && (
                            <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }} title={owner.name}>
                                {owner.name && owner.name.length > 20 ? `${owner.name.substring(0, 20)}...` : owner.name}
                            </span>
                        )}
                    </div>
                    {(!isMobile && owner.email) && (
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {owner.email}
                        </span>
                    )}
                </div>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div className="pcb-mini-list" style={{ gap: '6px' }}>
                    <span className="pcb-pill" style={{ padding: '2px 8px', fontSize: '0.75rem', borderColor: 'var(--accent)', color: 'var(--accent)' }}>
                        {owner.pcb_count || 0} PCBs
                    </span>
                </div>
                <div className="expand-indicator" style={{ display: 'flex', position: 'static', transform: 'none' }}>
                    {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </div>
            </div>
        </div>
    );
}
