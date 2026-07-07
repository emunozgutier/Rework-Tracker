import { CircuitBoard, ClipboardList, PenTool, Hash, Users, ShieldCheck } from 'lucide-react';
import { useStore } from '../store/useStore';
import './topTab.css';

export function TabBar() {
    const { activeTab, setActiveTab } = useStore();
    
    const tabs = [
        { id: 'projects', label: 'Projects', icon: ClipboardList },
        { id: 'pcbs', label: 'PCBs', icon: CircuitBoard },
        { id: 'reworks', label: 'Reworks', icon: PenTool },
        { id: 'owners', label: 'Owners', icon: Users },
        { id: 'tags', label: 'Tags', icon: Hash },
        { id: 'sandbox', label: 'CRC', icon: ShieldCheck }
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
