import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { ProjectCard } from './ProjectCard';
import { PcbCard } from './PcbCard';
import { ReworkCard } from './ReworkCard';
import { TagCard } from './TagCard';
import { OwnerCard } from './OwnerCard';
import { PcbFilter } from '../../components/Filter/PcbFilter';
import { TagFilter } from '../../components/Filter/TagFilter';

import { useProjectStore } from '../../store/storeProject';
import { usePcbStore } from '../../store/storePcb';
import { useReworkStore } from '../../store/storeRework';
import { useOwnerStore } from '../../store/storeOwner';
import { useTagStore } from '../../store/storeTag';
import { useStore } from '../../store/useStore';

interface CardListProps {
    type: 'projects' | 'pcbs' | 'reworks' | 'tags' | 'owners';
    title: string;
    onAdd: () => void;
    onEdit: (id: string | number) => void;
}

export function CardList({ type, title, onAdd, onEdit }: CardListProps) {
    const { projects, loading: projectsLoading, fetchProjects } = useProjectStore();
    const { pcbs, loading: pcbsLoading, fetchPcbs } = usePcbStore();
    const { reworks, loading: reworksLoading, fetchReworks, selectedBoards, setSelectedBoards } = useReworkStore();
    const { owners, loading: ownersLoading, fetchOwners } = useOwnerStore();
    const { tags, loading: tagsLoading, fetchTags } = useTagStore();
    const { expandedPcb, isolatedView } = useStore();

    useEffect(() => {
        if (type === 'projects') {
            fetchProjects();
            fetchPcbs();
        }
        if (type === 'pcbs') {
            fetchPcbs();
            fetchProjects(); // needed to know the project names and revisions
            fetchTags();
            fetchOwners();
        }
        if (type === 'reworks') fetchReworks();
        if (type === 'owners') fetchOwners();
        if (type === 'tags') fetchTags();
    }, [type, fetchProjects, fetchPcbs, fetchReworks, fetchOwners, fetchTags]);

    let items: any[] = [];
    let loading = false;

    const { 
        selectedProjects,
        selectedRevisions,
        selectedFlavors,
        selectedCorners,
        selectedPcbRevs,
        selectedTags,
        selectedOwners,
        selectedBoardNumbers,
        setSelectedBoardNumbers
    } = usePcbStore();

    const { 
        selectedTagTypes,
        selectedTagOwners
    } = useTagStore();
    
    const activePcbFilterCount = selectedProjects.length + selectedRevisions.length + selectedFlavors.length + selectedCorners.length + selectedPcbRevs.length + selectedTags.length + selectedOwners.length + selectedBoardNumbers.length;
    const activeTagFilterCount = selectedTagTypes.length + selectedTagOwners.length;
    const activeFilterCount = type === 'pcbs' ? activePcbFilterCount : (type === 'tags' ? activeTagFilterCount : 0);

    const [showFilters, setShowFilters] = useState<boolean>(activeFilterCount > 0 && !isolatedView);
    const [hasAutoFiltered, setHasAutoFiltered] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (type === 'pcbs' && expandedPcb && isolatedView && !hasAutoFiltered) {
            if (selectedBoardNumbers.length === 0) {
                setSelectedBoardNumbers([expandedPcb]);
            }
            setHasAutoFiltered(true);
        }
    }, [expandedPcb, isolatedView, type, hasAutoFiltered, selectedBoardNumbers, setSelectedBoardNumbers]);

    useEffect(() => {
        // Only auto-expand filters when we are NOT in an isolated full-screen view mode
        if (activeFilterCount > 0 && !isolatedView) {
            setShowFilters(true);
        }
    }, [activeFilterCount, isolatedView]);

    switch (type) {
        case 'projects': 
            items = [...projects]; 
            loading = projectsLoading; 
            break;
        case 'pcbs': 
            items = [...pcbs]; 
            loading = pcbsLoading || projectsLoading;
            if (selectedProjects.length > 0) {
                const projNames = selectedProjects.map(id => projects.find(p => p.id.toString() === id)?.name);
                items = items.filter(pcb => projNames.includes(pcb.project));
            }
            if (selectedRevisions.length > 0) {
                items = items.filter(pcb => selectedRevisions.includes(pcb.silicon_rev));
            }
            if (selectedCorners.length > 0) {
                items = items.filter(pcb => selectedCorners.includes(pcb.silicon_corner));
            }
            if (selectedFlavors.length > 0) {
                items = items.filter(pcb => selectedFlavors.includes(pcb.board_flavor));
            }
            if (selectedPcbRevs.length > 0) {
                items = items.filter(pcb => selectedPcbRevs.includes(pcb.board_rev));
            }
            if (selectedTags.length > 0) {
                items = items.filter(pcb => selectedTags.some(tagId => pcb.tag_ids?.includes(parseInt(tagId))));
            }
            if (selectedOwners.length > 0) {
                items = items.filter(pcb => selectedOwners.includes(pcb.owner));
            }
            if (selectedBoardNumbers && selectedBoardNumbers.length > 0) {
                items = items.filter(pcb => selectedBoardNumbers.includes(pcb.board_number));
            }
            if (searchQuery) {
                const sq = searchQuery.toLowerCase();
                items = items.filter(pcb => 
                    pcb.board_number.toLowerCase().includes(sq) || 
                    (pcb.product && pcb.product.toLowerCase().includes(sq)) ||
                    (pcb.project && pcb.project.toLowerCase().includes(sq))
                );
            }
            break;
        case 'reworks': 
            items = reworks; 
            loading = reworksLoading; 
            if (selectedBoards && selectedBoards.length > 0) {
                items = items.filter(rw => selectedBoards.includes(rw.pcb_id.toString()));
            }
            break;
        case 'owners': items = owners; loading = ownersLoading; break;
        case 'tags': 
            items = tags; 
            loading = tagsLoading; 
            if (selectedTagTypes && selectedTagTypes.length > 0) {
                items = items.filter(tag => selectedTagTypes.includes(tag.type));
            }
            if (selectedTagOwners && selectedTagOwners.length > 0) {
                items = items.filter(tag => selectedTagOwners.includes(tag.owner_name));
            }
            if (searchQuery) {
                const sq = searchQuery.toLowerCase();
                items = items.filter(tag => tag.name.toLowerCase().includes(sq));
            }
            break;
    }

    if (loading) return <div className="loading">Loading {title}...</div>;

    return (
        <div className="card-list-container">
            <div className="list-header" style={{ marginBottom: (type === 'pcbs' || type === 'tags') ? '12px' : '24px', flexWrap: 'wrap', gap: '16px' }}>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <h2 style={{ margin: 0 }}>{title}</h2>
                    {(type === 'pcbs' || type === 'tags') && (
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                            <svg style={{ position: 'absolute', left: '10px', color: 'var(--text-muted)' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                            <input 
                                type="text"
                                placeholder={`Search ${type === 'pcbs' ? 'PCBs' : 'Tags'}...`}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                style={{
                                    padding: '8px 12px 8px 34px',
                                    borderRadius: '8px',
                                    border: '1px solid var(--border-color)',
                                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                    color: 'var(--text)',
                                    fontSize: '0.85rem',
                                    width: '100%',
                                    maxWidth: '220px',
                                    outline: 'none',
                                    transition: 'all 0.2s ease'
                                }}
                                onFocus={(e) => {
                                    e.target.style.borderColor = 'var(--accent)';
                                    e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                                    e.target.style.boxShadow = '0 0 0 2px rgba(99, 102, 241, 0.2)';
                                }}
                                onBlur={(e) => {
                                    e.target.style.borderColor = 'var(--border-color)';
                                    e.target.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
                                    e.target.style.boxShadow = 'none';
                                }}
                            />
                        </div>
                    )}
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>

                    {(type === 'pcbs' || type === 'tags') && activeFilterCount > 0 && (
                        <button 
                            className="secondary-button" 
                            onClick={() => { type === 'pcbs' ? usePcbStore.getState().resetFilters() : useTagStore.getState().resetFilters(); }}
                            style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '8px', 
                                padding: '8px 16px', 
                                borderRadius: '8px', 
                                backgroundColor: 'transparent', 
                                border: '1px solid var(--border-color)', 
                                color: 'var(--text-muted)', 
                                cursor: 'pointer',
                                fontWeight: 500
                            }}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            <span>Clear All</span>
                        </button>
                    )}
                    {(type === 'pcbs' || type === 'tags') && (
                        <button 
                            className="secondary-button" 
                            onClick={() => setShowFilters(!showFilters)}
                            style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '8px', 
                                padding: '8px 16px', 
                                borderRadius: '8px', 
                                backgroundColor: activeFilterCount > 0 ? 'rgba(99, 102, 241, 0.1)' : 'var(--bg-element)', 
                                border: `1px solid ${activeFilterCount > 0 ? 'var(--accent)' : 'var(--border-color)'}`, 
                                color: activeFilterCount > 0 ? 'var(--accent)' : 'var(--text)', 
                                cursor: 'pointer',
                                fontWeight: 500
                            }}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
                            <span>{showFilters ? 'Hide Filters' : 'Filters'} {activeFilterCount > 0 ? `(${activeFilterCount})` : ''}</span>
                        </button>
                    )}
                    <button className="add-button" onClick={onAdd}>
                        <Plus size={18} />
                        <span>Add New</span>
                    </button>
                </div>
            </div>
            
            {type === 'reworks' && selectedBoards && selectedBoards.length > 0 && (
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
            
            {type === 'pcbs' && showFilters && (
                <PcbFilter />
            )}
            
            {type === 'tags' && showFilters && (
                <TagFilter />
            )}

            <div className={`cards-grid ${['projects', 'pcbs', 'reworks', 'tags', 'owners'].includes(type) ? 'single-column' : ''}`}>
                {items.length === 0 ? (
                    <div className="empty-state">No {type} found.</div>
                ) : (
                    items.map((item) => {
                        if (type === 'projects') {
                            return <ProjectCard key={item.id} project={item} />;
                        }
                        if (type === 'pcbs') {
                            return <PcbCard key={item.id} pcb={item} />;
                        }

                        if (type === 'reworks') {
                            return <ReworkCard key={item.id} rework={item} />;
                        }

                        if (type === 'tags') {
                            return <TagCard key={item.id} tag={item} onEdit={onEdit} />;
                        }

                        if (type === 'owners') {
                            return <OwnerCard key={item.id} owner={item} onEdit={onEdit} />;
                        }

                        return null;
                    })
                )}
            </div>
        </div>
    );
}
