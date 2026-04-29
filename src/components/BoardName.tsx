export function BoardName({ name }: { name: string }) {
    if (!name) return null;
    
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
                
                // If it is a hex number, avoid coloring the CRC purple to prevent visual confusion
                const isHex = base.includes('0x') || base.includes('0X');
                
                return (
                    <span>
                        {base}
                        {isHex ? (
                            <span>{crc}</span>
                        ) : (
                            <span style={{ color: '#a855f7', fontWeight: 'bold' }}>
                                {crc}
                            </span>
                        )}
                    </span>
                );
            }
        }
    }
    
    // Fallback if it doesn't match the new CRC format
    return <span>{name}</span>;
}
