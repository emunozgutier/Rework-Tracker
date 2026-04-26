import { useEffect, useState } from 'react';
import { ArrowLeft, Save, Trash2 } from 'lucide-react';

import { API_BASE, apiFetch } from '../../store/database/apiBridge';
import { usePcbStore } from '../../store/storePcb';
import { FormGroup } from '../../components/forms/FormGroup';
import { RemovePcb } from '../RemovePage/RemovePcb';

interface EditPCBProps {
    id: string | number;
    onBack: () => void;
    onSuccess: () => void;
}

export function EditPCB({ id, onBack, onSuccess }: EditPCBProps) {
    const [boardNumber, setBoardNumber] = useState('');
    const [status, setStatus] = useState('In Progress');
    const [pcbRev, setPcbRev] = useState('');
    const [bom, setBom] = useState('');
    const [noPartYet, setNoPartYet] = useState(false);
    const [selectedRevision, setSelectedRevision] = useState('');
    const [selectedFormfactor, setSelectedFormfactor] = useState('');
    const [selectedProject, setSelectedProject] = useState('');
    const [selectedOwner, setSelectedOwner] = useState('');
    const [siliconVersion, setSiliconVersion] = useState('');
    
    const [projects, setProjects] = useState<any[]>([]);
    const [owners, setOwners] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const { updatePcb, deletePcb } = usePcbStore();
    const [saving, setSaving] = useState(false);
    const [isRemoveOpen, setIsRemoveOpen] = useState(false);

    const selectedProjData = projects.find(p => p.id.toString() === selectedProject);

    const selectedProjectKey = selectedProjData?.project_key || 'XXX';

    useEffect(() => {
        Promise.all([
            apiFetch(`${API_BASE}/projects`).then(res => res.json()),
            apiFetch(`${API_BASE}/owners`).then(res => res.json()),
            apiFetch(`${API_BASE}/pcbs/${id}`).then(res => res.json())
        ]).then(([projData, ownerData, pcb]) => {
            setProjects(projData);
            setOwners(ownerData);
            if (pcb) {
                const parts = pcb.board_number.split('-');
                const hexPart = parts.length > 1 ? parts.slice(1).join('-') : pcb.board_number;
                setBoardNumber(hexPart);
                setStatus(pcb.status);
                setBom(pcb.bom || '');
                
                // Try to split product_name_and_rev
                const project = projData.find((p: any) => p.id === pcb.project_id);
                let rawProduct = pcb.product_name_and_rev || '';
                let foundRev = '';
                let foundFormfactor = '';
                let foundSilicon = '';
                
                if (project) {
                    // Extract Silicon Corner if present at the end
                    if (project.silicon_corners) {
                        const corners = project.silicon_corners.split(',').map((s: string) => s.trim()).filter(Boolean);
                        for (const corner of corners) {
                            if (rawProduct.endsWith(` ${corner}`) || rawProduct === corner) {
                                foundSilicon = corner;
                                rawProduct = rawProduct.slice(0, rawProduct.length - corner.length).trim();
                                break;
                            }
                        }
                    }

                    if (project.formfactors && project.formfactors.length > 0) {
                        for (const ff of project.formfactors) {
                            if (rawProduct.startsWith(ff.name)) {
                                foundFormfactor = ff.name;
                                rawProduct = rawProduct.slice(ff.name.length).trim();
                                for (const rev of ff.revisions) {
                                    if (rawProduct.endsWith(` ${rev}`) || rawProduct === rev) {
                                        foundRev = rev;
                                        rawProduct = rawProduct.slice(0, rawProduct.length - rev.length).trim();
                                        break;
                                    }
                                }
                                break;
                            }
                        }
                    }
                    if (!foundFormfactor && project.revisions) {
                        for (const rev of project.revisions) {
                            if (rawProduct.endsWith(` ${rev}`) || rawProduct === rev) {
                                foundRev = rev;
                                rawProduct = rawProduct.slice(0, rawProduct.length - rev.length).trim();
                                break;
                            }
                        }
                    }
                }
                
                if (rawProduct === "No part yet") {
                    setNoPartYet(true);
                    setPcbRev('');
                } else {
                    setNoPartYet(false);
                    setPcbRev(rawProduct);
                }
                setSiliconVersion(foundSilicon);
                setSelectedFormfactor(foundFormfactor);
                setSelectedRevision(foundRev);
                setSelectedProject(pcb.project_id.toString());
                setSelectedOwner(pcb.owner_id ? pcb.owner_id.toString() : '');
            }
            setLoading(false);
        }).catch(err => {
            console.error(err);
            setLoading(false);
        });
    }, [id]);



    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        const finalPcbRev = pcbRev;
        const revPart = noPartYet ? "No part yet" : (selectedRevision ? selectedRevision : '');
        const cornerPart = noPartYet ? "" : siliconVersion;
        const ffPart = selectedFormfactor ? selectedFormfactor : '';
        const combinedProduct = [ffPart, finalPcbRev, revPart, cornerPart].filter(Boolean).join(' ').trim();
        const finalBoardName = `${selectedProjectKey}-${boardNumber.toUpperCase()}`;
        
        const success = await updatePcb(id, {
            board_number: finalBoardName,
            status,
            product_name_and_rev: combinedProduct,
            bom: bom.trim(),
            project_id: selectedProject ? parseInt(selectedProject) : null,
            owner_id: selectedOwner ? parseInt(selectedOwner) : null
        });
        if (success) onSuccess();
        setSaving(false);
    };

    const handleConfirmedDelete = async () => {
        setSaving(true);
        const success = await deletePcb(id);
        if (success) onSuccess();
        setSaving(false);
    };

    if (loading) return <div className="loading">Loading PCB...</div>;

    return (
        <div className="add-page-container">
            <header className="add-page-header">
                <button onClick={onBack} className="back-button">
                    <ArrowLeft size={20} />
                </button>
                <h2>Edit PCB Board</h2>
                <button type="button" onClick={() => setIsRemoveOpen(true)} className="delete-icon-button" title="Delete PCB">
                    <Trash2 size={20} color="#ef4444" />
                </button>
            </header>

                        <form onSubmit={handleUpdate} className="add-form">
                <FormGroup title="Instance">
                    <div className="form-row">
                        <div className="form-group flex-1">
                            <label>Assigned Name</label>
                            <div style={{ padding: '0.75rem', backgroundColor: 'var(--bg-panel)', borderRadius: '4px', color: 'var(--text-muted)', fontSize: '1rem', fontWeight: 500, textTransform: 'uppercase', border: '1px solid var(--border-color)' }}>
                                {selectedProjectKey}-{boardNumber}
                            </div>
                        </div>
                        <div className="form-group flex-1">
                            <label htmlFor="owner">Owner</label>
                            <select 
                                id="owner" 
                                value={selectedOwner} 
                                onChange={(e) => setSelectedOwner(e.target.value)}
                            >
                                <option value="">Unassigned</option>
                                {owners.map(o => <option key={o.id} value={o.id}>@{o.username}</option>)}
                            </select>
                        </div>
                    </div>
                </FormGroup>

                <FormGroup title="Silicon">
                    <div style={{ 
                        marginBottom: '1rem', 
                        padding: '0.75rem', 
                        backgroundColor: 'rgba(255, 255, 255, 0.05)', 
                        borderLeft: '3px solid var(--accent)', 
                        borderRadius: '0 4px 4px 0',
                        fontSize: '0.875rem',
                        color: 'var(--text-muted)'
                    }}>
                        Note: To change silicon you need to fill rework log.
                    </div>
                    <div className="form-row">
                        <div className="form-group flex-1">
                            <label>Project</label>
                            <div style={{ padding: '0.75rem', backgroundColor: 'rgba(255, 255, 255, 0.03)', borderRadius: '6px', color: 'var(--text-muted)', fontSize: '1rem', fontWeight: 500, border: '1px dashed rgba(255, 255, 255, 0.1)' }}>
                                {projects.find(p => p.id.toString() === selectedProject)?.name || 'Unknown'}
                            </div>
                        </div>
                        <div className="form-group flex-1">
                            <label>Rev</label>
                            <div style={{ padding: '0.75rem', backgroundColor: 'rgba(255, 255, 255, 0.03)', borderRadius: '6px', color: 'var(--text-muted)', fontSize: '1rem', fontWeight: 500, border: '1px dashed rgba(255, 255, 255, 0.1)' }}>
                                {noPartYet ? 'No part yet' : (selectedRevision || 'N/A')}
                            </div>
                        </div>
                        <div className="form-group flex-1">
                            <label>Corner</label>
                            <div style={{ padding: '0.75rem', backgroundColor: 'rgba(255, 255, 255, 0.03)', borderRadius: '6px', color: 'var(--text-muted)', fontSize: '1rem', fontWeight: 500, border: '1px dashed rgba(255, 255, 255, 0.1)' }}>
                                {noPartYet ? 'No part yet' : (siliconVersion || 'N/A')}
                            </div>
                        </div>
                    </div>
                </FormGroup>

                <FormGroup title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        PCB
                        <span 
                            title="Base PCB configuration cannot be changed after creation." 
                            style={{ 
                                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                width: '16px', height: '16px', borderRadius: '50%', background: 'var(--accent)', 
                                color: 'white', fontSize: '10px', fontWeight: 'bold', cursor: 'help' 
                            }}
                        >
                            ?
                        </span>
                    </div>
                }>
                    <div className="form-row">
                        <div className="form-group flex-1">
                            <label>Flavor</label>
                            <div style={{ padding: '0.75rem', backgroundColor: 'rgba(255, 255, 255, 0.03)', borderRadius: '6px', color: 'var(--text-muted)', fontSize: '1rem', fontWeight: 500, border: '1px dashed rgba(255, 255, 255, 0.1)' }}>
                                {selectedFormfactor || 'N/A'}
                            </div>
                        </div>
                        <div className="form-group flex-1">
                            <label>Rev Number</label>
                            <div style={{ padding: '0.75rem', backgroundColor: 'rgba(255, 255, 255, 0.03)', borderRadius: '6px', color: 'var(--text-muted)', fontSize: '1rem', fontWeight: 500, border: '1px dashed rgba(255, 255, 255, 0.1)' }}>
                                {pcbRev || 'N/A'}
                            </div>
                        </div>
                        <div className="form-group flex-1">
                            <label>BOM</label>
                            <div style={{ padding: '0.75rem', backgroundColor: 'rgba(255, 255, 255, 0.03)', borderRadius: '6px', color: 'var(--text-muted)', fontSize: '1rem', fontWeight: 500, border: '1px dashed rgba(255, 255, 255, 0.1)' }}>
                                {bom || 'Unknown'}
                            </div>
                        </div>
                    </div>
                </FormGroup>

                <button type="submit" className="submit-button" disabled={saving}>
                    <Save size={18} />
                    <span>{saving ? 'Saving...' : 'Update PCB Board'}</span>
                </button>
            </form>

            <RemovePcb 
                isOpen={isRemoveOpen}
                onClose={() => setIsRemoveOpen(false)}
                onConfirm={handleConfirmedDelete}
                pcb={{ board_number: `${selectedProjectKey}-${boardNumber}` }}
            />
        </div>
    );
}
