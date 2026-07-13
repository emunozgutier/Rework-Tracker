import { useState } from 'react';
import { ArrowLeft, Save, HelpCircle } from 'lucide-react';
import { FormTabs } from '../../components/forms/FormTabs';
import { MultipleInputs } from '../../components/forms/MultipleInputs';
import { useProjectStore } from '../../store/useProjectStore';

interface AddProjectProps {
    onBack: () => void;
    onSuccess: () => void;
}

function generateUniqueKey(name: string, existingKeys: string[]): string {
    const letters = name.replace(/[^a-zA-Z]/g, '').toUpperCase();
    if (letters.length < 3) return '';

    // Strategy 1: First 3 letters
    const candidate1 = letters.substring(0, 3);
    if (!existingKeys.includes(candidate1)) return candidate1;

    // Strategy 2: First 3 consonants
    const consonants = letters.replace(/[AEIOU]/g, '');
    if (consonants.length >= 3) {
        const candidate2 = consonants.substring(0, 3);
        if (!existingKeys.includes(candidate2)) return candidate2;
    }

    return '';
}

export function AddProject({ onBack, onSuccess }: AddProjectProps) {
    const [name, setName] = useState('');
    const [revisions, setRevisions] = useState('A0');
    const [siliconCorners, setSiliconCorners] = useState('TT');
    const [projectKey, setProjectKey] = useState('');
    const [numberFormat, setNumberFormat] = useState<'hex' | 'decimal'>('decimal');
    const [flavors, setFlavors] = useState<{name: string, revisions: string, boms?: string}[]>([
        { name: 'Validation', revisions: '1.0', boms: 'BOM1, BOM2' }
    ]);
    const [activeTab, setActiveTab] = useState(0);
    const [isKeyManuallyEdited, setIsKeyManuallyEdited] = useState(false);
    const [autoKeyError, setAutoKeyError] = useState('');
    
    const { addProject, loading, projects, error } = useProjectStore();

    let keyBorderColor = undefined;
    let keyTextColor = undefined;
    if (projectKey.length === 3) {
        const isDuplicate = projects.some(p => p.project_key === projectKey);
        if (isDuplicate) {
            keyBorderColor = '#ef4444';
            keyTextColor = '#ef4444';
        } else {
            keyBorderColor = '#22c55e';
            keyTextColor = '#22c55e';
        }
    } else if (projectKey.length > 0 && projectKey.length < 3) {
        keyBorderColor = '#ef4444';
        keyTextColor = '#ef4444';
    }

    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newName = e.target.value;
        setName(newName);

        if (!isKeyManuallyEdited) {
            const existingKeys = projects.map(p => p.project_key);
            const autoKey = generateUniqueKey(newName, existingKeys);
            
            if (autoKey) {
                setProjectKey(autoKey);
                setAutoKeyError('');
            } else if (newName.replace(/[^a-zA-Z]/g, '').length >= 3) {
                setAutoKeyError('Could not auto-generate a unique 3-letter key. Please enter one manually.');
                setProjectKey('');
            } else {
                setAutoKeyError('');
                if (newName === '') setProjectKey('');
            }
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const payloadPcbFlavors = flavors.filter(f => f.name.trim() !== '').map(f => ({
            name: f.name.trim(),
            revisions: f.revisions.split(',').map(r => r.trim()).filter(Boolean),
            boms: f.boms ? f.boms.split(',').map(b => b.trim()).filter(Boolean) : []
        }));
        const success = await addProject({ 
            name, description: '', revisions, project_key: projectKey, 
            flavors: payloadPcbFlavors, silicon_corners: siliconCorners, number_format: numberFormat 
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
                <h2>Add New Project</h2>
            </header>

            <form onSubmit={handleSubmit} className="add-form">
                <div className="form-group">
                    <label htmlFor="name">Project Name</label>
                    <input 
                        id="name"
                        type="text" 
                        value={name} 
                        onChange={handleNameChange} 
                        placeholder="e.g. Project Ares"
                        required 
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="project_key" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        Project Key (3 Letters)
                        <span title="The 3-letter project key is for the links and storing data" style={{ cursor: 'help', display: 'flex' }}>
                            <HelpCircle size={14} color="var(--text-muted)" />
                        </span>
                    </label>
                    <input 
                        id="project_key"
                        type="text" 
                        maxLength={3}
                        value={projectKey} 
                        onChange={(e) => {
                            setProjectKey(e.target.value.replace(/[^A-Za-z]/g, '').toUpperCase());
                            setIsKeyManuallyEdited(true);
                            setAutoKeyError('');
                        }} 
                        placeholder="e.g. MOD (Auto-generates if blank)"
                        style={{ 
                            textTransform: 'uppercase',
                            borderColor: keyBorderColor,
                            color: keyTextColor,
                            outlineColor: keyBorderColor
                        }}
                    />
                    {autoKeyError && <span style={{ color: '#ef4444', fontSize: '0.8rem', marginTop: '4px', display: 'block' }}>{autoKeyError}</span>}
                </div>
                <div className="form-group">
                    <label htmlFor="revisions">Global Available Revisions (Optional)</label>
                    <MultipleInputs
                        value={revisions}
                        onChange={setRevisions}
                        placeholder="e.g. A0, A1, B0, B1"
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="silicon_corners">Silicon Corners (Optional)</label>
                    <MultipleInputs
                        value={siliconCorners}
                        onChange={setSiliconCorners}
                        placeholder="e.g. TT, FF, SS"
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
                        onDeleteActiveTab={() => {
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
                                    />
                                </div>
                            </div>
                        )}
                    </FormTabs>
                </div>
                {error && <div className="error-message" style={{ color: '#ef4444', marginBottom: '1rem', padding: '0.5rem', backgroundColor: '#fee2e2', borderRadius: '4px' }}>{error}</div>}
                <button type="submit" className="submit-button" disabled={loading}>
                    <Save size={18} />
                    <span>{loading ? 'Saving...' : 'Save Project'}</span>
                </button>
            </form>
        </div>
    );
}
