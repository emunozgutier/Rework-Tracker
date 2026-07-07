import { useEffect } from 'react';
import { TopButtons } from '../../components/TopButtons';
import { OwnerCard } from './Cards/OwnerCard';
import { useOwnerStore } from '../../store/storeOwner';

interface UserViewProps {
    title: string;
    onAdd: () => void;
    onEdit: (id: string | number) => void;
}

export function UserView({ title, onAdd, onEdit }: UserViewProps) {
    const { owners, loading: ownersLoading, fetchOwners } = useOwnerStore();

    useEffect(() => {
        fetchOwners();
    }, [fetchOwners]);

    if (ownersLoading) return <div className="loading">Loading {title}...</div>;

    return (
        <div className="card-list-container">
            <TopButtons
                title={title}
                onAdd={onAdd}
            />

            <div className="cards-grid single-column">
                {owners.length === 0 ? (
                    <div className="empty-state">No owners found.</div>
                ) : (
                    owners.map((item) => (
                        <OwnerCard key={item.id} owner={item} onEdit={onEdit} />
                    ))
                )}
            </div>
        </div>
    );
}
