import { COLORS } from '../store/storeStyles';

export function BoardName({ name, isHex }: { name: string; isHex?: boolean }) {
    if (!name) return null;
    
    // If it's a hex number, there is no CRC, so just return the raw string
    if (isHex) return <span>{name}</span>;
    
    // Check if it follows our strict format: 3 letters, hyphen, 4 numbers, 1 letter (CRC)
    // E.g. MAP-0001K
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
                        <span style={{ color: COLORS.purple, fontWeight: 'bold' }}>
                            {crc}
                        </span>
                    </span>
                );
            }
        }
    }
    
    // Fallback if it doesn't match the new CRC format
    return <span>{name}</span>;
}
