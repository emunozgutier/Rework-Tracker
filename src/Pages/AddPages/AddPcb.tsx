import { useEffect, useState } from 'react';
import { ArrowLeft, Save } from 'lucide-react';

import { API_BASE, apiFetch } from '../../store/database/apiBridge';
import { usePcbStore } from '../../store/storePcb';
import { FormGroup } from '../../components/forms/FormGroup';
import { generateCRC } from '../../components/UrlManager/crc';

interface AddPCBProps {
    onBack: () => void;
    onSuccess: () => void;
}

export function AddPCB({ onBack, onSuccess }: AddPCBProps) {
    const [boardNumber, setBoardNumber] = useState('');
    const [status] = useState('In Progress');
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
    const { addPcb, pcbs, fetchPcbs, loading } = usePcbStore();
    const [lastAutoFilledProject, setLastAutoFilledProject] = useState('');

    useEffect(() => {
        if (pcbs.length === 0) fetchPcbs();
    }, [fetchPcbs, pcbs.length]);

    const selectedProjData = projects.find(p => p.id.toString() === selectedProject);
    const availableFormfactors = selectedProjData?.formfactors || [];
    const availableSiliconVersions = selectedProjData?.silicon_corners ? selectedProjData.silicon_corners.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
    
    const availableSiliconRevisions = selectedProjData?.revisions || [];
    let availablePcbRevisions: string[] = [];
    let availableBoms: string[] = [];
    if (selectedProject && selectedFormfactor) {
        const ff = availableFormfactors.find((f: any) => f.name === selectedFormfactor);
        availablePcbRevisions = ff ? ff.revisions : [];
        availableBoms = ff && ff.boms ? ff.boms : [];
    }
    const selectedProjectKey = selectedProjData?.project_key || 'XXX';

    useEffect(() => {
        // Trigger autofill of the next hex number when the selected project changes
        if (selectedProjData && selectedProject !== lastAutoFilledProject && pcbs) {
            // Check if there are PCBs matching this project
            const projectPcbs = pcbs.filter(p => p.project === selectedProjData.name);
            let nextHex = '0001';
            
            if (projectPcbs.length > 0) {
                const hexValues = projectPcbs.map(p => {
                    const parts = p.board_number.split('-');
                    if (parts.length > 1) {
                        return parseInt(parts.slice(-1)[0], 16);
                    }
                    return NaN;
                }).filter(n => !isNaN(n));
                
                if (hexValues.length > 0) {
                    const maxHex = Math.max(...hexValues);
                    nextHex = (maxHex + 1).toString(16).toUpperCase().padStart(4, '0');
                }
            }
            setBoardNumber(nextHex);
            setLastAutoFilledProject(selectedProject);
        }
    }, [selectedProject, selectedProjData, pcbs, lastAutoFilledProject]);

    useEffect(() => {
        // Fetch projects and owners for dropdowns
        Promise.all([
            apiFetch(`${API_BASE}/projects`).then(res => res.json()),
            apiFetch(`${API_BASE}/owners`).then(res => res.json())
        ]).then(([projData, ownerData]) => {
            setProjects(projData);
            setOwners(ownerData);
            if (projData.length > 0) {
                const firstProj = projData[0];
                setSelectedProject(firstProj.id.toString());
                if (firstProj.silicon_corners) {
                    const corners = firstProj.silicon_corners.split(',').map((s: string) => s.trim()).filter(Boolean);
                    setSiliconVersion(corners.length > 0 ? corners[0] : '');
                }
                if (firstProj.formfactors && firstProj.formfactors.length > 0) {
                    setSelectedFormfactor(firstProj.formfactors[0].name);
                    setSelectedRevision(firstProj.revisions && firstProj.revisions.length > 0 ? firstProj.revisions[0] : '');
                    setPcbRev(firstProj.formfactors[0].revisions[0] || '');
                    setBom(firstProj.formfactors[0].boms ? firstProj.formfactors[0].boms[0] : '');
                } else if (firstProj.revisions && firstProj.revisions.length > 0) {
                    setSelectedFormfactor('');
                    setSelectedRevision(firstProj.revisions[0]);
                    setPcbRev('');
                    setBom('');
                }
            }
            if (ownerData.length > 0) setSelectedOwner(ownerData[0].id.toString());
        }).catch(err => console.error('Failed to pre-fetch data:', err));
    }, []);

    const handleProjectChange = (id: string) => {
        setSelectedProject(id);
        const project = projects.find(p => p.id.toString() === id);
        
        if (project && project.silicon_corners) {
            const corners = project.silicon_corners.split(',').map((s: string) => s.trim()).filter(Boolean);
            setSiliconVersion(corners.length > 0 ? corners[0] : '');
        } else {
            setSiliconVersion('');
        }

        if (project && project.formfactors && project.formfactors.length > 0) {
            setSelectedFormfactor(project.formfactors[0].name);
            setSelectedRevision(project.revisions && project.revisions.length > 0 ? project.revisions[0] : '');
            setPcbRev(project.formfactors[0].revisions[0] || '');
            setBom(project.formfactors[0].boms ? project.formfactors[0].boms[0] : '');
        } else if (project && project.revisions && project.revisions.length > 0) {
            setSelectedFormfactor('');
            setSelectedRevision(project.revisions[0]);
            setPcbRev('');
            setBom('');
        } else {
            setSelectedFormfactor('');
            setSelectedRevision('');
            setPcbRev('');
            setBom('');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        const finalPcbRev = pcbRev;
        const revPart = noPartYet ? "No part yet" : (selectedRevision ? selectedRevision : '');
        const cornerPart = noPartYet ? "" : siliconVersion;
        const ffPart = selectedFormfactor ? selectedFormfactor : '';
        
        const isNA = (str: string) => {
            const s = str.trim().toLowerCase();
            return s === 'n/a' || s === 'na' || s === 'not applicable';
        };
        
        const rawParts = [ffPart, finalPcbRev, revPart, cornerPart].filter(Boolean);
        const cleanParts: string[] = [];
        let hasNA = false;
        for (const part of rawParts) {
            if (isNA(part)) {
                if (!hasNA) {
                    cleanParts.push("N/A");
                    hasNA = true;
                }
            } else {
                cleanParts.push(part);
            }
        }
        const combinedProduct = cleanParts.join(' ').trim();
        const finalBoardName = `${selectedProjectKey}-${boardNumber.toUpperCase()}`;
        const crc = generateCRC(finalBoardName);
        const finalBoardWithCrc = `${finalBoardName}${crc}`;
        
        const success = await addPcb({
            board_number: finalBoardWithCrc,
            status,
            product_name_and_rev: combinedProduct,
            bom: bom.trim(),
            project_id: selectedProject ? parseInt(selectedProject) : null,
            owner_id: selectedOwner ? parseInt(selectedOwner) : null
        });
        if (success) {
            onSuccess();
        }
    };

    return (
        <div className="add-page-container">
            <header className="add-page-header">
                <button onClick={onBack} className="back-button">
                    <ArrowLeft size={20} />
                </button>
                <h2>Add New PCB Board</h2>
            </header>

            <form onSubmit={handleSubmit} className="add-form">
                <FormGroup title="Silicon">
                    <div className="form-row">
                        <div className="form-group flex-1">
                            <label htmlFor="project">Project *</label>
                            <select 
                                id="project" 
                                value={selectedProject} 
                                onChange={(e) => handleProjectChange(e.target.value)}
                            >
                                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>
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
                                    } else {
                                        setSelectedRevision(availableSiliconRevisions.length > 0 ? availableSiliconRevisions[0] : '');
                                        setSiliconVersion(availableSiliconVersions.length > 0 ? availableSiliconVersions[0] : '');
                                    }
                                }} 
                            />
                            No part yet
                        </label>
                    </div>
                </FormGroup>

                <FormGroup title="Instance">
                    <div className="form-row">
                        <div className="form-group flex-1">
                            <label>Assigned Name</label>
                            <div style={{ padding: '0.75rem', backgroundColor: 'rgba(0, 0, 0, 0.2)', borderRadius: '12px', color: 'var(--text)', fontSize: '1rem', fontWeight: 500, textTransform: 'uppercase', border: '1px solid var(--border)', display: 'flex', alignItems: 'center' }}>
                                <span>{selectedProjectKey}-{boardNumber}</span>
                                <span style={{ color: '#a855f7', fontWeight: 800 }} title="Mathematical Checksum">
                                    {generateCRC(`${selectedProjectKey}-${boardNumber.toUpperCase()}`)}
                                </span>
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
                                {owners.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                            </select>
                        </div>
                    </div>
                </FormGroup>

                <FormGroup title="PCB">
                    <div className="form-row">
                        <div className="form-group flex-1">
                            <label htmlFor="formfactor">Flavor *</label>
                            <select 
                                id="formfactor"
                                value={selectedFormfactor}
                                onChange={(e) => {
                                    setSelectedFormfactor(e.target.value);
                                    const ff = availableFormfactors.find((f: any) => f.name === e.target.value);
                                    setPcbRev(ff && ff.revisions.length > 0 ? ff.revisions[0] : '');
                                    setBom(ff && ff.boms && ff.boms.length > 0 ? ff.boms[0] : '');
                                }}
                                required
                            >
                                <option value="" disabled>-- Select Flavor --</option>
                                {availableFormfactors.map((ff: any) => (
                                    <option key={ff.name} value={ff.name}>{ff.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group flex-1">
                            <label htmlFor="pcb_rev">Rev Number *</label>
                            {availablePcbRevisions.length > 0 ? (
                                <select 
                                    id="pcb_rev"
                                    value={pcbRev}
                                    onChange={(e) => setPcbRev(e.target.value)}
                                    required
                                >
                                    <option value="">Select Rev</option>
                                    {availablePcbRevisions.map((rev) => (
                                        <option key={rev} value={rev}>{rev}</option>
                                    ))}
                                </select>
                            ) : (
                                <input 
                                    id="pcb_rev"
                                    type="number" 
                                    step="any"
                                    value={pcbRev} 
                                    onChange={(e) => setPcbRev(e.target.value)} 
                                    required
                                />
                            )}
                        </div>
                        <div className="form-group flex-1">
                            <label htmlFor="bom">BOM *</label>
                            <select 
                                id="bom"
                                value={bom}
                                onChange={(e) => setBom(e.target.value)}
                                required
                            >
                                <option value="">Select BOM</option>
                                {availableBoms.length > 0 ? (
                                    availableBoms.map((b) => (
                                        <option key={b} value={b}>{b}</option>
                                    ))
                                ) : (
                                    <>
                                        <option value="BOM1">BOM1</option>
                                        <option value="BOM2">BOM2</option>
                                    </>
                                )}
                            </select>
                        </div>
                    </div>
                </FormGroup>

                <button type="submit" className="submit-button" disabled={loading}>
                    <Save size={18} />
                    <span>{loading ? 'Saving...' : 'Save PCB Board'}</span>
                </button>
            </form>
        </div>
    );
}
