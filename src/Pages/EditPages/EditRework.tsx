import { useEffect, useState } from 'react';
import { ArrowLeft, Save, Trash2 } from 'lucide-react';

import { API_BASE, apiFetch } from '../../store/database/apiBridge';
import { useReworkStore } from '../../store/useReworkStore';
import { useOwnerStore } from '../../store/useOwnerStore';
import { FormGroup } from '../../components/forms/FormGroup';
import { useDeleteEditRequirements } from '../../store/useDeleteEditRequirements';
import { BoardName } from '../../components/BoardName';

interface EditReworkProps {
    id: string | number;
    onBack: () => void;
    onSuccess: () => void;
}

export function EditRework({ id, onBack, onSuccess }: EditReworkProps) {
    const [pcbs, setPcbs] = useState<any[]>([]);
    const [projects, setProjects] = useState<any[]>([]);
    const [selectedPcb, setSelectedPcb] = useState('');
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [ownerId, setOwnerId] = useState('-1');
    const [reworkType, setReworkType] = useState('Minor');
    const [selectedRevision, setSelectedRevision] = useState('');
    const [siliconVersion, setSiliconVersion] = useState('');
    const [noPartYet, setNoPartYet] = useState(false);
    const [loading, setLoading] = useState(true);
    const { updateRework, deleteRework } = useReworkStore();
    const { owners, fetchOwners } = useOwnerStore();
    const [saving, setSaving] = useState(false);
    const [isEditable, setIsEditable] = useState(true);
    const [reworkAgeDays, setReworkAgeDays] = useState(0);


    const activePcb = pcbs.find(p => p.id.toString() === selectedPcb);
    const selectedProjData = projects.find(p => p.id === activePcb?.project_id);

    useEffect(() => {
        fetchOwners();
        Promise.all([
            apiFetch(`${API_BASE}/pcbs`).then(res => res.json()),
            apiFetch(`${API_BASE}/projects`).then(res => res.json()),
            apiFetch(`${API_BASE}/reworks/${id}`).then(res => res.json())
        ]).then(([pcbData, projData, rework]) => {
            setPcbs(pcbData);
            setProjects(projData);
            if (rework) {
                setSelectedPcb(rework.pcb_id.toString());
                setTitle(rework.title || '');
                setDescription(rework.description);
                setOwnerId(rework.owner_id ? rework.owner_id.toString() : '-1');
                setReworkType(rework.rework_type || 'Minor');
                
                // Validate if rework is older than 2 weeks (14 days)
                const { requirementsMet, daysOld } = useDeleteEditRequirements.getState().checkReworkEditRequirements(rework);
                setIsEditable(requirementsMet);
                setReworkAgeDays(daysOld);
            }
            setLoading(false);
        }).catch(err => {
            console.error(err);
            setLoading(false);
        });
    }, [id, fetchOwners]);


    const availableSiliconVersions = selectedProjData?.silicon_corners ? selectedProjData.silicon_corners.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
    const availableSiliconRevisions = selectedProjData?.revisions || [];

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        let new_product = undefined;
        if (reworkType === 'Silicon Swap' && activePcb && selectedProjData) {
            let rawProduct = activePcb.product || '';
            let foundFormfactor = '';
            let finalPcbRev = '';

            if (selectedProjData.flavors && selectedProjData.flavors.length > 0) {
                for (const ff of selectedProjData.flavors) {
                    if (rawProduct.startsWith(ff.name)) {
                        foundFormfactor = ff.name;
                        rawProduct = rawProduct.slice(ff.name.length).trim();
                        for (const rev of ff.revisions) {
                            if (rawProduct.startsWith(rev)) {
                                finalPcbRev = rev;
                                break;
                            }
                        }
                        break;
                    }
                }
            }

            const cornerPart = noPartYet ? "" : siliconVersion;
            const revPart = noPartYet ? "No part" : (selectedRevision ? selectedRevision : '');
            new_product = [foundFormfactor, finalPcbRev, revPart, cornerPart].filter(Boolean).join(' ').trim();
        }

        const success = await updateRework(id, {
            pcb_id: selectedPcb ? parseInt(selectedPcb) : null,
            title,
            description,
            owner_id: ownerId,
            rework_type: reworkType,
            new_product
        });
        if (success) onSuccess();
        setSaving(false);
    };

    const handleDelete = async () => {
        if (!window.confirm('Are you sure you want to delete this rework record?')) return;
        setSaving(true);
        const success = await deleteRework(id);
        if (success) onSuccess();
        setSaving(false);
    };

    if (loading) return <div className="loading">Loading Rework...</div>;

    return (
        <div className="add-page-container">
            <header className="add-page-header">
                <button onClick={onBack} className="back-button">
                    <ArrowLeft size={20} />
                </button>
                <h2>Edit Rework</h2>
                <button onClick={handleDelete} className="delete-icon-button" title="Delete Rework">
                    <Trash2 size={20} color="#ef4444" />
                </button>
            </header>

            {!isEditable && (
                <div style={{ 
                    color: '#f97316', 
                    backgroundColor: 'rgba(249, 115, 22, 0.1)', 
                    border: '1px solid rgba(249, 115, 22, 0.2)', 
                    borderRadius: '8px', 
                    padding: '12px 16px', 
                    fontSize: '0.95rem', 
                    marginBottom: '20px', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px', 
                    lineHeight: '1.4' 
                }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    <span>This rework log is older than 2 weeks (Age: {reworkAgeDays.toFixed(1)} days) and cannot be edited.</span>
                </div>
            )}

            <form onSubmit={handleUpdate} className="add-form">
                <fieldset disabled={!isEditable} style={{ border: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <FormGroup title="PCB Board & Checksum">
                    <div className="form-group" style={{ marginBottom: 0 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>PCB</span>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                            </svg>
                        </label>
                        <div style={{ 
                            padding: '12px 16px', 
                            backgroundColor: 'rgba(0, 0, 0, 0.2)', 
                            borderRadius: '10px', 
                            border: '1px solid var(--border)', 
                            fontSize: '1.05rem', 
                            color: 'var(--text)',
                            display: 'flex',
                            alignItems: 'center',
                            fontWeight: 500,
                            boxSizing: 'border-box',
                            height: '48px',
                            minWidth: '200px'
                        }}>
                            {activePcb ? (
                                <BoardName name={activePcb.board_number} isHex={selectedProjData?.number_format === 'hex'} />
                            ) : (
                                'Unknown'
                            )}
                        </div>
                    </div>
                </FormGroup>

                <div className="form-group">
                    <label htmlFor="rework_type">Rework Type</label>
                    <select id="rework_type" value={reworkType} onChange={(e) => setReworkType(e.target.value)}>
                        <option value="Minor">Minor</option>
                        <option value="Major">Major</option>
                        <option value="Resistor Swap">Resistor Swap</option>
                        <option value="Silicon Swap">Silicon Swap</option>
                    </select>
                </div>

                {reworkType === 'Silicon Swap' && (
                    <FormGroup title="New Silicon Data">
                        <div className="form-row">
                            <div className="form-group flex-1">
                                <label htmlFor="revision">Rev</label>
                                <select 
                                    id="revision"
                                    value={selectedRevision}
                                    onChange={(e) => setSelectedRevision(e.target.value)} disabled={noPartYet}
                                >
                                    <option value="">N/A</option>
                                    {availableSiliconRevisions.map((rev: string) => (
                                        <option key={rev} value={rev}>{rev}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group flex-1">
                                <label htmlFor="silicon_version">Corner</label>
                                <select 
                                    id="silicon_version"
                                    value={siliconVersion}
                                    onChange={(e) => setSiliconVersion(e.target.value)} disabled={noPartYet}
                                >
                                    <option value="">N/A</option>
                                    {availableSiliconVersions.map((v: string) => (
                                        <option key={v} value={v}>{v}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="form-row">
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'normal', fontSize: '1rem', cursor: 'pointer', color: 'var(--text-muted)' }}>
                                <input 
                                    type="checkbox" 
                                    checked={noPartYet} 
                                    onChange={(e) => {
                                        setNoPartYet(e.target.checked);
                                        if (e.target.checked) {
                                            setSelectedRevision('');
                                            setSiliconVersion('');
                                        }
                                    }} 
                                />
                                No part
                            </label>
                        </div>
                    </FormGroup>
                )}
                <div className="form-group">
                    <label htmlFor="title">Rework Title</label>
                    <input 
                        type="text"
                        id="title"
                        value={title} 
                        onChange={(e) => setTitle(e.target.value)} 
                        placeholder="E.g. Resistor R12 Replacement"
                        required
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="description">Rework Description (Optional)</label>
                    <textarea 
                        id="description"
                        value={description} 
                        onChange={(e) => setDescription(e.target.value)} 
                        rows={4}
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="owner">Assigned Owner</label>
                    <select id="owner" value={ownerId} onChange={(e) => setOwnerId(e.target.value)}>
                        <option value="-1">-- Unassigned --</option>
                        {owners.map(o => <option key={o.id} value={o.id.toString()}>@{o.username}</option>)}
                    </select>
                </div>
                </fieldset>
                <button type="submit" className="submit-button" disabled={saving || !isEditable} style={{ opacity: isEditable ? 1 : 0.5, cursor: isEditable ? 'pointer' : 'not-allowed' }}>
                    <Save size={18} />
                    <span>{saving ? 'Saving...' : 'Update Rework'}</span>
                </button>
            </form>
        </div>
    );
}
