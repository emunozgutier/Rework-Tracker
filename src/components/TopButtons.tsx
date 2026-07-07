import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useStore } from '../store/useStore';
import './TopButtons.css';

interface TopButtonsProps {
    onAdd: () => void;
    // Search props (optional)
    searchQuery?: string;
    setSearchQuery?: (val: string) => void;
    searchPlaceholder?: string;
    // Filter props (optional)
    activeFilterCount?: number;
    onClearFilters?: () => void;
    showFilters?: boolean;
    setShowFilters?: (val: boolean) => void;
}

export function TopButtons({
    onAdd,
    searchQuery,
    setSearchQuery,
    searchPlaceholder = 'Search...',
    activeFilterCount = 0,
    onClearFilters,
    showFilters,
    setShowFilters
}: TopButtonsProps) {
    const { isMobile } = useStore();
    const [showMobileSearch, setShowMobileSearch] = useState(false);

    const hasSearch = !!setSearchQuery;
    const hasFilters = setShowFilters !== undefined;

    return (
        <>
            <div className="list-header">
                <div className="header-left">
                    {!isMobile && hasSearch && (
                        <div className="search-container-desktop">
                            <svg className="search-icon-desktop" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="11" cy="11" r="8"></circle>
                                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                            </svg>
                            <input 
                                type="text"
                                className="search-input-desktop"
                                placeholder={searchPlaceholder}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery?.(e.target.value)}
                            />
                        </div>
                    )}
                </div>
                <div className="header-right">
                    {!isMobile && activeFilterCount > 0 && onClearFilters && (
                        <button 
                            className="secondary-button" 
                            onClick={onClearFilters}
                            style={{ color: 'var(--text-muted)' }}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                            <span>Clear All ({activeFilterCount})</span>
                        </button>
                    )}
                    {hasFilters && (
                        <button 
                            className={`secondary-button ${activeFilterCount > 0 ? 'active' : ''}`}
                            onClick={() => setShowFilters?.(!showFilters)}
                            style={{ width: '145px' }}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
                            </svg>
                            <span>{showFilters ? 'Hide Filters' : 'Show Filters'}</span>
                        </button>
                    )}
                    {isMobile && hasSearch && (
                        <button 
                            className={`secondary-button ${showMobileSearch ? 'active' : ''}`}
                            onClick={() => setShowMobileSearch(!showMobileSearch)}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="11" cy="11" r="8"></circle>
                                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                            </svg>
                            <span>Search</span>
                        </button>
                    )}
                    <button className="add-button" onClick={onAdd}>
                        <Plus size={18} />
                        <span>Add New</span>
                    </button>
                </div>
            </div>

            {isMobile && activeFilterCount > 0 && onClearFilters && (
                <div className="mobile-clear-filters-row">
                    <button 
                        className="mobile-clear-filters-btn" 
                        onClick={onClearFilters}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                        <span>Clear All Active Filters ({activeFilterCount})</span>
                    </button>
                </div>
            )}

            {isMobile && hasSearch && showMobileSearch && (
                <div className="mobile-search-row">
                    <svg className="mobile-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8"></circle>
                        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                    </svg>
                    <input 
                        type="text"
                        className="mobile-search-input"
                        placeholder={searchPlaceholder}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery?.(e.target.value)}
                        autoFocus
                    />
                </div>
            )}
        </>
    );
}
