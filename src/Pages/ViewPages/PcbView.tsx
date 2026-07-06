import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { PcbCard } from './Cards/PcbCard';
import { PcbFilter } from '../../components/Filter/PcbFilter';

import { useProjectStore } from '../../store/storeProject';
import { usePcbStore } from '../../store/storePcb';
import { useOwnerStore } from '../../store/storeOwner';
import { useTagStore } from '../../store/storeTag';
import { useStore } from '../../store/useStore';

interface PcbViewProps {
    title: string;
    onAdd: () => void;
}

export function PcbView({ title, onAdd }: PcbViewProps) {
    const { projects, loading: projectsLoading, fetchProjects } = useProjectStore();
    const { pcbs, loading: pcbsLoading, fetchPcbs, selectedProjects, selectedRevisions, selectedFlavors, selectedCorners, selectedPcbRevs, selectedTags, selectedOwners, selectedBoardNumbers, setSelectedBoardNumbers, resetFilters } = usePcbStore();
    const { fetchOwners } = useOwnerStore();
    const { fetchTags } = useTagStore();
    const { expandedPcb, isolatedView, isMobile } = useStore();
    const [showMobileSearch, setShowMobileSearch] = useState(false);

    useEffect(() => {
        fetchPcbs();
        fetchProjects(); // needed to know the project names and revisions
        fetchTags();
        fetchOwners();
    }, [fetchPcbs, fetchProjects, fetchTags, fetchOwners]);

    const activePcbFilterCount = selectedProjects.length + selectedRevisions.length + selectedFlavors.length + selectedCorners.length + selectedPcbRevs.length + selectedTags.length + selectedOwners.length + selectedBoardNumbers.length;
    
    const [showFilters, setShowFilters] = useState<boolean>(activePcbFilterCount > 0 && !isolatedView);
    const [hasAutoFiltered, setHasAutoFiltered] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (expandedPcb && !expandedPcb.startsWith('SHORT:') && isolatedView && !hasAutoFiltered) {
            if (selectedBoardNumbers.length === 0) {
                setSelectedBoardNumbers([expandedPcb]);
            }
            setHasAutoFiltered(true);
        }
    }, [expandedPcb, isolatedView, hasAutoFiltered, selectedBoardNumbers, setSelectedBoardNumbers]);

    useEffect(() => {
        if (activePcbFilterCount > 0 && !isolatedView) {
            setShowFilters(true);
        }
    }, [activePcbFilterCount, isolatedView]);

    let items = [...pcbs];
    const loading = pcbsLoading || projectsLoading;

    if (selectedProjects.length > 0) {
        const projNames = selectedProjects.map(id => projects.find(p => p.id.toString() === id)?.name);
        items = items.filter(pcb => projNames.includes(pcb.project));
    }
    if (selectedRevisions.length > 0) {
        items = items.filter(pcb => selectedRevisions.includes(pcb.silicon_rev || ''));
    }
    if (selectedCorners.length > 0) {
        items = items.filter(pcb => selectedCorners.includes(pcb.silicon_corner || ''));
    }
    if (selectedFlavors.length > 0) {
        items = items.filter(pcb => selectedFlavors.includes(pcb.board_flavor || ''));
    }
    if (selectedPcbRevs.length > 0) {
        items = items.filter(pcb => selectedPcbRevs.includes(pcb.board_rev || ''));
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

    if (loading) return <div className="loading">Loading {title}...</div>;

    return (
        <div className="card-list-container">
            <div className="list-header" style={{ flexWrap: 'wrap', gap: '16px' }}>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <h2 style={{ margin: 0 }}>{title}</h2>
                    {!isMobile && (
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                            <svg style={{ position: 'absolute', left: '10px', color: 'var(--text-muted)' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                            <input 
                                type="text"
                                placeholder="Search PCBs..."
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
                    {!isMobile && activePcbFilterCount > 0 && (
                        <button 
                            className="secondary-button" 
                            onClick={resetFilters}
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
                            <span>Clear All ({activePcbFilterCount})</span>
                        </button>
                    )}
                    <button 
                        className="secondary-button" 
                        onClick={() => setShowFilters(!showFilters)}
                        style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            gap: '8px', 
                            padding: '8px 16px', 
                            borderRadius: '8px', 
                            backgroundColor: activePcbFilterCount > 0 ? 'rgba(99, 102, 241, 0.1)' : 'var(--bg-element)', 
                            border: `1px solid ${activePcbFilterCount > 0 ? 'var(--accent)' : 'var(--border-color)'}`, 
                            color: activePcbFilterCount > 0 ? 'var(--accent)' : 'var(--text)', 
                            cursor: 'pointer',
                            fontWeight: 500,
                            width: '145px'
                        }}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
                        <span>{showFilters ? 'Hide Filters' : 'Show Filters'}</span>
                    </button>
                    {isMobile && (
                        <button 
                            className="secondary-button" 
                            onClick={() => setShowMobileSearch(!showMobileSearch)}
                            style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '8px', 
                                padding: '8px 16px', 
                                borderRadius: '8px', 
                                backgroundColor: showMobileSearch ? 'rgba(99, 102, 241, 0.1)' : 'var(--bg-element)', 
                                border: `1px solid ${showMobileSearch ? 'var(--accent)' : 'var(--border-color)'}`, 
                                color: showMobileSearch ? 'var(--accent)' : 'var(--text)', 
                                cursor: 'pointer',
                                fontWeight: 500
                            }}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                            <span>Search</span>
                        </button>
                    )}
                    <button className="add-button" onClick={onAdd}>
                        <Plus size={18} />
                        <span>Add New</span>
                    </button>
                </div>
            </div>
            
            {isMobile && activePcbFilterCount > 0 && (
                <div style={{ display: 'flex', width: '100%', marginBottom: '16px', boxSizing: 'border-box' }}>
                    <button 
                        className="secondary-button" 
                        onClick={resetFilters}
                        style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '8px', 
                            padding: '10px 16px', 
                            borderRadius: '8px', 
                            backgroundColor: 'rgba(239, 68, 68, 0.08)', 
                            border: '1px solid rgba(239, 68, 68, 0.3)', 
                            color: '#ef4444', 
                            cursor: 'pointer',
                            fontWeight: 500,
                            width: '100%',
                            justifyContent: 'center',
                            fontSize: '0.85rem'
                        }}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        <span>Clear All Active Filters ({activePcbFilterCount})</span>
                    </button>
                </div>
            )}

            {isMobile && showMobileSearch && (
                <div style={{ 
                    position: 'relative', 
                    display: 'flex', 
                    alignItems: 'center', 
                    width: '100%', 
                    marginBottom: '16px',
                    boxSizing: 'border-box'
                }}>
                    <svg style={{ position: 'absolute', left: '12px', color: 'var(--text-muted)' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                    <input 
                        type="text"
                        placeholder="Search PCBs..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        autoFocus
                        style={{
                            padding: '10px 16px 10px 40px',
                            borderRadius: '8px',
                            border: '1px solid var(--accent)',
                            backgroundColor: 'rgba(255, 255, 255, 0.08)',
                            color: 'var(--text)',
                            fontSize: '0.85rem',
                            width: '100%',
                            outline: 'none',
                            boxShadow: '0 0 0 2px rgba(99, 102, 241, 0.2)',
                            boxSizing: 'border-box'
                        }}
                    />
                </div>
            )}
            
            {showFilters && <PcbFilter />}
            
            <div className="cards-grid single-column">
                {items.length === 0 ? (
                    <div className="empty-state">No PCBs found.</div>
                ) : (
                    items.map((item) => (
                        <PcbCard key={item.id} pcb={item} />
                    ))
                )}
            </div>
        </div>
    );
}
