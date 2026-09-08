import { useEffect, useState, useMemo } from 'react';
import { Popup } from '../../components/Popup';
import { useUploadedDocsStore, type UploadedDoc } from '../../store/clientDataBase/useUploadedDocsStore';
import { useProjectStore } from '../../store/clientDataBase/useProjectStore';
import { useAppState } from '../../store/useAppState';
import { usePermissionsStore } from '../../store/clientDataBase/usePermissionsStore';
import { getDocumentUrl } from '../../store/useDemoStore';
import { API_BASE } from '../../store/serverDataBase/apiBridge';
import { PictureCard } from '../ViewPages/Cards/PictureCard';
import { 
    FileText, 
    Eye, 
    Download, 
    Loader2, 
    Upload, 
    Trash2, 
    Image as ImageIcon, 
    Layers, 
    Cpu, 
    Table, 
    Search,
    BookOpen
} from 'lucide-react';

interface UploadedDocsModalProps {
    isOpen: boolean;
    onClose: () => void;
    project?: {
        id: number;
        name: string;
        project_key?: string;
    } | null;
    pcb?: {
        id: number;
        board_number: string;
    } | null;
    initialCategory?: string;
}

export function UploadedDocsModal({ isOpen, onClose, project, pcb, initialCategory = 'all' }: UploadedDocsModalProps) {
    const { docs, loading, fetchDocs, deleteDoc } = useUploadedDocsStore();
    const { uploadDocs } = useProjectStore();
    const { currentUserRole, editItem } = useAppState();
    const permissions = usePermissionsStore(state => state.permissions);
    const roleKey = currentUserRole === 'Super User' ? 'superUser' : currentUserRole === 'User' ? 'user' : 'guest';
    
    const canAddDocs = !!permissions[`Docs__Add__${roleKey}`];
    const canDeleteDocs = !!permissions[`Docs__Delete__${roleKey}`];

    const [activeTab, setActiveTab] = useState<string>(initialCategory);
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [uploading, setUploading] = useState(false);
    const [lightboxImage, setLightboxImage] = useState<{ url: string; title: string } | null>(null);

    useEffect(() => {
        if (isOpen) {
            fetchDocs({
                project_id: project?.id,
                pcb_id: pcb?.id
            });
        }
    }, [isOpen, project?.id, pcb?.id, fetchDocs]);

    const deduplicatedDocs = useMemo(() => {
        const seen = new Set<string>();
        const result: UploadedDoc[] = [];
        for (const doc of docs) {
            const key = `${doc.project_id || ''}-${doc.pcb_id || ''}-${doc.original_filename || doc.filename}`;
            if (!seen.has(key)) {
                seen.add(key);
                result.push(doc);
            } else if (doc.path && !doc.path.endsWith(`/${doc.filename}`)) {
                const idx = result.findIndex(r => `${r.project_id || ''}-${r.pcb_id || ''}-${r.original_filename || r.filename}` === key);
                if (idx !== -1) {
                    result[idx] = doc;
                }
            }
        }
        return result;
    }, [docs]);

    const filteredDocs = useMemo(() => {
        return deduplicatedDocs.filter(doc => {
            const matchesCategory = 
                activeTab === 'all' ? true :
                activeTab === 'picture' ? doc.doc_type === 'picture' :
                activeTab === 'schematic' ? doc.doc_type === 'schematic' :
                activeTab === 'board_file' ? doc.doc_type === 'board_file' :
                activeTab === 'bom_csv' ? doc.doc_type === 'bom_csv' :
                activeTab === 'datasheet' ? doc.doc_type === 'datasheet' : true;

            const searchLower = searchTerm.toLowerCase();
            const matchesSearch = !searchTerm.trim() || 
                (doc.filename && doc.filename.toLowerCase().includes(searchLower)) ||
                (doc.original_filename && doc.original_filename.toLowerCase().includes(searchLower)) ||
                (doc.pcb_board_number && doc.pcb_board_number.toLowerCase().includes(searchLower)) ||
                (doc.rework_title && doc.rework_title.toLowerCase().includes(searchLower)) ||
                (doc.project_name && doc.project_name.toLowerCase().includes(searchLower));

            return matchesCategory && matchesSearch;
        });
    }, [deduplicatedDocs, activeTab, searchTerm]);

    const counts = useMemo(() => {
        const c: Record<string, number> = {
            all: deduplicatedDocs.length,
            picture: 0,
            schematic: 0,
            board_file: 0,
            bom_csv: 0,
            datasheet: 0
        };
        deduplicatedDocs.forEach(d => {
            if (c[d.doc_type] !== undefined) c[d.doc_type]++;
        });
        return c;
    }, [deduplicatedDocs]);

    if (!isOpen) return null;

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0 && project?.id) {
            setUploading(true);
            const filesArray = Array.from(e.target.files);
            const success = await uploadDocs(project.id, filesArray);
            setUploading(false);
            if (!success) {
                alert("Failed to upload document files.");
            } else {
                fetchDocs({ project_id: project.id });
            }
        }
    };

    const handleDelete = async (doc: UploadedDoc) => {
        if (confirm(`Are you sure you want to delete "${doc.filename}"?`)) {
            const success = await deleteDoc(doc.id);
            if (!success) {
                alert("Failed to delete document.");
            }
        }
    };

    const handleView = (doc: UploadedDoc) => {
        if (doc.doc_type === 'picture') {
            const imgUrl = doc.path.startsWith('/api') 
                ? `${API_BASE.replace('/api', '')}${doc.path}`
                : `${API_BASE.replace('/api', '')}/api${doc.path}`;
            const title = doc.pcb_board_number 
                ? `${doc.pcb_board_number}${doc.rework_number ? `-R${String(doc.rework_number).padStart(3, '0')}` : ''}`
                : doc.filename;
            setLightboxImage({ url: imgUrl, title });
        } else if (doc.doc_type === 'board_file' || doc.filename.toLowerCase().endsWith('.brd')) {
            editItem('board_viewer', doc.path || doc.filename);
            onClose();
        } else {
            editItem('doc_viewer', doc.path || doc.filename);
            onClose();
        }
    };

    const getDocIcon = (docType: string) => {
        switch (docType) {
            case 'picture':
                return <ImageIcon size={20} color="#a855f7" />;
            case 'board_file':
                return <Cpu size={20} color="#06b6d4" />;
            case 'bom_csv':
                return <Table size={20} color="#10b981" />;
            case 'datasheet':
                return <BookOpen size={20} color="#f59e0b" />;
            case 'schematic':
            default:
                return <FileText size={20} color="#6366f1" />;
        }
    };

    const getDocBadgeColor = (docType: string) => {
        switch (docType) {
            case 'picture': return { bg: 'rgba(168, 85, 247, 0.12)', border: 'rgba(168, 85, 247, 0.3)', text: '#c084fc' };
            case 'board_file': return { bg: 'rgba(6, 182, 212, 0.12)', border: 'rgba(6, 182, 212, 0.3)', text: '#22d3ee' };
            case 'bom_csv': return { bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.3)', text: '#34d399' };
            case 'datasheet': return { bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.3)', text: '#fbbf24' };
            case 'schematic':
            default:
                return { bg: 'rgba(99, 102, 241, 0.12)', border: 'rgba(99, 102, 241, 0.3)', text: '#818cf8' };
        }
    };

    const titleText = project ? `${project.name} Documents` : pcb ? `Board ${pcb.board_number} Documents` : "Uploaded Documents Registry";

    const titleElement = (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Layers size={22} color="var(--accent)" />
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: 'var(--text)' }}>
                {titleText}
            </h2>
        </div>
    );

    return (
        <>
            <Popup isOpen={isOpen} onClose={onClose} title={titleElement} maxWidth="720px">
                <div style={{ minHeight: '380px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    
                    {/* Filter Tabs */}
                    <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '4px', borderBottom: '1px solid var(--border)' }}>
                        {[
                            { key: 'all', label: 'All', count: counts.all },
                            { key: 'picture', label: 'Pictures', count: counts.picture },
                            { key: 'schematic', label: 'Schematics', count: counts.schematic },
                            { key: 'board_file', label: 'Board Files', count: counts.board_file },
                            { key: 'bom_csv', label: 'BOMs', count: counts.bom_csv },
                            { key: 'datasheet', label: 'Datasheets', count: counts.datasheet },
                        ].map(tab => {
                            const active = activeTab === tab.key;
                            return (
                                <button
                                    key={tab.key}
                                    onClick={() => setActiveTab(tab.key)}
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                        padding: '6px 12px',
                                        borderRadius: '20px',
                                        fontSize: '0.82rem',
                                        fontWeight: active ? 700 : 500,
                                        border: active ? '1px solid var(--accent)' : '1px solid var(--border)',
                                        background: active ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                                        color: active ? 'var(--accent)' : 'var(--text-muted)',
                                        cursor: 'pointer',
                                        whiteSpace: 'nowrap',
                                        transition: 'all 0.15s ease'
                                    }}
                                >
                                    <span>{tab.label}</span>
                                    <span style={{
                                        fontSize: '0.72rem',
                                        padding: '1px 6px',
                                        borderRadius: '10px',
                                        background: active ? 'var(--accent)' : 'rgba(255, 255, 255, 0.06)',
                                        color: active ? '#fff' : 'var(--text-muted)'
                                    }}>
                                        {tab.count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Search bar */}
                    <div style={{ position: 'relative', width: '100%' }}>
                        <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                        <input
                            type="text"
                            placeholder="Filter documents by name, board, rework..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{
                                width: '100%',
                                boxSizing: 'border-box',
                                padding: '8px 12px 8px 36px',
                                background: 'rgba(255, 255, 255, 0.03)',
                                border: '1px solid var(--border)',
                                borderRadius: '8px',
                                color: 'var(--text)',
                                fontSize: '0.85rem'
                            }}
                        />
                    </div>

                    {/* List Content */}
                    {loading ? (
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: 'var(--text-muted)', padding: '40px 0' }}>
                            <Loader2 className="animate-spin" size={24} />
                            <span>Loading documents...</span>
                        </div>
                    ) : filteredDocs.length === 0 ? (
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '36px 0', color: 'var(--text-muted)' }}>
                            <FileText size={40} strokeWidth={1.5} style={{ marginBottom: '8px', opacity: 0.4 }} />
                            <p style={{ margin: 0, fontSize: '0.95rem' }}>
                                {searchTerm ? `No documents matching "${searchTerm}"` : `No ${activeTab === 'all' ? '' : activeTab} documents found.`}
                            </p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '340px', overflowY: 'auto', paddingRight: '4px' }}>
                            {filteredDocs.map((item) => {
                                const badgeStyle = getDocBadgeColor(item.doc_type);
                                const isPicture = item.doc_type === 'picture';
                                const fullUrl = isPicture 
                                    ? (item.path.startsWith('/api') ? `${API_BASE.replace('/api', '')}${item.path}` : `${API_BASE.replace('/api', '')}/api${item.path}`)
                                    : getDocumentUrl(item.path, item.filename);

                                return (
                                    <div
                                        key={item.id}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: '10px 14px',
                                            background: 'rgba(255, 255, 255, 0.02)',
                                            border: '1px solid var(--border)',
                                            borderRadius: '8px',
                                            gap: '12px',
                                            transition: 'background 0.2s ease'
                                        }}
                                        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)'; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)'; }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
                                            {/* Thumbnail / Icon */}
                                            {isPicture ? (
                                                <div 
                                                    onClick={() => handleView(item)}
                                                    style={{
                                                        width: '44px',
                                                        height: '44px',
                                                        borderRadius: '6px',
                                                        overflow: 'hidden',
                                                        cursor: 'pointer',
                                                        border: '1px solid var(--border)',
                                                        flexShrink: 0,
                                                        background: '#000'
                                                    }}
                                                    title="Click to view photo"
                                                >
                                                    <img 
                                                        src={fullUrl} 
                                                        alt={item.filename}
                                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                        onError={(e) => {
                                                            e.currentTarget.style.display = 'none';
                                                            e.currentTarget.parentElement!.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a855f7" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/></svg></div>';
                                                        }}
                                                    />
                                                </div>
                                            ) : (
                                                <div style={{
                                                    width: '40px',
                                                    height: '40px',
                                                    borderRadius: '8px',
                                                    background: badgeStyle.bg,
                                                    border: `1px solid ${badgeStyle.border}`,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    flexShrink: 0
                                                }}>
                                                    {getDocIcon(item.doc_type)}
                                                </div>
                                            )}

                                            {/* Details */}
                                            <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                                    <span 
                                                        style={{ 
                                                            fontSize: '0.92rem', 
                                                            fontWeight: 600, 
                                                            color: 'var(--text)', 
                                                            whiteSpace: 'nowrap', 
                                                            overflow: 'hidden', 
                                                            textOverflow: 'ellipsis' 
                                                        }}
                                                        title={item.filename}
                                                    >
                                                        {item.original_filename || item.filename}
                                                    </span>
                                                    <span style={{
                                                        fontSize: '0.68rem',
                                                        fontWeight: 700,
                                                        textTransform: 'uppercase',
                                                        padding: '2px 6px',
                                                        borderRadius: '4px',
                                                        background: badgeStyle.bg,
                                                        color: badgeStyle.text,
                                                        border: `1px solid ${badgeStyle.border}`
                                                    }}>
                                                        {item.doc_type.replace('_', ' ')}
                                                    </span>
                                                </div>

                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                    {item.pcb_board_number && (
                                                        <span style={{ color: 'var(--accent)' }}>
                                                            {item.pcb_board_number}{item.rework_number ? `-R${String(item.rework_number).padStart(3, '0')}` : ''}
                                                        </span>
                                                    )}
                                                    {item.project_name && !project && (
                                                        <span>• {item.project_name}</span>
                                                    )}
                                                    <span>• {new Date(item.uploaded_at).toLocaleDateString()}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                                            <button
                                                onClick={() => handleView(item)}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '5px',
                                                    padding: '6px 10px',
                                                    background: 'rgba(99, 102, 241, 0.1)',
                                                    border: '1px solid rgba(99, 102, 241, 0.3)',
                                                    borderRadius: '6px',
                                                    color: 'var(--accent)',
                                                    cursor: 'pointer',
                                                    fontSize: '0.82rem',
                                                    fontWeight: 600
                                                }}
                                                title="View Document"
                                            >
                                                <Eye size={13} />
                                                <span>View</span>
                                            </button>

                                            <a
                                                href={fullUrl}
                                                download={item.filename}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    width: '30px',
                                                    height: '30px',
                                                    background: 'rgba(255, 255, 255, 0.04)',
                                                    border: '1px solid var(--border)',
                                                    borderRadius: '6px',
                                                    color: 'var(--text-muted)',
                                                    cursor: 'pointer'
                                                }}
                                                title="Download File"
                                            >
                                                <Download size={13} />
                                            </a>

                                            {canDeleteDocs && (
                                                <button
                                                    onClick={() => handleDelete(item)}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        width: '30px',
                                                        height: '30px',
                                                        background: 'rgba(239, 68, 68, 0.1)',
                                                        border: '1px solid rgba(239, 68, 68, 0.3)',
                                                        borderRadius: '6px',
                                                        color: '#ef4444',
                                                        cursor: 'pointer'
                                                    }}
                                                    title="Delete Document"
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Upload button footer if attached to project */}
                    {canAddDocs && project && (
                        <div style={{ marginTop: 'auto', paddingTop: '12px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end' }}>
                            <input 
                                type="file" 
                                multiple 
                                accept=".pdf,.brd,.csv,.png,.jpg,.jpeg" 
                                onChange={handleFileChange}
                                style={{ display: 'none' }}
                                id="uploaded-docs-file-input"
                                disabled={uploading}
                            />
                            <label
                                htmlFor="uploaded-docs-file-input"
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '8px 16px',
                                    background: 'var(--accent)',
                                    color: '#fff',
                                    borderRadius: '6px',
                                    cursor: uploading ? 'not-allowed' : 'pointer',
                                    fontSize: '0.85rem',
                                    fontWeight: 600,
                                    opacity: uploading ? 0.7 : 1
                                }}
                            >
                                {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                                <span>{uploading ? 'Uploading...' : 'Upload Project Documents'}</span>
                            </label>
                        </div>
                    )}
                </div>
            </Popup>

            {/* Lightbox for pictures */}
            {lightboxImage && (
                <PictureCard
                    images={[lightboxImage.url]}
                    title={lightboxImage.title}
                    onClose={() => setLightboxImage(null)}
                />
            )}
        </>
    );
}
