import { useState } from 'react';
import { ArrowLeft, Save, ShieldCheck, RefreshCw } from 'lucide-react';
import QRCode from 'qrcode';
import { API_BASE, apiFetch } from '../../store/serverDataBase/apiBridge';
import { useOwnerStore } from '../../store/clientDataBase/useOwnerStore';
import { useAppState } from '../../store/useAppState';
import { setSessionCookie } from '../../authentication/clientAuth';

interface AddUserProps {
    onBack: () => void;
    onSuccess: () => void;
}

export function AddUser({ onBack, onSuccess }: AddUserProps) {
    const [name, setName] = useState('');
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const { addOwner, loading: storeLoading, error: storeError } = useOwnerStore();
    const { setCurrentUser } = useAppState();

    const [otpStep, setOtpStep] = useState<'form' | 'otp'>('form');
    const [secret, setSecret] = useState('');
    const [qrCodeUrl, setQrCodeUrl] = useState('');
    const [token, setToken] = useState('');
    const [otpError, setOtpError] = useState('');
    const [verifying, setVerifying] = useState(false);

    const handleStartOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setOtpError('');
        setVerifying(true);
        try {
            const host = window.location.host;
            const res = await apiFetch(`${API_BASE}/otp/setup?username=${encodeURIComponent(username.trim())}&host=${encodeURIComponent(host)}`);
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || 'Failed to generate OTP setup.');
            }
            const data = await res.json();
            
            const qrCodeDataUrl = await QRCode.toDataURL(data.otpauthUrl, {
                margin: 2,
                width: 200,
                errorCorrectionLevel: 'M'
            });
            
            setSecret(data.secret);
            setQrCodeUrl(qrCodeDataUrl);
            setOtpStep('otp');
        } catch (err: any) {
            setOtpError(err.message || 'Failed to start OTP setup.');
        } finally {
            setVerifying(false);
        }
    };

    const handleVerifyAndSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setOtpError('');
        setVerifying(true);
        try {
            const res = await apiFetch(`${API_BASE}/otp/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ secret, token })
            });
            if (!res.ok) throw new Error('Verification request failed.');
            const data = await res.json();
            
            if (!data.valid) {
                setOtpError('Invalid 6-digit verification code. Please check your authenticator app.');
                setVerifying(false);
                return;
            }

            // Persist the JWT session cookie returned by the OTP verify endpoint
            if (data.token) {
                setSessionCookie(data.token, 7);
            }
            
            const success = await addOwner({ name, username, email, otp_secret: secret });
            if (success) {
                // Auto-sign-in: find the new owner in the refreshed list and set them as current user
                const allOwners = useOwnerStore.getState().owners;
                const cleanUsername = username.replace(/\s+/g, '').toLowerCase();
                const newOwner = allOwners.find(o => o.username.toLowerCase() === cleanUsername);
                if (newOwner) {
                    const isSuperUser = newOwner.is_super_user === 1 || newOwner.is_super_user === (true as any);
                    const minId = allOwners.length > 0 ? Math.min(...allOwners.map(o => o.id)) : -1;
                    const isFirstUser = newOwner.id === minId;
                    const role = (isSuperUser || allOwners.length === 1 || isFirstUser) ? 'Super User' : 'User';
                    setCurrentUser(newOwner, role);
                }
                onSuccess();
            }
        } catch (err: any) {
            setOtpError(err.message || 'OTP verification failed.');
        } finally {
            setVerifying(false);
        }
    };

    const displayError = otpError || storeError;
    const isWorking = verifying || storeLoading;

    return (
        <div className="add-page-container">
            <header className="add-page-header">
                <button onClick={otpStep === 'otp' ? () => setOtpStep('form') : onBack} className="back-button">
                    <ArrowLeft size={20} />
                </button>
                <h2>{otpStep === 'otp' ? 'Security Setup' : 'Add New Owner'}</h2>
            </header>

            {displayError && (
                <div style={{ color: '#ef4444', margin: '0 24px 16px 24px', padding: '12px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                    {displayError}
                </div>
            )}

            {otpStep === 'form' ? (
                <form onSubmit={handleStartOtp} className="add-form">
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
                    <button type="submit" className="submit-button" disabled={isWorking}>
                        <ShieldCheck size={18} />
                        <span>{isWorking ? 'Initializing...' : 'Setup Authenticator'}</span>
                    </button>
                </form>
            ) : (
                <form onSubmit={handleVerifyAndSave} className="add-form" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '20px', padding: '0 10px' }}>
                        Scan this QR Code in your Google Authenticator or Authy app, then enter the 6-digit verification code below.
                    </p>

                    <div style={{ backgroundColor: '#fff', padding: '12px', borderRadius: '12px', marginBottom: '16px', display: 'inline-block' }}>
                        {qrCodeUrl && <img src={qrCodeUrl} alt="OTP Authenticator QR Code" style={{ display: 'block', width: '180px', height: '180px' }} />}
                    </div>

                    <div style={{ marginBottom: '24px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        Manual secret key: <code style={{ color: 'var(--accent)', fontWeight: 'bold', fontSize: '0.95rem' }}>{secret}</code>
                    </div>

                    <div className="form-group" style={{ width: '100%', maxWidth: '280px', textAlign: 'left' }}>
                        <label htmlFor="otp-token" style={{ textAlign: 'center', display: 'block', width: '100%', marginBottom: '8px' }}>Verification Code</label>
                        <input 
                            id="otp-token"
                            name="otp-token"
                            type="text" 
                            value={token} 
                            onChange={(e) => setToken(e.target.value.replace(/\D/g, ''))} 
                            placeholder="e.g. 123456"
                            maxLength={6}
                            pattern="[0-9]{6}"
                            required 
                            autoFocus
                            autoComplete="off"
                            style={{ textAlign: 'center', fontSize: '1.25rem', letterSpacing: '2px', fontWeight: 'bold' }}
                        />
                    </div>

                    <div style={{ display: 'flex', gap: '12px', width: '100%', marginTop: '16px' }}>
                        <button type="button" onClick={() => setOtpStep('form')} className="secondary-button" style={{ flex: 1, justifyContent: 'center' }}>
                            Back
                        </button>
                        <button type="submit" className="submit-button" disabled={isWorking} style={{ flex: 2, margin: 0, justifyContent: 'center' }}>
                            {isWorking ? (
                                <>
                                    <RefreshCw size={18} className="animate-spin" style={{ marginRight: '6px' }} />
                                    <span>Verifying...</span>
                                </>
                            ) : (
                                <>
                                    <Save size={18} />
                                    <span>Verify & Register</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
}
