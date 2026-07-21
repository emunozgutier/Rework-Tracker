import { describe, it, expect } from 'vitest';
import { useAppState } from '../src/store/useAppState';

describe('TabBar Settings Navigation Integration', () => {
    it('should switch activeTab and page to settings when setActiveTab("settings") is called', () => {
        const store = useAppState.getState();

        // Switch active tab to settings
        store.setActiveTab('settings');

        const updated = useAppState.getState();
        expect(updated.activeTab).toBe('settings');
        expect(updated.page).toBe('settings');
        expect(updated.selectedId).toBeNull();
        expect(updated.searchQuery).toBe('');
    });
});
