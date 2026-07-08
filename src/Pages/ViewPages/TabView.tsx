import { useEffect } from 'react';
import { TagCard } from './Cards/TagCard';

import { useTagStore } from '../../store/storeTag';
import { useStore } from '../../store/useStore';

interface TabViewProps {
    title: string;
    onAdd: () => void;
    onEdit: (id: string | number) => void;
}

export function TabView({ title, onEdit }: TabViewProps) {
    const { tags, loading: tagsLoading, fetchTags } = useTagStore();
    const { searchQuery } = useStore();

    useEffect(() => {
        fetchTags();
    }, [fetchTags]);

    let items = tags;

    if (searchQuery) {
        const sq = searchQuery.toLowerCase();
        items = items.filter(tag => tag.name.toLowerCase().includes(sq));
    }

    if (tagsLoading && tags.length === 0) return <div className="loading">Loading {title}...</div>;

    return (
        <div className="card-list-container">

            <div className="cards-grid single-column">
                {items.length === 0 ? (
                    <div className="empty-state">No tags found.</div>
                ) : (
                    items.map((item) => (
                        <TagCard key={item.id} tag={item} onEdit={onEdit} />
                    ))
                )}
            </div>
        </div>
    );
}
