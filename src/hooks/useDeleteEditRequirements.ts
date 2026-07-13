import { useReworkStore } from '../store/storeRework';

export const PCB_DELETE_LIMIT_DAYS = 3;
export const REWORK_DELETE_LIMIT_DAYS = 3;

export function useDeleteEditRequirements() {
    const { reworks } = useReworkStore();

    const getPcbAgeDays = (pcb: any) => {
        if (!pcb || !pcb.created_at) return 0;
        const createdAt = new Date(pcb.created_at.includes('T') ? pcb.created_at : pcb.created_at.replace(' ', 'T') + 'Z');
        if (isNaN(createdAt.getTime())) return 0;
        return (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
    };

    const getReworkAgeDays = (rework: any) => {
        if (!rework || !rework.timestamp) return 0;
        const timestampDate = new Date(rework.timestamp.includes('T') ? rework.timestamp : rework.timestamp.replace(' ', 'T') + 'Z');
        if (isNaN(timestampDate.getTime())) return 0;
        return (Date.now() - timestampDate.getTime()) / (1000 * 60 * 60 * 24);
    };

    const checkPcbDeleteRequirements = (pcb: any, reworkCount: number) => {
        const daysOld = getPcbAgeDays(pcb);
        const isAgeValid = daysOld <= PCB_DELETE_LIMIT_DAYS;
        const isReworksValid = reworkCount === 0;
        const requirementsMet = isAgeValid && isReworksValid;

        return {
            daysOld,
            isAgeValid,
            isReworksValid,
            requirementsMet
        };
    };

    const checkReworkDeleteRequirements = (rework: any) => {
        const daysOld = getReworkAgeDays(rework);
        const isAgeValid = daysOld <= REWORK_DELETE_LIMIT_DAYS;

        // Check if there is any newer rework log after it on the same board
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
    };

    const checkProjectDeleteRequirements = (project: any) => {
        const pcbCount = project?.pcb_count || 0;
        const isPcbCountValid = pcbCount === 0;
        const requirementsMet = isPcbCountValid;

        return {
            pcbCount,
            isPcbCountValid,
            requirementsMet
        };
    };

    const checkPcbEditRequirements = () => {
        return { requirementsMet: true };
    };

    const checkReworkEditRequirements = () => {
        return { requirementsMet: true };
    };

    const checkProjectEditRequirements = () => {
        return { requirementsMet: true };
    };

    return {
        PCB_DELETE_LIMIT_DAYS,
        REWORK_DELETE_LIMIT_DAYS,
        getPcbAgeDays,
        getReworkAgeDays,
        checkPcbDeleteRequirements,
        checkReworkDeleteRequirements,
        checkProjectDeleteRequirements,
        checkPcbEditRequirements,
        checkReworkEditRequirements,
        checkProjectEditRequirements
    };
}
