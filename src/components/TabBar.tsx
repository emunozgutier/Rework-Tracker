import { CircuitBoard, ClipboardList, PenTool, Hash, Users, ShieldCheck, Settings, Lock } from 'lucide-react';
import { useAppState } from '../store/useAppState';
import { useGlobalSettings } from '../store/useGlobalSettings';
import './topTab.css';

export function TabBar() {
    const { activeTab, setActiveTab } = useAppState();
    const { hasPermission } = useGlobalSettings();
    
    const tabs = [
        { id: 'projects', label: 'Projects', icon: ClipboardList },
        { id: 'pcbs', label: 'PCBs', icon: CircuitBoard },
        { id: 'reworks', label: 'Reworks', icon: PenTool },
        { id: 'owners', label: 'Owners', icon: Users },
        { id: 'tags', label: 'Tags', icon: Hash },
        { id: 'sandbox', label: 'CRC', icon: ShieldCheck },
        { id: 'settings', label: 'Settings', icon: Settings }
    ];

    return (
        <div className="tab-bar">
            {tabs.map((tab) => {
                const isPermitted = hasPermission(tab.id as any, 'view');
                const IconComponent = isPermitted ? tab.icon : Lock;
                return (
                    <button
                        key={tab.id}
                        className={`tab-item ${activeTab === tab.id ? 'active' : ''} ${!isPermitted ? 'locked' : ''}`}
                        onClick={() => setActiveTab(tab.id)}
                        style={!isPermitted ? { opacity: 0.65 } : undefined}
                    >
                        <IconComponent size={20} style={!isPermitted ? { color: 'var(--text-muted)' } : undefined} />
                        <span className="tab-label">{tab.label}</span>
                    </button>
                );
            })}
        </div>
    );
}
