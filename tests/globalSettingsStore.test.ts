import { describe, it, expect, beforeEach } from 'vitest';
import { useGlobalSettings, DEFAULT_GLOBAL_SETTINGS } from '../src/store/useGlobalSettings';
import { formatCrc, getNatoWord } from '../src/components/UrlManager/crc';

describe('Global Settings Store Unit Tests', () => {
    beforeEach(() => {
        // Reset settings before each test
        useGlobalSettings.getState().resetSettings();
    });

    it('should initialize with default crcFormat of "letter"', () => {
        const state = useGlobalSettings.getState();
        expect(state.crcFormat).toBe('letter');
        expect(DEFAULT_GLOBAL_SETTINGS.crcFormat).toBe('letter');
    });

    it('should set crcFormat to "nato"', () => {
        const store = useGlobalSettings.getState();
        store.setCrcFormat('nato');

        expect(useGlobalSettings.getState().crcFormat).toBe('nato');
    });

    it('should toggle crcFormat between "letter" and "nato"', () => {
        const store = useGlobalSettings.getState();
        expect(store.crcFormat).toBe('letter');

        store.toggleCrcFormat();
        expect(useGlobalSettings.getState().crcFormat).toBe('nato');

        useGlobalSettings.getState().toggleCrcFormat();
        expect(useGlobalSettings.getState().crcFormat).toBe('letter');
    });

    it('should reset settings to default values', () => {
        const store = useGlobalSettings.getState();
        store.setCrcFormat('nato');
        expect(useGlobalSettings.getState().crcFormat).toBe('nato');

        store.resetSettings();
        expect(useGlobalSettings.getState().crcFormat).toBe('letter');
    });

    it('should format CRC characters properly using formatCrc and getNatoWord helpers', () => {
        expect(getNatoWord('G')).toBe('Golf');
        expect(getNatoWord('k')).toBe('Kilo');

        expect(formatCrc('G', 'letter')).toBe('G');
        expect(formatCrc('G', 'nato')).toBe('Golf');
    });
});
