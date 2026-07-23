import { useState } from 'react';
import { ArrowLeft, Save } from 'lucide-react';

import { useOwnerStore } from '../../store/useOwnerStore';

interface AddUserProps {
    onBack: () => void;
    onSuccess: () => void;
}

export function AddUser({ onBack, onSuccess }: AddUserProps) {
    const [name, setName] = useState('');
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [superuser, setSuperuser] = useState(0);
    const { addOwner, loading, error } = useOwnerStore();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const success = await addOwner({ name, username, email, superuser });
        if (success) {
            onSuccess();
        }
    };

    return (
        <div className="add-page-container">
            <header className="add-page-header">
                <button onClick={onBack} className="back-button">
                    <ArrowLeft size={20} />
                </button>
                <h2>Add New Owner</h2>
            </header>

            <form onSubmit={handleSubmit} className="add-form">
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
                        placeholder="e.g. Jane Smith"
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
                        placeholder="e.g. jsmith"
                        pattern="^\S+$"
                        maxLength={8}
                        title="Username cannot contain spaces and must be 8 characters or fewer"
                        required 
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="email">Email Address (Optional)</label>
                    <input 
                        id="email"
                        type="email" 
                        value={email} 
                        onChange={(e) => setEmail(e.target.value)} 
                        placeholder="e.g. jsmith@example.com"
                    />
                </div>
                <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
                    <input 
                        id="superuser"
                        type="checkbox" 
                        checked={superuser === 1} 
                        onChange={(e) => setSuperuser(e.target.checked ? 1 : 0)}
                        style={{ width: '20px', height: '20px', cursor: 'pointer', accentColor: 'var(--accent)' }}
                    />
                    <label htmlFor="superuser" style={{ cursor: 'pointer', userSelect: 'none', margin: 0 }}>Is Superuser</label>
                </div>
                <button type="submit" className="submit-button" disabled={loading}>
                    <Save size={18} />
                    <span>{loading ? 'Saving...' : 'Save Owner'}</span>
                </button>
            </form>
        </div>
    );
}
