import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { useTagStore } from '../../store/useTagStore';
import { useOwnerStore } from '../../store/useOwnerStore';
import { COLORS } from '../../store/useStyles';
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

export function TagFilter() {
    const isMobile = useStore(state => state.isMobile);
    const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

    const { tags, selectedTagTypes, setSelectedTagTypes, selectedTagOwners, setSelectedTagOwners } = useTagStore();
    const { owners } = useOwnerStore();

    const matchTag = (tag: any, ignoreField: 'type' | 'owner') => {
        if (ignoreField !== 'type' && selectedTagTypes.length > 0) {
            if (!selectedTagTypes.includes(tag.type)) return false;
        }
        if (ignoreField !== 'owner' && selectedTagOwners.length > 0) {
            if (tag.type === 'public') return false; 
            if (!selectedTagOwners.includes(tag.owner_name)) return false;
        }
        return true;
    };

    const hasAnyOtherFilter = (ignoreField: string) => {
        const filters: any = {
            type: selectedTagTypes.length > 0,
            owner: selectedTagOwners.length > 0
        };
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
                    title="Tag Properties" 
                    activeCount={selectedTagTypes.length + selectedTagOwners.length}
                    isExpanded={expandedGroup === 'tag_props'}
                    onToggle={() => setExpandedGroup(expandedGroup === 'tag_props' ? null : 'tag_props')}
                >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <PcbFilterElement title="Type" value={selectedTagTypes} onChange={setSelectedTagTypes}>
                            {['public', 'personal'].map(type => {
                                const count = tags.filter((tag: any) => tag.type === type && matchTag(tag, 'type')).length;
                                if (count === 0 && hasAnyOtherFilter('type')) return null;
                                return <option key={type} value={type}>{type === 'public' ? 'Public' : 'Personal'} ({count})</option>;
                            })}
                        </PcbFilterElement>

                        <PcbFilterElement title="Owner" value={selectedTagOwners} onChange={setSelectedTagOwners}>
                            {owners.filter(o => tags.some(t => t.owner_name === o.name && t.type === 'personal')).map(owner => {
                                const count = tags.filter((tag: any) => tag.owner_name === owner.name && matchTag(tag, 'owner')).length;
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
            <PcbFilterGroup title="Tag Properties" color={COLORS.purpleAccent}>
                <PcbFilterElement title="Type" value={selectedTagTypes} onChange={setSelectedTagTypes}>
                    {['public', 'personal'].map(type => {
                        const count = tags.filter((tag: any) => tag.type === type && matchTag(tag, 'type')).length;
                        if (count === 0 && hasAnyOtherFilter('type')) return null;
                        return <option key={type} value={type}>{type === 'public' ? 'Public' : 'Personal'} ({count})</option>;
                    })}
                </PcbFilterElement>

                <PcbFilterElement title="Owner" value={selectedTagOwners} onChange={setSelectedTagOwners}>
                    {owners.filter(o => tags.some(t => t.owner_name === o.name && t.type === 'personal')).map(owner => {
                        const count = tags.filter((tag: any) => tag.owner_name === owner.name && matchTag(tag, 'owner')).length;
                        if (count === 0 && hasAnyOtherFilter('owner')) return null;
                        return <option key={owner.id} value={owner.name}>{owner.username} ({count})</option>;
                    })}
                </PcbFilterElement>
            </PcbFilterGroup>
        </div>
    );
}
