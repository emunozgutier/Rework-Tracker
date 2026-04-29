import { useEffect, useState } from 'react';
import { ArrowLeft, Save, Trash2 } from 'lucide-react';

import { API_BASE, apiFetch } from '../../store/database/apiBridge';
import { useOwnerStore } from '../../store/storeOwner';

interface EditUserProps {
    id: string | number;
    onBack: () => void;
    onSuccess: () => void;
}

export function EditUser({ id, onBack, onSuccess }: EditUserProps) {
    const [name, setName] = useState('');
    const [username, setUsername] = useState('');
    const [loading, setLoading] = useState(true);
    const { updateOwner, deleteOwner, error } = useOwnerStore();
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        apiFetch(`${API_BASE}/owners/${id}`)
            .then(res => res.json())
            .then(data => {
                if (data) {
                    setName(data.name);
                    setUsername(data.username || '');
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
        const success = await updateOwner(id, { name, username });
        if (success) onSuccess();
        setSaving(false);
    };

    const handleDelete = async () => {
        if (!window.confirm('Are you sure you want to delete this owner?')) return;
        setSaving(true);
        const success = await deleteOwner(id);
        if (success) onSuccess();
        setSaving(false);
    };

    if (loading) return <div className="loading">Loading Owner...</div>;

    return (
        <div className="add-page-container">
            <header className="add-page-header">
                <button onClick={onBack} className="back-button">
                    <ArrowLeft size={20} />
                </button>
                <h2>Edit Owner</h2>
                <button onClick={handleDelete} className="delete-icon-button" title="Delete Owner">
                    <Trash2 size={20} color="#ef4444" />
                </button>
            </header>

            <form onSubmit={handleUpdate} className="add-form">
                {error && (
                    <div style={{ color: '#ef4444', marginBottom: '16px', padding: '12px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                        {error}
                    </div>
                )}
                <div className="form-group">
                    <label htmlFor="name">Full Name</label>
                    <input 
                        id="name"
                        type="text" 
                        value={name} 
                        onChange={(e) => setName(e.target.value)} 
                        required 
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="username">Username (Max 8 characters, no spaces)</label>
                    <input 
                        id="username"
                        type="text" 
                        value={username} 
                        onChange={(e) => setUsername(e.target.value.toLowerCase())} 
                        pattern="^\S+$"
                        maxLength={8}
                        title="Username cannot contain spaces and must be 8 characters or fewer"
                        required 
                    />
                </div>
                <button type="submit" className="submit-button" disabled={saving}>
                    <Save size={18} />
                    <span>{saving ? 'Saving...' : 'Update Owner'}</span>
                </button>
            </form>
        </div>
    );
}
