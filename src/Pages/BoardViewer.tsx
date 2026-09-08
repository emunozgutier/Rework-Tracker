import { useEffect, useState, useMemo, useRef } from 'react';
import { AlertCircle } from 'lucide-react';
import { useProjectStore } from '../store/clientDataBase/useProjectStore';
import { useUploadedDocsStore } from '../store/clientDataBase/useUploadedDocsStore';
import { BoardCanvas } from './BoardViewer/canvas';
import { parseEagleXML, parseBinaryFallback, parseAllegro } from './BoardViewer/parser';
import type { BoardData } from './BoardViewer/parser';
import { SideMenu } from './BoardViewer/SideMenu';
import { getLayerList } from './BoardViewer/SideMenu/layers';
import { useBoardViewer } from '../store/useBoardViewer';
import { useAppState } from '../store/useAppState';
import { TopBar } from './BoardViewer/TopBar';
import { getDocumentUrl } from '../store/useDemoStore';
import { BrdLoadingOverlay } from './BoardViewer/BrdLoadingOverlay';
import type { LoadStep } from './BoardViewer/BrdLoadingOverlay';

interface BoardViewerProps {
    docId: string | number;
    onBack: () => void;
}

// ── Loading step definitions ──────────────────────────────────────────────────
const LOAD_STEPS: LoadStep[] = [
    { id: 'projects',  label: 'Loading projects'          },
    { id: 'docs',      label: 'Loading project documents'  },
    { id: 'resolve',   label: 'Resolving board file'       },
    { id: 'download',  label: 'Downloading board file'     },
    { id: 'detect',    label: 'Detecting file format'      },
    { id: 'parse',     label: 'Parsing board layout'       },
    { id: 'adapt',     label: 'Building component data'    },
    { id: 'layers',    label: 'Initializing layers'        },
];

export function BoardViewer({ docId, onBack }: BoardViewerProps) {
    const { isMobile } = useAppState();
    const [error, setError] = useState<string | null>(null);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    // ── Step-driven loading state ─────────────────────────────────────────────
    const [currentStep, setCurrentStep] = useState<number>(0);
    const isLoading = currentStep < LOAD_STEPS.length;
    const hasStarted = useRef(false);

    const [boardDoc, setBoardDoc] = useState<any>(null);
    const [boardData, setBoardData] = useState<BoardData | null>(null);

    const {
        visibleLayers,
        searchQuery,
        selectedItem,
        setSearchQuery,
        setSelectedItem,
        toggleLayer,
        setVisibleLayers,
    } = useBoardViewer();

    // ── Single sequential loader — runs exactly once ──────────────────────────
    useEffect(() => {
        if (hasStarted.current) return;
        hasStarted.current = true;

        const doLoad = async () => {
            try {
                const matchDoc = (d: any) =>
                    d && (
                        String(d.id) === String(docId) ||
                        d.filename === String(docId) ||
                        d.original_filename === String(docId) ||
                        d.path === String(docId)
                    );

                // ── Fast path: doc already in store (opened from a card) ──────
                setCurrentStep(2); // show "Resolving" immediately
                const existing = useProjectStore.getState().projectDocs;
                let found: any = null;
                for (const pid in existing) {
                    const doc = existing[pid].find(matchDoc);
                    if (doc) { found = doc; break; }
                }

                if (!found) {
                    const upDocs = useUploadedDocsStore.getState().docs;
                    found = upDocs.find(matchDoc);
                }

                if (!found) {
                    // ── Slow path: need to fetch metadata first ───────────────
                    // Step 0 — load projects
                    setCurrentStep(0);
                    const { fetchProjects, fetchDocs } = useProjectStore.getState();
                    let { projects } = useProjectStore.getState();
                    if (projects.length === 0) {
                        await fetchProjects();
                        projects = useProjectStore.getState().projects;
                    }

                    // Step 1 — load docs for every project
                    setCurrentStep(1);
                    await Promise.all(projects.map(p => fetchDocs(p.id)));

                    // Step 2 — resolve
                    setCurrentStep(2);
                    await new Promise(r => setTimeout(r, 30));
                    const { projectDocs } = useProjectStore.getState();
                    for (const pid in projectDocs) {
                        const doc = projectDocs[pid].find(matchDoc);
                        if (doc) { found = doc; break; }
                    }

                    if (!found) {
                        const upDocs = useUploadedDocsStore.getState().docs;
                        found = upDocs.find(matchDoc);
                    }

                    if (!found && typeof docId === 'string' && (docId.toLowerCase().endsWith('.brd') || docId.includes('/'))) {
                        found = {
                            id: docId,
                            filename: docId.split('/').pop() || docId,
                            path: docId.startsWith('/') ? docId : `/docs/${docId}`
                        };
                    }
                }

                if (!found) {
                    setError('Board document not found. It may have been removed.');
                    setCurrentStep(LOAD_STEPS.length);
                    return;
                }
                setBoardDoc(found);

                // Step 3 — download
                setCurrentStep(3);
                const fullUrl = getDocumentUrl(found.path, found.filename);
                const res = await fetch(fullUrl);
                if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to retrieve board file`);
                const buffer = await res.arrayBuffer();

                // Step 4 — detect format
                setCurrentStep(4);
                await new Promise(r => setTimeout(r, 0));
                const uint8 = new Uint8Array(buffer.slice(0, 100));
                let headerText = '';
                for (let i = 0; i < uint8.length; i++) headerText += String.fromCharCode(uint8[i]);
                const isXml = headerText.trim().startsWith('<?xml') || headerText.trim().startsWith('<eagle');

                const content: string | ArrayBuffer = isXml
                    ? new TextDecoder().decode(buffer)
                    : buffer;
                const fmt: 'eagle' | 'allegro' = isXml ? 'eagle' : 'allegro';

                // Step 5 — parse (CPU heavy — yield first so UI can paint the step)
                setCurrentStep(5);
                await new Promise(r => setTimeout(r, 20));

                let parsed: BoardData;
                try {
                    if (fmt === 'eagle') {
                        const parser = new DOMParser();
                        const xmlDoc = parser.parseFromString(content as string, 'text/xml');
                        const parseError = xmlDoc.querySelector('parsererror');
                        if (parseError) throw new Error(parseError.textContent || 'XML parse failed');
                        parsed = parseEagleXML(xmlDoc);
                    } else {
                        parsed = parseAllegro(content as ArrayBuffer);
                    }
                } catch (e: any) {
                    console.warn('Primary parse failed, using fallback:', e);
                    const text = typeof content === 'string'
                        ? content
                        : new TextDecoder().decode(content);
                    parsed = parseBinaryFallback(text);
                }

                // Step 6 — store adapted board data
                setCurrentStep(6);
                await new Promise(r => setTimeout(r, 0));
                setBoardData(parsed);

                // Step 7 — initialise layers
                setCurrentStep(7);
                await new Promise(r => setTimeout(r, 0));
                const allLayers = getLayerList(parsed).map(l => l.number);
                setVisibleLayers(new Set(allLayers));

                // Done
                setCurrentStep(LOAD_STEPS.length);

            } catch (err: any) {
                console.error('BoardViewer load error:', err);
                setError(err.message || 'Failed to load board file.');
                setCurrentStep(LOAD_STEPS.length);
            }
        };

        doLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // intentionally empty — runs exactly once on mount

    // ── Handlers ──────────────────────────────────────────────────────────────
    const [selectionSource, setSelectionSource] = useState<'search' | 'click' | null>(null);

    const handleToggleAll = (visible: boolean) => {
        if (visible) {
            const allLayers = getLayerList(boardData).map(l => l.number);
            setVisibleLayers(new Set(allLayers));
        } else {
            setVisibleLayers(new Set());
        }
    };

    const elementsList = useMemo(() => {
        if (!boardData) return [];
        return boardData.elements.map(e => ({ name: e.name, value: e.value, package: e.package }));
    }, [boardData]);

    const handleSelectSearchItem = (type: 'element' | 'net', name: string) => {
        setSelectionSource('search');
        setSelectedItem(
            (selectedItem?.type === type && selectedItem?.name === name) ? null : { type, name }
        );
    };

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="board-viewer-container">
            <TopBar
                filename={boardDoc?.filename}
                onClose={onBack}
                isSidebarOpen={isSidebarOpen}
                onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
            />

            {isLoading ? (
                <BrdLoadingOverlay
                    steps={LOAD_STEPS}
                    currentStep={currentStep}
                    filename={boardDoc?.filename}
                />
            ) : error ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <AlertCircle size={48} color="#ef4444" style={{ marginBottom: '12px' }} />
                    <h3 style={{ margin: '0 0 8px 0', color: 'var(--text-h)' }}>Loading Failed</h3>
                    <p style={{ margin: 0, fontSize: '0.9rem', maxWidth: '400px' }}>{error}</p>
                    <button
                        onClick={onBack}
                        style={{ marginTop: '16px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: '6px', padding: '8px 16px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}
                    >
                        Go Back
                    </button>
                </div>
            ) : (
                <div className="board-viewer-body">
                    {isMobile && isSidebarOpen && (
                        <div
                            onClick={() => setIsSidebarOpen(false)}
                            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)', zIndex: 9, borderRadius: '12px' }}
                        />
                    )}

                    <div className={`board-viewer-sidebar-wrapper ${isSidebarOpen ? 'open' : ''}`}>
                        <SideMenu
                            boardData={boardData}
                            searchQuery={searchQuery}
                            onSearchChange={setSearchQuery}
                            elements={elementsList}
                            onSelect={(type, name) => {
                                handleSelectSearchItem(type, name);
                                if (isMobile) setIsSidebarOpen(false);
                            }}
                            selectedItem={selectedItem}
                            visibleLayers={visibleLayers}
                            onToggleLayer={toggleLayer}
                            onToggleAll={handleToggleAll}
                        />
                    </div>

                    <div className="board-viewer-canvas-container">
                        <BoardCanvas
                            boardData={boardData}
                            onSelectElement={(name) => {
                                setSelectionSource('click');
                                setSelectedItem({ type: 'element', name });
                            }}
                            selectionSource={selectionSource}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
