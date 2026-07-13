import { Plus } from 'lucide-react';
import { useStore } from '../store/useStore';
import { usePcbStore } from '../store/usePcbStore';
import './TopButtons.css';

export function TopButtons() {
    const {
        activeTab,
        addItem,
        isMobile,
        searchQuery,
        setSearchQuery,
        showFilters,
        setShowFilters,
        showMobileSearch,
        setShowMobileSearch
    } = useStore();

    // PCBs and Tags (tags) have search and filters
    const hasSearch = activeTab === 'pcbs' || activeTab === 'tags';
    const searchPlaceholder = activeTab === 'pcbs' ? 'Search PCBs...' : 'Search tags...';

    const hasFilters = activeTab === 'pcbs';

    // Only display Add New button if not on sandbox
    const showAddButton = activeTab !== 'sandbox';

    // Retrieve PCB filters state
    const {
        selectedProjects,
        selectedRevisions,
        selectedFlavors,
        selectedCorners,
        selectedPcbRevs,
        selectedTags,
        selectedOwners,
        selectedBoardNumbers,
        resetFilters: resetPcbFilters
    } = usePcbStore();

    const activeFilterCount = activeTab === 'pcbs'
        ? selectedProjects.length +
        selectedRevisions.length +
        selectedFlavors.length +
        selectedCorners.length +
        selectedPcbRevs.length +
        selectedTags.length +
        selectedOwners.length +
        selectedBoardNumbers.length
        : 0;

    const onClearFilters = activeTab === 'pcbs' ? resetPcbFilters : undefined;

    const onAdd = () => {
        addItem((activeTab + '_add') as any);
    };

    return (
        <>
            <div className="top-buttons">
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
                            onClick={() => setShowFilters(!showFilters)}
                            style={isMobile ? undefined : { width: '145px' }}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
                            </svg>
                            <span>{showFilters ? 'Hide Filters' : 'Show Filters'}</span>
                        </button>
                    )}
                    {hasSearch && (
                        <button
                            className={`secondary-button ${showMobileSearch ? 'active' : ''}`}
                            onClick={() => setShowMobileSearch(!showMobileSearch)}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="11" cy="11" r="8"></circle>
                                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                            </svg>
                            <span>Search</span>
                        </button>
                    )}
                    {showAddButton && (
                        <button className="add-button" onClick={onAdd}>
                            <Plus size={18} />
                            <span>Add New</span>
                        </button>
                    )}
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

            {hasSearch && showMobileSearch && (
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
                        onChange={(e) => setSearchQuery(e.target.value)}
                        autoFocus
                    />
                </div>
            )}
        </>
    );
}
