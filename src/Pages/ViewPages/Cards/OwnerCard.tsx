import { OwnerCardHeader } from './OwnerCardHeader';

interface OwnerCardProps {
    owner: any;
    onEdit: (id: number | string) => void;
}

export function OwnerCard({ owner, onEdit }: OwnerCardProps) {
    return (
        <div className="item-card project-card">
            <OwnerCardHeader 
                owner={owner} 
                onEdit={onEdit} 
            />
        </div>
    );
}
