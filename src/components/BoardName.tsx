import { COLORS } from '../store/useStyles';
import { useGlobalSettings } from '../store/useGlobalSettings';
import { formatCrc } from './UrlManager/crc';
import './BoardName.css';

export function BoardName({ name, isHex, crcColor = COLORS.purple }: { name: string; isHex?: boolean; crcColor?: string }) {
    const { crcFormat } = useGlobalSettings();

    if (!name) return null;
    
    // If it's a hex number, there is no CRC, so just return the raw string
    if (isHex) return <span>{name}</span>;
    
    // Check if it follows our strict format: e.g. MAP-0001K
    if (name.length > 5 && name.includes('-')) {
        const parts = name.split('-');
        if (parts.length >= 2) {
            const lastPart = parts[parts.length - 1];
            // If the last part has an attached CRC letter, e.g. "0001K"
            if (lastPart.length > 1 && /^[a-zA-Z]$/.test(lastPart.slice(-1))) {
                const crc = lastPart.slice(-1);
                const base = name.slice(0, -1);
                
                return (
                    <span>
                        {base}
                        <span style={{ color: crcColor, fontWeight: 'bold' }}>
                            {formatCrc(crc, crcFormat)}
                        </span>
                    </span>
                );
            }
        }
    }
    
    // Fallback if it doesn't match the CRC format
    return <span>{name}</span>;
}
