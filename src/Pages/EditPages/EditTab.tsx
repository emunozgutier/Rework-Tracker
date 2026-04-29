import { useEffect, useState } from 'react';
import { ArrowLeft, Save, Trash2 } from 'lucide-react';

import { API_BASE, apiFetch } from '../../store/database/apiBridge';
import { useTagStore } from '../../store/storeTag';
import { useOwnerStore } from '../../store/storeOwner';
import { COLORS } from '../../store/storeStyles';

interface EditTabProps {
    id: string | number;
    onBack: () => void;
    onSuccess: () => void;
}

export function EditTab({ id, onBack, onSuccess }: EditTabProps) {
    const [name, setName] = useState('');
    const [color, setColor] = useState('#818cf8');
    const [ownerId, setOwnerId] = useState<string>('');
    const [type, setType] = useState<'public' | 'personal'>('public');
    const [loading, setLoading] = useState(true);
    const { updateTag, deleteTag } = useTagStore();
    const { owners, fetchOwners } = useOwnerStore();
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (owners.length === 0) fetchOwners();
    }, [owners.length, fetchOwners]);

    useEffect(() => {
        apiFetch(`${API_BASE}/tags/${id}`)
            .then(res => res.json())
            .then(data => {
                if (data) {
                    setName(data.name);
                    setColor(data.color || '#818cf8');
                    setOwnerId(data.owner_id ? data.owner_id.toString() : '');
                    setType(data.type || 'public');
                }
                setLoading(false);
            })
            .catch(err => {
                console.error(err);
                setLoading(false);
            });
    }, [id]);

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        const success = await updateTag(id, { name, color, owner_id: ownerId, type });
        if (success) onSuccess();
        setSaving(false);
    };

    const handleDelete = async () => {
        if (!window.confirm('Are you sure you want to delete this tag?')) return;
        setSaving(true);
        const success = await deleteTag(id);
        if (success) onSuccess();
        setSaving(false);
    };

    const colors = [COLORS.indigo, COLORS.red, COLORS.emerald, COLORS.amber, COLORS.blue, COLORS.pink, COLORS.purpleAccent];

    if (loading) return <div className="loading">Loading Tag...</div>;

    return (
        <div className="add-page-container">
            <header className="add-page-header">
                <button onClick={onBack} className="back-button">
                    <ArrowLeft size={20} />
                </button>
                <h2>Edit Tag (Tab)</h2>
                <button onClick={handleDelete} className="delete-icon-button" title="Delete Tag">
                    <Trash2 size={20} color="#ef4444" />
                </button>
            </header>

            <form onSubmit={handleUpdate} className="add-form">
                <div className="form-group">
                    <label htmlFor="type">Tag Type</label>
                    <select 
                        id="type"
                        value={type} 
                        onChange={(e) => {
                            setType(e.target.value as 'public' | 'personal');
                            if (e.target.value === 'public') setOwnerId('');
                        }} 
                        required
                    >
                        <option value="public">Public (Shared across all projects)</option>
                        <option value="personal">Personal (Private to you)</option>
                    </select>
                </div>
                {type === 'personal' && (
                    <div className="form-group">
                        <label htmlFor="owner">Tag Owner *</label>
                        <select 
                            id="owner"
                            value={ownerId} 
                            onChange={(e) => setOwnerId(e.target.value)} 
                            required
                        >
                            <option value="">Select an Owner...</option>
                            {owners.map(o => (
                                <option key={o.id} value={o.id}>@{o.username}</option>
                            ))}
                        </select>
                    </div>
                )}
                <div className="form-group">
                    <label htmlFor="name">Tag Name</label>
                    <input 
                        id="name"
                        type="text" 
                        value={name} 
                        onChange={(e) => {
                            let val = e.target.value.toLowerCase().replace(/\s+/g, '-');
                            if (type === 'public') val = val.replace(/\//g, '');
                            setName(val);
                        }} 
                        placeholder={type === 'public' ? "e.g. tag-name" : "e.g. username/tag-name"}
                        required 
                    />
                </div>
                <div className="form-group">
                    <label>Choose Color</label>
                    <div className="color-presets">
                        {colors.map(c => (
                            <button 
                                key={c}
                                type="button"
                                className={`color-preset ${color === c ? 'active' : ''}`}
                                style={{ backgroundColor: c }}
                                onClick={() => setColor(c)}
                            />
                        ))}
                    </div>
                </div>
                <button type="submit" className="submit-button" disabled={saving}>
                    <Save size={18} />
                    <span>{saving ? 'Saving...' : 'Update Tag'}</span>
                </button>
            </form>
        </div>
    );
}
