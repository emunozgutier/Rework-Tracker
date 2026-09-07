import React, { useEffect, useState } from 'react';
import { 
    ArrowLeft, Save, Trash2, Upload, FileText, Cpu, Layers, 
    Box, Plus, CircuitBoard, Hash, Binary, Sparkles,
    Paperclip, X, FileCheck
} from 'lucide-react';
import { MultipleInputs } from '../../components/forms/MultipleInputs';
import { useProjectStore } from '../../store/clientDataBase/useProjectStore';
import type { Package } from '../../store/clientDataBase/useProjectStore';
import { usePcbStore } from '../../store/clientDataBase/usePcbStore';
import { RemoveProject } from '../RemovePage/RemoveProject';
import { useAppState } from '../../store/useAppState';
import { usePermissionsStore } from '../../store/clientDataBase/usePermissionsStore';

interface EditProjectProps {
    id: string | number;
    onBack: () => void;
    onSuccess: () => void;
}

interface FormRevision {
    name: string;
    boms: string;
    schematic?: string | null;
    board_file?: string | null;
    bom_csv?: string | null;
    datasheet?: string | null;
}

interface FormBoardFormFactor {
    name: string;
    description?: string;
    revisions: FormRevision[];
}

interface FormPackage {
    name: string;
    description?: string;
    formfactors: FormBoardFormFactor[];
}

interface FormSiliconVersion {
    name: string;
    silicon_corners: string;
    description?: string;
}

export function EditProject({ id, onBack, onSuccess }: EditProjectProps) {
    const { currentUserRole, debugBypassPermissions } = useAppState();
    const { permissions } = usePermissionsStore();

    const canEditProject = debugBypassPermissions || currentUserRole === 'Super User' ||
        (currentUserRole === 'User' && permissions['Projects__Edit__user'] === true) ||
        (currentUserRole === 'Guest' && permissions['Projects__Edit__guest'] === true);

    if (!canEditProject) {
        return (
            <div className="project-page-container">
                <header className="add-page-header">
                    <button onClick={onBack} className="back-button">
                        <ArrowLeft size={20} />
                    </button>
                    <h2>Access Denied</h2>
                </header>
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <p>You do not have permission to edit projects.</p>
                </div>
            </div>
        );
    }

    const [name, setName] = useState('');
    const [projectKey, setProjectKey] = useState('');
    const [numberFormat, setNumberFormat] = useState<'hex' | 'decimal'>('decimal');
    const [description, setDescription] = useState('');

    // Section 1 & Section 2 states
    const [packages, setPackages] = useState<FormPackage[]>([]);
    const [siliconVersions, setSiliconVersions] = useState<FormSiliconVersion[]>([]);
    
    const [activePkgTab, setActivePkgTab] = useState(0);
    const [activeSiTab, setActiveSiTab] = useState(0);
    const [activeFfTab, setActiveFfTab] = useState(0);
    const [activeRevTab, setActiveRevTab] = useState(0);

    const [newPkgInput, setNewPkgInput] = useState('');
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [loading, setLoading] = useState(true);
    const [isRemoveOpen, setIsRemoveOpen] = useState(false);
    
    const { projects, updateProject, deleteProject, loading: saving, fetchProjects, fetchDocs } = useProjectStore();
    const { pcbs, fetchPcbs } = usePcbStore();

    useEffect(() => {
        if (projects.length === 0) {
            fetchProjects();
        }
    }, [projects.length, fetchProjects]);

    useEffect(() => {
        if (id) {
            fetchDocs(id);
        }
    }, [id, fetchDocs]);

    useEffect(() => {
        if (pcbs.length === 0) {
            fetchPcbs();
        }
    }, [pcbs.length, fetchPcbs]);

    const projectPcbs = pcbs.filter(p => p.project === name);
    const pcbCount = projectPcbs.length;

    useEffect(() => {
        const existingProject = projects.find(p => p.id.toString() === id.toString());
        if (existingProject) {
            setName(existingProject.name);
            setProjectKey(existingProject.project_key || '');
            setNumberFormat((existingProject.number_format as 'hex' | 'decimal') || 'decimal');
            setDescription(existingProject.description || '');

            // Load Silicon Versions
            if (existingProject.silicon_versions && existingProject.silicon_versions.length > 0) {
                setSiliconVersions(existingProject.silicon_versions.map(sv => ({
                    name: sv.name,
                    silicon_corners: Array.isArray(sv.silicon_corners) ? sv.silicon_corners.join(', ') : (sv.silicon_corners || ''),
                    description: sv.description || ''
                })));
            } else if (existingProject.revisions && existingProject.revisions.length > 0) {
                setSiliconVersions(existingProject.revisions.map(r => ({
                    name: r,
                    silicon_corners: existingProject.silicon_corners || 'TT, FF, SS',
                    description: ''
                })));
            } else {
                setSiliconVersions([{ name: 'A0', silicon_corners: 'TT, FF, SS', description: '' }]);
            }

            // Load Packages with Board Form Factors
            if (existingProject.packages && existingProject.packages.length > 0) {
                const mappedPackages: FormPackage[] = existingProject.packages.map((pkg: Package) => {
                    let formfactorsList: FormBoardFormFactor[] = [];

                    if (pkg.formfactors && pkg.formfactors.length > 0) {
                        formfactorsList = pkg.formfactors.map(ff => ({
                            name: ff.name,
                            description: ff.description || '',
                            revisions: (ff.revisionDetails || []).map(r => ({
                                name: r.name,
                                boms: Array.isArray(r.boms) ? r.boms.join(', ') : (r.boms || ''),
                                schematic: r.schematic || r.doc || null,
                                board_file: r.board_file || null,
                                bom_csv: r.bom_csv || null,
                                datasheet: r.datasheet || null
                            }))
                        }));
                    } else if (pkg.silicon_versions && pkg.silicon_versions.length > 0) {
                        // Legacy nested: extract formfactors from silicon versions
                        const ffMap = new Map<string, FormBoardFormFactor>();
                        for (const sv of pkg.silicon_versions) {
                            for (const ff of (sv.formfactors || [])) {
                                if (!ffMap.has(ff.name)) {
                                    ffMap.set(ff.name, {
                                        name: ff.name,
                                        description: ff.description || '',
                                        revisions: (ff.revisionDetails || []).map(r => ({
                                            name: r.name,
                                            boms: Array.isArray(r.boms) ? r.boms.join(', ') : (r.boms || ''),
                                            schematic: r.schematic || r.doc || null,
                                            board_file: r.board_file || null,
                                            bom_csv: r.bom_csv || null,
                                            datasheet: r.datasheet || null
                                        }))
                                    });
                                }
                            }
                        }
                        formfactorsList = Array.from(ffMap.values());
                    }

                    if (formfactorsList.length === 0) {
                        formfactorsList = [{
                            name: 'Demo',
                            description: '',
                            revisions: [{ name: '1.0', boms: 'BOM1', schematic: null, board_file: null, bom_csv: null, datasheet: null }]
                        }];
                    }

                    return {
                        name: pkg.name,
                        description: pkg.description || '',
                        formfactors: formfactorsList
                    };
                });
                setPackages(mappedPackages);
            } else {
                // Fallback from legacy flavors
                const flavors = (existingProject.flavors && existingProject.flavors.length > 0) ? existingProject.flavors.map(f => ({
                    name: f.name,
                    description: '',
                    revisions: (f.revisionDetails || []).map(r => ({
                        name: r.name,
                        boms: Array.isArray(r.boms) ? r.boms.join(', ') : (r.boms || ''),
                        schematic: r.schematic || r.doc || null,
                        board_file: r.board_file || null,
                        bom_csv: r.bom_csv || null,
                        datasheet: r.datasheet || null
                    }))
                })) : [{
                    name: 'Demo',
                    description: '',
                    revisions: [{ name: '1.0', boms: 'BOM1', schematic: null, board_file: null, bom_csv: null, datasheet: null }]
                }];

                setPackages([{
                    name: 'Default Package',
                    description: '',
                    formfactors: flavors
                }]);
            }

            setLoading(false);
        }
    }, [id, projects]);

    const handleFileUpload = (file: File, updateRevField?: (filename: string) => void) => {
        if (file.size > 25 * 1024 * 1024) {
            alert(`File "${file.name}" exceeds the 25MB maximum size limit.`);
            return;
        }
        setSelectedFiles(prev => {
            const exists = prev.some(f => f.name === file.name);
            return exists ? prev : [...prev, file];
        });
        if (updateRevField) {
            updateRevField(file.name);
        }
    };

    const handleRemoveFile = (filename: string) => {
        setSelectedFiles(prev => prev.filter(f => f.name !== filename));
        setPackages(prev => prev.map(pkg => ({
            ...pkg,
            formfactors: pkg.formfactors.map(ff => ({
                ...ff,
                revisions: ff.revisions.map(r => ({
                    ...r,
                    schematic: r.schematic === filename ? null : r.schematic,
                    board_file: r.board_file === filename ? null : r.board_file,
                    bom_csv: r.bom_csv === filename ? null : r.bom_csv,
                    datasheet: r.datasheet === filename ? null : r.datasheet,
                }))
            }))
        })));
    };

    const handleMultipleFiles = (files: FileList | null) => {
        if (!files || files.length === 0) return;
        const fileList = Array.from(files);
        fileList.forEach(file => {
            handleFileUpload(file);
            const ext = file.name.toLowerCase().split('.').pop() || '';
            const curRev = packages[activePkgTab]?.formfactors[activeFfTab]?.revisions[activeRevTab];
            if (curRev) {
                const updated = [...packages];
                const revRef = updated[activePkgTab].formfactors[activeFfTab].revisions[activeRevTab];
                if (ext === 'pdf' && !revRef.schematic) {
                    revRef.schematic = file.name;
                } else if (ext === 'brd' && !revRef.board_file) {
                    revRef.board_file = file.name;
                } else if ((ext === 'csv' || ext === 'xlsx' || ext === 'xls') && !revRef.bom_csv) {
                    revRef.bom_csv = file.name;
                } else if (ext === 'pdf' && revRef.schematic && !revRef.datasheet) {
                    revRef.datasheet = file.name;
                }
                setPackages(updated);
            }
        });
    };

    const handleAddPackage = (pkgName?: string) => {
        const nameToAdd = pkgName || newPkgInput || prompt("Enter package/pin count (e.g. 48 pin IC, BGA-128, 64-QFN):", "48 pin IC");
        if (!nameToAdd || !nameToAdd.trim()) return;
        const newPkg: FormPackage = {
            name: nameToAdd.trim(),
            description: '',
            formfactors: [
                {
                    name: 'Demo',
                    description: '',
                    revisions: [
                        { name: '1.0', boms: 'BOM1', schematic: null, board_file: null, bom_csv: null, datasheet: null }
                    ]
                }
            ]
        };
        setPackages([...packages, newPkg]);
        setNewPkgInput('');
        setActivePkgTab(packages.length);
        setActiveFfTab(0);
        setActiveRevTab(0);
    };

    const handleDeletePackage = (idxToDelete: number) => {
        if (packages.length <= 1) return;
        const targetPkg = packages[idxToDelete];
        const confirmDelete = window.confirm(`Are you sure you want to delete package "${targetPkg.name}" and all its board form factors?`);
        if (!confirmDelete) return;

        const newPkgs = packages.filter((_, i) => i !== idxToDelete);
        setPackages(newPkgs);
        if (activePkgTab >= newPkgs.length) {
            setActivePkgTab(Math.max(0, newPkgs.length - 1));
        }
        setActiveFfTab(0);
        setActiveRevTab(0);
    };

    const handleAddSilicon = () => {
        const siName = prompt("Enter silicon revision name (e.g. B0, C0):", "B0");
        if (!siName || !siName.trim()) return;
        const newSi: FormSiliconVersion = {
            name: siName.trim(),
            silicon_corners: 'TT, FF, SS',
            description: ''
        };
        setSiliconVersions([...siliconVersions, newSi]);
        setActiveSiTab(siliconVersions.length);
    };

    const handleDeleteSilicon = (idxToDelete: number) => {
        if (siliconVersions.length <= 1) return;
        const confirmDelete = window.confirm(`Delete silicon version "${siliconVersions[idxToDelete].name}"?`);
        if (!confirmDelete) return;

        const newSi = siliconVersions.filter((_, i) => i !== idxToDelete);
        setSiliconVersions(newSi);
        if (activeSiTab >= newSi.length) {
            setActiveSiTab(Math.max(0, newSi.length - 1));
        }
    };

    const handleAddFormFactor = () => {
        const ffName = prompt("Enter board form factor name (e.g. Validation, SVB, Chamber, EVB):", "Validation");
        if (!ffName || !ffName.trim()) return;
        const newFf: FormBoardFormFactor = {
            name: ffName.trim(),
            description: '',
            revisions: [
                { name: '1.0', boms: 'Default', schematic: null, board_file: null, bom_csv: null, datasheet: null }
            ]
        };
        const updated = [...packages];
        updated[activePkgTab].formfactors.push(newFf);
        setPackages(updated);
        setActiveFfTab(updated[activePkgTab].formfactors.length - 1);
        setActiveRevTab(0);
    };

    const handleDeleteFormFactor = () => {
        const currentPkg = packages[activePkgTab];
        if (!currentPkg || currentPkg.formfactors.length <= 1) return;
        const confirmDelete = window.confirm(`Delete board form factor "${currentPkg.formfactors[activeFfTab]?.name || 'this form factor'}"?`);
        if (!confirmDelete) return;

        const updated = [...packages];
        updated[activePkgTab].formfactors = updated[activePkgTab].formfactors.filter((_, i) => i !== activeFfTab);
        setPackages(updated);
        setActiveFfTab(Math.max(0, activeFfTab - 1));
        setActiveRevTab(0);
    };

    const handleAddRevision = () => {
        const revName = prompt("Enter board revision (e.g. 2.0, 1.1):", "2.0");
        if (!revName || !revName.trim()) return;
        const newRev: FormRevision = {
            name: revName.trim(),
            boms: 'Default',
            schematic: null,
            board_file: null,
            bom_csv: null,
            datasheet: null
        };
        const updated = [...packages];
        updated[activePkgTab].formfactors[activeFfTab].revisions.push(newRev);
        setPackages(updated);
        setActiveRevTab(updated[activePkgTab].formfactors[activeFfTab].revisions.length - 1);
    };

    const handleDeleteRevision = () => {
        const currentFf = packages[activePkgTab]?.formfactors[activeFfTab];
        if (!currentFf || currentFf.revisions.length <= 1) return;
        const confirmDelete = window.confirm(`Delete board revision "${currentFf.revisions[activeRevTab]?.name || 'this revision'}"?`);
        if (!confirmDelete) return;

        const updated = [...packages];
        updated[activePkgTab].formfactors[activeFfTab].revisions = updated[activePkgTab].formfactors[activeFfTab].revisions.filter((_, i) => i !== activeRevTab);
        setPackages(updated);
        setActiveRevTab(Math.max(0, activeRevTab - 1));
    };

    const toggleCornerPreset = (corner: string) => {
        const currentCorners = siliconVersions[activeSiTab].silicon_corners
            .split(',')
            .map(s => s.trim())
            .filter(Boolean);
        let updatedCorners: string[];
        if (currentCorners.includes(corner)) {
            updatedCorners = currentCorners.filter(c => c !== corner);
        } else {
            updatedCorners = [...currentCorners, corner];
        }
        const updated = [...siliconVersions];
        updated[activeSiTab].silicon_corners = updatedCorners.join(', ');
        setSiliconVersions(updated);
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();

        const payloadPackages = packages.map(pkg => ({
            name: pkg.name.trim() || 'Default Package',
            description: pkg.description || '',
            formfactors: pkg.formfactors.map(ff => ({
                name: ff.name.trim() || 'Default',
                description: ff.description || '',
                revisions: ff.revisions.map(r => r.name.trim() || '1.0'),
                revisionDetails: ff.revisions.map(r => ({
                    name: r.name.trim() || '1.0',
                    boms: r.boms.split(',').map(b => b.trim()).filter(Boolean),
                    schematic: r.schematic || null,
                    board_file: r.board_file || null,
                    bom_csv: r.bom_csv || null,
                    datasheet: r.datasheet || null,
                    doc: r.schematic || null
                }))
            }))
        }));

        const payloadSiliconVersions = siliconVersions.map(sv => ({
            name: sv.name.trim() || 'A0',
            silicon_corners: sv.silicon_corners.split(',').map(s => s.trim()).filter(Boolean),
            description: sv.description || ''
        }));

        const success = await updateProject(id, {
            name,
            description,
            project_key: projectKey,
            number_format: numberFormat,
            packages: payloadPackages as any,
            silicon_versions: payloadSiliconVersions as any
        }, selectedFiles);

        if (success) {
            onSuccess();
        }
    };

    const handleConfirmedDelete = async () => {
        const success = await deleteProject(id);
        if (success) {
            onSuccess();
        }
    };

    if (loading) {
        return (
            <div className="project-form-container" style={{ textAlign: 'center', padding: '48px' }}>
                <div style={{ color: 'var(--text-muted)' }}>Loading project configuration...</div>
            </div>
        );
    }

    const currentPkg = packages[activePkgTab] || packages[0];
    const currentSi = siliconVersions[activeSiTab] || siliconVersions[0];
    const currentFf = currentPkg?.formfactors[activeFfTab] || currentPkg?.formfactors[0];
    const currentRev = currentFf?.revisions[activeRevTab] || currentFf?.revisions[0];

    // Totals
    const totalPackages = packages.length;
    const totalSi = siliconVersions.length;
    const totalFf = packages.reduce((acc, p) => acc + (p.formfactors?.length || 0), 0);
    const totalRev = packages.reduce((acc, p) => acc + (p.formfactors?.reduce((acc2, f) => acc2 + (f.revisions?.length || 0), 0) || 0), 0);

    return (
        <div className="project-form-container">
            <header className="add-page-header">
                <button onClick={onBack} className="back-button" title="Go Back">
                    <ArrowLeft size={20} />
                </button>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <div>
                        <h2 style={{ fontSize: '1.6rem', fontWeight: 700, margin: 0 }}>Edit Project: {name}</h2>
                        <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            Modify project silicon architecture and package board form factors
                        </p>
                    </div>
                    {currentUserRole === 'Super User' && (
                        <button 
                            type="button" 
                            onClick={() => setIsRemoveOpen(true)} 
                            className="delete-icon-button"
                            title="Delete Project"
                            style={{
                                background: 'rgba(239, 68, 68, 0.1)',
                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                borderRadius: '8px',
                                padding: '8px 12px',
                                color: '#ef4444',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                        >
                            <Trash2 size={16} />
                            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Delete</span>
                        </button>
                    )}
                </div>
            </header>

            <form onSubmit={handleUpdate} className="add-form" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                
                {/* 1. PROJECT OVERVIEW CARD */}
                <div className="project-meta-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Sparkles size={18} color="var(--accent)" />
                        <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text)' }}>
                            Project Details
                        </h3>
                    </div>

                    <div className="project-meta-grid">
                        {/* Project Name */}
                        <div className="form-group" style={{ margin: 0 }}>
                            <label htmlFor="edit_name" style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', display: 'block' }}>
                                Project Name <span style={{ color: '#ef4444' }}>*</span>
                            </label>
                            <input 
                                id="edit_name"
                                type="text" 
                                value={name} 
                                onChange={(e) => setName(e.target.value)} 
                                required 
                                style={{ width: '100%', padding: '0.75rem', border: '1px solid var(--border)', borderRadius: '8px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text)' }}
                            />
                        </div>

                        {/* Project Key */}
                        <div className="form-group" style={{ margin: 0 }}>
                            <label htmlFor="edit_key" style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', display: 'block' }}>
                                Project Key <span style={{ color: '#ef4444' }}>*</span>
                            </label>
                            <input 
                                id="edit_key"
                                type="text" 
                                value={projectKey} 
                                onChange={(e) => setProjectKey(e.target.value.toUpperCase().slice(0, 3))} 
                                placeholder="3 letters"
                                maxLength={3}
                                required 
                                style={{ 
                                    width: '100%', 
                                    padding: '0.75rem', 
                                    border: '1px solid var(--border)', 
                                    borderRadius: '8px', 
                                    backgroundColor: 'var(--bg-secondary)', 
                                    color: 'var(--text)',
                                    fontWeight: '700',
                                    letterSpacing: '2px',
                                    textTransform: 'uppercase'
                                }}
                            />
                        </div>

                        {/* Number Format */}
                        <div className="form-group" style={{ margin: 0 }}>
                            <label style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', display: 'block' }}>
                                Board Number Format
                            </label>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                <button
                                    type="button"
                                    onClick={() => setNumberFormat('decimal')}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '6px',
                                        padding: '0.75rem',
                                        border: `1px solid ${numberFormat === 'decimal' ? 'var(--accent)' : 'var(--border)'}`,
                                        borderRadius: '8px',
                                        background: numberFormat === 'decimal' ? 'rgba(99, 102, 241, 0.15)' : 'var(--bg-secondary)',
                                        color: numberFormat === 'decimal' ? 'var(--accent)' : 'var(--text-muted)',
                                        fontWeight: 600,
                                        fontSize: '0.85rem',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <Hash size={16} />
                                    <span>Decimal</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setNumberFormat('hex')}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '6px',
                                        padding: '0.75rem',
                                        border: `1px solid ${numberFormat === 'hex' ? 'var(--accent)' : 'var(--border)'}`,
                                        borderRadius: '8px',
                                        background: numberFormat === 'hex' ? 'rgba(99, 102, 241, 0.15)' : 'var(--bg-secondary)',
                                        color: numberFormat === 'hex' ? 'var(--accent)' : 'var(--text-muted)',
                                        fontWeight: 600,
                                        fontSize: '0.85rem',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <Binary size={16} />
                                    <span>Hex (0x)</span>
                                </button>
                            </div>
                        </div>

                        {/* Description */}
                        <div className="form-group" style={{ margin: 0 }}>
                            <label htmlFor="edit_desc" style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', display: 'block' }}>
                                Description
                            </label>
                            <input 
                                id="edit_desc"
                                type="text" 
                                value={description} 
                                onChange={(e) => setDescription(e.target.value)} 
                                placeholder="Optional project notes"
                                style={{ width: '100%', padding: '0.75rem', border: '1px solid var(--border)', borderRadius: '8px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text)' }}
                            />
                        </div>
                    </div>
                </div>

                {/* ============================================================== */}
                {/* SECTION 1: SILICON (PACKAGES/PIN COUNTS & SILICON VERSIONS)     */}
                {/* ============================================================== */}
                <div className="project-section-card section-silicon">
                    <div className="section-card-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span className="section-badge section-badge-silicon">
                                <Cpu size={14} />
                                Section 1: Silicon
                            </span>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text)' }}>
                                    Silicon Tapeout & Packages
                                </h3>
                                <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                    (1) Packages / Pin counts and (2) Silicon revisions with process corners
                                </p>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <span style={{ fontSize: '0.75rem', background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
                                {packages.length} Package{packages.length !== 1 ? 's' : ''}
                            </span>
                            <span style={{ fontSize: '0.75rem', background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(168, 85, 247, 0.3)' }}>
                                {siliconVersions.length} Si Revision{siliconVersions.length !== 1 ? 's' : ''}
                            </span>
                        </div>
                    </div>

                    <div className="silicon-two-col">
                        {/* Sub-panel 1: Packages & Pin Counts */}
                        <div className="silicon-subpanel">
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Box size={16} color="#818cf8" />
                                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>
                                        (1) Packages / Pin Counts
                                    </h4>
                                </div>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    e.g. 40 pin, 48 pin IC
                                </span>
                            </div>

                            {/* Add Package Input Bar */}
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <input
                                    type="text"
                                    value={newPkgInput}
                                    onChange={(e) => setNewPkgInput(e.target.value)}
                                    placeholder="Add package (e.g. 48 pin IC, BGA-128)"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleAddPackage(newPkgInput);
                                        }
                                    }}
                                    style={{
                                        flex: 1,
                                        padding: '0.6rem 0.8rem',
                                        fontSize: '0.85rem',
                                        borderRadius: '8px',
                                        border: '1px solid var(--border)',
                                        background: 'rgba(0, 0, 0, 0.3)',
                                        color: 'var(--text)'
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={() => handleAddPackage(newPkgInput)}
                                    className="nested-add-tab-btn"
                                    style={{ padding: '0.6rem 1rem' }}
                                >
                                    <Plus size={15} />
                                    <span>Add</span>
                                </button>
                            </div>

                            {/* Packages List */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '220px', overflowY: 'auto' }}>
                                {packages.map((pkg, idx) => (
                                    <div 
                                        key={idx} 
                                        className={`package-item-card ${activePkgTab === idx ? 'active-pkg' : ''}`}
                                        onClick={() => {
                                            setActivePkgTab(idx);
                                            setActiveFfTab(0);
                                            setActiveRevTab(0);
                                        }}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <span style={{ 
                                                width: '24px', 
                                                height: '24px', 
                                                borderRadius: '6px', 
                                                background: activePkgTab === idx ? '#6366f1' : 'rgba(255, 255, 255, 0.1)', 
                                                color: '#fff', 
                                                fontSize: '0.75rem', 
                                                display: 'flex', 
                                                alignItems: 'center', 
                                                justifyContent: 'center',
                                                fontWeight: 700 
                                            }}>
                                                {idx + 1}
                                            </span>
                                            <input
                                                type="text"
                                                value={pkg.name}
                                                onClick={(e) => e.stopPropagation()}
                                                onChange={(e) => {
                                                    const updated = [...packages];
                                                    updated[idx].name = e.target.value;
                                                    setPackages(updated);
                                                }}
                                                placeholder="Package Name"
                                                style={{
                                                    background: 'transparent',
                                                    border: 'none',
                                                    color: 'var(--text)',
                                                    fontWeight: 600,
                                                    fontSize: '0.9rem',
                                                    outline: 'none',
                                                    width: '140px'
                                                }}
                                            />
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                {pkg.formfactors.length} form factor{pkg.formfactors.length !== 1 ? 's' : ''}
                                            </span>
                                            {packages.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDeletePackage(idx);
                                                    }}
                                                    title="Delete this package"
                                                    style={{
                                                        background: 'transparent',
                                                        border: 'none',
                                                        color: '#ef4444',
                                                        cursor: 'pointer',
                                                        padding: '4px',
                                                        display: 'flex',
                                                        alignItems: 'center'
                                                    }}
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Sub-panel 2: Silicon Versions & Corners */}
                        <div className="silicon-subpanel">
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Layers size={16} color="#c084fc" />
                                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>
                                        (2) Silicon Versions
                                    </h4>
                                </div>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                    e.g. A0, B0 with TT, FF, SS
                                </span>
                            </div>

                            {/* Silicon Version Tabs */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
                                {siliconVersions.map((sv, idx) => (
                                    <button
                                        key={idx}
                                        type="button"
                                        className={`nested-tab-chip ${activeSiTab === idx ? 'active-t2' : ''}`}
                                        onClick={() => setActiveSiTab(idx)}
                                        style={{ padding: '6px 12px' }}
                                    >
                                        <Cpu size={14} />
                                        <span>{sv.name || `Si ${idx + 1}`}</span>
                                    </button>
                                ))}
                                <button
                                    type="button"
                                    className="nested-add-tab-btn"
                                    onClick={handleAddSilicon}
                                    style={{ padding: '6px 10px' }}
                                    title="Add silicon revision"
                                >
                                    <Plus size={13} />
                                    <span>Add Si</span>
                                </button>
                            </div>

                            {/* Active Silicon Version Form */}
                            {currentSi && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                        <div style={{ flex: 1 }}>
                                            <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                                                Silicon Revision Name
                                            </label>
                                            <input
                                                type="text"
                                                value={currentSi.name}
                                                onChange={(e) => {
                                                    const updated = [...siliconVersions];
                                                    updated[activeSiTab].name = e.target.value;
                                                    setSiliconVersions(updated);
                                                }}
                                                placeholder="e.g. A0, B0"
                                                style={{ width: '100%', padding: '0.55rem', border: '1px solid var(--border)', borderRadius: '6px', background: 'rgba(0,0,0,0.3)', color: 'var(--text)' }}
                                            />
                                        </div>
                                        {siliconVersions.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => handleDeleteSilicon(activeSiTab)}
                                                style={{
                                                    alignSelf: 'flex-end',
                                                    padding: '7px 12px',
                                                    background: 'rgba(239, 68, 68, 0.1)',
                                                    border: '1px solid rgba(239, 68, 68, 0.3)',
                                                    borderRadius: '6px',
                                                    color: '#ef4444',
                                                    fontSize: '0.78rem',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '4px'
                                                }}
                                                title="Delete this silicon revision"
                                            >
                                                <Trash2 size={13} />
                                                <span>Remove</span>
                                            </button>
                                        )}
                                    </div>

                                    <div>
                                        <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                                            Silicon Corners
                                        </label>
                                        <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
                                            {['TT', 'FF', 'SS', 'FS', 'SF'].map(c => {
                                                const cornersArr = currentSi.silicon_corners.split(',').map(s => s.trim());
                                                const isSel = cornersArr.includes(c);
                                                return (
                                                    <button
                                                        key={c}
                                                        type="button"
                                                        onClick={() => toggleCornerPreset(c)}
                                                        className={`corner-preset-chip ${isSel ? 'selected' : ''}`}
                                                    >
                                                        {c}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        <MultipleInputs
                                            value={currentSi.silicon_corners}
                                            onChange={(val) => {
                                                const updated = [...siliconVersions];
                                                updated[activeSiTab].silicon_corners = val;
                                                setSiliconVersions(updated);
                                            }}
                                            placeholder="Corners: TT, FF, SS"
                                        />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* ============================================================== */}
                {/* SECTION 2: BOARD FORM FACTOR (CONFIGURED PER PACKAGE)          */}
                {/* ============================================================== */}
                <div className="project-section-card section-board-ff">
                    <div className="section-card-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <span className="section-badge section-badge-board-ff">
                                <CircuitBoard size={14} />
                                Section 2: Board Form Factor
                            </span>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text)' }}>
                                    Package Board Form Factors & CAD
                                </h3>
                                <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                    Each package has board form factors, versions, BOM flavors, and documents
                                </p>
                            </div>
                        </div>
                        <span style={{ fontSize: '0.75rem', background: 'rgba(14, 165, 233, 0.15)', color: '#38bdf8', padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(14, 165, 233, 0.3)' }}>
                            Active Package: <strong>{currentPkg?.name}</strong>
                        </span>
                    </div>

                    {/* Step 1: Package Switcher Bar */}
                    <div style={{ padding: '12px 22px', background: 'rgba(0, 0, 0, 0.2)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Select Package:
                        </span>
                        {packages.map((pkg, idx) => (
                            <button
                                key={idx}
                                type="button"
                                className={`nested-tab-chip ${activePkgTab === idx ? 'active-t1' : ''}`}
                                onClick={() => {
                                    setActivePkgTab(idx);
                                    setActiveFfTab(0);
                                    setActiveRevTab(0);
                                }}
                            >
                                <Box size={14} />
                                <span>{pkg.name || `Package ${idx + 1}`}</span>
                                <span style={{ fontSize: '0.72rem', background: 'rgba(255,255,255,0.15)', padding: '1px 6px', borderRadius: '10px' }}>
                                    {pkg.formfactors.length}
                                </span>
                            </button>
                        ))}
                    </div>

                    {/* Step 2: Form Factor Tabs Bar */}
                    <div className="nested-tabs-nav" style={{ background: 'rgba(0,0,0,0.15)' }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginRight: '6px' }}>
                            Form Factors:
                        </span>
                        {currentPkg?.formfactors.map((ff, idx) => (
                            <button
                                key={idx}
                                type="button"
                                className={`nested-tab-chip ${activeFfTab === idx ? 'active-t3' : ''}`}
                                onClick={() => {
                                    setActiveFfTab(idx);
                                    setActiveRevTab(0);
                                }}
                            >
                                <CircuitBoard size={14} />
                                <span>{ff.name || `Form Factor ${idx + 1}`}</span>
                            </button>
                        ))}
                        <button
                            type="button"
                            className="nested-add-tab-btn"
                            onClick={handleAddFormFactor}
                            title="Add board form factor"
                        >
                            <Plus size={14} />
                            <span>Add Form Factor</span>
                        </button>
                    </div>

                    {/* Active Form Factor Content */}
                    <div className="nested-tier-body" style={{ padding: '22px' }}>
                        {currentFf ? (
                            <>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                                    <div style={{ flex: 1, minWidth: '220px' }}>
                                        <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px', display: 'block' }}>
                                            Form Factor Name
                                        </label>
                                        <input
                                            type="text"
                                            value={currentFf.name}
                                            onChange={(e) => {
                                                const updated = [...packages];
                                                updated[activePkgTab].formfactors[activeFfTab].name = e.target.value;
                                                setPackages(updated);
                                            }}
                                            placeholder="e.g. Demo, Validation, Chamber"
                                            style={{ width: '100%', maxWidth: '320px', padding: '0.6rem', border: '1px solid var(--border)', borderRadius: '6px', background: 'rgba(0,0,0,0.25)', color: 'var(--text)' }}
                                        />
                                    </div>
                                    {currentPkg.formfactors.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={handleDeleteFormFactor}
                                            style={{
                                                padding: '6px 14px',
                                                background: 'rgba(239, 68, 68, 0.1)',
                                                border: '1px solid rgba(239, 68, 68, 0.3)',
                                                borderRadius: '6px',
                                                color: '#ef4444',
                                                fontSize: '0.8rem',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '6px'
                                            }}
                                        >
                                            <Trash2 size={14} />
                                            <span>Delete Form Factor</span>
                                        </button>
                                    )}
                                </div>

                                {/* Step 3: Board Revisions Bar */}
                                <div style={{ marginTop: '12px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span className="tier-badge tier-badge-4">Version & BOM</span>
                                            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                                Board revisions for <strong>{currentFf.name}</strong>
                                            </span>
                                        </div>
                                        {currentFf.revisions.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={handleDeleteRevision}
                                                style={{
                                                    background: 'transparent',
                                                    border: 'none',
                                                    color: '#ef4444',
                                                    fontSize: '0.78rem',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '4px'
                                                }}
                                            >
                                                <Trash2 size={13} />
                                                <span>Delete Revision</span>
                                            </button>
                                        )}
                                    </div>

                                    {/* Revision Tabs */}
                                    <div className="nested-tabs-nav" style={{ padding: '8px 12px', borderRadius: '8px', marginBottom: '16px' }}>
                                        {currentFf.revisions.map((rev, idx) => (
                                            <button
                                                key={idx}
                                                type="button"
                                                className={`nested-tab-chip ${activeRevTab === idx ? 'active-t4' : ''}`}
                                                onClick={() => setActiveRevTab(idx)}
                                            >
                                                <Layers size={13} />
                                                <span>{rev.name || `Rev ${idx + 1}`}</span>
                                            </button>
                                        ))}
                                        <button
                                            type="button"
                                            className="nested-add-tab-btn"
                                            onClick={handleAddRevision}
                                            title="Add board revision"
                                        >
                                            <Plus size={13} />
                                            <span>Add Revision</span>
                                        </button>
                                    </div>

                                    {/* Active Revision Details */}
                                    {currentRev && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                                            <div className="responsive-tier-grid">
                                                <div>
                                                    <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px', display: 'block', color: 'var(--text-muted)' }}>
                                                        Board Revision Name
                                                    </label>
                                                    <input 
                                                        type="text" 
                                                        placeholder="e.g. 1.0, 1.1, 2.0" 
                                                        value={currentRev.name} 
                                                        style={{ width: '100%', padding: '0.6rem', border: '1px solid var(--border)', borderRadius: '6px', backgroundColor: 'rgba(0, 0, 0, 0.25)', color: 'var(--text)' }}
                                                        onChange={e => {
                                                            const updated = [...packages];
                                                            updated[activePkgTab].formfactors[activeFfTab].revisions[activeRevTab].name = e.target.value;
                                                            setPackages(updated);
                                                        }}
                                                    />
                                                </div>
                                                <div>
                                                    <label style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px', display: 'block', color: 'var(--text-muted)' }}>
                                                        BOM Flavors
                                                    </label>
                                                    <MultipleInputs
                                                        value={currentRev.boms}
                                                        onChange={(val) => {
                                                            const updated = [...packages];
                                                            updated[activePkgTab].formfactors[activeFfTab].revisions[activeRevTab].boms = val;
                                                            setPackages(updated);
                                                        }}
                                                        placeholder="e.g. BOM1, BOM2, Default"
                                                    />
                                                </div>
                                            </div>

                                            {/* CAD Documents Grid */}
                                            <div>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <Paperclip size={15} color="#34d399" />
                                                        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text)' }}>
                                                            CAD & Documentation ({currentRev.name})
                                                        </span>
                                                    </div>
                                                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                                                        Auto-classified on upload
                                                    </span>
                                                </div>

                                                <div className="doc-slot-grid">
                                                    {/* Schematic Slot */}
                                                    <div className="doc-slot-card">
                                                        <div className="doc-slot-title">
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                <FileText size={14} color="#ef4444" />
                                                                <span>Schematic PDF</span>
                                                            </div>
                                                            {currentRev.schematic && (
                                                                <button
                                                                    type="button"
                                                                    className="doc-clear-btn"
                                                                    onClick={() => handleRemoveFile(currentRev.schematic!)}
                                                                    title="Remove schematic"
                                                                >
                                                                    <X size={12} />
                                                                </button>
                                                            )}
                                                        </div>
                                                        {currentRev.schematic ? (
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#22c55e', background: 'rgba(34, 197, 94, 0.1)', padding: '6px 10px', borderRadius: '6px', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
                                                                <FileCheck size={14} />
                                                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentRev.schematic}</span>
                                                            </div>
                                                        ) : (
                                                            <label className="doc-browse-btn">
                                                                <Upload size={13} />
                                                                <span>Attach Schematic</span>
                                                                <input
                                                                    type="file"
                                                                    accept=".pdf"
                                                                    style={{ display: 'none' }}
                                                                    onChange={(e) => {
                                                                        if (e.target.files && e.target.files[0]) {
                                                                            handleFileUpload(e.target.files[0], (fname) => {
                                                                                const updated = [...packages];
                                                                                updated[activePkgTab].formfactors[activeFfTab].revisions[activeRevTab].schematic = fname;
                                                                                setPackages(updated);
                                                                            });
                                                                        }
                                                                    }}
                                                                />
                                                            </label>
                                                        )}
                                                    </div>

                                                    {/* Board File Slot */}
                                                    <div className="doc-slot-card">
                                                        <div className="doc-slot-title">
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                <Layers size={14} color="#3b82f6" />
                                                                <span>Board File (BRD)</span>
                                                            </div>
                                                            {currentRev.board_file && (
                                                                <button
                                                                    type="button"
                                                                    className="doc-clear-btn"
                                                                    onClick={() => handleRemoveFile(currentRev.board_file!)}
                                                                    title="Remove board file"
                                                                >
                                                                    <X size={12} />
                                                                </button>
                                                            )}
                                                        </div>
                                                        {currentRev.board_file ? (
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#22c55e', background: 'rgba(34, 197, 94, 0.1)', padding: '6px 10px', borderRadius: '6px', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
                                                                <FileCheck size={14} />
                                                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentRev.board_file}</span>
                                                            </div>
                                                        ) : (
                                                            <label className="doc-browse-btn">
                                                                <Upload size={13} />
                                                                <span>Attach Board File</span>
                                                                <input
                                                                    type="file"
                                                                    accept=".brd,.cad"
                                                                    style={{ display: 'none' }}
                                                                    onChange={(e) => {
                                                                        if (e.target.files && e.target.files[0]) {
                                                                            handleFileUpload(e.target.files[0], (fname) => {
                                                                                const updated = [...packages];
                                                                                updated[activePkgTab].formfactors[activeFfTab].revisions[activeRevTab].board_file = fname;
                                                                                setPackages(updated);
                                                                            });
                                                                        }
                                                                    }}
                                                                />
                                                            </label>
                                                        )}
                                                    </div>

                                                    {/* BOM CSV Slot */}
                                                    <div className="doc-slot-card">
                                                        <div className="doc-slot-title">
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                <FileText size={14} color="#10b981" />
                                                                <span>BOM (CSV/Excel)</span>
                                                            </div>
                                                            {currentRev.bom_csv && (
                                                                <button
                                                                    type="button"
                                                                    className="doc-clear-btn"
                                                                    onClick={() => handleRemoveFile(currentRev.bom_csv!)}
                                                                    title="Remove BOM file"
                                                                >
                                                                    <X size={12} />
                                                                </button>
                                                            )}
                                                        </div>
                                                        {currentRev.bom_csv ? (
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#22c55e', background: 'rgba(34, 197, 94, 0.1)', padding: '6px 10px', borderRadius: '6px', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
                                                                <FileCheck size={14} />
                                                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentRev.bom_csv}</span>
                                                            </div>
                                                        ) : (
                                                            <label className="doc-browse-btn">
                                                                <Upload size={13} />
                                                                <span>Attach BOM File</span>
                                                                <input
                                                                    type="file"
                                                                    accept=".csv,.xlsx,.xls"
                                                                    style={{ display: 'none' }}
                                                                    onChange={(e) => {
                                                                        if (e.target.files && e.target.files[0]) {
                                                                            handleFileUpload(e.target.files[0], (fname) => {
                                                                                const updated = [...packages];
                                                                                updated[activePkgTab].formfactors[activeFfTab].revisions[activeRevTab].bom_csv = fname;
                                                                                setPackages(updated);
                                                                            });
                                                                        }
                                                                    }}
                                                                />
                                                            </label>
                                                        )}
                                                    </div>

                                                    {/* Datasheet Slot */}
                                                    <div className="doc-slot-card">
                                                        <div className="doc-slot-title">
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                <FileText size={14} color="#a855f7" />
                                                                <span>Datasheet (PDF)</span>
                                                            </div>
                                                            {currentRev.datasheet && (
                                                                <button
                                                                    type="button"
                                                                    className="doc-clear-btn"
                                                                    onClick={() => handleRemoveFile(currentRev.datasheet!)}
                                                                    title="Remove datasheet"
                                                                >
                                                                    <X size={12} />
                                                                </button>
                                                            )}
                                                        </div>
                                                        {currentRev.datasheet ? (
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#22c55e', background: 'rgba(34, 197, 94, 0.1)', padding: '6px 10px', borderRadius: '6px', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
                                                                <FileCheck size={14} />
                                                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{currentRev.datasheet}</span>
                                                            </div>
                                                        ) : (
                                                            <label className="doc-browse-btn">
                                                                <Upload size={13} />
                                                                <span>Attach Datasheet</span>
                                                                <input
                                                                    type="file"
                                                                    accept=".pdf"
                                                                    style={{ display: 'none' }}
                                                                    onChange={(e) => {
                                                                        if (e.target.files && e.target.files[0]) {
                                                                            handleFileUpload(e.target.files[0], (fname) => {
                                                                                const updated = [...packages];
                                                                                updated[activePkgTab].formfactors[activeFfTab].revisions[activeRevTab].datasheet = fname;
                                                                                setPackages(updated);
                                                                            });
                                                                        }
                                                                    }}
                                                                />
                                                            </label>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Generic Multiple File Drop Zone */}
                                                <div 
                                                    style={{
                                                        marginTop: '12px',
                                                        padding: '14px',
                                                        border: '1px dashed var(--border)',
                                                        borderRadius: '8px',
                                                        background: 'rgba(0,0,0,0.2)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        flexWrap: 'wrap',
                                                        gap: '10px'
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                        <Upload size={16} color="var(--text-muted)" />
                                                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                                            Batch attach docs for this revision (PDF, BRD, CSV)
                                                        </span>
                                                    </div>
                                                    <label className="doc-browse-btn">
                                                        <span>Browse Files</span>
                                                        <input
                                                            type="file"
                                                            multiple
                                                            style={{ display: 'none' }}
                                                            onChange={(e) => handleMultipleFiles(e.target.files)}
                                                        />
                                                    </label>
                                                </div>

                                                {/* Staged files overview */}
                                                {selectedFiles.length > 0 && (
                                                    <div className="staged-files-card">
                                                        <div className="staged-files-header">
                                                            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text)' }}>
                                                                Files Ready to Upload ({selectedFiles.length})
                                                            </span>
                                                        </div>
                                                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                                            {selectedFiles.map((file, fIdx) => (
                                                                <div key={fIdx} className="staged-file-chip">
                                                                    <FileText size={12} color="var(--accent)" />
                                                                    <span style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleRemoveFile(file.name)}
                                                                        className="staged-file-remove"
                                                                        title="Remove from upload queue"
                                                                    >
                                                                        <X size={11} />
                                                                    </button>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                                <p>No form factors for this package yet.</p>
                                <button type="button" onClick={handleAddFormFactor} className="nested-add-tab-btn" style={{ margin: '0 auto' }}>
                                    <Plus size={14} />
                                    <span>Add Form Factor</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Summary & Save Action Bar */}
                <div className="form-sticky-bar">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                            Summary:
                        </div>
                        <span style={{ fontSize: '0.78rem', background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8', padding: '3px 8px', borderRadius: '6px', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
                            {totalPackages} Pkg{totalPackages !== 1 ? 's' : ''}
                        </span>
                        <span style={{ fontSize: '0.78rem', background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', padding: '3px 8px', borderRadius: '6px', border: '1px solid rgba(168, 85, 247, 0.3)' }}>
                            {totalSi} Si Rev{totalSi !== 1 ? 's' : ''}
                        </span>
                        <span style={{ fontSize: '0.78rem', background: 'rgba(14, 165, 233, 0.15)', color: '#38bdf8', padding: '3px 8px', borderRadius: '6px', border: '1px solid rgba(14, 165, 233, 0.3)' }}>
                            {totalFf} Board Form Factor{totalFf !== 1 ? 's' : ''}
                        </span>
                        <span style={{ fontSize: '0.78rem', background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', padding: '3px 8px', borderRadius: '6px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                            {totalRev} Board Rev{totalRev !== 1 ? 's' : ''}
                        </span>
                    </div>

                    <button 
                        type="submit" 
                        disabled={saving || !name || projectKey.length !== 3} 
                        className="save-button"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '0.75rem 1.6rem',
                            background: 'var(--accent)',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '8px',
                            fontWeight: 700,
                            cursor: saving ? 'not-allowed' : 'pointer',
                            opacity: (saving || !name || projectKey.length !== 3) ? 0.6 : 1
                        }}
                    >
                        <Save size={18} />
                        <span>{saving ? 'Saving...' : 'Save Changes'}</span>
                    </button>
                </div>
            </form>

            {isRemoveOpen && (
                <RemoveProject 
                    isOpen={isRemoveOpen}
                    project={{ name, pcb_count: pcbCount }}
                    onClose={() => setIsRemoveOpen(false)}
                    onConfirm={handleConfirmedDelete}
                />
            )}
        </div>
    );
}
