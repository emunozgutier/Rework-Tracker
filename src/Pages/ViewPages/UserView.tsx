import { useEffect } from 'react';
import { Plus } from 'lucide-react';
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
            <div className="list-header" style={{ flexWrap: 'wrap', gap: '16px' }}>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <h2 style={{ margin: 0 }}>{title}</h2>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <button className="add-button" onClick={onAdd}>
                        <Plus size={18} />
                        <span>Add New</span>
                    </button>
                </div>
            </div>

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
