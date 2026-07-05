import { ChevronDown, ChevronUp, Edit2 } from 'lucide-react';
import { formatTagName } from '../../../store/storeTag';

interface TagCardHeaderProps {
    tag: any;
    isExpanded: boolean;
    onToggle: () => void;
    onEdit: (id: number | string) => void;
}

export function TagCardHeader({ tag, isExpanded, onToggle, onEdit }: TagCardHeaderProps) {
    return (
        <div 
            className="card-header-main" 
            onClick={onToggle}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', width: '100%', cursor: 'pointer' }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button 
                    className="edit-button" 
                    onClick={(e) => { e.stopPropagation(); onEdit(tag.id); }}
                    style={{ background: 'none', border: 'none', padding: 0, margin: 0, display: 'flex', alignItems: 'center', cursor: 'pointer', position: 'static' }}
                    title="Edit Tag"
                >
                    <Edit2 size={16} />
                </button>
                <div 
                    style={{ 
                        width: 14, height: 14, borderRadius: '4px', 
                        backgroundColor: tag.color || '#818cf8',
                        boxShadow: `0 0 10px ${tag.color || '#818cf8'}40`,
                        flexShrink: 0
                    }} 
                />
                <span className="board-num" style={{ fontSize: '1rem', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                    {tag.type === 'public' 
                        ? formatTagName(tag) 
                        : (tag.owner_username || tag.owner_name ? formatTagName(tag) : `Unassigned/${formatTagName(tag)}`)}
                </span>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ 
                    backgroundColor: 'rgba(255, 255, 255, 0.05)', 
                    border: '1px solid rgba(255, 255, 255, 0.1)', 
                    padding: '4px 12px', 
                    borderRadius: '16px', 
                    display: 'flex', 
                    gap: '6px',
                    alignItems: 'center',
                    color: 'var(--text-muted)',
                    fontSize: '0.85rem'
                }}>
                    <span style={{ fontWeight: 600, color: 'var(--text)' }}>{tag.pcb_count || 0}</span>
                    <span>PCBs</span>
                </div>
                <div className="expand-indicator" style={{ display: 'flex', position: 'static', transform: 'none' }}>
                    {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </div>
            </div>
        </div>
    );
}
