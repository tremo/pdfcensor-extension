import type { PIIMatch, PIIType, PIIDetectionResult } from "./types";
// Global
import { detectEmail, detectIBAN, detectCreditCard, detectPhone, detectAddress, detectDateOfBirth, detectIPAddress, detectMACAddress, detectCryptoWallet, detectGPSCoordinates } from "./patterns/global";
// Turkey
import { detectTCKimlik, detectTRPhone, detectTRPassport, detectTRPlate, detectTRVKN, detectTRSGK, detectTRDriverLicense } from "./patterns/turkish";
// US
import { detectSSN, detectITIN, detectUSPhone, detectUSDriverLicense, detectUSPassport } from "./patterns/us";
// EU
import { detectNHS, detectNINO, detectDEPersonalausweis, detectDESteuerID, detectFRNIR, detectESNIF, detectESDNI, detectITCodiceFiscale, detectNLBSN, detectPLPESEL, detectSEPersonnummer, detectPTNIF } from "./patterns/eu";
// LATAM
import { detectBRCPF, detectBRCNPJ } from "./patterns/latam";
// Asia
import { detectAadhaar, detectINPAN, detectKRRRN, detectJPMyNumber } from "./patterns/asia";
// Names
import { detectNames } from "./patterns/names";

type DetectorFn = (text: string, pageIndex: number) => PIIMatch[];

const detectorMap: Record<PIIType, DetectorFn> = {
  // Global
  email: detectEmail,
  phone: detectPhone,
  iban: detectIBAN,
  creditCard: detectCreditCard,
  passport: detectTRPassport,
  names: detectNames,
  address: detectAddress,
  dateOfBirth: detectDateOfBirth,
  ipAddress: detectIPAddress,
  macAddress: detectMACAddress,
  cryptoWallet: detectCryptoWallet,
  gpsCoordinates: detectGPSCoordinates,
  // Turkey
  tcKimlik: detectTCKimlik,
  trPhone: detectTRPhone,
  trPlate: detectTRPlate,
  trVKN: detectTRVKN,
  trSGK: detectTRSGK,
  trDriverLicense: detectTRDriverLicense,
  // US
  ssn: detectSSN,
  itin: detectITIN,
  usPhone: detectUSPhone,
  usDriverLicense: detectUSDriverLicense,
  usPassport: detectUSPassport,
  // EU
  ukNHS: detectNHS,
  ukNINO: detectNINO,
  dePersonalausweis: detectDEPersonalausweis,
  deSteuerID: detectDESteuerID,
  frNIR: detectFRNIR,
  esNIF: detectESNIF,
  esDNI: detectESDNI,
  itCodiceFiscale: detectITCodiceFiscale,
  nlBSN: detectNLBSN,
  plPESEL: detectPLPESEL,
  sePersonnummer: detectSEPersonnummer,
  ptNIF: detectPTNIF,
  // LATAM
  brCPF: detectBRCPF,
  brCNPJ: detectBRCNPJ,
  // Asia
  inAadhaar: detectAadhaar,
  inPAN: detectINPAN,
  krRRN: detectKRRRN,
  jpMyNumber: detectJPMyNumber,
};

export function detectPII(text: string, pageIndex: number, piiTypes: PIIType[]): PIIDetectionResult {
  const allMatches: PIIMatch[] = [];
  for (const piiType of piiTypes) {
    const detector = detectorMap[piiType];
    if (detector) allMatches.push(...detector(text, pageIndex));
  }
  const deduplicated = deduplicateMatches(allMatches);
  const byType: Record<string, number> = {};
  for (const m of deduplicated) byType[m.type] = (byType[m.type] || 0) + 1;
  return { matches: deduplicated, totalCount: deduplicated.length, byType };
}

function deduplicateMatches(matches: PIIMatch[]): PIIMatch[] {
  if (matches.length <= 1) return matches;
  const sorted = [...matches].sort((a, b) => a.startIndex - b.startIndex);
  const result: PIIMatch[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const prev = result[result.length - 1];
    const curr = sorted[i];
    if (curr.startIndex < prev.endIndex && curr.pageIndex === prev.pageIndex) {
      if (curr.confidence > prev.confidence) result[result.length - 1] = curr;
    } else result.push(curr);
  }
  return result;
}
