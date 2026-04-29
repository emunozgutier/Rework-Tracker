import { ChevronDown, ChevronUp } from 'lucide-react';
import { useStore } from '../../store/useStore';

interface ReworkCardHeaderProps {
    rework: any;
    isExpanded: boolean;
    onToggle: () => void;
    showFullTitle?: boolean;
}

export function ReworkCardHeader({ rework, isExpanded, onToggle, showFullTitle = false }: ReworkCardHeaderProps) {
    const { isMobile } = useStore();

    const shortName = showFullTitle 
        ? `${rework.board_number || rework.pcb_board_number || 'UNKNOWN'}-R${String(rework.rework_number || rework.id).padStart(3, '0')}`
        : `R${String(rework.rework_number || rework.id).padStart(3, '0')}`;

    return (
        <div 
            className="card-header-main" 
            onClick={onToggle}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', gap: '12px', minWidth: 0, width: '100%' }}
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, width: '100%' }}>
                    <span className="board-num" style={{ flexShrink: 0, margin: 0, whiteSpace: 'nowrap', color: 'var(--accent)', fontWeight: 'bold' }}>
                        {shortName}
                    </span>
                    <span style={{ 
                        flexShrink: 0,
                        padding: '2px 8px', 
                        borderRadius: '12px', 
                        fontSize: '0.75rem', 
                        fontWeight: 600,
                        background: rework.rework_type === 'Major' ? 'rgba(239, 68, 68, 0.15)' : rework.rework_type === 'Silicon Swap' ? 'rgba(168, 85, 247, 0.15)' : rework.rework_type === 'Resistor Option Swap' || rework.rework_type === 'Resistor Swap' ? 'rgba(249, 115, 22, 0.15)' : 'rgba(99, 102, 241, 0.15)',
                        color: rework.rework_type === 'Major' ? '#ef4444' : rework.rework_type === 'Silicon Swap' ? '#a855f7' : rework.rework_type === 'Resistor Option Swap' || rework.rework_type === 'Resistor Swap' ? '#f97316' : '#818cf8',
                        border: `1px solid ${rework.rework_type === 'Major' ? 'rgba(239, 68, 68, 0.4)' : rework.rework_type === 'Silicon Swap' ? 'rgba(168, 85, 247, 0.4)' : rework.rework_type === 'Resistor Option Swap' || rework.rework_type === 'Resistor Swap' ? 'rgba(249, 115, 22, 0.4)' : 'rgba(99, 102, 241, 0.4)'}`
                    }}>
                        {rework.rework_type === 'Resistor Option Swap' ? 'Resistor Swap' : (rework.rework_type || 'Minor')}
                    </span>
                    {rework.title && !isMobile && (
                        <span style={{ 
                            flexShrink: 1, 
                            minWidth: 0,
                            whiteSpace: 'nowrap', 
                            overflow: 'hidden', 
                            textOverflow: 'ellipsis',
                            color: 'var(--text-muted)'
                        }}>
                            {rework.title}
                        </span>
                    )}
                </div>
                {rework.title && isMobile && (
                    <div style={{ 
                        color: 'var(--text-muted)', 
                        fontSize: '0.85rem', 
                        whiteSpace: 'nowrap', 
                        overflow: 'hidden', 
                        textOverflow: 'ellipsis', 
                        width: '100%',
                        textAlign: 'left'
                    }}>
                        {rework.title}
                    </div>
                )}
            </div>

            <div className="expand-indicator" style={{ display: 'flex', position: 'static', transform: 'none', flexShrink: 0 }}>
                {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </div>
        </div>
    );
}
