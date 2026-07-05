import { useEffect, useRef } from 'react';
import { ProjectCardHeader } from './ProjectCardHeader';
import { ProjectCardBody } from './ProjectCardBody';
import { useStore } from '../../../store/useStore';

interface ProjectCardProps {
    project: {
        id: number;
        name: string;
        description: string;
        pcb_count: number;
        pcbs: string[];
        revisions: string[];
        project_key: string;
    };
}

export function ProjectCard({ project }: ProjectCardProps) {
    const { expandedProject, setExpandedProject } = useStore();
    const isExpanded = expandedProject === project.name;
    const cardRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isExpanded && cardRef.current) {
            setTimeout(() => {
                cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
        }
    }, [isExpanded]);

    const handleToggle = () => {
        if (isExpanded) {
            setExpandedProject(null);
        } else {
            setExpandedProject(project.name);
        }
    };

    return (
        <div ref={cardRef} className={`item-card project-card ${isExpanded ? 'active' : ''}`}>
            <ProjectCardHeader 
                project={project} 
                isExpanded={isExpanded} 
                onToggle={handleToggle} 
            />
            {isExpanded && <ProjectCardBody project={project} />}
        </div>
    );
}
