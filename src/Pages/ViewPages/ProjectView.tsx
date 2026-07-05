import { useEffect } from 'react';
import { Plus } from 'lucide-react';
import { ProjectCard } from './Cards/ProjectCard';
import { useProjectStore } from '../../store/storeProject';
import { usePcbStore } from '../../store/storePcb';

interface ProjectViewProps {
    title: string;
    onAdd: () => void;
}

export function ProjectView({ title, onAdd }: ProjectViewProps) {
    const { projects, loading: projectsLoading, fetchProjects } = useProjectStore();
    const { fetchPcbs } = usePcbStore();

    useEffect(() => {
        fetchProjects();
        fetchPcbs();
    }, [fetchProjects, fetchPcbs]);

    if (projectsLoading) return <div className="loading">Loading {title}...</div>;

    return (
        <div className="card-list-container">
            <div className="list-header" style={{ flexWrap: 'wrap', gap: '16px' }}>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <h2 style={{ margin: 0 }}>{title}</h2>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <button className="add-button" onClick={onAdd}>
                        <Plus size={18} />
                        <span>Add New</span>
                    </button>
                </div>
            </div>

            <div className="cards-grid single-column">
                {projects.length === 0 ? (
                    <div className="empty-state">No projects found.</div>
                ) : (
                    projects.map((item) => (
                        <ProjectCard key={item.id} project={item} />
                    ))
                )}
            </div>
        </div>
    );
}
