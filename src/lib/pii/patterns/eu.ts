import type { PIIMatch } from "../types";

/**
 * UK NHS Number — 10 digits, often grouped as 3-3-4.
 * Validated with MOD 11 checksum.
 */
export function detectNHS(text: string, pageIndex: number): PIIMatch[] {
  const matches: PIIMatch[] = [];
  const regex = /\b(\d{3}[\s-]?\d{3}[\s-]?\d{4})\b/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const digits = match[1].replace(/[\s-]/g, "");
    if (digits.length !== 10) continue;
    if (validateNHSChecksum(digits)) {
      matches.push({
        type: "ukNHS",
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

function validateNHSChecksum(digits: string): boolean {
  const weights = [10, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(digits[i], 10) * weights[i];
  }
  const remainder = sum % 11;
  const check = 11 - remainder;
  if (check === 11) return parseInt(digits[9], 10) === 0;
  if (check === 10) return false; // invalid
  return parseInt(digits[9], 10) === check;
}

/**
 * UK National Insurance Number (NINO)
 * Format: AB 12 34 56 C — 2 letters, 6 digits, 1 letter (A-D)
 */
export function detectNINO(text: string, pageIndex: number): PIIMatch[] {
  const matches: PIIMatch[] = [];
  // Prefix letters exclude D, F, I, Q, U, V + BG, GB, NK, KN, TN, NT, ZZ
  const regex = /\b([A-CEGHJ-PR-TW-Z][A-CEGHJ-NPR-TW-Z][\s-]?\d{2}[\s-]?\d{2}[\s-]?\d{2}[\s-]?[A-D])\b/gi;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const cleaned = match[1].replace(/[\s-]/g, "").toUpperCase();
    const prefix = cleaned.slice(0, 2);
    if (["BG", "GB", "NK", "KN", "TN", "NT", "ZZ"].includes(prefix)) continue;
    matches.push({
      type: "ukNINO",
      value: match[1],
      startIndex: match.index,
      endIndex: match.index + match[0].length,
      pageIndex,
      confidence: 0.85,
    });
  }
  return matches;
}

/**
 * German Personalausweis (ID card) — 10-character alphanumeric
 * Format: LNNNNNNNNC (1 letter + 8 digits + 1 check digit)
 * Also detect new format: LLLLNNNNN + check
 */
export function detectDEPersonalausweis(text: string, pageIndex: number): PIIMatch[] {
  const matches: PIIMatch[] = [];
  const regex = /\b([A-Z][0-9A-Z]{8}[0-9])\b/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    matches.push({
      type: "dePersonalausweis",
      value: match[1],
      startIndex: match.index,
      endIndex: match.index + match[1].length,
      pageIndex,
      confidence: 0.6,
    });
  }
  return matches;
}

/**
 * German Steuerliche Identifikationsnummer (Steuer-ID)
 * 11 digits, first digit not 0, exactly one digit appears twice (or three times),
 * all others appear once.
 */
export function detectDESteuerID(text: string, pageIndex: number): PIIMatch[] {
  const matches: PIIMatch[] = [];
  const regex = /\b([1-9]\d{10})\b/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (validateSteuerID(match[1])) {
      matches.push({
        type: "deSteuerID",
        value: match[1],
        startIndex: match.index,
        endIndex: match.index + match[1].length,
        pageIndex,
        confidence: 0.7,
      });
    }
  }
  return matches;
}

function validateSteuerID(digits: string): boolean {
  // First 10 digits: exactly one digit appears 2 or 3 times, rest appear once
  const freq: Record<string, number> = {};
  for (let i = 0; i < 10; i++) {
    freq[digits[i]] = (freq[digits[i]] || 0) + 1;
  }
  const counts = Object.values(freq);
  const multiCount = counts.filter((c) => c >= 2);
  if (multiCount.length !== 1) return false;
  if (multiCount[0] > 3) return false;
  return true;
}

/**
 * French NIR (Numéro d'Inscription au Répertoire) — "numéro de sécurité sociale"
 * 15 digits: S AA MM DDD CCC OOO CC
 * S: sex (1/2), AA: year, MM: month, DDD: dept, CCC: commune, OOO: order, CC: check
 */
export function detectFRNIR(text: string, pageIndex: number): PIIMatch[] {
  const matches: PIIMatch[] = [];
  const regex = /\b([12]\s?\d{2}\s?\d{2}\s?\d{2,3}\s?\d{3}\s?\d{3}\s?\d{2})\b/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const cleaned = match[1].replace(/\s/g, "");
    if (cleaned.length === 15 && validateNIR(cleaned)) {
      matches.push({
        type: "frNIR",
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

function validateNIR(digits: string): boolean {
  const base = parseInt(digits.slice(0, 13), 10);
  const check = parseInt(digits.slice(13), 10);
  return (97 - (base % 97)) === check;
}

/**
 * Spanish NIF (Número de Identificación Fiscal)
 * Format: 8 digits + 1 letter (check). The letter is MOD 23 of the number.
 */
export function detectESNIF(text: string, pageIndex: number): PIIMatch[] {
  const matches: PIIMatch[] = [];
  const regex = /\b(\d{8}[A-Z])\b/g;
  const letters = "TRWAGMYFPDXBNJZSQVHLCKE";
  let match;
  while ((match = regex.exec(text)) !== null) {
    const num = parseInt(match[1].slice(0, 8), 10);
    const expectedLetter = letters[num % 23];
    if (match[1][8] === expectedLetter) {
      matches.push({
        type: "esNIF",
        value: match[1],
        startIndex: match.index,
        endIndex: match.index + match[1].length,
        pageIndex,
        confidence: 0.9,
      });
    }
  }
  return matches;
}

/**
 * Spanish DNI — same format as NIF but with contextual keyword
 * (NIF and DNI share format; we detect both under esNIF for dedup)
 */
export function detectESDNI(text: string, pageIndex: number): PIIMatch[] {
  const matches: PIIMatch[] = [];
  // NIE format: X/Y/Z + 7 digits + letter
  const regex = /\b([XYZ]\d{7}[A-Z])\b/g;
  const letters = "TRWAGMYFPDXBNJZSQVHLCKE";
  let match;
  while ((match = regex.exec(text)) !== null) {
    const prefix = match[1][0];
    const replaceMap: Record<string, string> = { X: "0", Y: "1", Z: "2" };
    const num = parseInt(replaceMap[prefix] + match[1].slice(1, 8), 10);
    const expectedLetter = letters[num % 23];
    if (match[1][8] === expectedLetter) {
      matches.push({
        type: "esDNI",
        value: match[1],
        startIndex: match.index,
        endIndex: match.index + match[1].length,
        pageIndex,
        confidence: 0.9,
      });
    }
  }
  return matches;
}

/**
 * Italian Codice Fiscale — 16 chars: 6 letters + 2 digits + 1 letter + 2 digits + 1 letter + 3 digits + 1 letter
 * Pattern: LLLLLL DD L DD L DDD L
 */
export function detectITCodiceFiscale(text: string, pageIndex: number): PIIMatch[] {
  const matches: PIIMatch[] = [];
  const regex = /\b([A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z])\b/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    matches.push({
      type: "itCodiceFiscale",
      value: match[1],
      startIndex: match.index,
      endIndex: match.index + match[1].length,
      pageIndex,
      confidence: 0.9,
    });
  }
  return matches;
}

/**
 * Dutch BSN (Burgerservicenummer) — 9 digits with 11-proof check.
 * The weighted sum (9*d1 + 8*d2 + ... + 2*d8 - 1*d9) must be divisible by 11.
 */
export function detectNLBSN(text: string, pageIndex: number): PIIMatch[] {
  const matches: PIIMatch[] = [];
  const regex = /\b(\d{9})\b/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (validateBSN(match[1])) {
      matches.push({
        type: "nlBSN",
        value: match[1],
        startIndex: match.index,
        endIndex: match.index + match[1].length,
        pageIndex,
        confidence: 0.7,
      });
    }
  }
  return matches;
}

function validateBSN(digits: string): boolean {
  const weights = [9, 8, 7, 6, 5, 4, 3, 2, -1];
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(digits[i], 10) * weights[i];
  }
  return sum % 11 === 0 && sum !== 0;
}

/**
 * Polish PESEL — 11 digits: YYMMDD + serial + sex + check.
 * Encodes date of birth, so we validate the date portion.
 */
export function detectPLPESEL(text: string, pageIndex: number): PIIMatch[] {
  const matches: PIIMatch[] = [];
  const regex = /\b(\d{11})\b/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (validatePESEL(match[1])) {
      matches.push({
        type: "plPESEL",
        value: match[1],
        startIndex: match.index,
        endIndex: match.index + match[1].length,
        pageIndex,
        confidence: 0.8,
      });
    }
  }
  return matches;
}

function validatePESEL(digits: string): boolean {
  const weights = [1, 3, 7, 9, 1, 3, 7, 9, 1, 3];
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(digits[i], 10) * weights[i];
  }
  const check = (10 - (sum % 10)) % 10;
  if (check !== parseInt(digits[10], 10)) return false;

  // Validate month portion
  const month = parseInt(digits.slice(2, 4), 10);
  // PESEL encodes century in month: 01-12 (1900s), 21-32 (2000s), 41-52 (2100s)
  const baseMonth = month % 20;
  return baseMonth >= 1 && baseMonth <= 12;
}

/**
 * Swedish Personnummer — YYMMDD-NNNC or YYYYMMDD-NNNC
 * Last digit is Luhn check on first 9 digits.
 */
export function detectSEPersonnummer(text: string, pageIndex: number): PIIMatch[] {
  const matches: PIIMatch[] = [];
  // YYMMDD[-+]NNNC or YYYYMMDD[-]NNNC
  const regex = /\b(\d{6,8}[-+]?\d{4})\b/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const cleaned = match[1].replace(/[-+]/g, "");
    // Need exactly 10 or 12 digits
    if (cleaned.length !== 10 && cleaned.length !== 12) continue;
    // Take last 10 digits for validation
    const tenDigits = cleaned.length === 12 ? cleaned.slice(2) : cleaned;
    if (validateLuhn10(tenDigits.slice(0, 9), parseInt(tenDigits[9], 10))) {
      matches.push({
        type: "sePersonnummer",
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

function validateLuhn10(digits: string, checkDigit: number): boolean {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = parseInt(digits[i], 10);
    if (i % 2 === 0) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return (10 - (sum % 10)) % 10 === checkDigit;
}

/**
 * Portuguese NIF (Número de Identificação Fiscal) — 9 digits with MOD 11 check.
 * First digit: 1-3 (person), 5 (company), 6 (public), 7 (entity), 8 (sole trader), 9 (temp/non-resident)
 */
export function detectPTNIF(text: string, pageIndex: number): PIIMatch[] {
  const matches: PIIMatch[] = [];
  const regex = /\b([123456789]\d{8})\b/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (validatePTNIF(match[1])) {
      matches.push({
        type: "ptNIF",
        value: match[1],
        startIndex: match.index,
        endIndex: match.index + match[1].length,
        pageIndex,
        confidence: 0.75,
      });
    }
  }
  return matches;
}

function validatePTNIF(digits: string): boolean {
  const weights = [9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 8; i++) {
    sum += parseInt(digits[i], 10) * weights[i];
  }
  const remainder = sum % 11;
  const check = remainder < 2 ? 0 : 11 - remainder;
  return check === parseInt(digits[8], 10);
}
