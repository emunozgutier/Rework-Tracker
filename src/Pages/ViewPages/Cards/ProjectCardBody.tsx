import { useState, useRef, useEffect } from 'react';
import { COLORS } from '../../../store/storeStyles';
import { EditButton, ViewButton } from '../../../components/forms/ActionButtons';
import { usePcbStore } from '../../../store/storePcb';
import { useStore } from '../../../store/useStore';
import { PcbCardHeader } from './PcbCardHeader';
import { ProjectCardSummary } from './ProjectCardSummary';

interface ProjectCardBodyProps {
    project: {
        id: number;
        name: string;
        description: string;
        pcb_count: number;
        pcbs: string[];
        revisions: string[];
        formfactors?: { name: string; revisions: string[] }[];
        silicon_corners?: string;
    };
}

export function ProjectCardBody({ project }: ProjectCardBodyProps) {
    const { pcbs: allPcbs, setSelectedProjects, setSelectedBoardNumbers } = usePcbStore();
    const { setActiveTab, editItem, setExpandedPcb, setIsolatedView, setPage } = useStore();
    
    // Get actual PCB objects for this project
    const projectPcbs = allPcbs.filter(p => p.project === project.name);

    const LongPressPcbCard = ({ pcb }: { pcb: any }) => {
        const [progress, setProgress] = useState(0);
        const intervalRef = useRef<any>(null);
        const timeoutRef = useRef<any>(null);
        const isPressingRef = useRef(false);

        useEffect(() => {
            return () => {
                if (intervalRef.current) clearInterval(intervalRef.current);
                if (timeoutRef.current) clearTimeout(timeoutRef.current);
            };
        }, []);

        const startPress = () => {
            // Prevent default to avoid selecting text while holding
            // e.preventDefault(); 
            isPressingRef.current = true;
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            setProgress(0);
            const startTime = Date.now();
            intervalRef.current = setInterval(() => {
                const elapsed = Date.now() - startTime;
                const percentage = Math.min((elapsed / 1000) * 100, 100);
                setProgress(percentage);
                if (percentage >= 100) {
                    clearInterval(intervalRef.current);
                    // Trigger navigation
                    setSelectedBoardNumbers([pcb.board_number]);
                    setExpandedPcb(pcb.board_number);
                    setIsolatedView(true);
                    setPage('pcbs');
                    setActiveTab('pcbs');
                }
            }, 30);
        };

        const cancelPress = () => {
            if (!isPressingRef.current) return;
            isPressingRef.current = false;
            
            if (intervalRef.current) clearInterval(intervalRef.current);
            setProgress(prev => {
                if (prev < 30) {
                    if (timeoutRef.current) clearTimeout(timeoutRef.current);
                    timeoutRef.current = setTimeout(() => {
                        setProgress(0);
                    }, 500);
                    return 30;
                }
                return 0;
            });
        };

        return (
            <div 
                style={{ 
                    position: 'relative', 
                    border: '1px solid var(--border)', 
                    borderRadius: '8px', 
                    background: 'var(--bg-element)', 
                    overflow: 'hidden',
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    cursor: 'pointer'
                }}
                onMouseDown={startPress}
                onMouseUp={cancelPress}
                onMouseLeave={cancelPress}
                onTouchStart={startPress}
                onTouchEnd={cancelPress}
            >
                <div 
                    style={{ 
                        position: 'absolute', 
                        top: 0, 
                        left: 0, 
                        height: '100%', 
                        width: `${progress}%`, 
                        backgroundColor: COLORS.indigoFill, 
                        transition: progress === 0 ? 'none' : progress === 30 ? 'width 0.2s ease-out' : 'width 0.05s linear',
                        zIndex: 0
                    }} 
                />
                <div style={{ position: 'relative', zIndex: 1, pointerEvents: 'none' }}>
                    <PcbCardHeader pcb={pcb} isExpanded={false} onToggle={() => {}} hideActions={true} />
                </div>
            </div>
        );
    };

    return (
        <div className="card-expanded-content" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <ProjectCardSummary project={project} />

            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                <EditButton 
                    onClick={(e) => { e.stopPropagation(); editItem('projects_edit', project.id); }}
                    label="Edit Project"
                />
                <ViewButton 
                    onClick={(e) => {
                        e.stopPropagation();
                        setSelectedProjects([project.id.toString()]);
                        setPage('pcbs');
                        setActiveTab('pcbs');
                    }}
                    className="view-pcbs-btn"
                    label="View PCBs Info"
                />
            </div>

            {projectPcbs.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {projectPcbs.map((pcb, index) => (
                        <LongPressPcbCard key={index} pcb={pcb} />
                    ))}
                </div>
            ) : (
                <p className="no-data" style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>No PCBs assigned.</p>
            )}
        </div>
    );
}

