import { useEffect, useState } from 'react';
import { useReworkStore } from '../../../store/clientDataBase/useReworkStore';
import { useTagStore } from '../../../store/clientDataBase/useTagStore';
import { useAppState } from '../../../store/useAppState';
import { usePcbStore } from '../../../store/clientDataBase/usePcbStore';
import { API_BASE, apiFetch } from '../../../store/serverDataBase/apiBridge';
import { FormTabs } from '../../../components/forms/FormTabs';
import { RemoveTag } from '../../RemovePage/RemoveTag';
import { Tag as TagIcon, X } from 'lucide-react';
import { formatTagName } from '../../../store/clientDataBase/useTagStore';
import { EditButton, ViewButton, AddButton, QrButton, DeleteButton, DocsButton } from '../../../components/forms/ActionButtons';
import { RemovePcb } from '../../RemovePage/RemovePcb';
import { UploadedDocsModal } from '../../PopupPage/UploadedDocsModal';
import { ReworkCardBody } from './ReworkCardBody';
import { useProjectStore } from '../../../store/clientDataBase/useProjectStore';

interface PcbCardBodyProps {
    pcb: any;
}

export function PcbCardBody({ pcb }: PcbCardBodyProps) {
    const { reworks, fetchReworks, setSelectedBoards } = useReworkStore();
    const { tags, fetchTags } = useTagStore();
    const { fetchPcbs, deletePcb } = usePcbStore();
    const { addItem, setActiveTab, setQrModalBoard, editItem, isMobile, currentUserRole, allowGuestMinorRework, debugBypassPermissions } = useAppState();
    const { projects, projectDocs, fetchDocs } = useProjectStore();

    const isSuperUser = currentUserRole === 'Super User' || debugBypassPermissions;

    const canAddRework = isSuperUser || currentUserRole === 'User' || (currentUserRole === 'Guest' && allowGuestMinorRework);

    const [attachedTags, setAttachedTags] = useState<any[]>([]);
    const [isAssigningTag, setIsAssigningTag] = useState(false);
    const [tagToRemove, setTagToRemove] = useState<any>(null);
    const [isRemovePcbOpen, setIsRemovePcbOpen] = useState(false);
    const [isDocsPopupOpen, setIsDocsPopupOpen] = useState(false);
    const [activeTabIndex, setActiveTabIndex] = useState(0);
    const tabsList = ['Rework', 'Tags'];
    const mobileTabsList = ['Rework', 'Tags'];
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

    const project = projects.find(p => p.id === pcb.project_id);

    let schematicFilename = '';
    let boardFileFilename = '';
    let bomCsvFilename = '';
    let datasheetFilename = '';

    if (project) {
        if (project.packages && project.packages.length > 0) {
            for (const pkg of project.packages) {
                if (pcb.package_name && pkg.name !== pcb.package_name) continue;
                for (const ff of (pkg.formfactors || [])) {
                    if (pcb.board_flavor && ff.name !== pcb.board_flavor) continue;
                    for (const r of (ff.revisionDetails || [])) {
                        if (pcb.board_rev && r.name === pcb.board_rev) {
                            schematicFilename = r.schematic || r.doc || '';
                            boardFileFilename = r.board_file || '';
                            bomCsvFilename = r.bom_csv || '';
                            datasheetFilename = r.datasheet || '';
                            break;
                        }
                    }
                }
                if (!schematicFilename) {
                    for (const sv of (pkg.silicon_versions || [])) {
                        if (pcb.silicon_rev && sv.name !== pcb.silicon_rev) continue;
                        for (const ff of (sv.formfactors || [])) {
                            if (pcb.board_flavor && ff.name !== pcb.board_flavor) continue;
                            for (const r of (ff.revisionDetails || [])) {
                                if (pcb.board_rev && r.name === pcb.board_rev) {
                                    schematicFilename = r.schematic || r.doc || '';
                                    boardFileFilename = r.board_file || '';
                                    bomCsvFilename = r.bom_csv || '';
                                    datasheetFilename = r.datasheet || '';
                                    break;
                                }
                            }
                        }
                    }
                }
            }
        }
        if (!schematicFilename && pcb.board_flavor && pcb.board_rev) {
            const ff = project.flavors?.find(f => f.name === pcb.board_flavor);
            if (ff && ff.revisionDetails) {
                const revDetail = ff.revisionDetails.find(r => r.name === pcb.board_rev);
                if (revDetail) {
                    schematicFilename = revDetail.schematic || revDetail.doc || '';
                    boardFileFilename = revDetail.board_file || '';
                    bomCsvFilename = revDetail.bom_csv || '';
                    datasheetFilename = revDetail.datasheet || '';
                }
            }
        }
    }

    const docs = project ? (projectDocs[project.id.toString()] || []) : [];
    const schematicDoc = docs.find(s => s.filename === schematicFilename) || (schematicFilename ? { id: schematicFilename, filename: schematicFilename, path: `/docs/${schematicFilename}` } : null);
    const boardFileDoc = docs.find(s => s.filename === boardFileFilename) || (boardFileFilename ? { id: boardFileFilename, filename: boardFileFilename, path: `/docs/${boardFileFilename}` } : null);
    const bomCsvDoc = docs.find(s => s.filename === bomCsvFilename) || (bomCsvFilename ? { id: bomCsvFilename, filename: bomCsvFilename, path: `/docs/${bomCsvFilename}` } : null);
    const datasheetDoc = docs.find(s => s.filename === datasheetFilename) || (datasheetFilename ? { id: datasheetFilename, filename: datasheetFilename, path: `/docs/${datasheetFilename}` } : null);


    useEffect(() => {
        if (project && !projectDocs[project.id.toString()]) {
            fetchDocs(project.id);
        }
    }, [project, projectDocs, fetchDocs]);

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

    const pcbReworks = reworks
        .filter((r: any) => r.pcb_id === pcb.id)
        .sort((a: any, b: any) => {
            if (a.timestamp && b.timestamp) {
                return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
            }
            return b.id - a.id;
        });

    const hasAnyDocs = Boolean(schematicDoc || boardFileDoc || bomCsvDoc || datasheetDoc);




    return (
        <div className="card-expanded-content">
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                <EditButton 
                    onClick={(e) => { e.stopPropagation(); editItem('pcbs_edit', pcb.id); }}
                    disabled={!isSuperUser}
                    title={!isSuperUser ? "Only super users can do that" : "Edit PCB"}
                    label={isMobile ? "" : "Edit PCB"}
                />

                {hasAnyDocs && (
                    <DocsButton 
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsDocsPopupOpen(true);
                        }}
                        label={isMobile ? "" : "Docs"}
                    />
                )}

                <QrButton 
                    onClick={(e) => { e.stopPropagation(); setQrModalBoard(pcb.board_number); }}
                    label={isMobile ? "" : "QR Code"}
                />
                
                <DeleteButton 
                    onClick={(e) => { e.stopPropagation(); setIsRemovePcbOpen(true); }}
                    disabled={!isSuperUser}
                    title={!isSuperUser ? "Only super users can do that" : "Delete PCB"}
                    label={isMobile ? "" : "Delete PCB"}
                />
            </div>

            {pcb.manufacturer_id && (
                <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 12px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    marginBottom: '16px',
                    fontSize: '0.85rem'
                }}>
                    <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Manufacturer ID:</span>
                    <span style={{ color: 'var(--text)', fontWeight: 600, fontFamily: 'monospace', letterSpacing: '0.5px' }}>
                        {pcb.manufacturer_id}
                    </span>
                </div>
            )}

            <div style={{ marginTop: pcb.manufacturer_id ? '4px' : '20px' }}>
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
                                {canAddRework && (
                                    <AddButton 
                                        onClick={(e) => { e.stopPropagation(); addItem('reworks_add', pcb.id); }}
                                        label="Add Rework"
                                        icon={null}
                                        style={{ flex: 'none' }}
                                    />
                                )}
                            </div>
                        </div>
                        {pcbReworks.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {pcbReworks.slice(0, 5).map((rework) => (
                                    <div 
                                        key={rework.id} 
                                        style={{ 
                                            background: 'rgba(255,255,255,0.02)', 
                                            border: '1px solid var(--border)', 
                                            borderRadius: '6px',
                                            overflow: 'hidden'
                                        }}
                                    >
                                        <div 
                                            onClick={() => handleReworkClick(rework.id)}
                                            style={{
                                                padding: '10px 14px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                cursor: 'pointer',
                                                userSelect: 'none',
                                                background: expandedReworkId === rework.id ? 'rgba(255,255,255,0.04)' : 'transparent',
                                                transition: 'background 0.2s ease'
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ fontWeight: 600, color: 'var(--accent)', fontSize: '0.9rem' }}>
                                                    {rework.pcb_board_number || (rework as any).board_number || pcb.board_number}-R{String(rework.rework_number).padStart(3, '0')}
                                                </span>
                                                <span style={{
                                                    fontSize: '0.75rem',
                                                    padding: '2px 8px',
                                                    borderRadius: '12px',
                                                    background: rework.rework_type === 'Major' ? 'rgba(239, 68, 68, 0.15)' : rework.rework_type === 'Silicon Swap' ? 'rgba(168, 85, 247, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                                                    color: rework.rework_type === 'Major' ? '#ef4444' : rework.rework_type === 'Silicon Swap' ? '#a855f7' : '#3b82f6',
                                                    border: `1px solid ${rework.rework_type === 'Major' ? 'rgba(239, 68, 68, 0.3)' : rework.rework_type === 'Silicon Swap' ? 'rgba(168, 85, 247, 0.3)' : 'rgba(59, 130, 246, 0.3)'}`
                                                }}>
                                                    {rework.rework_type || 'Minor'}
                                                </span>
                                                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                                    {rework.title || rework.description}
                                                </span>
                                            </div>
                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                {new Date(rework.timestamp).toLocaleDateString()}
                                            </span>
                                        </div>
                                        {expandedReworkId === rework.id && (
                                            <div style={{ borderTop: '1px solid var(--border)', padding: '12px 14px' }}>
                                                <ReworkCardBody rework={rework} />
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontStyle: 'italic' }}>
                                No rework history found for this board.
                            </div>
                        )}
                    </>
                )}

                {activeTabName === 'Tags' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                            {attachedTags.map((tag) => (
                                <span 
                                    key={tag.id} 
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '4px 10px',
                                        borderRadius: '16px',
                                        backgroundColor: tag.color ? `${tag.color}22` : 'rgba(99, 102, 241, 0.15)',
                                        color: tag.color || 'var(--accent)',
                                        border: `1px solid ${tag.color ? `${tag.color}66` : 'rgba(99, 102, 241, 0.3)'}`,
                                        fontSize: '0.85rem',
                                        fontWeight: 500
                                    }}
                                >
                                    <TagIcon size={12} />
                                    {formatTagName(tag)}
                                    {isSuperUser && (
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); handleRemoveTagDirect(tag); }}
                                            style={{
                                                background: 'none',
                                                border: 'none',
                                                cursor: 'pointer',
                                                padding: 0,
                                                color: 'inherit',
                                                opacity: 0.7,
                                                display: 'flex',
                                                alignItems: 'center'
                                            }}
                                            title="Detach Tag"
                                        >
                                            <X size={12} />
                                        </button>
                                    )}
                                </span>
                            ))}
                            
                            {isSuperUser && !isAssigningTag && (
                                <button 
                                    onClick={() => setIsAssigningTag(true)}
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        padding: '4px 10px',
                                        borderRadius: '16px',
                                        background: 'rgba(255, 255, 255, 0.05)',
                                        border: '1px dashed var(--border)',
                                        color: 'var(--text-muted)',
                                        fontSize: '0.85rem',
                                        cursor: 'pointer'
                                    }}
                                >
                                    + Assign Tag
                                </button>
                            )}
                        </div>

                        {isAssigningTag && (
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '8px' }}>
                                <select 
                                    onChange={(e) => {
                                        if (e.target.value) handleAssignTagDirect(e.target.value);
                                    }}
                                    defaultValue=""
                                    style={{
                                        padding: '6px 12px',
                                        borderRadius: '4px',
                                        background: 'var(--bg-secondary)',
                                        border: '1px solid var(--border)',
                                        color: 'var(--text)',
                                        fontSize: '0.85rem'
                                    }}
                                >
                                    <option value="" disabled>Select a tag to assign...</option>
                                    {tags
                                        .filter(t => !attachedTags.some(at => at.id === t.id))
                                        .map(t => (
                                            <option key={t.id} value={t.id}>
                                                {formatTagName(t)}
                                            </option>
                                        ))
                                    }
                                </select>
                                <button 
                                    onClick={() => setIsAssigningTag(false)}
                                    style={{
                                        padding: '6px 10px',
                                        background: 'none',
                                        border: '1px solid var(--border)',
                                        borderRadius: '4px',
                                        color: 'var(--text-muted)',
                                        cursor: 'pointer',
                                        fontSize: '0.85rem'
                                    }}
                                >
                                    Cancel
                                </button>
                            </div>
                        )}
                    </div>
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

            <UploadedDocsModal 
                isOpen={isDocsPopupOpen} 
                onClose={() => setIsDocsPopupOpen(false)} 
                project={project ? { id: project.id, name: project.name, project_key: project.project_key } : null}
                pcb={{ id: pcb.id, board_number: pcb.board_number }}
            />
        </div>
    );
}
