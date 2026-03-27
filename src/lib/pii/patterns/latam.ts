import type { PIIMatch } from "../types";

/**
 * Brazilian CPF (Cadastro de Pessoas Físicas) — 11 digits, often formatted as XXX.XXX.XXX-XX.
 * Two check digits validated with weighted sum MOD 11.
 */
export function detectBRCPF(text: string, pageIndex: number): PIIMatch[] {
  const matches: PIIMatch[] = [];
  const regex = /\b(\d{3}\.?\d{3}\.?\d{3}[-.]?\d{2})\b/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const cleaned = match[1].replace(/[.\-]/g, "");
    if (cleaned.length !== 11) continue;
    if (validateCPF(cleaned)) {
      matches.push({
        type: "brCPF",
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

function validateCPF(digits: string): boolean {
  // Reject all same digits (000.000.000-00, 111.111.111-11, etc.)
  if (/^(\d)\1+$/.test(digits)) return false;

  // First check digit
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(digits[i], 10) * (10 - i);
  }
  let check1 = 11 - (sum % 11);
  if (check1 >= 10) check1 = 0;
  if (check1 !== parseInt(digits[9], 10)) return false;

  // Second check digit
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(digits[i], 10) * (11 - i);
  }
  let check2 = 11 - (sum % 11);
  if (check2 >= 10) check2 = 0;
  return check2 === parseInt(digits[10], 10);
}

/**
 * Brazilian CNPJ (Cadastro Nacional da Pessoa Jurídica) — 14 digits.
 * Format: XX.XXX.XXX/XXXX-XX
 * Two check digits validated with weighted sum MOD 11.
 */
export function detectBRCNPJ(text: string, pageIndex: number): PIIMatch[] {
  const matches: PIIMatch[] = [];
  const regex = /\b(\d{2}\.?\d{3}\.?\d{3}\/?\d{4}[-.]?\d{2})\b/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const cleaned = match[1].replace(/[.\-\/]/g, "");
    if (cleaned.length !== 14) continue;
    if (validateCNPJ(cleaned)) {
      matches.push({
        type: "brCNPJ",
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

function validateCNPJ(digits: string): boolean {
  if (/^(\d)\1+$/.test(digits)) return false;

  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    sum += parseInt(digits[i], 10) * weights1[i];
  }
  let check1 = sum % 11;
  check1 = check1 < 2 ? 0 : 11 - check1;
  if (check1 !== parseInt(digits[12], 10)) return false;

  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  sum = 0;
  for (let i = 0; i < 13; i++) {
    sum += parseInt(digits[i], 10) * weights2[i];
  }
  let check2 = sum % 11;
  check2 = check2 < 2 ? 0 : 11 - check2;
  return check2 === parseInt(digits[13], 10);
}
