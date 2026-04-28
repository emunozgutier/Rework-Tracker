import { useEffect, useState } from 'react';
import { ArrowLeft, Save } from 'lucide-react';

import { API_BASE, apiFetch } from '../../store/database/apiBridge';
import { usePcbStore } from '../../store/storePcb';
import { FormGroup } from '../../components/forms/FormGroup';
import { generateCRC } from '../../components/UrlManager/crc';

const isNA = (str: string) => {
    if (!str) return false;
    const s = str.trim().toLowerCase();
    return s === 'n/a' || s === 'na' || s === 'not applicable';
};

interface AddPCBProps {
    onBack: () => void;
    onSuccess: () => void;
}

export function AddPCB({ onBack, onSuccess }: AddPCBProps) {
    const [boardNumber, setBoardNumber] = useState('');
    const [isManualNumber, setIsManualNumber] = useState(false);
    const [lastAutoAssignedProject, setLastAutoAssignedProject] = useState('');
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

    useEffect(() => {
        if (pcbs.length === 0) fetchPcbs();
    }, [fetchPcbs, pcbs.length]);

    const selectedProjData = projects.find(p => p.id.toString() === selectedProject);
    const availableFormfactors = selectedProjData?.formfactors || [];
    const availableSiliconVersions = selectedProjData?.silicon_corners ? selectedProjData.silicon_corners.split(',').map((s: string) => s.trim()).filter((s: string) => Boolean(s) && !isNA(s)) : [];
    
    const availableSiliconRevisions = (selectedProjData?.revisions || []).filter((s: string) => !isNA(s));
    let availablePcbRevisions: string[] = [];
    let availableBoms: string[] = [];
    if (selectedProject && selectedFormfactor) {
        const ff = availableFormfactors.find((f: any) => f.name === selectedFormfactor);
        availablePcbRevisions = ff ? ff.revisions : [];
        availableBoms = ff && ff.boms ? ff.boms : [];
    }
    const selectedProjectKey = selectedProjData?.project_key || 'XXX';

    const handleAutoAssign = () => {
        if (!selectedProjData || !pcbs) return;
        const projectPcbs = pcbs.filter(p => p.project === selectedProjData.name);
        let nextVal = 1;
        
        if (projectPcbs.length > 0) {
            const numericValues = projectPcbs.map(p => {
                const parts = p.board_number.split('-');
                if (parts.length > 1) {
                    let numPart = parts.slice(-1)[0];
                    numPart = numPart.substring(0, numPart.length - 1);
                    if (numPart.toLowerCase().startsWith('0x')) {
                        return parseInt(numPart.substring(2), 16);
                    } else {
                        return parseInt(numPart, 16);
                    }
                }
                return NaN;
            }).filter(n => !isNaN(n));
            
            if (numericValues.length > 0) {
                nextVal = Math.max(...numericValues) + 1;
            }
        }
        
        const numberFormat = selectedProjData.number_format || 'decimal';
        if (numberFormat === 'hex') {
            setBoardNumber('0x' + nextVal.toString(16).toUpperCase().padStart(4, '0'));
        } else {
            setBoardNumber(nextVal.toString(10).padStart(4, '0'));
        }
        setIsManualNumber(false);
    };

    useEffect(() => {
        if (selectedProjData && selectedProject !== lastAutoAssignedProject && !loading) {
            handleAutoAssign();
            setLastAutoAssignedProject(selectedProject);
        }
    }, [selectedProject, selectedProjData, loading, lastAutoAssignedProject]);

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
                    const corners = firstProj.silicon_corners.split(',').map((s: string) => s.trim()).filter((s: string) => Boolean(s) && !isNA(s));
                    setSiliconVersion(corners.length > 0 ? corners[0] : '');
                }
                if (firstProj.formfactors && firstProj.formfactors.length > 0) {
                    setSelectedFormfactor(firstProj.formfactors[0].name);
                    const revs = (firstProj.revisions || []).filter((s: string) => !isNA(s));
                    setSelectedRevision(revs.length > 0 ? revs[0] : '');
                    setPcbRev(firstProj.formfactors[0].revisions[0] || '');
                    setBom(firstProj.formfactors[0].boms ? firstProj.formfactors[0].boms[0] : '');
                } else if (firstProj.revisions && firstProj.revisions.length > 0) {
                    setSelectedFormfactor('');
                    const revs = (firstProj.revisions || []).filter((s: string) => !isNA(s));
                    setSelectedRevision(revs.length > 0 ? revs[0] : '');
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
            const corners = project.silicon_corners.split(',').map((s: string) => s.trim()).filter((s: string) => Boolean(s) && !isNA(s));
            setSiliconVersion(corners.length > 0 ? corners[0] : '');
        } else {
            setSiliconVersion('');
        }

        if (project && project.formfactors && project.formfactors.length > 0) {
            setSelectedFormfactor(project.formfactors[0].name);
            const revs = (project.revisions || []).filter((s: string) => !isNA(s));
            setSelectedRevision(revs.length > 0 ? revs[0] : '');
            setPcbRev(project.formfactors[0].revisions[0] || '');
            setBom(project.formfactors[0].boms ? project.formfactors[0].boms[0] : '');
        } else if (project && project.revisions && project.revisions.length > 0) {
            setSelectedFormfactor('');
            const revs = (project.revisions || []).filter((s: string) => !isNA(s));
            setSelectedRevision(revs.length > 0 ? revs[0] : '');
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
        const finalBoardName = `${selectedProjectKey}-${boardNumber.trim()}`;
        const crc = generateCRC(finalBoardName);
        const finalBoardWithCrc = `${finalBoardName}${crc}`;
        
        // Final duplicate check before submit
        if (pcbs.some(p => p.board_number.toUpperCase() === finalBoardWithCrc.toUpperCase())) {
            alert('This board number is already assigned in this project.');
            return;
        }
        
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

    const finalBoardNameForUI = `${selectedProjectKey}-${boardNumber.trim()}`;
    const crcForUI = generateCRC(finalBoardNameForUI);
    const finalBoardWithCrcForUI = `${finalBoardNameForUI}${crcForUI}`;
    const isDuplicate = pcbs.some(p => p.board_number.toUpperCase() === finalBoardWithCrcForUI.toUpperCase());

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
                                onChange={(e) => {
                                    setLastAutoAssignedProject(''); // Reset to allow auto-assign for new project
                                    handleProjectChange(e.target.value);
                                }}
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
                            <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span>Assigned Name</span>
                                <button type="button" onClick={handleAutoAssign} style={{ fontSize: '0.8rem', padding: '4px 12px', borderRadius: '4px', backgroundColor: 'var(--bg-element)', color: 'var(--text)', border: '1px solid var(--border)', cursor: 'pointer' }}>
                                    Auto Assign
                                </button>
                            </label>
                            <div style={{ padding: '0.75rem', backgroundColor: 'rgba(0, 0, 0, 0.2)', borderRadius: '12px', color: 'var(--text)', fontSize: '1rem', fontWeight: 500, border: `1px solid ${isDuplicate ? '#ef4444' : 'var(--border)'}`, display: 'flex', alignItems: 'center' }}>
                                <span>{selectedProjectKey}-</span>
                                <input 
                                    type="text"
                                    value={boardNumber}
                                    onChange={(e) => {
                                        setBoardNumber(e.target.value);
                                        setIsManualNumber(true);
                                    }}
                                    style={{ background: 'transparent', border: 'none', color: isDuplicate ? '#ef4444' : 'inherit', fontSize: 'inherit', fontWeight: 'inherit', outline: 'none', width: '100px', padding: 0 }}
                                />
                                <span style={{ color: '#a855f7', fontWeight: 800, marginLeft: '4px' }} title="Mathematical Checksum">
                                    {crcForUI}
                                </span>
                            </div>
                            {isDuplicate && <span style={{ color: '#ef4444', fontSize: '0.85rem', marginTop: '6px', display: 'block' }}>This board number is already assigned.</span>}
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
