import { useEffect, useState } from 'react';
import { ArrowLeft, Save } from 'lucide-react';

import { API_BASE, apiFetch } from '../../store/serverDataBase/apiBridge';
import { usePcbStore } from '../../store/clientDataBase/usePcbStore';
import { FormGroup } from '../../components/forms/FormGroup';
import { generateCRC } from '../../components/UrlManager/crc';
import { useAppState } from '../../store/useAppState';
import type { Package, SiliconVersion, BoardFormFactor, BoardFormFactorRevision } from '../../store/clientDataBase/useProjectStore';

export const getBiggestRevision = (revisions: string[]): string => {
    if (!revisions || revisions.length === 0) return '';
    const sorted = [...revisions].sort((a, b) => {
        const matchA = a.trim().match(/^([A-Za-z]+)(\d+)$/);
        const matchB = b.trim().match(/^([A-Za-z]+)(\d+)$/);
        if (!matchA && !matchB) return b.localeCompare(a);
        if (!matchA) return 1;
        if (!matchB) return -1;
        
        const letterA = matchA[1].toUpperCase();
        const letterB = matchB[1].toUpperCase();
        if (letterA !== letterB) {
            return letterB.localeCompare(letterA);
        }
        
        const numA = parseInt(matchA[2], 10);
        const numB = parseInt(matchB[2], 10);
        return numB - numA;
    });
    return sorted[0];
};

interface AddPCBProps {
    onBack: () => void;
    onSuccess: () => void;
}

export function AddPCB({ onBack, onSuccess }: AddPCBProps) {
    const { currentUser, currentUserRole, debugBypassPermissions } = useAppState();

    if (!debugBypassPermissions && currentUserRole === 'Guest') {
        return (
            <div className="add-page-container">
                <header className="add-page-header">
                    <button onClick={onBack} className="back-button">
                        <ArrowLeft size={20} />
                    </button>
                    <h2>Access Denied</h2>
                </header>
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <p>Guests do not have permission to add new PCBs.</p>
                </div>
            </div>
        );
    }

    const [boardNumber, setBoardNumber] = useState('');
    const [manufacturerId, setManufacturerId] = useState('');
    const [lastAutoAssignedProject, setLastAutoAssignedProject] = useState('');
    const [status] = useState('In Progress');

    // Hierarchy selection states
    const [selectedProject, setSelectedProject] = useState('');
    const [selectedPackage, setSelectedPackage] = useState('');
    const [selectedSiliconRev, setSelectedSiliconRev] = useState('');
    const [siliconCorner, setSiliconCorner] = useState('');
    const [noPartYet, setNoPartYet] = useState(false);

    const [selectedFormfactor, setSelectedFormfactor] = useState('');
    const [pcbRev, setPcbRev] = useState('');
    const [bom, setBom] = useState('');
    const [selectedOwner, setSelectedOwner] = useState('');
    
    const [projects, setProjects] = useState<any[]>([]);
    const [owners, setOwners] = useState<any[]>([]);
    const { addPcb, pcbs, fetchPcbs, loading } = usePcbStore();

    useEffect(() => {
        fetchPcbs();
    }, [fetchPcbs]);

    useEffect(() => {
        if (currentUser && currentUserRole === 'User') {
            setSelectedOwner(currentUser.id.toString());
        }
    }, [currentUser, currentUserRole]);

    const selectedProjData = projects.find(p => p.id.toString() === selectedProject);
    const availablePackages: Package[] = selectedProjData?.packages || [];

    const selectedPkgData = availablePackages.find(pkg => pkg.name === selectedPackage) || availablePackages[0];
    const availableSiliconVersions: SiliconVersion[] = (selectedProjData?.silicon_versions && selectedProjData.silicon_versions.length > 0)
        ? selectedProjData.silicon_versions
        : (selectedPkgData?.silicon_versions || []);

    const selectedSiData = availableSiliconVersions.find(sv => sv.name === selectedSiliconRev) || availableSiliconVersions[0];
    const availableCorners: string[] = selectedSiData?.silicon_corners 
        ? (Array.isArray(selectedSiData.silicon_corners) ? selectedSiData.silicon_corners : String(selectedSiData.silicon_corners).split(',').map(s => s.trim()))
        : [];
    const availableFormFactors: BoardFormFactor[] = (selectedPkgData?.formfactors && selectedPkgData.formfactors.length > 0)
        ? selectedPkgData.formfactors
        : (selectedPkgData?.board_formfactors || selectedSiData?.formfactors || []);

    const selectedFfData = availableFormFactors.find(ff => ff.name === selectedFormfactor) || availableFormFactors[0];
    const availableRevisions: (string | BoardFormFactorRevision)[] = selectedFfData?.revisionDetails || selectedFfData?.revisions || [];

    const selectedRevData = (typeof availableRevisions[0] === 'object' 
        ? (availableRevisions as BoardFormFactorRevision[]).find(r => r.name === pcbRev)
        : null) || (availableRevisions[0] as BoardFormFactorRevision | undefined);
        
    const availableBoms: string[] = selectedRevData?.boms || [];

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
                    const numberFormat = selectedProjData?.number_format || 'decimal';
                    
                    if (numberFormat !== 'hex') {
                        numPart = numPart.substring(0, numPart.length - 1);
                    }
                    
                    if (numPart.toLowerCase().startsWith('0x')) {
                        return parseInt(numPart.substring(2), 16);
                    } else if (numberFormat === 'hex') {
                        return parseInt(numPart, 16);
                    } else {
                        return parseInt(numPart, 10);
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
            setBoardNumber(nextVal.toString(16).toUpperCase().padStart(4, '0'));
        } else {
            setBoardNumber(nextVal.toString(10).padStart(4, '0'));
        }
    };

    useEffect(() => {
        if (selectedProjData && selectedProject !== lastAutoAssignedProject && !loading) {
            handleAutoAssign();
            setLastAutoAssignedProject(selectedProject);
        }
    }, [selectedProject, selectedProjData, loading, lastAutoAssignedProject]);

    // Initial load
    useEffect(() => {
        Promise.all([
            apiFetch(`${API_BASE}/projects`).then(res => res.json()),
            apiFetch(`${API_BASE}/owners`).then(res => res.json())
        ]).then(([projData, ownerData]) => {
            setProjects(projData);
            setOwners(ownerData);
            if (projData.length > 0) {
                const firstProj = projData[0];
                setSelectedProject(firstProj.id.toString());
                initializeCascading(firstProj);
            }
            if (ownerData.length > 0) {
                const userMatch = currentUser ? ownerData.find((o: any) => o.id === currentUser.id) : null;
                setSelectedOwner(userMatch ? userMatch.id.toString() : ownerData[0].id.toString());
            }
        }).catch(err => console.error('Failed to pre-fetch data:', err));
    }, [currentUser]);

    const initializeCascading = (proj: any) => {
        const pkgs = proj.packages || [];
        const siVers = (proj.silicon_versions && proj.silicon_versions.length > 0)
            ? proj.silicon_versions
            : (pkgs[0]?.silicon_versions || []);
        
        if (siVers.length > 0) {
            const firstSi = siVers[0];
            setSelectedSiliconRev(firstSi.name);
            const corners = Array.isArray(firstSi.silicon_corners) ? firstSi.silicon_corners : String(firstSi.silicon_corners || '').split(',').map((s: string) => s.trim()).filter(Boolean);
            setSiliconCorner(corners.length > 0 ? corners[0] : '');
        } else {
            setSelectedSiliconRev('');
            setSiliconCorner('');
        }

        if (pkgs.length > 0) {
            const firstPkg = pkgs[0];
            setSelectedPackage(firstPkg.name);
            const ffs = (firstPkg.formfactors && firstPkg.formfactors.length > 0)
                ? firstPkg.formfactors
                : (firstPkg.board_formfactors || firstPkg.silicon_versions?.[0]?.formfactors || []);
            if (ffs.length > 0) {
                const firstFf = ffs[0];
                setSelectedFormfactor(firstFf.name);
                const revs = firstFf.revisionDetails || firstFf.revisions || [];
                if (revs.length > 0) {
                    const firstRev = typeof revs[0] === 'object' ? revs[0].name : revs[0];
                    setPcbRev(firstRev);
                    const boms = typeof revs[0] === 'object' ? revs[0].boms : [];
                    setBom(boms && boms.length > 0 ? boms[0] : '');
                } else {
                    setPcbRev('');
                    setBom('');
                }
            } else {
                setSelectedFormfactor('');
                setPcbRev('');
                setBom('');
            }
        }
    };

    const handleProjectChange = (id: string) => {
        setSelectedProject(id);
        const proj = projects.find(p => p.id.toString() === id);
        if (proj) {
            initializeCascading(proj);
        }
    };

    const handlePackageChange = (pkgName: string) => {
        setSelectedPackage(pkgName);
        const pkg = availablePackages.find(p => p.name === pkgName);
        if (pkg) {
            const ffs = (pkg.formfactors && pkg.formfactors.length > 0)
                ? pkg.formfactors
                : (pkg.board_formfactors || pkg.silicon_versions?.[0]?.formfactors || []);
            if (ffs.length > 0) {
                const firstFf = ffs[0];
                setSelectedFormfactor(firstFf.name);
                const revs = firstFf.revisionDetails || firstFf.revisions || [];
                if (revs.length > 0) {
                    const firstRev = typeof revs[0] === 'object' ? revs[0].name : revs[0];
                    setPcbRev(firstRev);
                    const boms = typeof revs[0] === 'object' ? revs[0].boms : [];
                    setBom(boms && boms.length > 0 ? boms[0] : '');
                } else {
                    setPcbRev('');
                    setBom('');
                }
            } else {
                setSelectedFormfactor('');
                setPcbRev('');
                setBom('');
            }
        }
    };

    const handleSiliconRevChange = (siName: string) => {
        setSelectedSiliconRev(siName);
        const si = availableSiliconVersions.find(s => s.name === siName);
        if (si) {
            const corners = Array.isArray(si.silicon_corners) ? si.silicon_corners : String(si.silicon_corners || '').split(',').map((s: string) => s.trim()).filter(Boolean);
            setSiliconCorner(corners.length > 0 ? corners[0] : '');
        } else {
            setSiliconCorner('');
        }
    };

    const handleFormFactorChange = (ffName: string) => {
        setSelectedFormfactor(ffName);
        const ff = availableFormFactors.find(f => f.name === ffName);
        if (ff) {
            const revs = ff.revisionDetails || ff.revisions || [];
            if (revs.length > 0) {
                const firstRev = typeof revs[0] === 'object' ? revs[0].name : revs[0];
                setPcbRev(firstRev);
                const boms = typeof revs[0] === 'object' ? revs[0].boms : [];
                setBom(boms && boms.length > 0 ? boms[0] : '');
            }
        }
    };

    const handleRevChange = (rName: string) => {
        setPcbRev(rName);
        const rObj = (availableRevisions as any[]).find(r => (typeof r === 'object' ? r.name : r) === rName);
        if (rObj && typeof rObj === 'object' && rObj.boms && rObj.boms.length > 0) {
            setBom(rObj.boms[0]);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        const finalBoardName = `${selectedProjectKey}-${boardNumber.trim()}`;
        const numberFormat = selectedProjData?.number_format || 'decimal';
        let finalBoardWithCrc = finalBoardName;
        if (numberFormat !== 'hex') {
            const crc = generateCRC(finalBoardName);
            finalBoardWithCrc = `${finalBoardName}${crc}`;
        }
        
        const clientDuplicate = pcbs.some(
            p => p.board_number.trim().toUpperCase() === finalBoardWithCrc.trim().toUpperCase()
        );
        if (clientDuplicate) {
            alert(`Board "${finalBoardWithCrc}" already exists. Please use a different number.`);
            return;
        }
        
        const success = await addPcb({
            board_number: finalBoardWithCrc,
            status,
            package_name: selectedPackage,
            package_id: selectedPkgData?.id || null,
            silicon_version_id: selectedSiData?.id || null,
            board_formfactor_id: selectedFfData?.id || null,
            formfactor_revision_id: selectedRevData?.id || null,
            board_flavor: selectedFormfactor,
            board_rev: pcbRev,
            silicon_rev: noPartYet ? "No part" : selectedSiliconRev,
            silicon_corner: noPartYet ? "" : siliconCorner,
            bom: bom.trim(),
            manufacturer_id: manufacturerId.trim() || undefined,
            project_id: selectedProject ? parseInt(selectedProject) : null,
            owner_id: selectedOwner ? parseInt(selectedOwner) : null
        });

        if (success) {
            onSuccess();
        } else {
            const storeError = usePcbStore.getState().error;
            alert(storeError || `Board "${finalBoardWithCrc}" could not be saved. It may already exist.`);
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

            {debugBypassPermissions && currentUserRole === 'Guest' && (
                <div className="debug-preview-banner">
                    <span className="debug-preview-banner-text">
                        ⚡ Debug Preview Mode: UI permissions bypassed for page inspection.
                    </span>
                </div>
            )}

            <form onSubmit={handleSubmit} className="add-form">
                <FormGroup title="Silicon">
                    <div className="form-row">
                        <div className="form-group flex-1">
                            <label htmlFor="project">Project *</label>
                            <select 
                                id="project" 
                                value={selectedProject} 
                                onChange={(e) => {
                                    setLastAutoAssignedProject('');
                                    handleProjectChange(e.target.value);
                                }}
                            >
                                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>

                        <div className="form-group flex-1">
                            <label htmlFor="package">Package</label>
                            <select 
                                id="package"
                                value={selectedPackage}
                                onChange={(e) => handlePackageChange(e.target.value)}
                            >
                                {availablePackages.map((pkg) => (
                                    <option key={pkg.name} value={pkg.name}>{pkg.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group flex-1">
                            <label htmlFor="revision">Silicon Version</label>
                            <select 
                                id="revision"
                                value={selectedSiliconRev}
                                onChange={(e) => handleSiliconRevChange(e.target.value)} 
                                disabled={noPartYet}
                            >
                                <option value="">N/A</option>
                                {availableSiliconVersions.map((sv) => (
                                    <option key={sv.name} value={sv.name}>{sv.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group flex-1">
                            <label htmlFor="silicon_corner">Silicon Corner</label>
                            <select 
                                id="silicon_corner"
                                value={siliconCorner}
                                onChange={(e) => setSiliconCorner(e.target.value)} 
                                disabled={noPartYet}
                            >
                                <option value="">N/A</option>
                                {availableCorners.map((c: string) => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="form-row">
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 'normal', fontSize: '0.9rem', cursor: 'pointer', color: 'var(--text-muted)' }}>
                            <input 
                                type="checkbox" 
                                checked={noPartYet} 
                                onChange={(e) => setNoPartYet(e.target.checked)} 
                            />
                            No Part Yet (Unmounted IC)
                        </label>
                    </div>
                </FormGroup>

                <FormGroup title="Board FormFactor & Revision">
                    <div className="form-row">
                        <div className="form-group flex-1">
                            <label htmlFor="formfactor">FormFactor</label>
                            <select 
                                id="formfactor"
                                value={selectedFormfactor}
                                onChange={(e) => handleFormFactorChange(e.target.value)}
                            >
                                {availableFormFactors.map((ff) => (
                                    <option key={ff.name} value={ff.name}>{ff.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group flex-1">
                            <label htmlFor="pcbRev">Board Revision</label>
                            <select 
                                id="pcbRev"
                                value={pcbRev}
                                onChange={(e) => handleRevChange(e.target.value)}
                            >
                                {availableRevisions.map((r) => {
                                    const rName = typeof r === 'object' ? r.name : r;
                                    return <option key={rName} value={rName}>{rName}</option>;
                                })}
                            </select>
                        </div>

                        <div className="form-group flex-1">
                            <label htmlFor="bom">BOM Flavor</label>
                            <select 
                                id="bom"
                                value={bom}
                                onChange={(e) => setBom(e.target.value)}
                            >
                                {availableBoms.map((b) => (
                                    <option key={b} value={b}>{b}</option>
                                ))}
                                {availableBoms.length === 0 && <option value="">Default</option>}
                            </select>
                        </div>
                    </div>
                </FormGroup>

                <FormGroup title="Instance Information">
                    <div className="form-row">
                        <div className="form-group flex-1">
                            <label htmlFor="boardNumber">Assigned Board Number *</label>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>{selectedProjectKey}-</span>
                                <input 
                                    id="boardNumber"
                                    type="text" 
                                    value={boardNumber} 
                                    onChange={(e) => setBoardNumber(e.target.value)} 
                                    placeholder="0001"
                                    required 
                                    style={{ flex: 1 }}
                                />
                            </div>
                        </div>

                        <div className="form-group flex-1">
                            <label htmlFor="owner">Owner</label>
                            <select 
                                id="owner" 
                                value={selectedOwner} 
                                onChange={(e) => setSelectedOwner(e.target.value)}
                                disabled={currentUserRole === 'User'}
                            >
                                <option value="">Unassigned</option>
                                {owners.map(o => <option key={o.id} value={o.id}>@{o.username}</option>)}
                            </select>
                        </div>

                        <div className="form-group flex-1">
                            <label htmlFor="manufacturer_id">Manufacturer ID</label>
                            <input 
                                id="manufacturer_id"
                                type="text" 
                                value={manufacturerId} 
                                onChange={(e) => setManufacturerId(e.target.value)} 
                                placeholder="e.g. SN12345, MFG-987"
                            />
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
