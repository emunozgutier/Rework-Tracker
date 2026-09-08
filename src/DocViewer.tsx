import { useEffect } from 'react';
import { useProjectStore } from './store/clientDataBase/useProjectStore';
import { useUploadedDocsStore } from './store/clientDataBase/useUploadedDocsStore';
import { TopBar } from './Pages/BoardViewer/TopBar';
import { getDocumentUrl } from './store/useDemoStore';
import { Loader2 } from 'lucide-react';

interface DocViewerProps {
    docId: string | number;
    onBack: () => void;
}

export function DocViewer({ docId, onBack }: DocViewerProps) {
    const { projectDocs, fetchDocs, projects } = useProjectStore();
    const uploadedDocs = useUploadedDocsStore((state) => state.docs);
    
    const matchDoc = (d: any) =>
        d && (
            String(d.id) === String(docId) ||
            d.filename === String(docId) ||
            d.original_filename === String(docId) ||
            d.path === String(docId)
        );

    // 1. Check in useUploadedDocsStore
    let boardDoc: any = uploadedDocs.find(matchDoc);

    // 2. Check across all projectDocs
    if (!boardDoc) {
        for (const projId in projectDocs) {
            const found = projectDocs[projId]?.find(matchDoc);
            if (found) {
                boardDoc = found;
                break;
            }
        }
    }

    if (!boardDoc) {
        const legacyDocs = (window as any).__lastUploadedDocs || [];
        const foundUp = legacyDocs.find(matchDoc);
        if (foundUp) {
            boardDoc = foundUp;
        } else if (typeof docId === 'string' && (docId.includes('.') || docId.includes('/'))) {
            boardDoc = {
                id: docId,
                filename: docId.split('/').pop() || docId,
                path: docId.startsWith('/') ? docId : `/docs/${docId}`
            };
        }
    }

    // Proactively fetch documents for all projects if not loaded yet
    useEffect(() => {
        if (!boardDoc && projects.length > 0) {
            projects.forEach((proj) => {
                fetchDocs(proj.id);
            });
        }
    }, [boardDoc, projects, fetchDocs]);

    if (!boardDoc) {
        return (
            <div style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                height: '100vh', 
                background: '#0b0f19', 
                alignItems: 'center', 
                justifyContent: 'center', 
                color: '#9ca3af' 
            }}>
                <Loader2 className="animate-spin" size={32} />
                <p style={{ marginTop: '10px' }}>Loading document...</p>
            </div>
        );
    }

    const fullUrl = getDocumentUrl(boardDoc.path, boardDoc.filename);

    return (
        <div 
            style={{
                position: 'absolute',
                inset: 0,
                background: '#0b0f19', // Dark background matching theme
                display: 'flex',
                flexDirection: 'column',
                padding: '12px',
                boxSizing: 'border-box',
                gap: '12px',
                height: '100%',
                width: '100%',
                zIndex: 99
            }}
        >
            <TopBar
                filename={boardDoc.filename}
                onClose={onBack}
                showSearchToggle={false}
                fileType="pdf"
            />

            <div 
                style={{ 
                    flex: 1,
                    width: '100%', 
                    borderRadius: '12px',
                    overflow: 'hidden',
                    border: '1px solid var(--border)',
                    background: '#0f172a'
                }}
            >
                <iframe 
                    src={`${fullUrl}#toolbar=1`}
                    title={boardDoc.filename}
                    width="100%" 
                    height="100%" 
                    style={{ border: 'none' }}
                />
            </div>
        </div>
    );
}
