import { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { API_BASE } from '../../../store/database/apiBridge';

interface PictureCardProps {
    images: string[];
    title: string;
    onClose: () => void;
}

export function PictureCard({ images, title, onClose }: PictureCardProps) {
    const [currentIndex, setCurrentIndex] = useState(0);

    // Prevent body scroll when modal is open
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = 'auto'; };
    }, []);

    if (!images || images.length === 0) return null;

    const handleNext = (e: React.MouseEvent) => {
        e.stopPropagation();
        setCurrentIndex((prev) => (prev + 1) % images.length);
    };

    const handlePrev = (e: React.MouseEvent) => {
        e.stopPropagation();
        setCurrentIndex((prev) => (prev - 1 + images.length) % images.length);
    };

    return (
        <div 
            style={{
                position: 'fixed',
                top: 0, left: 0, right: 0, bottom: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.75)',
                backdropFilter: 'blur(8px)',
                zIndex: 9999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '24px',
                animation: 'fadeIn 0.2s ease-out'
            }}
            onClick={onClose}
        >
            {/* Modal Card */}
            <div 
                style={{
                    backgroundColor: 'var(--bg)',
                    borderRadius: '16px',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                    width: '90%',
                    maxWidth: '800px',
                    height: '90vh',
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    border: '1px solid var(--border)'
                }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid var(--border)', backgroundColor: 'var(--card-bg)' }}>
                    <h3 style={{ margin: 0, color: 'var(--text)', fontSize: '1.2rem', fontWeight: 600 }}>{title} Evidence</h3>
                    <button onClick={onClose} style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text-muted)', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                        <X size={18} />
                    </button>
                </div>

                {/* Body Centerpiece */}
                <div style={{ flex: 1, minHeight: 0, padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', position: 'relative' }}>
                    
                    {images.length > 1 && (
                        <button 
                            onClick={handlePrev} 
                            style={{ position: 'absolute', left: '24px', top: '50%', transform: 'translateY(-50%)', background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: '50%', padding: '10px', cursor: 'pointer', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            title="Previous Image"
                        >
                            <ChevronLeft size={24} />
                        </button>
                    )}

                    <div style={{ flex: 1, minHeight: 0, width: '100%', background: 'var(--bg)', borderRadius: '12px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                        <img 
                            src={`${API_BASE.replace('/api', '')}/api${images[currentIndex]}`} 
                            alt={`Evidence ${currentIndex + 1}`} 
                            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '12px', backgroundColor: '#000' }}
                            onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                e.currentTarget.parentElement!.innerHTML = '<div style="color:var(--text-muted);display:flex;flex-direction:column;align-items:center;gap:8px;"><svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg><span>Image Not Found</span></div>';
                            }}
                        />
                    </div>

                    <div style={{ textAlign: 'center', maxWidth: '350px' }}>
                        <div style={{ fontSize: '1.6rem', fontWeight: 900, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '3px' }}>
                            REWORK
                        </div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontFamily: 'monospace', marginTop: '12px', wordBreak: 'break-all', padding: '8px 12px', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '8px' }}>
                            {images[currentIndex]}
                        </div>
                    </div>

                    {images.length > 1 && (
                        <button 
                            onClick={handleNext} 
                            style={{ position: 'absolute', right: '24px', top: '50%', transform: 'translateY(-50%)', background: 'var(--card-bg)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: '50%', padding: '10px', cursor: 'pointer', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            title="Next Image"
                        >
                            <ChevronRight size={24} />
                        </button>
                    )}
                </div>

                {/* Thumbnails Footer */}
                {images.length > 1 && (
                    <div style={{ padding: '16px 24px', display: 'flex', justifyContent: 'center', gap: '16px', background: 'var(--card-bg)', borderTop: '1px solid var(--border)' }}>
                        {images.map((img, idx) => (
                            <div
                                key={idx}
                                onClick={(e) => { e.stopPropagation(); setCurrentIndex(idx); }}
                                style={{ 
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    transform: currentIndex === idx ? 'scale(1.1)' : 'scale(1)',
                                    filter: currentIndex === idx ? 'none' : 'grayscale(100%) opacity(40%)',
                                    borderRadius: '8px',
                                    border: currentIndex === idx ? '2px solid var(--accent)' : '2px solid transparent',
                                    boxShadow: currentIndex === idx ? '0 4px 12px rgba(99, 102, 241, 0.3)' : 'none'
                                }}
                            >
                                <div style={{ width: '54px', height: '54px', overflow: 'hidden', borderRadius: '6px' }}>
                                    <img 
                                        src={`${API_BASE.replace('/api', '')}/api${img}`} 
                                        alt={`Thumb ${idx + 1}`} 
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        onError={(e) => {
                                            e.currentTarget.style.display = 'none';
                                            e.currentTarget.parentElement!.innerHTML = '<div style="width:100%;height:100%;background:var(--card-bg);display:flex;align-items:center;justify-content:center;color:var(--text-muted)"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg></div>';
                                        }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
