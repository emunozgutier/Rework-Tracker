import { COLORS } from '../../../store/storeStyles';

interface ProjectCardSummaryProps {
    project: {
        pcb_count: number;
        revisions: string[];
        formfactors?: { name: string; revisions: string[] }[];
        silicon_corners?: string;
    };
}

export function ProjectCardSummary({ project }: ProjectCardSummaryProps) {
    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px', marginBottom: '8px', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Silicon Versions</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '6px' }}>
                    {(Array.isArray(project.revisions) ? project.revisions : (project.revisions ? (project.revisions as unknown as string).split(',').map(r => r.trim()) : [])).length > 0 ? (Array.isArray(project.revisions) ? project.revisions : (project.revisions as unknown as string).split(',').map(r => r.trim())).map((rev, i) => (
                        <span key={i} className="pcb-pill" style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}>{rev}</span>
                    )) : <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>None defined</span>}
                </div>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Silicon Corners</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '6px' }}>
                    {project.silicon_corners ? project.silicon_corners.split(',').map((s: string) => s.trim()).filter(Boolean).map((sc: string, i: number) => (
                        <span key={i} className="pcb-pill" style={{ borderColor: COLORS.amber, color: COLORS.amber }}>{sc}</span>
                    )) : <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>None defined</span>}
                </div>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>PCB Flavors</span>
                 <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '6px' }}>
                    {project.formfactors && project.formfactors.length > 0 ? project.formfactors.map((ff, i) => (
                        <span key={i} className="pcb-pill" style={{ padding: '2px 8px' }}>{ff.name}</span>
                    )) : <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>None assigned</span>}
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Total Count</span>
                <span style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--text)', lineHeight: '1', marginTop: '2px' }}>{project.pcb_count}</span>
            </div>
        </div>
    );
}
