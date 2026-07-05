import { useState } from 'react';
import { useStore } from '../../store/useStore';
import { usePcbStore } from '../../store/storePcb';
import { useProjectStore } from '../../store/storeProject';
import { COLORS } from '../../store/storeStyles';
import { useTagStore, formatTagName } from '../../store/storeTag';
import { useOwnerStore } from '../../store/storeOwner';
import { PcbFilterElement } from './PcbFilterElement';
import { PcbFilterGroup } from './PcbFilterGroup';

function MobileFilterGroup({ title, activeCount, isExpanded, onToggle, children }: { title: string; activeCount: number; isExpanded: boolean; onToggle: () => void; children: React.ReactNode }) {
    return (
        <div style={{ 
            border: '1px solid var(--border)', 
            borderRadius: '8px', 
            overflow: 'hidden', 
            background: 'var(--bg-element)' 
        }}>
            <button 
                onClick={onToggle}
                style={{
                    width: '100%',
                    padding: '12px 16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text)',
                    fontSize: '0.95rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>{title}</span>
                    {activeCount > 0 && (
                        <span style={{ 
                            color: 'var(--accent)', 
                            fontWeight: 700,
                            marginLeft: '4px'
                        }}>
                            #{activeCount}
                        </span>
                    )}
                </div>
                <span style={{ transition: 'transform 0.2s', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
                </span>
            </button>
            {isExpanded && (
                <div style={{ 
                    padding: '16px', 
                    borderTop: '1px solid var(--border)', 
                    background: 'rgba(0,0,0,0.1)' 
                }}>
                    {children}
                </div>
            )}
        </div>
    );
}

export function PcbFilter() {
    const isMobile = useStore(state => state.isMobile);
    const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

    const { 
        pcbs,
        selectedProjects, setSelectedProjects, 
        selectedRevisions, setSelectedRevisions, 
        selectedCorners, setSelectedCorners,
        selectedFlavors, setSelectedFlavors,
        selectedPcbRevs, setSelectedPcbRevs,
        selectedTags, setSelectedTags,
        selectedOwners, setSelectedOwners,
        selectedBoardNumbers, setSelectedBoardNumbers,
        selectedBoms, setSelectedBoms
    } = usePcbStore();
    
    const { projects } = useProjectStore();
    const { tags } = useTagStore();
    const { owners } = useOwnerStore();

    // Helper to evaluate a PCB against all filters except the one currently generating options
    const matchPcb = (pcb: any, ignoreField: 'project' | 'revision' | 'corner' | 'flavor' | 'pcbrev' | 'tag' | 'owner' | 'boardnum' | 'bom') => {
        if (ignoreField !== 'project' && selectedProjects.length > 0) {
            const pObj = projects.find(p => p.name === pcb.project);
            if (!pObj || !selectedProjects.includes(pObj.id.toString())) return false;
        }
        if (ignoreField !== 'revision' && selectedRevisions.length > 0) {
            if (!pcb.silicon_rev || !selectedRevisions.includes(pcb.silicon_rev)) return false;
        }
        if (ignoreField !== 'corner' && selectedCorners.length > 0) {
            if (!pcb.silicon_corner || !selectedCorners.includes(pcb.silicon_corner)) return false;
        }
        if (ignoreField !== 'flavor' && selectedFlavors.length > 0) {
            if (!pcb.board_flavor || !selectedFlavors.includes(pcb.board_flavor)) return false;
        }
        if (ignoreField !== 'pcbrev' && selectedPcbRevs.length > 0) {
            if (!pcb.board_rev || !selectedPcbRevs.includes(pcb.board_rev)) return false;
        }
        if (ignoreField !== 'tag' && selectedTags.length > 0) {
            if (!pcb.tag_ids || !selectedTags.some((tagId: string) => pcb.tag_ids?.includes(parseInt(tagId)))) return false;
        }
        if (ignoreField !== 'owner' && selectedOwners.length > 0) {
            if (!selectedOwners.includes(pcb.owner)) return false;
        }
        if (ignoreField !== 'boardnum' && selectedBoardNumbers.length > 0) {
            if (!selectedBoardNumbers.includes(pcb.board_number)) return false;
        }
        if (ignoreField !== 'bom' && selectedBoms.length > 0) {
            if (!pcb.bom || !selectedBoms.includes(pcb.bom)) return false;
        }
        return true;
    };

    const hasAnyOtherFilter = (ignoreField: string) => {
        const filters = {
            project: selectedProjects.length > 0,
            revision: selectedRevisions.length > 0,
            corner: selectedCorners.length > 0,
            flavor: selectedFlavors.length > 0,
            pcbrev: selectedPcbRevs.length > 0,
            tag: selectedTags.length > 0,
            owner: selectedOwners.length > 0,
            boardnum: selectedBoardNumbers.length > 0,
            bom: selectedBoms.length > 0
        };
        // @ts-ignore
        filters[ignoreField] = false;
        return Object.values(filters).some(Boolean);
    };

    if (isMobile) {
        return (
            <div className="pcb-filters-mobile" style={{  
                marginBottom: '24px', 
                display: 'flex', 
                flexDirection: 'column',
                gap: '12px', 
                width: '100%'
            }}>
                <MobileFilterGroup 
                    title="Silicon Filters" 
                    activeCount={selectedProjects.length + selectedRevisions.length + selectedCorners.length}
                    isExpanded={expandedGroup === 'silicon'}
                    onToggle={() => setExpandedGroup(expandedGroup === 'silicon' ? null : 'silicon')}
                >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <PcbFilterElement title="Projects" value={selectedProjects} onChange={setSelectedProjects}>
                            {projects.map(p => {
                                const count = pcbs.filter(pcb => pcb.project === p.name && matchPcb(pcb, 'project')).length;
                                if (count === 0 && hasAnyOtherFilter('project')) return null;
                                return <option key={p.id} value={p.id.toString()}>{p.name} ({count})</option>;
                            })}
                        </PcbFilterElement>

                        <PcbFilterElement title="Rev" value={selectedRevisions} onChange={setSelectedRevisions}>
                            {(() => {
                                const activeProjects = selectedProjects.length > 0 ? projects.filter(p => selectedProjects.includes(p.id.toString())) : projects;
                                const allRevs = new Set<string>();
                                activeProjects.forEach((p: any) => { if (p.revisions) p.revisions.forEach((r: string) => allRevs.add(r)); });
                                if (pcbs.some(pcb => pcb.product && (pcb.product.includes('No part yet') || pcb.product.includes('No part')))) {
                                    allRevs.add('No part');
                                }
                                return Array.from(allRevs).sort().map(rev => {
                                    const count = pcbs.filter(pcb => (pcb.silicon_rev === rev || (rev === 'No part' && (pcb.silicon_rev === 'No part yet' || pcb.silicon_rev === 'No part'))) && matchPcb(pcb, 'revision')).length;
                                    if (count === 0 && hasAnyOtherFilter('revision')) return null;
                                    return <option key={rev} value={rev}>{rev === 'No part' || rev === 'No part yet' ? 'N/A (No part)' : rev} ({count})</option>;
                                });
                            })()}
                        </PcbFilterElement>

                        <PcbFilterElement title="Corners" value={selectedCorners} onChange={setSelectedCorners}>
                            {(() => {
                                const activeProjects = selectedProjects.length > 0 ? projects.filter(p => selectedProjects.includes(p.id.toString())) : projects;
                                const allCorners = new Set<string>();
                                activeProjects.forEach((p: any) => { if (p.silicon_corners) p.silicon_corners.split(',').forEach((c: string) => allCorners.add(c.trim())); });
                                return Array.from(allCorners).filter(Boolean).sort().map(corner => {
                                    const count = pcbs.filter(pcb => pcb.silicon_corner === corner && matchPcb(pcb, 'corner')).length;
                                    if (count === 0 && hasAnyOtherFilter('corner')) return null;
                                    return <option key={corner} value={corner}>{corner} ({count})</option>;
                                });
                            })()}
                        </PcbFilterElement>
                    </div>
                </MobileFilterGroup>

                <MobileFilterGroup 
                    title="PCB Filters" 
                    activeCount={selectedBoardNumbers.length + selectedFlavors.length + selectedPcbRevs.length + selectedBoms.length}
                    isExpanded={expandedGroup === 'pcb'}
                    onToggle={() => setExpandedGroup(expandedGroup === 'pcb' ? null : 'pcb')}
                >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <PcbFilterElement title="Name" value={selectedBoardNumbers} onChange={setSelectedBoardNumbers}>
                            {pcbs
                                .filter(pcb => matchPcb(pcb, 'boardnum'))
                                .sort((a,b) => a.board_number.localeCompare(b.board_number))
                                .map(pcb => (
                                    <option key={pcb.id} value={pcb.board_number}>{pcb.board_number}</option>
                                ))
                            }
                        </PcbFilterElement>

                        <PcbFilterElement title="Flavors" value={selectedFlavors} onChange={setSelectedFlavors}>
                            {(() => {
                                const activeProjects = selectedProjects.length > 0 ? projects.filter(p => selectedProjects.includes(p.id.toString())) : projects;
                                const allFlavors = new Set<string>();
                                activeProjects.forEach((p: any) => { if (p.flavors) p.flavors.forEach((ff: any) => allFlavors.add(ff.name)); });
                                return Array.from(allFlavors).sort().map(ff => {
                                    const count = pcbs.filter(pcb => pcb.board_flavor === ff && matchPcb(pcb, 'flavor')).length;
                                    if (count === 0 && hasAnyOtherFilter('flavor')) return null;
                                    return <option key={ff} value={ff}>{ff} ({count})</option>;
                                });
                            })()}
                        </PcbFilterElement>

                        <PcbFilterElement title="Revs" value={selectedPcbRevs} onChange={setSelectedPcbRevs}>
                            {(() => {
                                const activeProjects = selectedProjects.length > 0 ? projects.filter(p => selectedProjects.includes(p.id.toString())) : projects;
                                const allPcbRevs = new Set<string>();
                                activeProjects.forEach((p: any) => { 
                                    if (p.flavors) {
                                        p.flavors.forEach((ff: any) => {
                                            if (ff.revisions) {
                                                ff.revisions.forEach((r: string) => allPcbRevs.add(r));
                                            }
                                        });
                                    }
                                });
                                return Array.from(allPcbRevs).sort().map(pr => {
                                    const count = pcbs.filter(pcb => pcb.board_rev === pr && matchPcb(pcb, 'pcbrev')).length;
                                    if (count === 0 && hasAnyOtherFilter('pcbrev')) return null;
                                    return <option key={pr} value={pr}>{pr} ({count})</option>;
                                });
                            })()}
                        </PcbFilterElement>

                        <PcbFilterElement title="BOM" value={selectedBoms} onChange={setSelectedBoms}>
                            {(() => {
                                const allBoms = new Set<string>();
                                pcbs.forEach(pcb => {
                                    if (pcb.bom) allBoms.add(pcb.bom);
                                });
                                return Array.from(allBoms).filter(Boolean).sort().map(b => {
                                    const count = pcbs.filter(pcb => pcb.bom === b && matchPcb(pcb, 'bom')).length;
                                    if (count === 0 && hasAnyOtherFilter('bom')) return null;
                                    return <option key={b} value={b}>{b} ({count})</option>;
                                });
                            })()}
                        </PcbFilterElement>
                    </div>
                </MobileFilterGroup>

                <MobileFilterGroup 
                    title="Organization" 
                    activeCount={selectedTags.length + selectedOwners.length}
                    isExpanded={expandedGroup === 'org'}
                    onToggle={() => setExpandedGroup(expandedGroup === 'org' ? null : 'org')}
                >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <PcbFilterElement 
                            title="Public Tags" 
                            value={(() => {
                                const activePublicIds = selectedTags.filter(id => tags.find(t => t.id.toString() === id)?.type === 'public');
                                if (activePublicIds.length === 0) return [];
                                const sampleTag = tags.find(t => t.id.toString() === activePublicIds[0]);
                                if (!sampleTag) return [];
                                const name = formatTagName(sampleTag);
                                const groupIds = tags.filter(t => t.type === 'public' && formatTagName(t) === name).map(t => t.id.toString());
                                return [groupIds.join(',')];
                            })()} 
                            onChange={(newPublic) => {
                                if (newPublic.length > 0) {
                                    setSelectedTags(newPublic[newPublic.length - 1].split(','));
                                } else {
                                    setSelectedTags([]);
                                }
                            }}
                        >
                            {(() => {
                                const publicTags = tags.filter((t: any) => t.type === 'public');
                                const grouped = new Map<string, any[]>();
                                publicTags.forEach((t: any) => {
                                    const name = formatTagName(t);
                                    if (!grouped.has(name)) grouped.set(name, []);
                                    grouped.get(name)!.push(t);
                                });
                                return Array.from(grouped.entries()).map(([name, groupTags]) => {
                                    const groupIds = groupTags.map(t => t.id);
                                    const count = pcbs.filter(pcb => pcb.tag_ids && pcb.tag_ids.some(id => groupIds.includes(id)) && matchPcb(pcb, 'tag')).length;
                                    if (count === 0 && hasAnyOtherFilter('tag')) return null;
                                    const valueStr = groupIds.join(',');
                                    return <option key={name} value={valueStr}>{name} ({count})</option>;
                                });
                            })()}
                        </PcbFilterElement>

                        <PcbFilterElement 
                            title="Personal Tags" 
                            value={selectedTags.filter(id => tags.find(t => t.id.toString() === id)?.type === 'personal')} 
                            onChange={(newPersonal) => {
                                setSelectedTags(newPersonal.length > 0 ? [newPersonal[newPersonal.length - 1]] : []);
                            }}
                        >
                            {tags.filter(t => t.type === 'personal').map(tag => {
                                const count = pcbs.filter(pcb => pcb.tag_ids && pcb.tag_ids.includes(tag.id) && matchPcb(pcb, 'tag')).length;
                                if (count === 0 && hasAnyOtherFilter('tag')) return null;
                                return <option key={tag.id} value={tag.id.toString()}>{formatTagName(tag)} ({count})</option>;
                            })}
                        </PcbFilterElement>

                        <PcbFilterElement title="Owner" value={selectedOwners} onChange={setSelectedOwners}>
                            {owners.map(owner => {
                                const count = pcbs.filter(pcb => pcb.owner === owner.name && matchPcb(pcb, 'owner')).length;
                                if (count === 0 && hasAnyOtherFilter('owner')) return null;
                                return <option key={owner.id} value={owner.name}>{owner.username} ({count})</option>;
                            })}
                        </PcbFilterElement>
                    </div>
                </MobileFilterGroup>
            </div>
        );
    }

    return (
        <div className="pcb-filters" style={{  
            marginBottom: '24px', 
            display: 'flex', 
            gap: '24px', 
            alignItems: 'stretch', 
            overflowX: 'auto', 
            width: '100%',
            paddingBottom: '12px'
        }}>
            
            {/* Silicon Group */}
            <PcbFilterGroup title="Silicon Filters" color={COLORS.purpleAccent}>
                <PcbFilterElement title="Projects" value={selectedProjects} onChange={setSelectedProjects}>
                    {projects.map(p => {
                        const count = pcbs.filter(pcb => pcb.project === p.name && matchPcb(pcb, 'project')).length;
                        if (count === 0 && hasAnyOtherFilter('project')) return null;
                        return <option key={p.id} value={p.id.toString()}>{p.name} ({count})</option>;
                    })}
                </PcbFilterElement>

                <PcbFilterElement title="Rev" value={selectedRevisions} onChange={setSelectedRevisions}>
                    {(() => {
                        const activeProjects = selectedProjects.length > 0 ? projects.filter(p => selectedProjects.includes(p.id.toString())) : projects;
                        const allRevs = new Set<string>();
                        activeProjects.forEach((p: any) => { if (p.revisions) p.revisions.forEach((r: string) => allRevs.add(r)); });
                        
                        // Dynamically inject implicit 'No part' placeholder if any board matches
                        if (pcbs.some(pcb => pcb.product && (pcb.product.includes('No part yet') || pcb.product.includes('No part')))) {
                            allRevs.add('No part');
                        }

                        return Array.from(allRevs).sort().map(rev => {
                            const count = pcbs.filter(pcb => (pcb.silicon_rev === rev || (rev === 'No part' && (pcb.silicon_rev === 'No part yet' || pcb.silicon_rev === 'No part'))) && matchPcb(pcb, 'revision')).length;
                            if (count === 0 && hasAnyOtherFilter('revision')) return null;
                            return <option key={rev} value={rev}>{rev === 'No part' || rev === 'No part yet' ? 'N/A (No part)' : rev} ({count})</option>;
                        });
                    })()}
                </PcbFilterElement>

                <PcbFilterElement title="Corners" value={selectedCorners} onChange={setSelectedCorners}>
                    {(() => {
                        const activeProjects = selectedProjects.length > 0 ? projects.filter(p => selectedProjects.includes(p.id.toString())) : projects;
                        const allCorners = new Set<string>();
                        activeProjects.forEach((p: any) => { if (p.silicon_corners) p.silicon_corners.split(',').forEach((c: string) => allCorners.add(c.trim())); });

                        return Array.from(allCorners).filter(Boolean).sort().map(corner => {
                            const count = pcbs.filter(pcb => pcb.silicon_corner === corner && matchPcb(pcb, 'corner')).length;
                            if (count === 0 && hasAnyOtherFilter('corner')) return null;
                            return <option key={corner} value={corner}>{corner} ({count})</option>;
                        });
                    })()}
                </PcbFilterElement>
                
            </PcbFilterGroup>

            {/* PCB Group */}
            <PcbFilterGroup title="PCB Filters" color={COLORS.purpleAccent}>
                <PcbFilterElement title="Name" value={selectedBoardNumbers} onChange={setSelectedBoardNumbers}>
                    {pcbs
                        .filter(pcb => matchPcb(pcb, 'boardnum'))
                        .sort((a,b) => a.board_number.localeCompare(b.board_number))
                        .map(pcb => (
                            <option key={pcb.id} value={pcb.board_number}>{pcb.board_number}</option>
                        ))
                    }
                </PcbFilterElement>

                <PcbFilterElement title="Flavors" value={selectedFlavors} onChange={setSelectedFlavors}>
                    {(() => {
                        const activeProjects = selectedProjects.length > 0 ? projects.filter(p => selectedProjects.includes(p.id.toString())) : projects;
                        const allFlavors = new Set<string>();
                        activeProjects.forEach((p: any) => { if (p.flavors) p.flavors.forEach((ff: any) => allFlavors.add(ff.name)); });

                        return Array.from(allFlavors).sort().map(ff => {
                            const count = pcbs.filter(pcb => pcb.board_flavor === ff && matchPcb(pcb, 'flavor')).length;
                            if (count === 0 && hasAnyOtherFilter('flavor')) return null;
                            return <option key={ff} value={ff}>{ff} ({count})</option>;
                        });
                    })()}
                </PcbFilterElement>

                <PcbFilterElement title="Revs" value={selectedPcbRevs} onChange={setSelectedPcbRevs}>
                    {(() => {
                        const activeProjects = selectedProjects.length > 0 ? projects.filter(p => selectedProjects.includes(p.id.toString())) : projects;
                        const allPcbRevs = new Set<string>();
                        activeProjects.forEach((p: any) => { 
                            if (p.flavors) {
                                p.flavors.forEach((ff: any) => {
                                    if (ff.revisions) {
                                        ff.revisions.forEach((r: string) => allPcbRevs.add(r));
                                    }
                                });
                            }
                        });

                        return Array.from(allPcbRevs).sort().map(pr => {
                            const count = pcbs.filter(pcb => pcb.board_rev === pr && matchPcb(pcb, 'pcbrev')).length;
                            if (count === 0 && hasAnyOtherFilter('pcbrev')) return null;
                            return <option key={pr} value={pr}>{pr} ({count})</option>;
                        });
                    })()}
                </PcbFilterElement>

                <PcbFilterElement title="BOM" value={selectedBoms} onChange={setSelectedBoms}>
                    {(() => {
                        const allBoms = new Set<string>();
                        pcbs.forEach(pcb => {
                            if (pcb.bom) allBoms.add(pcb.bom);
                        });

                        return Array.from(allBoms).filter(Boolean).sort().map(b => {
                            const count = pcbs.filter(pcb => pcb.bom === b && matchPcb(pcb, 'bom')).length;
                            if (count === 0 && hasAnyOtherFilter('bom')) return null;
                            return <option key={b} value={b}>{b} ({count})</option>;
                        });
                    })()}
                </PcbFilterElement>
            </PcbFilterGroup>

            {/* Tags & Owner Group */}
            <PcbFilterGroup title="Organization" color="#0ea5e9">
                <PcbFilterElement 
                    title="Public Tags" 
                    value={(() => {
                        const activePublicIds = selectedTags.filter(id => tags.find(t => t.id.toString() === id)?.type === 'public');
                        if (activePublicIds.length === 0) return [];
                        const sampleTag = tags.find(t => t.id.toString() === activePublicIds[0]);
                        if (!sampleTag) return [];
                        const name = formatTagName(sampleTag);
                        const groupIds = tags.filter(t => t.type === 'public' && formatTagName(t) === name).map(t => t.id.toString());
                        return [groupIds.join(',')];
                    })()} 
                    onChange={(newPublic) => {
                        if (newPublic.length > 0) {
                            setSelectedTags(newPublic[newPublic.length - 1].split(','));
                        } else {
                            setSelectedTags([]);
                        }
                    }}
                >
                    {(() => {
                        const publicTags = tags.filter((t: any) => t.type === 'public');
                        const grouped = new Map<string, any[]>();
                        publicTags.forEach((t: any) => {
                            const name = formatTagName(t);
                            if (!grouped.has(name)) grouped.set(name, []);
                            grouped.get(name)!.push(t);
                        });

                        return Array.from(grouped.entries()).map(([name, groupTags]) => {
                            const groupIds = groupTags.map(t => t.id);
                            const count = pcbs.filter(pcb => pcb.tag_ids && pcb.tag_ids.some(id => groupIds.includes(id)) && matchPcb(pcb, 'tag')).length;
                            if (count === 0 && hasAnyOtherFilter('tag')) return null;
                            const valueStr = groupIds.join(',');
                            return <option key={name} value={valueStr}>{name} ({count})</option>;
                        });
                    })()}
                </PcbFilterElement>

                <PcbFilterElement 
                    title="Personal Tags" 
                    value={selectedTags.filter(id => tags.find(t => t.id.toString() === id)?.type === 'personal')} 
                    onChange={(newPersonal) => {
                        setSelectedTags(newPersonal.length > 0 ? [newPersonal[newPersonal.length - 1]] : []);
                    }}
                >
                    {tags.filter(t => t.type === 'personal').map(tag => {
                        const count = pcbs.filter(pcb => pcb.tag_ids && pcb.tag_ids.includes(tag.id) && matchPcb(pcb, 'tag')).length;
                        if (count === 0 && hasAnyOtherFilter('tag')) return null;
                        return <option key={tag.id} value={tag.id.toString()}>{formatTagName(tag)} ({count})</option>;
                    })}
                </PcbFilterElement>

                <PcbFilterElement title="Owner" value={selectedOwners} onChange={setSelectedOwners}>
                    {owners.map(owner => {
                        const count = pcbs.filter(pcb => pcb.owner === owner.name && matchPcb(pcb, 'owner')).length;
                        if (count === 0 && hasAnyOtherFilter('owner')) return null;
                        return <option key={owner.id} value={owner.name}>{owner.username} ({count})</option>;
                    })}
                </PcbFilterElement>
            </PcbFilterGroup>


        </div>
    );
}
