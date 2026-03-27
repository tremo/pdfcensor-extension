import type { PIIMatch } from "../types";

/**
 * Indian Aadhaar Number — 12 digits with Verhoeff checksum.
 * Format: XXXX XXXX XXXX (first digit 2-9).
 */
export function detectAadhaar(text: string, pageIndex: number): PIIMatch[] {
  const matches: PIIMatch[] = [];
  const regex = /\b([2-9]\d{3}[\s-]?\d{4}[\s-]?\d{4})\b/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const cleaned = match[1].replace(/[\s-]/g, "");
    if (cleaned.length !== 12) continue;
    if (validateVerhoeff(cleaned)) {
      matches.push({
        type: "inAadhaar",
        value: match[1],
        startIndex: match.index,
        endIndex: match.index + match[0].length,
        pageIndex,
        confidence: 0.85,
      });
    }
  }
  return matches;
}

// Verhoeff checksum tables
const verhoeffD = [
  [0,1,2,3,4,5,6,7,8,9],[1,2,3,4,0,6,7,8,9,5],[2,3,4,0,1,7,8,9,5,6],
  [3,4,0,1,2,8,9,5,6,7],[4,0,1,2,3,9,5,6,7,8],[5,9,8,7,6,0,4,3,2,1],
  [6,5,9,8,7,1,0,4,3,2],[7,6,5,9,8,2,1,0,4,3],[8,7,6,5,9,3,2,1,0,4],
  [9,8,7,6,5,4,3,2,1,0],
];
const verhoeffP = [
  [0,1,2,3,4,5,6,7,8,9],[1,5,7,6,2,8,3,0,9,4],[5,8,0,3,7,9,6,1,4,2],
  [8,9,1,6,0,4,3,5,2,7],[9,4,5,3,1,2,6,8,7,0],[4,2,8,6,5,7,3,9,0,1],
  [2,7,9,3,8,0,6,4,1,5],[7,0,4,6,9,1,3,2,5,8],
];
const verhoeffInv = [0,4,3,2,1,5,6,7,8,9];

function validateVerhoeff(num: string): boolean {
  let c = 0;
  const digits = num.split("").reverse().map(Number);
  for (let i = 0; i < digits.length; i++) {
    c = verhoeffD[c][verhoeffP[i % 8][digits[i]]];
  }
  return c === 0;
}

/**
 * Indian PAN (Permanent Account Number) — 10 alphanumeric.
 * Format: AAAAA9999A — 5 letters + 4 digits + 1 letter.
 * 4th character indicates holder type (P=person, C=company, etc.)
 */
export function detectINPAN(text: string, pageIndex: number): PIIMatch[] {
  const matches: PIIMatch[] = [];
  const regex = /\b([A-Z]{5}\d{4}[A-Z])\b/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    // 4th char must be a valid type: A,B,C,F,G,H,J,L,P,T
    const typeChar = match[1][3];
    if ("ABCFGHJLPT".includes(typeChar)) {
      matches.push({
        type: "inPAN",
        value: match[1],
        startIndex: match.index,
        endIndex: match.index + match[1].length,
        pageIndex,
        confidence: 0.85,
      });
    }
  }
  return matches;
}

/**
 * South Korean Resident Registration Number (RRN) — 13 digits.
 * Format: YYMMDD-NNNNNNN (6 birth digits + 7 serial digits).
 * 7th digit indicates sex/century: 1/2 (1900s), 3/4 (2000s).
 */
export function detectKRRRN(text: string, pageIndex: number): PIIMatch[] {
  const matches: PIIMatch[] = [];
  const regex = /\b(\d{6}[-]\d{7})\b/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const cleaned = match[1].replace(/-/g, "");
    if (cleaned.length !== 13) continue;
    const sexDigit = parseInt(cleaned[6], 10);
    if (sexDigit < 1 || sexDigit > 4) continue;
    if (validateRRNChecksum(cleaned)) {
      matches.push({
        type: "krRRN",
        value: match[1],
        startIndex: match.index,
        endIndex: match.index + match[0].length,
        pageIndex,
        confidence: 0.9,
      });
    }
  }
  return matches;
}

function validateRRNChecksum(digits: string): boolean {
  const weights = [2, 3, 4, 5, 6, 7, 8, 9, 2, 3, 4, 5];
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(digits[i], 10) * weights[i];
  }
  const check = (11 - (sum % 11)) % 10;
  return check === parseInt(digits[12], 10);
}

/**
 * Japanese My Number (Individual Number) — 12 digits with check digit.
 */
export function detectJPMyNumber(text: string, pageIndex: number): PIIMatch[] {
  const matches: PIIMatch[] = [];
  const regex = /\b(\d{4}[\s-]?\d{4}[\s-]?\d{4})\b/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const cleaned = match[1].replace(/[\s-]/g, "");
    if (cleaned.length !== 12) continue;
    if (validateMyNumber(cleaned)) {
      matches.push({
        type: "jpMyNumber",
        value: match[1],
        startIndex: match.index,
        endIndex: match.index + match[0].length,
        pageIndex,
        confidence: 0.8,
      });
    }
  }
  return matches;
}

function validateMyNumber(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < 11; i++) {
    const q = 11 - i;
    const weight = q <= 6 ? q + 1 : q - 5;
    sum += parseInt(digits[i], 10) * weight;
  }
  const remainder = sum % 11;
  const check = remainder <= 1 ? 0 : 11 - remainder;
  return check === parseInt(digits[11], 10);
}
