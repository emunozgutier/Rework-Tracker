import { useEffect, useState } from 'react';
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

export function PcbView({ title }: PcbViewProps) {
    const { projects, loading: projectsLoading, fetchProjects } = useProjectStore();
    const { pcbs, loading: pcbsLoading, fetchPcbs, selectedProjects, selectedRevisions, selectedFlavors, selectedCorners, selectedPcbRevs, selectedTags, selectedOwners, selectedBoardNumbers, setSelectedBoardNumbers } = usePcbStore();
    const { fetchOwners } = useOwnerStore();
    const { fetchTags } = useTagStore();
    const { expandedPcb, isolatedView, searchQuery, showFilters, setShowFilters } = useStore();

    useEffect(() => {
        fetchPcbs();
        fetchProjects(); // needed to know the project names and revisions
        fetchTags();
        fetchOwners();
    }, [fetchPcbs, fetchProjects, fetchTags, fetchOwners]);

    const activePcbFilterCount = selectedProjects.length + selectedRevisions.length + selectedFlavors.length + selectedCorners.length + selectedPcbRevs.length + selectedTags.length + selectedOwners.length + selectedBoardNumbers.length;
    
    const [hasAutoFiltered, setHasAutoFiltered] = useState(false);

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
    }, [activePcbFilterCount, isolatedView, setShowFilters]);

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

    if (loading && pcbs.length === 0) return <div className="loading">Loading {title}...</div>;

    return (
        <div className="card-list-container">
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
