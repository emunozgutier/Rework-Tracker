import { useEffect, useState } from 'react';
import { ArrowLeft, Save, Trash2, HelpCircle } from 'lucide-react';
import { FormTabs } from '../../components/forms/FormTabs';
import { MultipleInputs } from '../../components/forms/MultipleInputs';
import { API_BASE, apiFetch } from '../../store/database/apiBridge';
import { useProjectStore } from '../../store/storeProject';
import { usePcbStore } from '../../store/storePcb';

interface EditProjectProps {
    id: string | number;
    onBack: () => void;
    onSuccess: () => void;
}

export function EditProject({ id, onBack, onSuccess }: EditProjectProps) {
    const [name, setName] = useState('');
    const [revisions, setRevisions] = useState('');
    const [siliconCorners, setSiliconCorners] = useState('');
    const [projectKey, setProjectKey] = useState('');
    const [numberFormat, setNumberFormat] = useState<'hex' | 'decimal'>('decimal');
    const [flavors, setFlavors] = useState<{name: string, revisions: string, boms?: string}[]>([]);
    const [activeTab, setActiveTab] = useState(0);
    const [loading, setLoading] = useState(true);
    
    const { projects, updateProject, deleteProject, loading: saving } = useProjectStore();
    const { pcbs, fetchPcbs } = usePcbStore();

    useEffect(() => {
        if (pcbs.length === 0) fetchPcbs();
    }, [pcbs.length, fetchPcbs]);

    const projectPcbs = pcbs.filter(p => p.project === name);
    const pcbCount = projectPcbs.length;

    const getProductUsageCount = (val: string) => {
        if (!val) return 0;
        return projectPcbs.filter(p => p.product && p.product.split(' ').includes(val)).length;
    };

    const getFlavorRevisionUsageCount = (flavorName: string, val: string) => {
        if (!val) return 0;
        return projectPcbs.filter(p => {
            if (!p.product) return false;
            if (flavorName && !p.product.startsWith(flavorName)) return false;
            return p.product.split(' ').includes(val);
        }).length;
    };

    const getFlavorBomUsageCount = (flavorName: string, val: string) => {
        if (!val) return 0;
        return projectPcbs.filter(p => {
            if (flavorName && p.product && !p.product.startsWith(flavorName)) return false;
            return p.bom === val;
        }).length;
    };

    const filterCountsObj = (valStr: string | undefined | null, counter: (v: string) => number) => {
        if (!valStr) return {};
        return valStr.split(',').reduce((acc, item) => {
            const trimmed = item.trim();
            if (trimmed) acc[trimmed] = counter(trimmed);
            return acc;
        }, {} as Record<string, number>);
    };

    useEffect(() => {
        // Find existing project from store directly if available, else fetch
        const existingProject = projects.find(p => p.id.toString() === id.toString());
        if (existingProject) {
            setName(existingProject.name);
            setRevisions(Array.isArray(existingProject.revisions) ? existingProject.revisions.join(', ') : (existingProject.revisions || ''));
            setSiliconCorners(existingProject.silicon_corners || '');
            setProjectKey(existingProject.project_key || '');
            setNumberFormat((existingProject.number_format as 'hex' | 'decimal') || 'decimal');
            if (existingProject.flavors && existingProject.flavors.length > 0) {
                setFlavors(existingProject.flavors.map((f: any) => ({ name: f.name, revisions: f.revisions.join(', '), boms: f.boms ? f.boms.join(', ') : '' })));
            } else {
                setFlavors([{ name: '', revisions: '', boms: '' }]);
            }
            setLoading(false);
        } else {
            apiFetch(`${API_BASE}/projects`)
                .then(res => res.json())
                .then(data => {
                    const project = data.find((p: any) => p.id.toString() === id.toString());
                    if (project) {
                        setName(project.name);
                        setRevisions(Array.isArray(project.revisions) ? project.revisions.join(', ') : (project.revisions || ''));
                        setSiliconCorners(project.silicon_corners || '');
                        setProjectKey(project.project_key || '');
                        setNumberFormat(project.number_format || 'decimal');
                        if (project.flavors && project.flavors.length > 0) {
                            setFlavors(project.flavors.map((f: any) => ({ name: f.name, revisions: f.revisions.join(', '), boms: f.boms ? f.boms.join(', ') : '' })));
                        } else {
                            setFlavors([{ name: '', revisions: '', boms: '' }]);
                        }
                    }
                    setLoading(false);
                })
                .catch(err => {
                    console.error(err);
                    setLoading(false);
                });
        }
    }, [id, projects]);


    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        const payloadPcbFlavors = flavors
            .filter(f => f.name.trim())
            .map(f => ({
                name: f.name.trim(),
                revisions: f.revisions.split(',').map(r => r.trim()).filter(Boolean),
                boms: f.boms ? f.boms.split(',').map(b => b.trim()).filter(Boolean) : []
            }));
        const success = await updateProject(id, { 
            name, description: '', revisions, project_key: projectKey, 
            flavors: payloadPcbFlavors, silicon_corners: siliconCorners, number_format: numberFormat 
        });
        if (success) {
            onSuccess();
        }
    };

    const handleDelete = async () => {
        if (!window.confirm('Are you sure you want to delete this project?')) return;
        const success = await deleteProject(id);
        if (success) {
            onSuccess();
        }
    };

    if (loading) return <div className="loading">Loading Project...</div>;

    const activeFlavorName = flavors[activeTab]?.name;
    const activeFlavorInUse = activeFlavorName ? projectPcbs.some(p => p.product && p.product.startsWith(activeFlavorName)) : false;

    return (
        <div className="add-page-container">
            <header className="add-page-header">
                <button onClick={onBack} className="back-button">
                    <ArrowLeft size={20} />
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h2 style={{ margin: 0 }}>Edit Project</h2>
                    <span style={{ fontSize: '0.8rem', backgroundColor: 'var(--bg-element)', color: 'var(--text-muted)', padding: '2px 8px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                        {pcbCount} {pcbCount === 1 ? 'PCB' : 'PCBs'}
                    </span>
                </div>
                <button 
                    onClick={handleDelete} 
                    className="delete-icon-button" 
                    title={pcbCount > 0 ? `Cannot delete project with ${pcbCount} active ${pcbCount === 1 ? 'PCB' : 'PCBs'}` : "Delete Project"}
                    disabled={pcbCount > 0}
                    style={{ opacity: pcbCount > 0 ? 0.3 : 1, cursor: pcbCount > 0 ? 'not-allowed' : 'pointer' }}
                >
                    <Trash2 size={20} color="#ef4444" />
                </button>
            </header>

            <form onSubmit={handleUpdate} className="add-form">
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <div className="form-group" style={{ flex: 1.5 }}>
                        <label>Project Name</label>
                        <div style={{ padding: '0.75rem', backgroundColor: 'var(--bg-panel)', borderRadius: '4px', color: 'var(--text-muted)', fontSize: '1rem', fontWeight: 500, border: '1px solid var(--border)' }}>
                            {name}
                        </div>
                    </div>
                    <div className="form-group" style={{ flex: 1 }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            Project Key (3 Letters)
                            <span title="The 3-letter project key is for the links and storing data" style={{ cursor: 'help', display: 'flex' }}>
                                <HelpCircle size={14} color="var(--text-muted)" />
                            </span>
                        </label>
                        <div style={{ padding: '0.75rem', backgroundColor: 'var(--bg-panel)', borderRadius: '4px', color: 'var(--text-muted)', fontSize: '1rem', fontWeight: 500, textTransform: 'uppercase', border: '1px solid var(--border)' }}>
                            {projectKey}
                        </div>
                    </div>
                </div>
                <div className="form-group">
                    <label htmlFor="revisions">Global Available Revisions (Optional)</label>
                    <MultipleInputs
                        value={revisions}
                        onChange={setRevisions}
                        placeholder="e.g. A0, A1, B0, B1"
                        usageCounts={filterCountsObj(revisions, getProductUsageCount)}
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="silicon_corners">Silicon Corners (Optional)</label>
                    <MultipleInputs
                        value={siliconCorners}
                        onChange={setSiliconCorners}
                        placeholder="e.g. TT, FF, SS"
                        usageCounts={filterCountsObj(siliconCorners, getProductUsageCount)}
                    />
                </div>
                <div className="form-group">
                    <label>Board Number Format</label>
                    <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 'normal' }}>
                            <input 
                                type="radio" 
                                name="numberFormat" 
                                value="hex" 
                                checked={numberFormat === 'hex'} 
                                onChange={() => setNumberFormat('hex')} 
                            />
                            Hex (0x)
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontWeight: 'normal' }}>
                            <input 
                                type="radio" 
                                name="numberFormat" 
                                value="decimal" 
                                checked={numberFormat === 'decimal'} 
                                onChange={() => setNumberFormat('decimal')} 
                            />
                            Decimal
                        </label>
                    </div>
                </div>
                <div className="form-group">
                    <label>PCB Flavors & Revisions</label>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '-4px', marginBottom: '8px' }}>
                        Define specific flavors (e.g., Demo, Validation) and their allowed revisions.
                    </p>
                    <FormTabs
                        tabs={flavors.map(ff => ff.name)}
                        activeTab={activeTab}
                        onTabChange={setActiveTab}
                        onAddTab={() => {
                            setFlavors([...flavors, { name: '', revisions: '', boms: '' }]);
                            setActiveTab(flavors.length);
                        }}
                        canDeleteActiveTab={!activeFlavorInUse}
                        onDeleteActiveTab={() => {
                            if (activeFlavorInUse) {
                                alert(`Cannot delete flavor "${activeFlavorName}" because it is currently assigned to one or more PCBs.`);
                                return;
                            }
                            const newFf = flavors.filter((_, i) => i !== activeTab);
                            setFlavors(newFf);
                            setActiveTab(Math.max(0, activeTab - 1));
                        }}
                    >
                        {flavors[activeTab] && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div>
                                    <label style={{ fontSize: '0.85rem', marginBottom: '4px', display: 'block' }}>Flavor Name</label>
                                    <input 
                                        type="text" 
                                        placeholder="e.g. Demo" 
                                        value={flavors[activeTab].name} 
                                        style={{ width: '100%', padding: '0.6rem', border: '1px solid var(--border)', borderRadius: '4px', backgroundColor: 'rgba(0, 0, 0, 0.2)', color: 'var(--text)', transition: 'border-color 0.2s ease' }}
                                        onChange={e => {
                                            const newFf = [...flavors];
                                            newFf[activeTab].name = e.target.value;
                                            setFlavors(newFf);
                                        }}
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.85rem', marginBottom: '4px', display: 'block' }}>PCB Revisions</label>
                                    <MultipleInputs
                                        value={flavors[activeTab].revisions}
                                        onChange={(val) => {
                                            const newFf = [...flavors];
                                            newFf[activeTab].revisions = val;
                                            setFlavors(newFf);
                                        }}
                                        placeholder="e.g. 1.0, 1.1"
                                        usageCounts={filterCountsObj(flavors[activeTab].revisions, (val) => getFlavorRevisionUsageCount(flavors[activeTab].name, val))}
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.85rem', marginBottom: '4px', display: 'block' }}>BOM Options</label>
                                    <MultipleInputs
                                        value={flavors[activeTab].boms || ''}
                                        onChange={(val) => {
                                            const newFf = [...flavors];
                                            newFf[activeTab].boms = val;
                                            setFlavors(newFf);
                                        }}
                                        placeholder="e.g. BOM1, BOM2"
                                        usageCounts={filterCountsObj(flavors[activeTab].boms, (val) => getFlavorBomUsageCount(flavors[activeTab].name, val))}
                                    />
                                </div>
                            </div>
                        )}
                    </FormTabs>
                </div>
                <button type="submit" className="submit-button" disabled={saving}>
                    <Save size={18} />
                    <span>{saving ? 'Saving...' : 'Update Project'}</span>
                </button>
            </form>
        </div>
    );
}
