import { ChevronDown, ChevronUp } from 'lucide-react';
import { BoardName } from '../../../components/BoardName';
import { useAppState } from '../../../store/useAppState';

interface PcbCardHeaderProps {
    pcb: any;
    isExpanded: boolean;
    onToggle: () => void;
    hideActions?: boolean;
}

export function PcbCardHeader({ pcb, isExpanded, onToggle, hideActions }: PcbCardHeaderProps) {
    const { isMobile } = useAppState();
    return (
        <div 
            className="card-header-main" 
            onClick={onToggle}
            style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', padding: '12px 16px', gap: '12px' }}
        >
            <div style={{ display: 'flex', flex: 1, flexWrap: 'wrap', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                <span className="board-num" style={{ margin: 0, whiteSpace: 'nowrap' }}><BoardName name={pcb.board_number} isHex={pcb.number_format === 'hex'} /></span>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', fontSize: '0.85rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.03)', padding: '4px 10px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <span style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>{(pcb.product || 'No Rev').replace('No part yet', 'No part')}</span>
                    {pcb.bom && <><span style={{ opacity: 0.5 }}>•</span><span style={{ whiteSpace: 'nowrap' }}>{pcb.bom}</span></>}
                    {!isMobile && (
                        <>
                            <span style={{ opacity: 0.5 }}>•</span>
                            <span style={{ whiteSpace: 'nowrap' }}>{pcb.owner_username ? `@${pcb.owner_username}` : (pcb.owner || 'Unassigned')}</span>
                        </>
                    )}
                </div>
            </div>

            {!hideActions && (
                <div className="expand-indicator" style={{ display: 'flex', position: 'static', transform: 'none', flexShrink: 0, marginTop: '2px' }}>
                    {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </div>
            )}
        </div>
    );
}
