// Removed numbers, visually ambiguous letters (O, I, L, Z), and hex characters (A-F)
const CHARSET = 'GHJKMNPQRSTUVWXY';

export function generateCRC(input: string): string {
    let sum = 0;
    for (let i = 0; i < input.length; i++) {
        const char = input[i].toUpperCase();
        sum += char.charCodeAt(0) * (i + 1);
    }
    return CHARSET[sum % CHARSET.length];
}

export const NATO_PHONETIC_MAP: Record<string, string> = {
    A: 'Alpha',
    B: 'Bravo',
    C: 'Charlie',
    D: 'Delta',
    E: 'Echo',
    F: 'Foxtrot',
    G: 'Golf',
    H: 'Hotel',
    I: 'India',
    J: 'Juliet',
    K: 'Kilo',
    L: 'Lima',
    M: 'Mike',
    N: 'November',
    O: 'Oscar',
    P: 'Papa',
    Q: 'Quebec',
    R: 'Romeo',
    S: 'Sierra',
    T: 'Tango',
    U: 'Uniform',
    V: 'Victor',
    W: 'Whiskey',
    X: 'X-ray',
    Y: 'Yankee',
    Z: 'Zulu',
};

export function getNatoWord(char: string): string {
    if (!char) return '';
    const upper = char.toUpperCase();
    return NATO_PHONETIC_MAP[upper] || upper;
}

export function formatCrc(crcChar: string, format: 'letter' | 'nato'): string {
    if (!crcChar) return '';
    if (format === 'nato') {
        return getNatoWord(crcChar);
    }
    return crcChar.toUpperCase();
}
