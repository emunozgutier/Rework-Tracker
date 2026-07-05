import { useEffect, useState } from 'react';
import { API_BASE, apiFetch } from '../../../store/database/apiBridge';
import { PcbCardHeader } from './PcbCardHeader';
import { useStore } from '../../../store/useStore';
import { usePcbStore } from '../../../store/storePcb';
import { ViewButton } from '../../../components/forms/ActionButtons';
import { useTagStore, formatTagName } from '../../../store/storeTag';

interface TagCardBodyProps {
    tag: any;
}

export function TagCardBody({ tag }: TagCardBodyProps) {
    const [taggedPcbs, setTaggedPcbs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const { setActiveTab } = useStore();
    const { setSelectedTags, resetFilters } = usePcbStore();

    useEffect(() => {
        apiFetch(`${API_BASE}/tags/${tag.id}/pcbs`)
            .then(res => res.json())
            .then(data => {
                setTaggedPcbs(data);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, [tag.id]);

    if (loading) return <div style={{ padding: '12px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Loading attached PCBs...</div>;

    return (
        <div className="card-expanded-content" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px' }}>Tagged PCBs List</h4>
            
            {taggedPcbs.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <ViewButton 
                        onClick={() => {
                            resetFilters();
                            if (tag.type === 'public') {
                                const { tags } = useTagStore.getState();
                                const groupIds = tags.filter((t: any) => t.type === 'public' && formatTagName(t) === formatTagName(tag)).map((t: any) => t.id.toString());
                                setSelectedTags(groupIds);
                            } else {
                                setSelectedTags([tag.id.toString()]);
                            }
                            setActiveTab('pcbs');
                        }}
                        label="View PCBs Global List"
                        style={{ marginBottom: '4px' }}
                    />
                    {taggedPcbs.map((pcb, index) => (
                        <div key={index} style={{ border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--bg-element)' }}>
                            <PcbCardHeader 
                                pcb={pcb} 
                                isExpanded={false}
                                onToggle={() => {}}
                                hideActions={true}
                            />
                        </div>
                    ))}
                </div>
            ) : (
                <p className="no-data" style={{ color: 'var(--text-muted)', fontStyle: 'italic', margin: 0, fontSize: '0.9rem' }}>No PCBs are currently using this Tag.</p>
            )}
        </div>
    );
}
