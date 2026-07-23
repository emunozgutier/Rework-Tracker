import { Check, Radio, Shield, Key, Eye, Plus, Edit2, Trash2 } from 'lucide-react';
import { useGlobalSettings } from '../../store/useGlobalSettings';
import type { UserRole, PageName, PagePermissions } from '../../store/useGlobalSettings';
import { getNatoWord } from '../../components/UrlManager/crc';
import './SettingsView.css';
import { useState } from 'react';

export function SettingsView() {
    const { crcFormat, setCrcFormat, activeRole, setActiveRole, permissions, togglePermission } = useGlobalSettings();
    const [selectedRoleTab, setSelectedRoleTab] = useState<UserRole>(activeRole);

    const sampleBase = 'VTT-0042';
    const sampleLetter = 'G';
    const sampleNato = getNatoWord(sampleLetter); // 'Golf'

    const handleRoleTabClick = (role: UserRole) => {
        setSelectedRoleTab(role);
        setActiveRole(role); // Auto-simulate active role
    };

    const pagesList: { name: PageName; label: string }[] = [
        { name: 'projects', label: 'Projects' },
        { name: 'pcbs', label: 'PCBs' },
        { name: 'reworks', label: 'Reworks' },
        { name: 'owners', label: 'Owners/Users' },
        { name: 'tags', label: 'Tags' },
        { name: 'sandbox', label: 'CRC (Always Open)' },
        { name: 'settings', label: 'Settings' }
    ];

    const rightsList: { key: keyof PagePermissions; label: string; icon: any }[] = [
        { key: 'view', label: 'View', icon: Eye },
        { key: 'create', label: 'Create', icon: Plus },
        { key: 'edit', label: 'Edit', icon: Edit2 },
        { key: 'delete', label: 'Delete', icon: Trash2 }
    ];

    return (
        <div className="settings-page-wrapper">
            {/* Active Role Simulation Bar */}
            <div className="settings-main-card active-role-card" style={{ marginBottom: '24px', background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(168, 85, 247, 0.08) 100%)', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ background: 'var(--accent)', color: 'white', borderRadius: '8px', padding: '8px' }}>
                            <Shield size={20} />
                        </div>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text)' }}>
                                RBAC Simulation Mode
                            </h3>
                            <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                Toggling roles instantly changes permissions across all views.
                            </p>
                        </div>
                    </div>
                    
                    <div className="settings-role-tabs">
                        {(['superuser', 'user', 'guest'] as UserRole[]).map((role) => (
                            <button
                                key={role}
                                className={`role-tab-btn ${activeRole === role ? 'active' : ''} ${role}`}
                                onClick={() => handleRoleTabClick(role)}
                            >
                                <span className="role-dot" />
                                {role === 'superuser' ? '✦ ' : ''}
                                {role.toUpperCase()}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Rights Table Card */}
            <div className="settings-main-card" style={{ marginBottom: '24px' }}>
                <div className="settings-card-label">
                    <Key size={18} color="var(--accent)" />
                    <span>Role Access Rights Matrix ({selectedRoleTab.charAt(0).toUpperCase() + selectedRoleTab.slice(1)})</span>
                </div>
                
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '-10px 0 20px 0', lineHeight: '1.4' }}>
                    Customize which pages and actions are available for the <strong>{selectedRoleTab}</strong> role. CRC actions are open for everyone.
                </p>

                <div className="permissions-table-container">
                    <table className="permissions-table">
                        <thead>
                            <tr>
                                <th>Page / Feature</th>
                                {rightsList.map((right) => (
                                    <th key={right.key} style={{ textAlign: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                            <right.icon size={14} />
                                            <span>{right.label}</span>
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {pagesList.map((page) => {
                                const isCrc = page.name === 'sandbox';
                                return (
                                    <tr key={page.name} className={isCrc ? 'crc-row' : ''}>
                                        <td style={{ fontWeight: 600, color: 'var(--text-h)' }}>
                                            {page.label}
                                        </td>
                                        {rightsList.map((right) => {
                                            const hasRight = isCrc ? true : permissions[selectedRoleTab]?.[page.name]?.[right.key];
                                            const isDisabled = isCrc; // CRC is open for all and cannot be toggled

                                            return (
                                                <td key={right.key} style={{ textAlign: 'center' }}>
                                                    <span 
                                                        className={`perm-checkbox-label ${isDisabled ? 'disabled' : ''} ${hasRight ? 'checked' : ''}`}
                                                        onClick={() => !isDisabled && togglePermission(selectedRoleTab, page.name, right.key)}
                                                    >
                                                        <div className="perm-checkbox-box">
                                                            {hasRight && <Check size={14} strokeWidth={3} />}
                                                        </div>
                                                    </span>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Checksum format setting */}
            <div className="settings-main-card">
                <div className="settings-card-label">
                    <Radio size={18} color="var(--accent)" />
                    <span>CRC Checksum Display Mode</span>
                </div>

                <div className="settings-options-grid">
                    {/* Option 1: Single Letter */}
                    <div
                        className={`setting-choice-card ${crcFormat === 'letter' ? 'selected' : ''}`}
                        onClick={() => setCrcFormat('letter')}
                    >
                        <div className="choice-card-top">
                            <span className="choice-title">Single Letter</span>
                            <div className="choice-radio">
                                {crcFormat === 'letter' && <Check size={14} color="#ffffff" />}
                            </div>
                        </div>

                        <div className="choice-example-badge">
                            <span className="example-code">
                                {sampleBase}<span>{sampleLetter}</span>
                            </span>
                        </div>
                    </div>

                    {/* Option 2: NATO Phonetic Word */}
                    <div
                        className={`setting-choice-card ${crcFormat === 'nato' ? 'selected' : ''}`}
                        onClick={() => setCrcFormat('nato')}
                    >
                        <div className="choice-card-top">
                            <span className="choice-title">NATO Phonetic Word</span>
                            <div className="choice-radio">
                                {crcFormat === 'nato' && <Check size={14} color="#ffffff" />}
                            </div>
                        </div>

                        <div className="choice-example-badge">
                            <span className="example-tag">NATO:</span>
                            <span className="example-code">
                                {sampleBase}<span>{sampleNato}</span>
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
