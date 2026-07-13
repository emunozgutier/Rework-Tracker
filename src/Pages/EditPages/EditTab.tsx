import { useEffect, useState } from 'react';
import { ArrowLeft, Save, Trash2 } from 'lucide-react';

import { API_BASE, apiFetch } from '../../store/database/apiBridge';
import { useTagStore } from '../../store/useTagStore';
import { COLORS } from '../../store/useStyles';

interface EditTabProps {
    id: string | number;
    onBack: () => void;
    onSuccess: () => void;
}

export function EditTab({ id, onBack, onSuccess }: EditTabProps) {
    const [name, setName] = useState('');
    const [color, setColor] = useState('#818cf8');
    const [loading, setLoading] = useState(true);
    const { updateTag, deleteTag } = useTagStore();
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        apiFetch(`${API_BASE}/tags/${id}`)
            .then(res => res.json())
            .then(data => {
                if (data) {
                    setName(data.name);
                    setColor(data.color || '#818cf8');
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
        const success = await updateTag(id, { name, color, type: 'public' });
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
                    <label htmlFor="name">Tag Name</label>
                    <input 
                        id="name"
                        type="text" 
                        value={name} 
                        onChange={(e) => {
                            const val = e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/\//g, '');
                            setName(val);
                        }} 
                        placeholder="e.g. tag-name"
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
