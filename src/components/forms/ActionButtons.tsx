import React from 'react';
import { Plus, Edit2, ExternalLink, QrCode, Trash2 } from 'lucide-react';

interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    label?: React.ReactNode;
    icon?: React.ElementType | React.ReactNode;
}

const renderIcon = (icon: unknown) => {
    if (!icon) return null;
    if (React.isValidElement(icon)) return icon;
    if (typeof icon === 'function' || typeof icon === 'object') {
        const IconComponent = icon as React.ElementType;
        return <IconComponent size={18} />;
    }
    return null;
};

export function EditButton({ label = "Edit", icon = Edit2, style, ...props }: ActionButtonProps) {
    return (
        <button 
            style={{ 
                flex: 1,
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                gap: '8px', 
                background: 'transparent', 
                color: '#fbbf24', 
                border: '1px solid rgba(245, 158, 11, 0.5)', 
                padding: '10px 16px', 
                borderRadius: '8px', 
                fontSize: '0.9rem', 
                fontWeight: 600, 
                cursor: 'pointer',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                ...style 
            }}
            {...props}
            className={`action-btn-hover action-btn-edit ${props.className || ''}`}
        >
            {renderIcon(icon)}
            {label}
        </button>
    );
}

export function ViewButton({ label = "View", icon = ExternalLink, style, ...props }: ActionButtonProps) {
    return (
        <button 
            style={{ 
                flex: 1,
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                gap: '8px', 
                background: 'transparent', 
                color: 'var(--accent)', 
                border: '1px solid var(--accent)', 
                padding: '10px 16px', 
                borderRadius: '8px', 
                fontSize: '0.9rem', 
                fontWeight: 600, 
                cursor: 'pointer',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                ...style 
            }}
            {...props}
            className={`action-btn-hover action-btn-view ${props.className || ''}`}
        >
            {renderIcon(icon)}
            {label}
        </button>
    );
}

export function AddButton({ label = "Add", icon = Plus, style, ...props }: ActionButtonProps) {
    return (
        <button 
            style={{ 
                flex: 1,
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                gap: '8px', 
                background: 'rgba(99, 102, 241, 0.15)', 
                color: '#818cf8', 
                border: '1px solid rgba(99, 102, 241, 0.5)', 
                padding: '10px 16px', 
                borderRadius: '8px', 
                fontSize: '0.9rem', 
                fontWeight: 600, 
                cursor: 'pointer',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                ...style 
            }}
            {...props}
            className={`action-btn-hover action-btn-add ${props.className || ''}`}
        >
            {renderIcon(icon)}
            {label}
        </button>
    );
}

export function QrButton({ label = "QR Code", icon = QrCode, style, ...props }: ActionButtonProps) {
    return (
        <button 
            style={{ 
                flex: 1,
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                gap: '8px', 
                background: 'transparent', 
                color: 'var(--text)', 
                border: '1px solid var(--border-color, var(--border))', 
                padding: '10px 16px', 
                borderRadius: '8px', 
                fontSize: '0.9rem', 
                fontWeight: 600, 
                cursor: 'pointer',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                ...style 
            }}
            {...props}
            className={`action-btn-hover action-btn-neutral ${props.className || ''}`}
        >
            {renderIcon(icon)}
            {label}
        </button>
    );
}

export function DeleteButton({ label = "Delete", icon = Trash2, style, ...props }: ActionButtonProps) {
    return (
        <button 
            style={{ 
                flex: 1,
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                gap: '8px', 
                background: 'transparent', 
                color: '#ef4444', 
                border: '1px solid rgba(239, 68, 68, 0.5)', 
                padding: '10px 16px', 
                borderRadius: '8px', 
                fontSize: '0.9rem', 
                fontWeight: 600, 
                cursor: 'pointer',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                ...style 
            }}
            {...props}
            className={`action-btn-hover action-btn-delete ${props.className || ''}`}
        >
            {renderIcon(icon)}
            {label}
        </button>
    );
}
