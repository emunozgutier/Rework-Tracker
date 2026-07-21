import { CircuitBoard, ClipboardList, PenTool, Hash, Users, ShieldCheck, Settings } from 'lucide-react';
import { useAppState } from '../store/useAppState';
import './topTab.css';

export function TabBar() {
    const { activeTab, setActiveTab } = useAppState();
    
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
            {tabs.map((tab) => (
                <button
                    key={tab.id}
                    className={`tab-item ${activeTab === tab.id ? 'active' : ''}`}
                    onClick={() => setActiveTab(tab.id)}
                >
                    <tab.icon size={20} />
                    <span className="tab-label">{tab.label}</span>
                </button>
            ))}
        </div>
    );
}
