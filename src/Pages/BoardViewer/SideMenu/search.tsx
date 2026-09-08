import { useState } from 'react';
import { Search, X, Cpu, ChevronDown, ChevronRight } from 'lucide-react';

interface SearchProps {
    searchQuery: string;
    onSearchChange: (query: string) => void;
    elements: Array<{ name: string; value?: string; package?: string; layer?: 'top' | 'bottom' | string }>;
    onSelect: (type: 'element' | 'net', name: string) => void;
    selectedItem: { type: 'element' | 'net'; name: string } | null;
}

export function BoardSearch({
    searchQuery,
    onSearchChange,
    elements,
    onSelect,
    selectedItem
}: SearchProps) {
    const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
    const cleanQuery = searchQuery.trim().toLowerCase();

    // Sort components naturally (alphabetical and numerical order: C1, C2, C10)
    const sortedElements = [...elements].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
    );

    // Filter components based on query
    const filteredElements = cleanQuery
        ? sortedElements.filter(
              (el) =>
                  el.name.toLowerCase().includes(cleanQuery) ||
                  (el.value && el.value.toLowerCase().includes(cleanQuery)) ||
                  (el.package && el.package.toLowerCase().includes(cleanQuery)) ||
                  (el.layer && el.layer.toLowerCase().includes(cleanQuery)) ||
                  `${el.name.toLowerCase()} (${el.layer || ''})`.includes(cleanQuery)
          )
        : sortedElements;

    const hasResults = filteredElements.length > 0;

    // Group elements by component prefix letter (e.g. C, R, U, TP)
    const groups: Record<string, typeof elements> = {};
    filteredElements.forEach((el) => {
        const prefix = el.name.match(/^[a-zA-Z]+/)?.[0]?.toUpperCase() || 'OTHER';
        if (!groups[prefix]) {
            groups[prefix] = [];
        }
        groups[prefix].push(el);
    });

    // Sorted prefixes list
    const sortedPrefixes = Object.keys(groups).sort();

    const toggleGroup = (prefix: string) => {
        setCollapsedGroups((prev) => ({
            ...prev,
            [prefix]: !prev[prefix]
        }));
    };

    const expandAll = () => {
        setCollapsedGroups({});
    };

    const collapseAll = () => {
        const allCollapsed: Record<string, boolean> = {};
        sortedPrefixes.forEach((prefix) => {
            allCollapsed[prefix] = true;
        });
        setCollapsedGroups(allCollapsed);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '12px' }}>
            {/* Search Input Box */}
            <div style={{ position: 'relative' }}>
                <input
                    type="text"
                    placeholder="Search component..."
                    value={searchQuery}
                    onChange={(e) => onSearchChange(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            if (filteredElements.length > 0) {
                                onSelect('element', filteredElements[0].name);
                            }
                        }
                    }}
                    style={{
                        width: '100%',
                        padding: '10px 36px 10px 32px',
                        background: 'rgba(255, 255, 255, 0.03)',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        color: 'var(--text-h)',
                        fontSize: '0.85rem',
                        outline: 'none',
                        transition: 'border-color 0.2s, box-shadow 0.2s',
                        boxSizing: 'border-box'
                    }}
                    onFocus={(e) => {
                        e.target.style.borderColor = 'var(--accent)';
                        e.target.style.boxShadow = '0 0 0 2px var(--accent-bg)';
                    }}
                    onBlur={(e) => {
                        e.target.style.borderColor = 'var(--border)';
                        e.target.style.boxShadow = 'none';
                    }}
                />
                <Search
                    size={16}
                    color="var(--text-muted)"
                    style={{
                        position: 'absolute',
                        left: '10px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        pointerEvents: 'none'
                    }}
                />
                {searchQuery && (
                    <button
                        onClick={() => onSearchChange('')}
                        style={{
                            position: 'absolute',
                            right: '10px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            padding: '2px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        <X size={14} />
                    </button>
                )}
            </div>

            {/* Expand / Collapse All Utilities */}
            {hasResults && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', padding: '0 4px', alignItems: 'center' }}>
                    <button
                        onClick={expandAll}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--accent)',
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            padding: '2px 4px',
                            transition: 'opacity 0.2s'
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.8')}
                        onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                    >
                        Expand All
                    </button>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>|</span>
                    <button
                        onClick={collapseAll}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-muted)',
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            padding: '2px 4px',
                            transition: 'opacity 0.2s'
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.8')}
                        onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                    >
                        Collapse All
                    </button>
                </div>
            )}

            {/* Scrollable List Container */}
            <div
                className="search-scroll"
                style={{
                    flex: 1,
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    paddingRight: '4px'
                }}
            >
                {/* Heading */}
                <div>
                    <h4
                        style={{
                            margin: '0 0 8px 0',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            color: 'var(--accent)'
                        }}
                    >
                        Components {cleanQuery ? `(${filteredElements.length} of ${elements.length})` : `(${elements.length})`}
                    </h4>

                    {/* Grouped Accordions */}
                    {hasResults ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {sortedPrefixes.map((prefix) => {
                                const isCollapsed = collapsedGroups[prefix] === true;
                                return (
                                    <div key={prefix} style={{ display: 'flex', flexDirection: 'column' }}>
                                        {/* Accordion Group Header */}
                                        <div
                                            onClick={() => toggleGroup(prefix)}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'space-between',
                                                padding: '8px 12px',
                                                background: 'rgba(255, 255, 255, 0.02)',
                                                border: '1px solid var(--border)',
                                                borderRadius: '6px',
                                                cursor: 'pointer',
                                                userSelect: 'none',
                                                transition: 'all 0.2s ease',
                                                marginBottom: '4px'
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                                                e.currentTarget.style.borderColor = 'var(--accent)';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                                                e.currentTarget.style.borderColor = 'var(--border)';
                                            }}
                                        >
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                {isCollapsed ? (
                                                    <ChevronRight size={14} color="var(--text-muted)" />
                                                ) : (
                                                    <ChevronDown size={14} color="var(--accent)" />
                                                )}
                                                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-h)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                                    {prefix} Components
                                                </span>
                                            </div>
                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: 'rgba(255, 255, 255, 0.04)', padding: '2px 6px', borderRadius: '10px' }}>
                                                {groups[prefix].length}
                                            </span>
                                        </div>

                                        {/* Accordion Group Body / Components List */}
                                        {!isCollapsed && (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', paddingLeft: '8px', marginBottom: '4px' }}>
                                                {groups[prefix].map((el) => {
                                                    const isSelected =
                                                        selectedItem?.type === 'element' && selectedItem?.name === el.name;
                                                    return (
                                                        <div
                                                            key={el.name}
                                                            onClick={() => onSelect('element', el.name)}
                                                            style={{
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'space-between',
                                                                padding: '6px 10px',
                                                                borderRadius: '6px',
                                                                cursor: 'pointer',
                                                                background: isSelected
                                                                    ? 'var(--accent-bg)'
                                                                    : 'transparent',
                                                                border: isSelected
                                                                    ? '1px solid var(--accent)'
                                                                    : '1px solid transparent',
                                                                transition: 'all 0.15s ease'
                                                            }}
                                                            onMouseEnter={(e) => {
                                                                if (!isSelected) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                                                            }}
                                                            onMouseLeave={(e) => {
                                                                if (!isSelected) e.currentTarget.style.background = 'transparent';
                                                            }}
                                                        >
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                                                                <Cpu size={12} color={isSelected ? 'var(--accent)' : 'var(--text-muted)'} style={{ flexShrink: 0 }} />
                                                                <span style={{ fontSize: '0.8rem', fontWeight: isSelected ? 600 : 500, color: 'var(--text-h)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                    {el.name}{' '}
                                                                    <span style={{
                                                                        fontSize: '0.72rem',
                                                                        fontWeight: 500,
                                                                        color: el.layer === 'bottom' ? '#60a5fa' : '#f87171',
                                                                        marginLeft: '2px'
                                                                    }}>
                                                                        ({el.layer || 'top'})
                                                                    </span>
                                                                </span>
                                                            </div>
                                                            {el.value && (
                                                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', maxWidth: '120px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                                    {el.value}
                                                                </span>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            No matching components.
                        </p>
                    )}
                </div>

                {!hasResults && cleanQuery && (
                    <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                        No results found for "{searchQuery}"
                    </div>
                )}
            </div>
        </div>
    );
}
