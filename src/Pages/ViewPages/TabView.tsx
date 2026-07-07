import { useEffect, useState } from 'react';
import { TagCard } from './Cards/TagCard';
import { TagFilter } from '../../components/Filter/TagFilter';

import { useTagStore } from '../../store/storeTag';
import { useStore } from '../../store/useStore';

interface TabViewProps {
    title: string;
    onAdd: () => void;
    onEdit: (id: string | number) => void;
}

export function TabView({ title, onAdd, onEdit }: TabViewProps) {
    const { tags, loading: tagsLoading, fetchTags, selectedTagTypes, selectedTagOwners, resetFilters } = useTagStore();
    const { isolatedView, searchQuery, showFilters, setShowFilters } = useStore();

    useEffect(() => {
        fetchTags();
    }, [fetchTags]);

    const activeTagFilterCount = selectedTagTypes.length + selectedTagOwners.length;

    useEffect(() => {
        if (activeTagFilterCount > 0 && !isolatedView) {
            setShowFilters(true);
        }
    }, [activeTagFilterCount, isolatedView, setShowFilters]);

    let items = tags;

    if (selectedTagTypes && selectedTagTypes.length > 0) {
        items = items.filter(tag => selectedTagTypes.includes(tag.type || ''));
    }
    if (selectedTagOwners && selectedTagOwners.length > 0) {
        items = items.filter(tag => selectedTagOwners.includes(tag.owner_name || ''));
    }
    if (searchQuery) {
        const sq = searchQuery.toLowerCase();
        items = items.filter(tag => tag.name.toLowerCase().includes(sq));
    }

    if (tagsLoading) return <div className="loading">Loading {title}...</div>;

    return (
        <div className="card-list-container">
            {showFilters && <TagFilter />}

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
