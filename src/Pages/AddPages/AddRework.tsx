import { useEffect, useState } from 'react';
import { ArrowLeft, Save } from 'lucide-react';

import { API_BASE, apiFetch } from '../../store/database/apiBridge';
import { useReworkStore } from '../../store/useReworkStore';
import { useAppState } from '../../store/useAppState';
import { useOwnerStore } from '../../store/useOwnerStore';
import { FormGroup } from '../../components/forms/FormGroup';
import { BoardName } from '../../components/BoardName';

interface AddReworkProps {
    onBack: () => void;
    onSuccess: () => void;
}

const compressImage = async (file: File, maxSizeMB: number = 10, maxDimension: number = 1920): Promise<File> => {
    // If the file is small enough and we don't strictly need resizing, we can just process it to be safe,
    // or we can pass it through. But to guarantee it's small, we'll draw it to a canvas.
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                let width = img.width;
                let height = img.height;
                
                if (width > maxDimension || height > maxDimension) {
                    if (width > height) {
                        height = Math.round((height * maxDimension) / width);
                        width = maxDimension;
                    } else {
                        width = Math.round((width * maxDimension) / height);
                        height = maxDimension;
                    }
                }
                
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);
                
                const fileSizeMB = file.size / (1024 * 1024);
                // Adjust JPEG quality based on original size to aim for < maxSizeMB
                let quality = 0.8;
                if (fileSizeMB > maxSizeMB) quality = 0.6;
                if (fileSizeMB > maxSizeMB * 2) quality = 0.5;

                canvas.toBlob((blob) => {
                    if (blob) {
                        const newFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpeg", {
                            type: 'image/jpeg',
                            lastModified: Date.now(),
                        });
                        resolve(newFile);
                    } else {
                        resolve(file); // fallback
                    }
                }, 'image/jpeg', quality);
            };
            img.onerror = () => resolve(file); 
        };
        reader.onerror = () => resolve(file); 
    });
};

export function AddRework({ onBack, onSuccess }: AddReworkProps) {
    const { selectedId } = useAppState();
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
    const [images, setImages] = useState<File[]>([]);
    const { owners, fetchOwners } = useOwnerStore();
    const { addRework, loading } = useReworkStore();
    const [typedCrc, setTypedCrc] = useState('');

    const getPcbDetails = (pcbIdStr: string) => {
        if (!pcbIdStr) return { baseName: '', crc: '', hasCrc: false };
        const pcb = pcbs.find(p => p.id.toString() === pcbIdStr);
        if (!pcb) return { baseName: '', crc: '', hasCrc: false };
        
        const project = projects.find(p => p.id === pcb.project_id);
        const hasCrc = project ? project.number_format !== 'hex' : true;
        
        let baseName = pcb.board_number || '';
        let crc = '';
        if (hasCrc && baseName.length > 1) {
            crc = baseName.slice(-1);
            baseName = baseName.slice(0, -1);
        }
        return { baseName, crc, hasCrc };
    };

    const handlePcbChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setSelectedPcb(e.target.value);
        setTypedCrc('');
    };

    const selectedPcbDetails = getPcbDetails(selectedPcb);
    const isCrcCorrect = !selectedPcbDetails.hasCrc || selectedId || typedCrc === selectedPcbDetails.crc;
    const showCrcError = selectedPcbDetails.hasCrc && !selectedId && typedCrc !== '' && typedCrc !== selectedPcbDetails.crc;
    const isCrcValid = selectedPcbDetails.hasCrc && !selectedId && typedCrc === selectedPcbDetails.crc;

    useEffect(() => {
        fetchOwners();
        Promise.all([
            apiFetch(`${API_BASE}/pcbs`).then(res => res.json()),
            apiFetch(`${API_BASE}/projects`).then(res => res.json())
        ])
        .then(([pcbData, projData]) => {
            setPcbs(pcbData);
            setProjects(projData);
            if (selectedId) {
                setSelectedPcb(selectedId.toString());
                const pcb = pcbData.find((p: any) => p.id.toString() === selectedId.toString());
                if (pcb) {
                    const project = projData.find((p: any) => p.id === pcb.project_id);
                    const hasCrc = project ? project.number_format !== 'hex' : true;
                    if (hasCrc && pcb.board_number && pcb.board_number.length > 1) {
                        setTypedCrc(pcb.board_number.slice(-1));
                    }
                }
            } else if (pcbData.length > 0) {
                setSelectedPcb(pcbData[0].id.toString());
            }
        })
        .catch(err => console.error('Failed to fetch data:', err));
    }, [selectedId, fetchOwners]);

    useEffect(() => {
        if (reworkType === 'Silicon Swap') {
            if (noPartYet) {
                setTitle('Silicon Swap (No part)');
            } else {
                const rev = selectedRevision || 'A0';
                const corner = siliconVersion || 'TT';
                setTitle(`Silicon Swap to ${rev} ${corner}`);
            }
        } else if (title.startsWith('Silicon Swap')) {
            setTitle(''); 
        }
    }, [reworkType, selectedRevision, siliconVersion, noPartYet]);

    const activePcb = pcbs.find(p => p.id.toString() === selectedPcb);
    const selectedProjData = projects.find(p => p.id === activePcb?.project_id);
    const availableSiliconVersions = selectedProjData?.silicon_corners ? selectedProjData.silicon_corners.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
    
    let availableSiliconRevisions: string[] = [];
    if (selectedProjData?.revisions) {
        if (Array.isArray(selectedProjData.revisions)) {
            availableSiliconRevisions = selectedProjData.revisions;
        } else {
            availableSiliconRevisions = (selectedProjData.revisions as unknown as string).split(',').map(r => r.trim());
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!isCrcCorrect) {
            alert("Please verify the board by entering the correct CRC checksum character.");
            return;
        }
        
        const formData = new FormData();
        formData.append('pcb_id', selectedPcb || '');
        formData.append('title', title);
        formData.append('description', description);
        formData.append('owner_id', ownerId);
        formData.append('rework_type', reworkType);

        if (reworkType === 'Silicon Swap' && activePcb && selectedProjData) {
            let rawProduct = activePcb.product || '';
            let foundPcbFlavor = '';
            let finalPcbRev = '';

            if (selectedProjData.flavors && selectedProjData.flavors.length > 0) {
                for (const ff of selectedProjData.flavors) {
                    if (rawProduct.startsWith(ff.name)) {
                        foundPcbFlavor = ff.name;
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
            const new_product = [foundPcbFlavor, finalPcbRev, revPart, cornerPart].filter(Boolean).join(' ').trim();
            formData.append('new_product', new_product);
            formData.append('new_silicon_rev', revPart);
            formData.append('new_silicon_corner', cornerPart);
        }
        images.forEach(img => {
            formData.append('images', img);
        });

        const success = await addRework(formData);
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
                <h2>Add Rework Record</h2>
            </header>

            <form onSubmit={handleSubmit} className="add-form">
                {selectedId ? (
                    <FormGroup title="PCB Board & Checksum">
                        <div className="form-row">
                            <div className="form-group flex-1">
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
                                    height: '48px'
                                }}>
                                    {activePcb ? (
                                        <BoardName name={activePcb.board_number} isHex={selectedProjData?.number_format === 'hex'} />
                                    ) : (
                                        'Unknown'
                                    )}
                                </div>
                            </div>
                            <div className="form-group flex-1">
                                <label htmlFor="rework_type">Rework Type</label>
                                <select id="rework_type" value={reworkType} onChange={(e) => setReworkType(e.target.value)}>
                                    <option value="Minor">Minor - still works</option>
                                    <option value="Major">Major - something wrong</option>
                                    <option value="Resistor Swap">Resistor Swap</option>
                                    <option value="Silicon Swap">Silicon Swap</option>
                                </select>
                            </div>
                        </div>

                        {reworkType === 'Silicon Swap' && (
                            <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px dashed var(--border)' }}>
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
                            </div>
                        )}
                    </FormGroup>
                ) : (
                    <>
                        <FormGroup title="PCB Board & Checksum">
                            <div className="form-row">
                                <div className="form-group flex-1">
                                    <label htmlFor="pcb">PCB Board *</label>
                                    <select 
                                        id="pcb" 
                                        value={selectedPcb} 
                                        onChange={handlePcbChange}
                                        required
                                    >
                                        {pcbs.map(p => {
                                            const details = getPcbDetails(p.id.toString());
                                            return (
                                                <option key={p.id} value={p.id}>
                                                    {details.baseName}
                                                </option>
                                            );
                                        })}
                                    </select>
                                </div>
                                {selectedPcbDetails.hasCrc && (
                                    <div className="form-group flex-1">
                                        <label htmlFor="crc">Enter CRC Checksum Character *</label>
                                        <input 
                                            type="text"
                                            id="crc"
                                            value={typedCrc}
                                            onChange={(e) => setTypedCrc(e.target.value.trim().toUpperCase().slice(0, 1))}
                                            placeholder="E.g. G"
                                            required
                                            maxLength={1}
                                            style={{
                                                color: showCrcError ? '#ef4444' : (isCrcValid ? '#10b981' : 'inherit'),
                                                borderColor: showCrcError ? 'rgba(239, 68, 68, 0.4)' : (isCrcValid ? 'rgba(16, 185, 129, 0.4)' : 'var(--border)'),
                                                boxShadow: showCrcError ? '0 0 0 2px rgba(239, 68, 68, 0.15)' : (isCrcValid ? '0 0 0 2px rgba(16, 185, 129, 0.15)' : 'none')
                                            }}
                                        />
                                        {showCrcError && (
                                            <span style={{ color: '#ef4444', fontSize: '0.85rem', marginTop: '6px', display: 'block' }}>
                                                Incorrect CRC checksum character.
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        </FormGroup>
                        <div className="form-group">
                            <label htmlFor="rework_type">Rework Type</label>
                            <select id="rework_type" value={reworkType} onChange={(e) => setReworkType(e.target.value)}>
                                <option value="Minor">Minor - still works</option>
                                <option value="Major">Major - something wrong</option>
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
                    </>
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
                        placeholder="Detail the repairs or modifications..."
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


                <div className="form-group" style={{ marginBottom: '24px' }}>
                    <label style={{ display: 'block', fontWeight: 600, marginBottom: '8px' }}>Attach Photo Evidence (Up to 3)</label>
                    
                    {images.length > 0 && (
                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
                            {images.map((img, i) => (
                                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                                    <div style={{ position: 'relative', width: '90px', height: '90px', borderRadius: '12px', overflow: 'hidden', border: '2px solid var(--accent)' }}>
                                        <img 
                                            src={URL.createObjectURL(img)} 
                                            alt={`Preview ${i}`} 
                                            style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                                        />
                                        <button 
                                            type="button"
                                            onClick={(e) => { e.preventDefault(); setImages(images.filter((_, idx) => idx !== i)); }}
                                            style={{ 
                                                position: 'absolute', top: 4, right: 4, 
                                                background: 'rgba(239, 68, 68, 0.9)', color: 'white', 
                                                border: 'none', borderRadius: '50%', width: '22px', height: '22px', 
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', 
                                                cursor: 'pointer', fontSize: '14px', fontWeight: 700 
                                            }}
                                        >
                                            &times;
                                        </button>
                                    </div>
                                    <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-muted)' }}>
                                        {img.size > 1024 * 1024 ? `${(img.size / (1024 * 1024)).toFixed(2)} MB` : `${Math.round(img.size / 1024)} KB`}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}

                    {images.length < 3 && (
                        <label 
                            htmlFor="image" 
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '12px',
                                background: 'rgba(99, 102, 241, 0.1)',
                                color: 'var(--accent)',
                                border: '2px dashed var(--accent)',
                                padding: '20px',
                                borderRadius: '12px',
                                cursor: 'pointer',
                                fontWeight: 600,
                                fontSize: '1.05rem',
                                textAlign: 'center',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"></path>
                                <circle cx="12" cy="13" r="3"></circle>
                            </svg>
                            {images.length > 0 ? 'Add Another Photo' : 'Open Camera & Take Photo'}
                        </label>
                    )}
                    
                    <input 
                        type="file" 
                        id="image" 
                        accept="image/*" 
                        capture="environment"
                        onChange={async (e) => {
                            if (e.target.files && e.target.files.length > 0) {
                                const originalFile = e.target.files[0];
                                const processedFile = await compressImage(originalFile);
                                setImages(prev => [...prev, processedFile]);
                                e.target.value = ''; // reset file input safely
                            }
                        }}
                        style={{ display: 'none' }}
                    />
                </div>
                <button type="submit" className="submit-button" disabled={loading || !isCrcCorrect} style={{ opacity: isCrcCorrect ? 1 : 0.5, cursor: isCrcCorrect ? 'pointer' : 'not-allowed' }}>
                    <Save size={18} />
                    <span>{loading ? 'Saving...' : 'Save Rework'}</span>
                </button>
            </form>
        </div>
    );
}
