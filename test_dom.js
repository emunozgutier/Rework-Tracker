const board_number = "MAP-0xFA01F";
const parts = board_number.split('-');
const lastPart = parts[parts.length - 1];
const crc = lastPart.slice(-1);
const base = board_number.slice(0, -1);
console.log("Base:", base, "CRC:", crc);
