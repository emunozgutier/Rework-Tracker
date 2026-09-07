import { useState, useEffect } from 'react';
import { ArrowLeft, RefreshCw, Save, CheckCircle2 } from 'lucide-react';
import QRCode from 'qrcode';
import { API_BASE, apiFetch } from '../../store/serverDataBase/apiBridge';

interface ResetOtpProps {
    token: string | null;
    onBack: () => void;
}

export function ResetOtp({ token, onBack }: ResetOtpProps) {
    const [loadingInfo, setLoadingInfo] = useState(true);
    const [valid, setValid] = useState(false);
    const [owner, setOwner] = useState<any>(null);
    const [infoError, setInfoError] = useState('');

    const [secret, setSecret] = useState('');
    const [qrCodeUrl, setQrCodeUrl] = useState('');
    const [otpToken, setOtpToken] = useState('');
    const [otpError, setOtpError] = useState('');
    const [verifying, setVerifying] = useState(false);
    const [success, setSuccess] = useState(false);

    // Validate reset token on mount
    useEffect(() => {
        const validateToken = async () => {
            if (!token) {
                setInfoError('No security reset token was provided.');
                setLoadingInfo(false);
                return;
            }
            try {
                const res = await apiFetch(`${API_BASE}/otp/reset-info?token=${encodeURIComponent(token)}`);
                const data = await res.json();
                if (!res.ok || data.error) {
                    throw new Error(data.error || 'Failed to validate reset link.');
                }
                setOwner(data.owner);
                setValid(true);

                // Instantly generate OTP secret and QR code for this owner
                const host = window.location.host;
                const setupRes = await apiFetch(`${API_BASE}/otp/setup?username=${encodeURIComponent(data.owner.username)}&host=${encodeURIComponent(host)}`);
                if (!setupRes.ok) {
                    const setupData = await setupRes.json().catch(() => ({}));
                    throw new Error(setupData.error || 'Failed to generate OTP setup.');
                }
                const setupData = await setupRes.json();

                const qrCodeDataUrl = await QRCode.toDataURL(setupData.otpauthUrl, {
                    margin: 2,
                    width: 200,
                    errorCorrectionLevel: 'M'
                });

                setSecret(setupData.secret);
                setQrCodeUrl(qrCodeDataUrl);
            } catch (err: any) {
                setInfoError(err.message || 'Reset link is invalid or has expired.');
            } finally {
                setLoadingInfo(false);
            }
        };

        validateToken();
    }, [token]);

    const handleResetConfirmSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setOtpError('');
        setVerifying(true);
        try {
            const res = await apiFetch(`${API_BASE}/otp/reset-confirm`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, secret, code: otpToken })
            });
            const data = await res.json();
            if (!res.ok || data.error) {
                throw new Error(data.error || 'Failed to verify verification code.');
            }
            setSuccess(true);
        } catch (err: any) {
            setOtpError(err.message || 'OTP verification failed.');
        } finally {
            setVerifying(false);
        }
    };

    if (loadingInfo) {
        return (
            <div className="add-page-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px' }}>
                <RefreshCw className="animate-spin" size={32} color="var(--accent)" />
                <p style={{ marginTop: '16px', color: 'var(--text-muted)' }}>Validating security token...</p>
            </div>
        );
    }

    if (!valid || infoError) {
        return (
            <div className="add-page-container" style={{ textAlign: 'center', padding: '40px 24px' }}>
                <header className="add-page-header">
                    <button onClick={onBack} className="back-button">
                        <ArrowLeft size={20} />
                    </button>
                    <h2>Reset OTP Authenticator</h2>
                </header>
                <div style={{ color: '#ef4444', padding: '20px', background: 'rgba(239, 68, 68, 0.05)', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.2)', maxWidth: '400px', margin: '40px auto 20px' }}>
                    <p style={{ fontWeight: 'bold', margin: '0 0 10px 0' }}>Security Reset Error</p>
                    <p style={{ margin: 0, fontSize: '0.9rem' }}>{infoError || 'This link has expired or is invalid.'}</p>
                </div>
                <button onClick={onBack} className="secondary-button" style={{ display: 'inline-flex', margin: '20px auto 0' }}>
                    Go to Projects
                </button>
            </div>
        );
    }

    if (success) {
        return (
            <div className="add-page-container" style={{ textAlign: 'center', padding: '40px 24px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', maxWidth: '400px', margin: '60px auto' }}>
                    <CheckCircle2 size={48} color="#10b981" style={{ marginBottom: '20px' }} />
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text)', marginBottom: '12px' }}>Reset Successful</h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', lineHeight: 1.5, marginBottom: '24px' }}>
                        Your OTP authenticator has been successfully updated for account <strong style={{ color: 'var(--text)' }}>{owner?.name}</strong>. You can now use your new authenticator code to log in.
                    </p>
                    <button onClick={onBack} className="submit-button" style={{ display: 'inline-flex', margin: 0, padding: '10px 24px' }}>
                        Go to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="add-page-container">
            <header className="add-page-header">
                <button onClick={onBack} className="back-button">
                    <ArrowLeft size={20} />
                </button>
                <h2>OTP Security Reset</h2>
            </header>

            {otpError && (
                <div style={{ color: '#ef4444', margin: '0 24px 16px 24px', padding: '12px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.3)', fontSize: '0.9rem' }}>
                    {otpError}
                </div>
            )}

            <form onSubmit={handleResetConfirmSubmit} className="add-form" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                <div style={{ marginBottom: '20px', padding: '0 10px' }}>
                    <p style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text)', margin: '0 0 4px 0' }}>
                        Resetting Authenticator for {owner?.name}
                    </p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
                        @{owner?.username}
                    </p>
                </div>

                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '20px', padding: '0 10px', lineHeight: 1.4 }}>
                    Scan the QR Code below in your Google Authenticator or Authy app, then enter the new 6-digit verification code.
                </p>

                <div style={{ backgroundColor: '#fff', padding: '12px', borderRadius: '12px', marginBottom: '16px', display: 'inline-block' }}>
                    {qrCodeUrl && <img src={qrCodeUrl} alt="OTP Authenticator QR Code" style={{ display: 'block', width: '180px', height: '180px' }} />}
                </div>

                <div style={{ marginBottom: '24px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Manual secret key: <code style={{ color: 'var(--accent)', fontWeight: 'bold', fontSize: '0.95rem' }}>{secret}</code>
                </div>

                <div className="form-group" style={{ width: '100%', maxWidth: '280px', textAlign: 'left' }}>
                    <label htmlFor="otp-token" style={{ textAlign: 'center', display: 'block', width: '100%', marginBottom: '8px' }}>New Verification Code</label>
                    <input 
                        id="otp-token"
                        type="text" 
                        value={otpToken} 
                        onChange={(e) => setOtpToken(e.target.value.replace(/\D/g, ''))} 
                        placeholder="e.g. 123456"
                        maxLength={6}
                        pattern="[0-9]{6}"
                        required 
                        autoFocus
                        style={{ textAlign: 'center', fontSize: '1.25rem', letterSpacing: '2px', fontWeight: 'bold' }}
                    />
                </div>

                <button type="submit" className="submit-button" disabled={verifying} style={{ width: '100%', maxWidth: '280px', marginTop: '16px', justifyContent: 'center', margin: '16px 0 0 0' }}>
                    {verifying ? (
                        <>
                            <RefreshCw size={18} className="animate-spin" style={{ marginRight: '6px' }} />
                            <span>Verifying...</span>
                        </>
                    ) : (
                        <>
                            <Save size={18} />
                            <span>Confirm & Reset OTP</span>
                        </>
                    )}
                </button>
            </form>
        </div>
    );
}
