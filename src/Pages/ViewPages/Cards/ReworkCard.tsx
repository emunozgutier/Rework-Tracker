import { ReworkCardHeader } from './ReworkCardHeader';
import { ReworkCardBody } from './ReworkCardBody';
import { useAppState } from '../../../store/useAppState';

interface ReworkCardProps {
    rework: any;
}

export function ReworkCard({ rework }: ReworkCardProps) {
    const { expandedRework, setExpandedRework } = useAppState();
    const isExpanded = expandedRework === rework.id.toString();

    const handleToggle = () => {
        if (isExpanded) {
            setExpandedRework(null);
        } else {
            setExpandedRework(rework.id.toString());
        }
    };

    return (
        <div className={`item-card project-card ${isExpanded ? 'active' : ''}`}>
            <ReworkCardHeader 
                rework={rework} 
                isExpanded={isExpanded} 
                onToggle={handleToggle} 
                showFullTitle={true}
            />
            {isExpanded && <ReworkCardBody rework={rework} />}
        </div>
    );
}
