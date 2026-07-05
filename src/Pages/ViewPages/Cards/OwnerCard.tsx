import { useState } from 'react';
import { OwnerCardHeader } from './OwnerCardHeader';
import { OwnerCardBody } from './OwnerCardBody';

interface OwnerCardProps {
    owner: any;
    onEdit: (id: number | string) => void;
}

export function OwnerCard({ owner, onEdit }: OwnerCardProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    const toggleExpand = () => setIsExpanded(!isExpanded);

    return (
        <div className={`item-card project-card ${isExpanded ? 'active' : ''}`}>
            <OwnerCardHeader 
                owner={owner} 
                isExpanded={isExpanded} 
                onToggle={toggleExpand} 
                onEdit={onEdit} 
            />
            {isExpanded && <OwnerCardBody owner={owner} />}
        </div>
    );
}
