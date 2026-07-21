import { useEffect, useState } from 'react';
import { API_BASE, apiFetch } from '../../../store/database/apiBridge';
import { useAppState } from '../../../store/useAppState';
import { usePcbStore } from '../../../store/usePcbStore';
import { ViewButton } from '../../../components/forms/ActionButtons';
import { useTagStore, formatTagName } from '../../../store/useTagStore';
import { BoardName } from '../../../components/BoardName';

interface TagCardBodyProps {
    tag: any;
}

export function TagCardBody({ tag }: TagCardBodyProps) {
    const [taggedPcbs, setTaggedPcbs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const { setActiveTab } = useAppState();
    const { pcbs, fetchPcbs, setSelectedTags } = usePcbStore();

    useEffect(() => {
        if (pcbs.length === 0) {
            fetchPcbs();
        }
    }, [pcbs.length, fetchPcbs]);

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
                            setActiveTab('pcbs');
                            const { tags } = useTagStore.getState();
                            const groupIds = tags.filter((t: any) => t.type === 'public' && formatTagName(t) === formatTagName(tag)).map((t: any) => t.id.toString());
                            setSelectedTags(groupIds);
                        }}
                        label="View PCBs Global List"
                        style={{ marginBottom: '4px' }}
                    />
                    {taggedPcbs.map((taggedPcb, index) => {
                        const pcb = pcbs.find(p => p.id === taggedPcb.id) || taggedPcb;
                        return (
                            <div 
                                key={index} 
                                style={{ 
                                    padding: '12px 16px',
                                    border: '1px solid var(--border)', 
                                    borderRadius: '8px', 
                                    background: 'var(--bg-element)',
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: '12px'
                                }}
                            >
                                <span className="board-num" style={{ fontWeight: 600, color: 'var(--text)' }}>
                                    <BoardName name={pcb.board_number} isHex={pcb.number_format === 'hex'} />
                                </span>
                                {pcb.bom && (
                                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.03)', padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                                        BOM: {pcb.bom}
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>
            ) : (
                <p className="no-data" style={{ color: 'var(--text-muted)', fontStyle: 'italic', margin: 0, fontSize: '0.9rem' }}>No PCBs are currently using this Tag.</p>
            )}
        </div>
    );
}
