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

