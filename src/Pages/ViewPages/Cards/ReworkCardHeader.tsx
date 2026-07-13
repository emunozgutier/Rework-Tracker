import { ChevronDown, ChevronUp } from 'lucide-react';
import { useStore } from '../../../store/useStore';
import { usePcbStore } from '../../../store/usePcbStore';
import { COLORS } from '../../../store/useStyles';

import { BoardName } from '../../../components/BoardName';

interface ReworkCardHeaderProps {
    rework: any;
    isExpanded: boolean;
    onToggle: () => void;
    showFullTitle?: boolean;
}

export function ReworkCardHeader({ rework, isExpanded, onToggle, showFullTitle = false }: ReworkCardHeaderProps) {
    const { isMobile } = useStore();
    const { pcbs } = usePcbStore();

    const parentPcb = pcbs.find(p => p.id === rework.pcb_id);
    const resolvedBoardName = parentPcb ? parentPcb.board_number : (rework.board_number || rework.pcb_board_number || 'UNKNOWN');

    const reworkSuffix = `R${String(rework.rework_number || rework.id).padStart(3, '0')}`;

    return (
        <div 
            className="card-header-main" 
            onClick={onToggle}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', gap: '12px', minWidth: 0, width: '100%' }}
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, width: '100%' }}>
                    <span className="board-num" style={{ flexShrink: 0, margin: 0, whiteSpace: 'nowrap' }}>
                        {showFullTitle ? (
                            <>
                                <BoardName name={resolvedBoardName} />
                                <span style={{ color: COLORS.purple, fontWeight: 'bold' }}>-{reworkSuffix}</span>
                            </>
                        ) : (
                            <span style={{ color: COLORS.purple, fontWeight: 'bold' }}>{reworkSuffix}</span>
                        )}
                    </span>
                    <span style={{ 
                        flexShrink: 0,
                        padding: '2px 8px', 
                        borderRadius: '12px', 
                        fontSize: '0.75rem', 
                        fontWeight: 600,
                        background: rework.rework_type === 'Major' ? COLORS.redLight : rework.rework_type === 'Silicon Swap' ? COLORS.purpleMedium : rework.rework_type === 'Resistor Option Swap' || rework.rework_type === 'Resistor Swap' || rework.rework_type === 'R swap' ? COLORS.orangeMedium : COLORS.indigoLight,
                        color: rework.rework_type === 'Major' ? COLORS.red : rework.rework_type === 'Silicon Swap' ? COLORS.purple : rework.rework_type === 'Resistor Option Swap' || rework.rework_type === 'Resistor Swap' || rework.rework_type === 'R swap' ? COLORS.orange : COLORS.indigo,
                        border: `1px solid ${rework.rework_type === 'Major' ? COLORS.redBorder : rework.rework_type === 'Silicon Swap' ? COLORS.purpleBorder : rework.rework_type === 'Resistor Option Swap' || rework.rework_type === 'Resistor Swap' || rework.rework_type === 'R swap' ? COLORS.orangeBorder : COLORS.indigoBorder}`
                    }}>
                        {rework.rework_type === 'Resistor Option Swap' || rework.rework_type === 'Resistor Swap' || rework.rework_type === 'R swap' ? 'R swap' : (rework.rework_type || 'Minor')}
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
