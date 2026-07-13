import { create } from 'zustand';
import { useReworkStore } from './useReworkStore';

interface DeleteEditRequirementsState {
    pcbDeleteLimitDays: number;
    reworkDeleteLimitDays: number;
    getPcbAgeDays: (pcb: any) => number;
    getReworkAgeDays: (rework: any) => number;
    checkPcbDeleteRequirements: (pcb: any, reworkCount: number) => {
        daysOld: number;
        isAgeValid: boolean;
        isReworksValid: boolean;
        requirementsMet: boolean;
    };
    checkReworkDeleteRequirements: (rework: any) => {
        daysOld: number;
        isAgeValid: boolean;
        isLatest: boolean;
        requirementsMet: boolean;
    };
    checkProjectDeleteRequirements: (project: any) => {
        pcbCount: number;
        isPcbCountValid: boolean;
        requirementsMet: boolean;
    };
    checkPcbEditRequirements: () => { requirementsMet: boolean };
    checkReworkEditRequirements: (rework: any) => {
        daysOld: number;
        isAgeValid: boolean;
        requirementsMet: boolean;
    };
    checkProjectEditRequirements: () => { requirementsMet: boolean };
}

export const useDeleteEditRequirements = create<DeleteEditRequirementsState>((_, get) => ({
    pcbDeleteLimitDays: 3,
    reworkDeleteLimitDays: 3,

    getPcbAgeDays: (pcb: any) => {
        if (!pcb || !pcb.created_at) return 0;
        const createdAt = new Date(pcb.created_at.includes('T') ? pcb.created_at : pcb.created_at.replace(' ', 'T') + 'Z');
        if (isNaN(createdAt.getTime())) return 0;
        return (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
    },

    getReworkAgeDays: (rework: any) => {
        if (!rework || !rework.timestamp) return 0;
        const timestampDate = new Date(rework.timestamp.includes('T') ? rework.timestamp : rework.timestamp.replace(' ', 'T') + 'Z');
        if (isNaN(timestampDate.getTime())) return 0;
        return (Date.now() - timestampDate.getTime()) / (1000 * 60 * 60 * 24);
    },

    checkPcbDeleteRequirements: (pcb: any, reworkCount: number) => {
        const daysOld = get().getPcbAgeDays(pcb);
        const isAgeValid = daysOld <= get().pcbDeleteLimitDays;
        const isReworksValid = reworkCount === 0;
        const requirementsMet = isAgeValid && isReworksValid;

        return {
            daysOld,
            isAgeValid,
            isReworksValid,
            requirementsMet
        };
    },

    checkReworkDeleteRequirements: (rework: any) => {
        const daysOld = get().getReworkAgeDays(rework);
        const isAgeValid = daysOld <= get().reworkDeleteLimitDays;

        // Retrieve reworks from useReworkStore
        const { reworks } = useReworkStore.getState();
        const hasNewerRework = reworks.some((r: any) => 
            r.pcb_id === rework.pcb_id && r.id > rework.id
        );
        const isLatest = !hasNewerRework;
        const requirementsMet = isAgeValid && isLatest;

        return {
            daysOld,
            isAgeValid,
            isLatest,
            requirementsMet
        };
    },

    checkProjectDeleteRequirements: (project: any) => {
        const pcbCount = project?.pcb_count || 0;
        const isPcbCountValid = pcbCount === 0;
        const requirementsMet = isPcbCountValid;

        return {
            pcbCount,
            isPcbCountValid,
            requirementsMet
        };
    },

    checkPcbEditRequirements: () => {
        return { requirementsMet: true };
    },

    checkReworkEditRequirements: (rework: any) => {
        const daysOld = get().getReworkAgeDays(rework);
        const isAgeValid = daysOld <= 14;
        const requirementsMet = isAgeValid;
        return {
            daysOld,
            isAgeValid,
            requirementsMet
        };
    },

    checkProjectEditRequirements: () => {
        return { requirementsMet: true };
    },
}));
