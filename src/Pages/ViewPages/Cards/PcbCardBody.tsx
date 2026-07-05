import { useEffect, useState } from 'react';
import { useReworkStore } from '../../../store/storeRework';
import { useTagStore } from '../../../store/storeTag';
import { useStore } from '../../../store/useStore';
import { usePcbStore } from '../../../store/storePcb';
import { API_BASE, apiFetch } from '../../../store/database/apiBridge';
import { FormTabs } from '../../../components/forms/FormTabs';
import { RemoveTag } from '../../RemovePage/RemoveTag';
import { Tag as TagIcon, X } from 'lucide-react';
import { formatTagName } from '../../../store/storeTag';
import { EditButton, ViewButton, AddButton, QrButton, DeleteButton } from '../../../components/forms/ActionButtons';
import { RemovePcb } from '../../RemovePage/RemovePcb';
import { ReworkCardHeader } from './ReworkCardHeader';
import { ReworkCardBody } from './ReworkCardBody';

interface PcbCardBodyProps {
    pcb: any;
}

export function PcbCardBody({ pcb }: PcbCardBodyProps) {
    const { reworks, fetchReworks, setSelectedBoards } = useReworkStore();
    const { tags, fetchTags } = useTagStore();
    const { fetchPcbs, deletePcb } = usePcbStore();
    const { addItem, setActiveTab, setQrModalBoard, editItem, isMobile } = useStore();

    const [attachedTags, setAttachedTags] = useState<any[]>([]);
    const [isAssigningTag, setIsAssigningTag] = useState(false);
    const [tagToRemove, setTagToRemove] = useState<any>(null);
    const [isRemovePcbOpen, setIsRemovePcbOpen] = useState(false);
    const [activeTabIndex, setActiveTabIndex] = useState(0);
    const tabsList = ['Rework', 'Public Tags', 'Personal Tags'];
    const mobileTabsList = ['Rework', 'Public #', 'Personal #'];
    const activeTabName = tabsList[activeTabIndex];
    
    const [expandedReworkId, setExpandedReworkId] = useState<number | string | null>(null);
    const handleReworkClick = (reworkId: number | string) => {
        setExpandedReworkId(expandedReworkId === reworkId ? null : reworkId);
    };

    const fetchAttachedTags = async () => {
        try {
            const res = await apiFetch(`${API_BASE}/pcbs/${pcb.id}/tags`);
            if (res.ok) {
                setAttachedTags(await res.json());
            }
        } catch (err) { }
    };

    useEffect(() => {
        if (reworks.length === 0) fetchReworks();
        if (tags.length === 0) fetchTags();
        fetchAttachedTags();
    }, [reworks.length, tags.length, fetchReworks, fetchTags, pcb.id]);

    const handleAssignTagDirect = async (tagId: string | number) => {
        try {
            await apiFetch(`${API_BASE}/pcbs/${pcb.id}/tags`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tag_id: tagId })
            });
            await fetchAttachedTags();
            fetchPcbs();
        } catch (err) { }
        setIsAssigningTag(false);
    };

    const handleRemoveTagDirect = async (tag: any) => {
        if (tag.type === 'personal') return; 
        setTagToRemove(tag);
    };

    const confirmRemoveTag = async () => {
        if (!tagToRemove) return;
        try {
            await apiFetch(`${API_BASE}/pcbs/${pcb.id}/tags/${tagToRemove.id}`, {
                method: 'DELETE'
            });
            await fetchAttachedTags();
            fetchPcbs();
        } catch (err) { }
        setTagToRemove(null);
    };

    const confirmRemovePcb = async () => {
        const success = await deletePcb(pcb.id);
        if (success) {
            fetchPcbs();
        }
    };

    const pcbReworks = reworks.filter((r: any) => r.pcb_id === pcb.id);
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    const hasReworks = pcbReworks.length > 0;
    let daysSinceCreation = 999;
    if (pcb.created_at) {
        const createdAt = new Date(pcb.created_at.includes('T') ? pcb.created_at : pcb.created_at.replace(' ', 'T') + 'Z');
        if (!isNaN(createdAt.getTime())) {
            daysSinceCreation = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
        }
    }
    const cannotDelete = hasReworks || daysSinceCreation > 3;
    const deleteTooltip = hasReworks 
        ? "Cannot delete PCB because it has rework logs attached" 
        : (daysSinceCreation > 3 ? "Cannot delete PCB because it was created more than 3 days ago" : "");

    return (
        <div className="card-expanded-content">
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                <EditButton 
                    onClick={(e) => { e.stopPropagation(); editItem('pcbs_edit', pcb.id); }}
                    label={isMobile ? "Edit" : "Edit PCB"}
                />

                <QrButton 
                    onClick={(e) => { e.stopPropagation(); setQrModalBoard(pcb.board_number); }}
                    label={isMobile ? "QR" : "QR Code"}
                />
                
                {isLocalhost && (
                    <DeleteButton 
                        onClick={(e) => { e.stopPropagation(); setIsRemovePcbOpen(true); }}
                        label={isMobile ? "Delete" : "Delete PCB"}
                        disabled={cannotDelete}
                        title={deleteTooltip}
                        style={{
                            opacity: cannotDelete ? 0.35 : 1,
                            cursor: cannotDelete ? 'not-allowed' : 'pointer'
                        }}
                    />
                )}
            </div>

            <div style={{ marginTop: '20px' }}>
                <FormTabs
                    tabs={isMobile ? mobileTabsList : tabsList}
                    activeTab={activeTabIndex}
                    onTabChange={(t) => { setActiveTabIndex(t); setIsAssigningTag(false); }}
                >
                {activeTabName === 'Rework' && (
                    <>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                            <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-muted)', margin: 0 }}>Recent Rework History</h4>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                <ViewButton 
                                    onClick={(e) => { 
                                        e.stopPropagation(); 
                                        setSelectedBoards([pcb.id.toString()]);
                                        setActiveTab('reworks'); 
                                    }}
                                    className=""
                                    label="View Reworks"
                                    icon={null}
                                    style={{ flex: 'none' }}
                                />
                                <AddButton 
                                    onClick={(e) => { e.stopPropagation(); addItem('reworks_add', pcb.id); }}
                                    label="Add Rework"
                                    icon={null}
                                    style={{ flex: 'none' }}
                                />
                            </div>
                        </div>
                        {pcbReworks.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {pcbReworks.slice(0, 5).map((rework: any, index: number) => (
                                    <div key={index} style={{ border: '1px solid var(--border)', borderRadius: '8px', background: 'rgba(255, 255, 255, 0.03)', minWidth: 0, width: '100%', boxSizing: 'border-box' }}>
                                        <ReworkCardHeader 
                                            rework={rework} 
                                            isExpanded={expandedReworkId === rework.id}
                                            onToggle={() => handleReworkClick(rework.id)}
                                        />
                                        {expandedReworkId === rework.id && (
                                            <div style={{ padding: '0 12px 12px 12px' }}>
                                                <ReworkCardBody rework={rework} />
                                            </div>
                                        )}
                                    </div>
                                ))}
                                {pcbReworks.length > 5 && (
                                    <p style={{ fontSize: '0.8rem', color: 'var(--accent)', textAlign: 'center', margin: '4px 0 0 0', cursor: 'pointer', padding: '4px' }}>
                                        + {pcbReworks.length - 5} older reworks...
                                    </p>
                                )}
                            </div>
                        ) : (
                            <p className="no-data" style={{ color: 'var(--text-muted)', fontStyle: 'italic', margin: 0, fontSize: '0.9rem' }}>No rework history logged for this board.</p>
                        )}
                    </>
                )}

                {(activeTabName === 'Public Tags' || activeTabName === 'Personal Tags') && (
                    <>
                        {(() => {
                            const isPersonal = activeTabName === 'Personal Tags';
                            const filteredAttached = attachedTags.filter(t => isPersonal ? t.type === 'personal' : t.type !== 'personal');
                            const filteredAvailable = tags.filter(t => (isPersonal ? t.type === 'personal' : t.type !== 'personal') && !attachedTags.some(at => at.id === t.id));

                            return (
                                <div>
                                    {isAssigningTag ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)', marginBottom: '16px' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>Select {isPersonal ? 'Personal' : 'Public'} Tag to Attach:</span>
                                                <button onClick={(e) => { e.stopPropagation(); setIsAssigningTag(false); }} style={{ background: 'transparent', color: 'var(--text-muted)', border: 'none', cursor: 'pointer' }}><X size={18} /></button>
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '8px' }}>
                                                {filteredAvailable.map(tag => (
                                                    <div 
                                                        key={tag.id} 
                                                        onClick={(e) => { e.stopPropagation(); handleAssignTagDirect(tag.id); }}
                                                        style={{ 
                                                            display: 'flex', alignItems: 'center', gap: '6px', 
                                                            background: `${tag.color}20`, color: tag.color, 
                                                            border: `1px solid ${tag.color}40`, padding: '8px 12px', 
                                                            borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600, 
                                                            cursor: 'pointer', transition: 'all 0.2s',
                                                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                                                        }}
                                                        onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                                                        onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                                    >
                                                        <TagIcon size={14} style={{ flexShrink: 0 }} />
                                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                            {formatTagName(tag)}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                            {filteredAvailable.length === 0 && (
                                                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>All available {isPersonal ? 'personal' : 'public'} tags are already attached.</p>
                                            )}
                                        </div>
                                    ) : (
                                        <AddButton 
                                            onClick={(e) => { e.stopPropagation(); setIsAssigningTag(true); }}
                                            label={`Add ${isPersonal ? 'Personal' : 'Public'} Tag`}
                                            style={{ width: '100%', marginBottom: '16px' }}
                                        />
                                    )}

                                    {filteredAttached.length > 0 ? (
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px dashed var(--border)' }}>
                                            {filteredAttached.map(tag => (
                                                <div key={tag.id} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: `${tag.color}20`, color: tag.color, border: `1px solid ${tag.color}40`, padding: '4px 10px', borderRadius: '100px', fontSize: '0.8rem', fontWeight: 600 }}>
                                                    <TagIcon size={12} />
                                                    {formatTagName(tag)}
                                                    {!isPersonal && (
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); handleRemoveTagDirect(tag); }}
                                                            style={{
                                                                background: 'none', border: 'none', cursor: 'pointer',
                                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                color: tag.color, padding: 0, marginLeft: '4px', opacity: 0.7
                                                            }}
                                                            onMouseOver={(e) => e.currentTarget.style.opacity = '1'}
                                                            onMouseOut={(e) => e.currentTarget.style.opacity = '0.7'}
                                                        >
                                                            <X size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.9rem', margin: 0 }}>
                                            No {isPersonal ? 'personal' : 'public'} tags attached.
                                        </p>
                                    )}
                                </div>
                            );
                        })()}
                    </>
                )}
            </FormTabs>
            </div>

            <RemoveTag 
                isOpen={!!tagToRemove} 
                onClose={() => setTagToRemove(null)} 
                onConfirm={confirmRemoveTag} 
                tag={tagToRemove} 
                pcb={pcb} 
            />

            <RemovePcb 
                isOpen={isRemovePcbOpen}
                onClose={() => setIsRemovePcbOpen(false)}
                onConfirm={confirmRemovePcb}
                pcb={pcb}
            />
        </div>
    );
}
