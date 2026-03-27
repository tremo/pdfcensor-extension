import type { PIIMatch } from "../types";
import { validateLuhn } from "../validators/luhn";
import { validateIBAN } from "../validators/iban";

export function detectEmail(text: string, pageIndex: number): PIIMatch[] {
  const matches: PIIMatch[] = [];
  const regex = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    matches.push({
      type: "email",
      value: match[0],
      startIndex: match.index,
      endIndex: match.index + match[0].length,
      pageIndex,
      confidence: 0.95,
    });
  }
  return matches;
}

export function detectIBAN(text: string, pageIndex: number): PIIMatch[] {
  const matches: PIIMatch[] = [];
  const regex = /\b([A-Z]{2}\d{2}\s?[A-Z0-9]{4}(?:\s?[A-Z0-9]{1,4}){2,7})\b/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (validateIBAN(match[1])) {
      matches.push({
        type: "iban",
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

export function detectCreditCard(text: string, pageIndex: number): PIIMatch[] {
  const matches: PIIMatch[] = [];
  const regex = /\b(\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4})\b/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (validateLuhn(match[1])) {
      matches.push({
        type: "creditCard",
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

export function detectPhone(text: string, pageIndex: number): PIIMatch[] {
  const matches: PIIMatch[] = [];
  const seen = new Set<string>();

  const structuralPatterns: [RegExp, number][] = [
    [/\+\d{1,3}[\s.-]*\(?\d{1,5}\)?[\s.-]*\d{1,5}[\s.-]*\d{1,5}(?:[\s.-]*\d{1,5})?(?:[\s.-]*\d{1,5})?(?!\d)/g, 0.9],
    [/(?<!\d)00\d{2,3}[\s.-]*\(?\d{1,5}\)?[\s.-]*\d{1,5}[\s.-]*\d{1,5}(?:[\s.-]*\d{1,5})?(?!\d)/g, 0.85],
    [/(?<!\d)\(0?\d{1,5}\)[\s.-]*\d{2,5}[\s.-]*\d{2,5}(?:[\s.-]*\d{1,5})?(?!\d)/g, 0.85],
    [/(?<!\d)0\d{1,4}[\s.-]+\d{2,5}[\s.-]+\d{2,5}(?:[\s.-]+\d{1,5})?(?!\d)/g, 0.8],
  ];

  for (const [pattern, confidence] of structuralPatterns) {
    pattern.lastIndex = 0;
    let m;
    while ((m = pattern.exec(text)) !== null) {
      addPhoneMatch(m[0], m.index, confidence);
    }
  }

  const labelRegex =
    /(?:tel(?:efon|[eé]phone|[eé]fono|efone)?|phone|fax|gsm|mobile|mobil|cep|cell(?:ular)?|h[üu]cre|telefax)[\s.:\/]+(\+?[\d][\d\s.()\-]{5,18}\d)/gi;
  labelRegex.lastIndex = 0;
  let lm;
  while ((lm = labelRegex.exec(text)) !== null) {
    const numPart = lm[1];
    const offset = lm[0].indexOf(numPart);
    addPhoneMatch(numPart, lm.index + offset, 0.85);
  }

  return matches;

  function addPhoneMatch(raw: string, index: number, confidence: number) {
    const value = raw.trim();
    const digits = value.replace(/\D/g, "");
    if (digits.length < 7 || digits.length > 15) return;
    if (isDateLike(value)) return;
    const start = index + (raw.length - raw.trimStart().length);
    const end = start + value.length;
    const key = `${start}:${end}`;
    if (seen.has(key)) return;
    seen.add(key);
    matches.push({ type: "phone", value, startIndex: start, endIndex: end, pageIndex, confidence });
  }
}

function isDateLike(str: string): boolean {
  const s = str.trim();
  if (/^\d{4}[.\/-]\d{1,2}[.\/-]\d{1,2}$/.test(s)) return true;
  if (/^\d{1,2}[.\/-]\d{1,2}[.\/-]\d{4}$/.test(s)) return true;
  return false;
}

const ADDRESS_STANDALONE = [
  "sokak", "cadde", "mahalle", "bulvar",
  "street", "avenue", "boulevard", "road", "drive", "lane", "suite",
  "rue", "allée", "impasse", "chemin",
  "calle", "avenida", "plaza", "paseo", "camino",
  "viale", "piazza", "vicolo",
  "rua", "praça", "travessa",
  "straat", "laan", "gracht", "plein",
  "ulica", "aleja", "plac", "osiedle",
  "náměstí", "třída", "námestie",
  "utca", "körút", "fasor",
  "strada", "bulevardul", "piața", "aleea", "calea",
  "avenija", "cesta",
  "gatvė", "alėja", "aikštė",
  "iela", "bulvāris", "laukums",
  "sráid", "bóthar",
  "triq", "pjazza",
  "οδός", "λεωφόρος", "πλατεία",
  "улица", "булевард", "площад",
];

const ADDRESS_SUFFIX = [
  "straße", "gasse", "platz", "allee",
  "gatan", "vägen", "torget", "stigen",
  "gade", "plads", "stræde",
  "katu", "polku", "kuja",
  "tänav", "puiestee",
];

const ADDRESS_ABBR_PATTERNS = [
  "sok\\.", "cad\\.", "mah\\.", "blv\\.",
  "st\\.", "ave\\.", "blvd\\.", "rd\\.", "dr\\.", "ln\\.", "apt\\.?", "ste\\.?",
  "str\\.",
  "avda\\.",
  "ul\\.", "al\\.", "os\\.",
  "nám\\.",
  "krt\\.",
  "bd\\.",
  "ул\\.", "бул\\.", "пл\\.",
];

function escapeForRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const standalonePattern = ADDRESS_STANDALONE.map(escapeForRegex).join("|");
const suffixPattern = ADDRESS_SUFFIX.map(escapeForRegex).join("|");
const abbrPattern = ADDRESS_ABBR_PATTERNS.join("|");

const ADDRESS_REGEX = new RegExp(
  `(?:(?<!\\p{L})(?:${standalonePattern}|${abbrPattern})|(?:${suffixPattern}))(?!\\p{L})`,
  "giu"
);

export function detectAddress(text: string, pageIndex: number): PIIMatch[] {
  const matches: PIIMatch[] = [];
  ADDRESS_REGEX.lastIndex = 0;
  let match;
  while ((match = ADDRESS_REGEX.exec(text)) !== null) {
    const lineStart = text.lastIndexOf("\n", match.index);
    const lineEnd = text.indexOf("\n", match.index);
    const actualLineStart = lineStart === -1 ? 0 : lineStart + 1;
    const actualLineEnd = lineEnd === -1 ? text.length : lineEnd;
    let start = Math.max(actualLineStart, match.index - 40);
    let end = Math.min(actualLineEnd, match.index + match[0].length + 40);
    if (start > actualLineStart && start < text.length && !/\s/.test(text[start])) {
      const spacePos = text.indexOf(" ", start);
      if (spacePos !== -1 && spacePos < match.index) start = spacePos + 1;
    }
    if (end < actualLineEnd && end > 0 && /\p{L}/u.test(text[end] || "")) {
      const spacePos = text.lastIndexOf(" ", end);
      if (spacePos > match.index + match[0].length) end = spacePos;
    }
    const addressText = text.slice(start, end).trim();
    if (addressText.length > 10) {
      matches.push({
        type: "address",
        value: addressText,
        startIndex: start,
        endIndex: end,
        pageIndex,
        confidence: 0.7,
      });
    }
  }
  return matches;
}

const DOB_KEYWORDS = [
  "doğum tarihi", "d\\.tarihi",
  "date of birth", "birth date", "birthdate", "born on", "dob",
  "geburtsdatum", "geb\\.datum", "geb\\.", "geboren am",
  "date de naissance", "né(?:e)? le",
  "fecha de nacimiento", "f\\. ?nacimiento", "nacido(?:a)? el",
  "data di nascita", "nato(?:a)? il",
  "data de nascimento", "nascido(?:a)? em",
  "geboortedatum", "geboren op",
  "data urodzenia", "ur\\.",
  "datum narození",
  "dátum narodenia",
  "születési dátum", "szül\\.", "született",
  "data nașterii", "născut(?:ă)?",
  "datum rođenja",
  "datum rojstva",
  "gimimo data",
  "dzimšanas datums",
  "sünniaeg", "sünnikuupäev",
  "syntymäaika", "syntymäpäivä",
  "födelsedatum", "född",
  "fødselsdato", "født",
  "дата на раждане",
  "ημερομηνία γέννησης",
  "dáta breithe",
  "data tat-twelid",
  "生年月日", "생년월일", "出生日期",
];

const DATE_PATTERNS = [
  /\d{1,2}[./-]\d{1,2}[./-]\d{2,4}/,
  /\d{4}[./-]\d{1,2}[./-]\d{1,2}/,
  /\d{1,2}\.?\s+\p{L}{3,12}\s+\d{2,4}/u,
  /\p{L}{3,12}\s+\d{1,2},?\s+\d{2,4}/u,
];

const DOB_KEYWORD_REGEX = new RegExp(`(?:${DOB_KEYWORDS.join("|")})`, "giu");
const DATE_REGEX = new RegExp(DATE_PATTERNS.map((r) => r.source).join("|"), "giu");

export function detectDateOfBirth(text: string, pageIndex: number): PIIMatch[] {
  const matches: PIIMatch[] = [];
  const seen = new Set<string>();
  DOB_KEYWORD_REGEX.lastIndex = 0;
  let kwMatch;
  while ((kwMatch = DOB_KEYWORD_REGEX.exec(text)) !== null) {
    const kwStart = kwMatch.index;
    const kwEnd = kwStart + kwMatch[0].length;
    const lineStart = text.lastIndexOf("\n", kwStart);
    const lineEnd = text.indexOf("\n", kwEnd);
    const actualLineStart = lineStart === -1 ? 0 : lineStart + 1;
    const actualLineEnd = lineEnd === -1 ? text.length : lineEnd;
    const searchStart = Math.max(actualLineStart, kwStart - 30);
    const searchEnd = Math.min(actualLineEnd, kwEnd + 80);
    const searchSlice = text.slice(searchStart, searchEnd);
    DATE_REGEX.lastIndex = 0;
    let dateMatch;
    while ((dateMatch = DATE_REGEX.exec(searchSlice)) !== null) {
      const absStart = searchStart + dateMatch.index;
      const absEnd = absStart + dateMatch[0].length;
      const key = `${absStart}:${absEnd}`;
      if (seen.has(key)) continue;
      seen.add(key);
      matches.push({
        type: "dateOfBirth",
        value: dateMatch[0],
        startIndex: absStart,
        endIndex: absEnd,
        pageIndex,
        confidence: 0.9,
      });
    }
  }
  return matches;
}

/**
 * IPv4 addresses — X.X.X.X where each octet is 0-255.
 * Excludes common non-PII addresses: 0.0.0.0, 127.x.x.x, 255.255.255.255.
 */
export function detectIPAddress(text: string, pageIndex: number): PIIMatch[] {
  const matches: PIIMatch[] = [];
  // IPv4
  const ipv4Regex = /\b(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/g;
  let match;
  while ((match = ipv4Regex.exec(text)) !== null) {
    const parts = match[1].split(".").map(Number);
    if (parts.some((p) => p > 255)) continue;
    if (parts[0] === 0 || parts[0] === 127 || parts[0] === 255) continue;
    if (parts[0] === 224 || parts[0] === 169) continue;
    matches.push({
      type: "ipAddress",
      value: match[1],
      startIndex: match.index,
      endIndex: match.index + match[1].length,
      pageIndex,
      confidence: 0.8,
    });
  }

  // IPv6 — full or compressed form
  const ipv6Regex = /\b((?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|(?:[0-9a-fA-F]{1,4}:){1,7}:|(?:[0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|::(?:[0-9a-fA-F]{1,4}:){0,5}[0-9a-fA-F]{1,4})\b/g;
  while ((match = ipv6Regex.exec(text)) !== null) {
    if (match[1] === "::1") continue;
    matches.push({
      type: "ipAddress",
      value: match[1],
      startIndex: match.index,
      endIndex: match.index + match[1].length,
      pageIndex,
      confidence: 0.75,
    });
  }

  return matches;
}

/**
 * MAC addresses — 6 groups of 2 hex digits, separated by : or -.
 * Format: AA:BB:CC:DD:EE:FF or AA-BB-CC-DD-EE-FF
 */
export function detectMACAddress(text: string, pageIndex: number): PIIMatch[] {
  const matches: PIIMatch[] = [];
  const regex = /\b([0-9A-Fa-f]{2}(?:[:-][0-9A-Fa-f]{2}){5})\b/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const cleaned = match[1].replace(/[:-]/g, "").toUpperCase();
    if (cleaned === "FFFFFFFFFFFF" || cleaned === "000000000000") continue;
    matches.push({
      type: "macAddress",
      value: match[1],
      startIndex: match.index,
      endIndex: match.index + match[1].length,
      pageIndex,
      confidence: 0.8,
    });
  }
  return matches;
}

/**
 * Cryptocurrency wallet addresses — Bitcoin (BTC) and Ethereum (ETH).
 * BTC Legacy: starts with 1, 26-34 chars (Base58)
 * BTC SegWit: starts with 3, 26-34 chars
 * BTC Bech32: starts with bc1, 42-62 chars
 * ETH: starts with 0x, 42 hex chars
 */
export function detectCryptoWallet(text: string, pageIndex: number): PIIMatch[] {
  const matches: PIIMatch[] = [];
  const seen = new Set<string>();
  let match;

  // Bitcoin Legacy / SegWit
  const btcRegex = /\b([13][a-km-zA-HJ-NP-Z1-9]{25,34})\b/g;
  while ((match = btcRegex.exec(text)) !== null) {
    const key = `${match.index}:${match.index + match[1].length}`;
    if (seen.has(key)) continue;
    seen.add(key);
    matches.push({
      type: "cryptoWallet", value: match[1],
      startIndex: match.index, endIndex: match.index + match[1].length,
      pageIndex, confidence: 0.8,
    });
  }

  // Bitcoin Bech32
  const bech32Regex = /\b(bc1[a-z0-9]{38,58})\b/g;
  while ((match = bech32Regex.exec(text)) !== null) {
    const key = `${match.index}:${match.index + match[1].length}`;
    if (seen.has(key)) continue;
    seen.add(key);
    matches.push({
      type: "cryptoWallet", value: match[1],
      startIndex: match.index, endIndex: match.index + match[1].length,
      pageIndex, confidence: 0.85,
    });
  }

  // Ethereum
  const ethRegex = /\b(0x[0-9a-fA-F]{40})\b/g;
  while ((match = ethRegex.exec(text)) !== null) {
    const key = `${match.index}:${match.index + match[1].length}`;
    if (seen.has(key)) continue;
    seen.add(key);
    matches.push({
      type: "cryptoWallet", value: match[1],
      startIndex: match.index, endIndex: match.index + match[1].length,
      pageIndex, confidence: 0.9,
    });
  }

  return matches;
}

/**
 * GPS Coordinates — latitude/longitude pairs.
 * Formats: 41.0082, 28.9784 | 41°0'29.5"N 28°58'42.2"E
 */
export function detectGPSCoordinates(text: string, pageIndex: number): PIIMatch[] {
  const matches: PIIMatch[] = [];
  const seen = new Set<string>();
  let match;

  // Decimal format: lat, lon pair
  const decimalRegex = /(-?\d{1,2}\.\d{3,8})\s*[,;\s]\s*(-?\d{1,3}\.\d{3,8})/g;
  while ((match = decimalRegex.exec(text)) !== null) {
    const lat = parseFloat(match[1]);
    const lon = parseFloat(match[2]);
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;
    if (Math.abs(lat) < 1 && Math.abs(lon) < 1) continue;
    const key = `${match.index}:${match.index + match[0].length}`;
    if (seen.has(key)) continue;
    seen.add(key);
    matches.push({
      type: "gpsCoordinates", value: `${match[1]}, ${match[2]}`,
      startIndex: match.index, endIndex: match.index + match[0].length,
      pageIndex, confidence: 0.75,
    });
  }

  // DMS format: 41°0'29.5"N 28°58'42.2"E
  const dmsRegex = /(\d{1,3})°\s*(\d{1,2})[''′]\s*(\d{1,2}(?:\.\d+)?)[""″]?\s*([NSEW])\s+(\d{1,3})°\s*(\d{1,2})[''′]\s*(\d{1,2}(?:\.\d+)?)[""″]?\s*([NSEW])/g;
  while ((match = dmsRegex.exec(text)) !== null) {
    const key = `${match.index}:${match.index + match[0].length}`;
    if (seen.has(key)) continue;
    seen.add(key);
    matches.push({
      type: "gpsCoordinates", value: match[0],
      startIndex: match.index, endIndex: match.index + match[0].length,
      pageIndex, confidence: 0.9,
    });
  }

  return matches;
}
