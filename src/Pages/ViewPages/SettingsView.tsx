import { Check, Radio } from 'lucide-react';
import { useGlobalSettings } from '../../store/useGlobalSettings';
import { getNatoWord } from '../../components/UrlManager/crc';
import './SettingsView.css';

export function SettingsView() {
    const { crcFormat, setCrcFormat } = useGlobalSettings();

    const sampleBase = 'VTT-0042';
    const sampleLetter = 'G';
    const sampleNato = getNatoWord(sampleLetter); // 'Golf'

    return (
        <div className="settings-page-wrapper">
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
