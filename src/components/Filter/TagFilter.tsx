import { useTagStore } from '../../store/storeTag';
import { useOwnerStore } from '../../store/storeOwner';
import { COLORS } from '../../store/storeStyles';
import { PcbFilterElement } from './PcbFilterElement';
import { PcbFilterGroup } from './PcbFilterGroup';

export function TagFilter() {
    const { tags, selectedTagTypes, setSelectedTagTypes, selectedTagOwners, setSelectedTagOwners } = useTagStore();
    const { owners } = useOwnerStore();

    const matchTag = (tag: any, ignoreField: 'type' | 'owner') => {
        if (ignoreField !== 'type' && selectedTagTypes.length > 0) {
            if (!selectedTagTypes.includes(tag.type)) return false;
        }
        if (ignoreField !== 'owner' && selectedTagOwners.length > 0) {
            if (tag.type === 'public') return false; 
            if (!selectedTagOwners.includes(tag.owner_name)) return false;
        }
        return true;
    };

    const hasAnyOtherFilter = (ignoreField: string) => {
        const filters: any = {
            type: selectedTagTypes.length > 0,
            owner: selectedTagOwners.length > 0
        };
        filters[ignoreField] = false;
        return Object.values(filters).some(Boolean);
    };

    return (
        <div className="pcb-filters" style={{  
            marginBottom: '24px', 
            display: 'flex', 
            gap: '24px', 
            alignItems: 'stretch', 
            overflowX: 'auto', 
            width: '100%',
            paddingBottom: '12px'
        }}>
            <PcbFilterGroup title="Tag Properties" color={COLORS.purpleAccent}>
                <PcbFilterElement title="Type" value={selectedTagTypes} onChange={setSelectedTagTypes}>
                    {['public', 'personal'].map(type => {
                        const count = tags.filter((tag: any) => tag.type === type && matchTag(tag, 'type')).length;
                        if (count === 0 && hasAnyOtherFilter('type')) return null;
                        return <option key={type} value={type}>{type === 'public' ? 'Public' : 'Personal'} ({count})</option>;
                    })}
                </PcbFilterElement>

                <PcbFilterElement title="Owner" value={selectedTagOwners} onChange={setSelectedTagOwners}>
                    {owners.filter(o => tags.some(t => t.owner_name === o.name && t.type === 'personal')).map(owner => {
                        const count = tags.filter((tag: any) => tag.owner_name === owner.name && matchTag(tag, 'owner')).length;
                        if (count === 0 && hasAnyOtherFilter('owner')) return null;
                        return <option key={owner.id} value={owner.name}>{owner.username} ({count})</option>;
                    })}
                </PcbFilterElement>
            </PcbFilterGroup>
        </div>
    );
}
