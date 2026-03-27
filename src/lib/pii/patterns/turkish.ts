import type { PIIMatch } from "../types";
import { validateTCKimlik } from "../validators/tc-kimlik";

export function detectTCKimlik(text: string, pageIndex: number): PIIMatch[] {
  const matches: PIIMatch[] = [];
  const regex = /\b([1-9]\d{10})\b/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (validateTCKimlik(match[1])) {
      matches.push({
        type: "tcKimlik",
        value: match[1],
        startIndex: match.index,
        endIndex: match.index + match[1].length,
        pageIndex,
        confidence: 0.95,
      });
    }
  }
  return matches;
}

export function detectTRPhone(text: string, pageIndex: number): PIIMatch[] {
  const matches: PIIMatch[] = [];
  const regex = /(?<!\d)(?:\+90[\s.-]*|0[\s.-]?)\(?[2-5]\d{2}\)?[\s.-]?\d{3}[\s.-]?\d{2}[\s.-]?\d{2}(?!\d)/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    matches.push({
      type: "trPhone",
      value: match[0],
      startIndex: match.index,
      endIndex: match.index + match[0].length,
      pageIndex,
      confidence: 0.9,
    });
  }
  return matches;
}

export function detectTRPassport(text: string, pageIndex: number): PIIMatch[] {
  const matches: PIIMatch[] = [];
  const regex = /\b([A-Z]{1,2}\d{6,9})\b/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    matches.push({
      type: "passport",
      value: match[1],
      startIndex: match.index,
      endIndex: match.index + match[1].length,
      pageIndex,
      confidence: 0.7,
    });
  }
  return matches;
}

/**
 * Turkish Vehicle License Plate — il kodu (01-81) + harf(ler) + rakam(lar).
 * Formats: 34 ABC 1234, 06 A 1234, 01 AB 123, etc.
 */
export function detectTRPlate(text: string, pageIndex: number): PIIMatch[] {
  const matches: PIIMatch[] = [];
  // Match: 2 digits (01-81) + space + 1-3 letters + space + 1-4 digits
  const regex = /\b((?:0[1-9]|[1-7]\d|8[01])[\s-]?[A-Z]{1,3}[\s-]?\d{1,4})\b/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const cleaned = match[1].replace(/[\s-]/g, "");
    // Total length should be 5-9 (2 digits + 1-3 letters + 1-4 digits)
    if (cleaned.length < 5 || cleaned.length > 9) continue;
    matches.push({
      type: "trPlate",
      value: match[1],
      startIndex: match.index,
      endIndex: match.index + match[0].length,
      pageIndex,
      confidence: 0.8,
    });
  }
  return matches;
}

/**
 * Turkish VKN (Vergi Kimlik Numarası) — 10 digits for companies/entities.
 * Individuals use TC Kimlik (11 digits), VKN is for legal entities.
 * Context-based: looks for "VKN", "Vergi Kimlik", "Vergi No" nearby.
 */
export function detectTRVKN(text: string, pageIndex: number): PIIMatch[] {
  const matches: PIIMatch[] = [];
  const keywordRegex = /(?:VKN|vergi\s*(?:kimlik)?\s*(?:no|numaras[ıi]))\s*[:.]?\s*(\d{10})\b/gi;
  let match;
  while ((match = keywordRegex.exec(text)) !== null) {
    const numStart = match.index + match[0].indexOf(match[1]);
    matches.push({
      type: "trVKN",
      value: match[1],
      startIndex: numStart,
      endIndex: numStart + match[1].length,
      pageIndex,
      confidence: 0.9,
    });
  }
  return matches;
}

/**
 * Turkish SGK Number (Sosyal Güvenlik Kurumu) — Social Security number.
 * Context-based: looks for "SGK", "Sigorta", "SSK" nearby + 7-11 digit number.
 */
export function detectTRSGK(text: string, pageIndex: number): PIIMatch[] {
  const matches: PIIMatch[] = [];
  const keywordRegex = /(?:SGK|SSK|sigorta)\s*(?:sicil)?\s*(?:no|numaras[ıi])?\s*[:.]?\s*(\d{7,11})\b/gi;
  let match;
  while ((match = keywordRegex.exec(text)) !== null) {
    const numStart = match.index + match[0].indexOf(match[1]);
    matches.push({
      type: "trSGK",
      value: match[1],
      startIndex: numStart,
      endIndex: numStart + match[1].length,
      pageIndex,
      confidence: 0.85,
    });
  }
  return matches;
}

/**
 * Turkish Driver's License Number — 6 digits (may expand in future).
 * Context-based: looks for "Ehliyet", "Sürücü Belgesi" nearby.
 */
export function detectTRDriverLicense(text: string, pageIndex: number): PIIMatch[] {
  const matches: PIIMatch[] = [];
  const keywordRegex = /(?:ehliyet|s[üu]r[üu]c[üu]\s*belgesi)\s*(?:no|numaras[ıi])?\s*[:.]?\s*(\d{6,8})\b/gi;
  let match;
  while ((match = keywordRegex.exec(text)) !== null) {
    const numStart = match.index + match[0].indexOf(match[1]);
    matches.push({
      type: "trDriverLicense",
      value: match[1],
      startIndex: numStart,
      endIndex: numStart + match[1].length,
      pageIndex,
      confidence: 0.8,
    });
  }
  return matches;
}
