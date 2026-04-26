import { useEffect, useState } from 'react';
import { ArrowLeft, Save, Trash2 } from 'lucide-react';

import { API_BASE, apiFetch } from '../../store/database/apiBridge';
import { useReworkStore } from '../../store/storeRework';
import { useOwnerStore } from '../../store/storeOwner';
import { FormGroup } from '../../components/forms/FormGroup';

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
            }
            setLoading(false);
        }).catch(err => {
            console.error(err);
            setLoading(false);
        });
    }, [id, fetchOwners]);

    const activePcb = pcbs.find(p => p.id.toString() === selectedPcb);
    const selectedProjData = projects.find(p => p.id === activePcb?.project_id);
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

            if (selectedProjData.formfactors && selectedProjData.formfactors.length > 0) {
                for (const ff of selectedProjData.formfactors) {
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
            const revPart = noPartYet ? "No part yet" : (selectedRevision ? selectedRevision : '');
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

            <form onSubmit={handleUpdate} className="add-form">
                <div className="form-group">
                    <label htmlFor="pcb">Select PCB Board</label>
                    <select 
                        id="pcb" 
                        value={selectedPcb} 
                        onChange={(e) => setSelectedPcb(e.target.value)}
                        required
                    >
                        {pcbs.map(p => <option key={p.id} value={p.id}>{p.board_number}</option>)}
                    </select>
                </div>
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
                                No part yet
                            </label>
                        </div>
                    </FormGroup>
                )}
                <button type="submit" className="submit-button" disabled={saving}>
                    <Save size={18} />
                    <span>{saving ? 'Saving...' : 'Update Rework'}</span>
                </button>
            </form>
        </div>
    );
}
