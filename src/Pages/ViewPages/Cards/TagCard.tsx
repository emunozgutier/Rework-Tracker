import { useState } from 'react';
import { TagCardHeader } from './TagCardHeader';
import { TagCardBody } from './TagCardBody';

interface TagCardProps {
    tag: any;
    onEdit: (id: number | string) => void;
}

export function TagCard({ tag, onEdit }: TagCardProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    const toggleExpand = () => setIsExpanded(!isExpanded);

    return (
        <div className={`item-card project-card ${isExpanded ? 'active' : ''}`}>
            <TagCardHeader 
                tag={tag} 
                isExpanded={isExpanded} 
                onToggle={toggleExpand} 
                onEdit={onEdit} 
            />
            {isExpanded && <TagCardBody tag={tag} />}
        </div>
    );
}
