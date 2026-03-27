import type { PIIMatch } from "../types";

export function detectSSN(text: string, pageIndex: number): PIIMatch[] {
  const matches: PIIMatch[] = [];
  const regex = /\b(\d{3})-(\d{2})-(\d{4})\b/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const area = parseInt(match[1], 10);
    if (area === 0 || area === 666 || area >= 900) continue;
    if (match[2] === "00" || match[3] === "0000") continue;
    matches.push({
      type: "ssn",
      value: match[0],
      startIndex: match.index,
      endIndex: match.index + match[0].length,
      pageIndex,
      confidence: 0.95,
    });
  }
  return matches;
}

export function detectITIN(text: string, pageIndex: number): PIIMatch[] {
  const matches: PIIMatch[] = [];
  const regex = /\b(9\d{2})-([7-9]\d)-(\d{4})\b/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    matches.push({
      type: "itin",
      value: match[0],
      startIndex: match.index,
      endIndex: match.index + match[0].length,
      pageIndex,
      confidence: 0.9,
    });
  }
  return matches;
}

export function detectUSPhone(text: string, pageIndex: number): PIIMatch[] {
  const matches: PIIMatch[] = [];
  const regex = /(?:\+1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const cleaned = match[0].replace(/[\s.()+\-]/g, "");
    if (cleaned.length < 10 || cleaned.length > 11) continue;
    matches.push({
      type: "usPhone",
      value: match[0],
      startIndex: match.index,
      endIndex: match.index + match[0].length,
      pageIndex,
      confidence: 0.8,
    });
  }
  return matches;
}

/**
 * US Driver's License — state-specific formats.
 * Context-based: looks for "DL", "Driver's License", "License #" nearby.
 * Covers most common formats: 1 letter + 6-14 digits, or pure numeric.
 */
export function detectUSDriverLicense(text: string, pageIndex: number): PIIMatch[] {
  const matches: PIIMatch[] = [];
  const keywordRegex = /(?:driver'?s?\s*license|DL|license\s*#?|lic\s*#)\s*[:.]?\s*([A-Z]?\d{5,14})\b/gi;
  let match;
  while ((match = keywordRegex.exec(text)) !== null) {
    const numStart = match.index + match[0].indexOf(match[1]);
    matches.push({
      type: "usDriverLicense",
      value: match[1],
      startIndex: numStart,
      endIndex: numStart + match[1].length,
      pageIndex,
      confidence: 0.75,
    });
  }
  return matches;
}

/**
 * US Passport Number — 9 digits (since 1981) or 1 letter + 8 digits.
 * Context-based: looks for "Passport" keyword nearby.
 */
export function detectUSPassport(text: string, pageIndex: number): PIIMatch[] {
  const matches: PIIMatch[] = [];
  const keywordRegex = /(?:passport)\s*(?:#|no|number)?\s*[:.]?\s*([A-Z]?\d{8,9})\b/gi;
  let match;
  while ((match = keywordRegex.exec(text)) !== null) {
    const numStart = match.index + match[0].indexOf(match[1]);
    matches.push({
      type: "usPassport",
      value: match[1],
      startIndex: numStart,
      endIndex: numStart + match[1].length,
      pageIndex,
      confidence: 0.8,
    });
  }
  return matches;
}
