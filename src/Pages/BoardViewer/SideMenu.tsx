import { useState } from 'react';
import { Search, Layers } from 'lucide-react';
import { BoardSearch } from './SideMenu/search';
import { BoardLayers } from './SideMenu/layers';
import type { BoardData } from './parser';

interface SideMenuProps {
    boardData: BoardData | null;
    searchQuery: string;
    onSearchChange: (query: string) => void;
    elements: Array<{ name: string; value?: string; package?: string; layer?: 'top' | 'bottom' | string }>;
    onSelect: (type: 'element' | 'net', name: string) => void;
    selectedItem: { type: 'element' | 'net'; name: string } | null;
    visibleLayers: Set<number>;
    onToggleLayer: (layerNumber: number) => void;
    onToggleAll: (visible: boolean) => void;
}

export function SideMenu({
    boardData,
    searchQuery,
    onSearchChange,
    elements,
    onSelect,
    selectedItem,
    visibleLayers,
    onToggleLayer,
    onToggleAll
}: SideMenuProps) {
    const [activeTab, setActiveTab] = useState<'search' | 'layers'>('search');

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
            {/* Tabs Header */}
            <div
                style={{
                    display: 'flex',
                    borderBottom: '1px solid var(--border)',
                    paddingBottom: '8px',
                    marginBottom: '16px',
                    gap: '4px'
                }}
            >
                {/* Search Tab */}
                <button
                    onClick={() => setActiveTab('search')}
                    style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        padding: '10px 12px',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        color: activeTab === 'search' ? 'var(--text-h)' : 'var(--text-muted)',
                        position: 'relative',
                        transition: 'all 0.2s ease',
                        borderRadius: '6px'
                    }}
                    onMouseEnter={(e) => {
                        if (activeTab !== 'search') e.currentTarget.style.color = 'var(--text-h)';
                    }}
                    onMouseLeave={(e) => {
                        if (activeTab !== 'search') e.currentTarget.style.color = 'var(--text-muted)';
                    }}
                >
                    <Search size={15} color={activeTab === 'search' ? 'var(--accent)' : 'var(--text-muted)'} />
                    <span>Search</span>
                    {activeTab === 'search' && (
                        <div
                            style={{
                                position: 'absolute',
                                bottom: '-9px',
                                left: 0,
                                width: '100%',
                                height: '2px',
                                background: 'var(--accent)',
                                boxShadow: '0 0 8px var(--accent)',
                                borderRadius: '20px'
                            }}
                        />
                    )}
                </button>

                {/* Layers Tab */}
                <button
                    onClick={() => setActiveTab('layers')}
                    style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        padding: '10px 12px',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        fontWeight: 600,
                        color: activeTab === 'layers' ? 'var(--text-h)' : 'var(--text-muted)',
                        position: 'relative',
                        transition: 'all 0.2s ease',
                        borderRadius: '6px'
                    }}
                    onMouseEnter={(e) => {
                        if (activeTab !== 'layers') e.currentTarget.style.color = 'var(--text-h)';
                    }}
                    onMouseLeave={(e) => {
                        if (activeTab !== 'layers') e.currentTarget.style.color = 'var(--text-muted)';
                    }}
                >
                    <Layers size={15} color={activeTab === 'layers' ? 'var(--accent)' : 'var(--text-muted)'} />
                    <span>Layers</span>
                    {activeTab === 'layers' && (
                        <div
                            style={{
                                position: 'absolute',
                                bottom: '-9px',
                                left: 0,
                                width: '100%',
                                height: '2px',
                                background: 'var(--accent)',
                                boxShadow: '0 0 8px var(--accent)',
                                borderRadius: '20px'
                            }}
                        />
                    )}
                </button>
            </div>

            {/* Tab Content Panel */}
            <div style={{ flex: 1, minHeight: 0 }}>
                {activeTab === 'search' ? (
                    <BoardSearch
                        searchQuery={searchQuery}
                        onSearchChange={onSearchChange}
                        elements={elements}
                        onSelect={onSelect}
                        selectedItem={selectedItem}
                    />
                ) : (
                    <BoardLayers
                        boardData={boardData}
                        visibleLayers={visibleLayers}
                        onToggleLayer={onToggleLayer}
                        onToggleAll={onToggleAll}
                    />
                )}
            </div>
        </div>
    );
}
