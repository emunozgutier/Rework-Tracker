import { useEffect } from 'react';
import { TopButtons } from '../../components/TopButtons';
import { ReworkCard } from './Cards/ReworkCard';
import { useReworkStore } from '../../store/storeRework';

interface ReworkViewProps {
    title: string;
    onAdd: () => void;
}

export function ReworkView({ title, onAdd }: ReworkViewProps) {
    const { reworks, loading: reworksLoading, fetchReworks, selectedBoards, setSelectedBoards } = useReworkStore();

    useEffect(() => {
        fetchReworks();
    }, [fetchReworks]);

    let items = reworks;
    if (selectedBoards && selectedBoards.length > 0) {
        items = items.filter(rw => selectedBoards.includes(rw.pcb_id.toString()));
    }

    if (reworksLoading) return <div className="loading">Loading {title}...</div>;

    return (
        <div className="card-list-container">
            <TopButtons
                title={title}
                onAdd={onAdd}
            />
            
            {selectedBoards && selectedBoards.length > 0 && (
                <div style={{ marginBottom: '24px', padding: '12px', backgroundColor: 'rgba(99, 102, 241, 0.1)', border: '1px solid var(--accent)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--accent)', fontWeight: 500 }}>
                        Filtered by Board ID: {selectedBoards.join(', ')}
                    </span>
                    <button 
                        onClick={() => setSelectedBoards([])}
                        style={{ padding: '6px 12px', backgroundColor: 'transparent', border: '1px solid var(--accent)', borderRadius: '4px', color: 'var(--accent)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500 }}
                    >
                        Clear Filter
                    </button>
                </div>
            )}

            <div className="cards-grid single-column">
                {items.length === 0 ? (
                    <div className="empty-state">No reworks found.</div>
                ) : (
                    items.map((item) => (
                        <ReworkCard key={item.id} rework={item} />
                    ))
                )}
            </div>
        </div>
    );
}
