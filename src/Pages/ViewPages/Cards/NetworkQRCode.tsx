import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { COLORS } from '../../../store/storeStyles';
import { useStore } from '../../../store/useStore';
import { usePcbStore } from '../../../store/storePcb';
import { Popup } from '../../../components/Popup';

export function NetworkQRCode() {
    const [qrDataUrl, setQrDataUrl] = useState<string>('');
    const [qrInfo, setQrInfo] = useState<{ version: number, size: number } | null>(null);
    const { qrModalBoard, setQrModalBoard } = useStore();
    const pcbs = usePcbStore(state => state.pcbs);
    const [useShortUrl, setUseShortUrl] = useState(false);
    
    let url = '';
    let displayDomain = '';
    let displayPath = '';

    const pcb = pcbs.find(p => p.board_number === qrModalBoard);
    const hasShortCode = pcb && pcb.short_code;
    const actualUseShortUrl = useShortUrl && hasShortCode;

    if (qrModalBoard) {
        if (typeof window !== 'undefined' && window.location.hostname.includes('github.io')) {
            const base = import.meta.env.BASE_URL || '/';
            const cleanBase = base.endsWith('/') ? base : base + '/';
            displayDomain = window.location.origin;
            displayPath = actualUseShortUrl 
                ? `/${cleanBase}${pcb.short_code}`.replace(/\/\//g, '/')
                : `/${cleanBase}pcbs/${encodeURIComponent(qrModalBoard)}/view`.replace(/\/\//g, '/');
            url = displayDomain + displayPath;
        } else {
            const localIp = typeof __LOCAL_IP__ !== 'undefined' ? __LOCAL_IP__ : window.location.hostname;
            const port = typeof __PORT__ !== 'undefined' ? __PORT__ : window.location.port;
            const portSuffix = port ? `:${port}` : '';
            displayDomain = `http://${localIp}${portSuffix}`;
            displayPath = actualUseShortUrl ? `/${pcb.short_code}` : `/pcbs/${encodeURIComponent(qrModalBoard)}/view`;
            url = displayDomain + displayPath;
        }
    }

    useEffect(() => {
        if (!url) return;
        const generateQR = async () => {
            try {
                const info = QRCode.create(url, { errorCorrectionLevel: 'L' });
                setQrInfo({ version: info.version, size: info.modules.size });

                const dataUrl = await QRCode.toDataURL(url, {
                    margin: 2,
                    width: 400, // Generate high resolution
                    errorCorrectionLevel: 'L', // Lowest error correction for simplest look
                    color: {
                        dark: '#000000',
                        light: '#ffffff'
                    }
                });
                setQrDataUrl(dataUrl);
            } catch (err) {
                console.error('Failed to generate QR code:', err);
            }
        };

        generateQR();
    }, [url]);

    if (!qrModalBoard) {
        return null;
    }

    return (
        <Popup 
            isOpen={!!qrModalBoard} 
            onClose={() => setQrModalBoard(null)} 
            title="PCB Board Identity"
            maxWidth="380px"
        >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                <div style={{ 
                    backgroundColor: '#fff', 
                    padding: '16px', 
                    borderRadius: '12px',
                    marginBottom: '20px'
                }}>
                    {qrDataUrl && <img 
                        src={qrDataUrl} 
                        alt="PCB QR Code" 
                        title={qrInfo ? `QR Version: ${qrInfo.version} (${qrInfo.size}x${qrInfo.size} modules)` : undefined}
                        style={{ display: 'block', width: '250px', height: '250px' }} 
                    />}
                </div>
                
                {hasShortCode && (
                    <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        <span>Full URL</span>
                        <div 
                            style={{ 
                                width: '40px', height: '20px', borderRadius: '10px', 
                                background: useShortUrl ? 'var(--accent)' : 'rgba(255,255,255,0.2)', 
                                position: 'relative', cursor: 'pointer', transition: 'all 0.2s' 
                            }}
                            onClick={() => setUseShortUrl(!useShortUrl)}
                        >
                            <div style={{ 
                                width: '16px', height: '16px', borderRadius: '50%', background: '#fff', 
                                position: 'absolute', top: '2px', left: useShortUrl ? '22px' : '2px', 
                                transition: 'all 0.2s' 
                            }} />
                        </div>
                        <span style={{ color: useShortUrl ? 'var(--accent)' : 'inherit' }}>Short URL</span>
                    </div>
                )}
                
                <div style={{ textAlign: 'center', width: '100%' }}>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent)', marginBottom: '8px' }}>{qrModalBoard}</div>
                    <a 
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ 
                            display: 'block', 
                            fontSize: '0.8rem', 
                            color: 'var(--text-muted)', 
                            background: 'rgba(0,0,0,0.2)', 
                            padding: '12px 8px',
                            borderRadius: '8px',
                            lineHeight: '1.4',
                            textDecoration: 'none',
                            border: '1px solid rgba(255, 255, 255, 0.05)',
                            transition: 'all 0.2s ease',
                            cursor: 'pointer',
                            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(99, 102, 241, 0.15)';
                            e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.3)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(0,0,0,0.2)';
                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.05)';
                        }}
                    >
                        <div style={{ wordBreak: 'break-all' }}>{displayDomain}</div>
                        <div style={{ color: 'var(--accent)', fontWeight: 'bold', fontSize: '0.9rem', marginTop: '2px', textDecoration: 'underline text-underline-offset-2' }}>{displayPath}</div>
                        <div style={{ marginTop: '6px', fontSize: '0.7rem', color: COLORS.purple, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            Click to Open PCB Page
                        </div>
                    </a>
                </div>
            </div>
        </Popup>
    );
}
