import { useEffect, useRef } from 'react';
import { PcbCardHeader } from './PcbCardHeader';
import { PcbCardBody } from './PcbCardBody';
import { useAppState } from '../../../store/useAppState';

interface PcbCardProps {
    pcb: any;
}

export function PcbCard({ pcb }: PcbCardProps) {
    const { expandedPcb, setExpandedPcb } = useAppState();
    const isExpanded = expandedPcb === pcb.board_number;
    const cardRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isExpanded && cardRef.current) {
            setTimeout(() => {
                cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
        }
    }, [isExpanded]);

    const handleToggle = () => {
        if (isExpanded) {
            setExpandedPcb(null);
        } else {
            setExpandedPcb(pcb.board_number);
        }
    };

    return (
        <div ref={cardRef} className={`item-card project-card ${isExpanded ? 'active' : ''}`}>
            <PcbCardHeader 
                pcb={pcb} 
                isExpanded={isExpanded} 
                onToggle={handleToggle} 
            />
            {isExpanded && <PcbCardBody pcb={pcb} />}
        </div>
    );
}
