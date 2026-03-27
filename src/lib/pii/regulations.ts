import type { RegulationProfile, RegulationType, PIIType } from "./types";

const ALL_TYPES: PIIType[] = [
  "email","phone","iban","creditCard","passport","names","address","dateOfBirth",
  "ipAddress","macAddress","cryptoWallet","gpsCoordinates",
  "tcKimlik","trPhone","trPlate","trVKN","trSGK","trDriverLicense",
  "ssn","itin","usPhone","usDriverLicense","usPassport",
  "ukNHS","ukNINO","dePersonalausweis","deSteuerID","frNIR","esNIF","esDNI",
  "itCodiceFiscale","nlBSN","plPESEL","sePersonnummer","ptNIF",
  "brCPF","brCNPJ",
  "inAadhaar","inPAN","krRRN","jpMyNumber",
];

export const regulations: Record<RegulationType, RegulationProfile> = {
  COMPREHENSIVE: {
    name: "COMPREHENSIVE", country: "ALL",
    patterns: ALL_TYPES,
    description: "Comprehensive — All regions (Recommended)",
  },
  KVKK: {
    name: "KVKK", country: "TR",
    patterns: [
      "tcKimlik","trPhone","trPlate","trVKN","trSGK","trDriverLicense",
      "email","iban","creditCard","names","address","dateOfBirth",
      "ipAddress","phone","passport",
    ],
    description: "Kişisel Verilerin Korunması Kanunu (Turkey)",
  },
  GDPR: {
    name: "GDPR", country: "EU",
    patterns: [
      "email","phone","iban","names","address","passport","dateOfBirth",
      "ipAddress","macAddress","gpsCoordinates","creditCard",
      "ukNHS","ukNINO","dePersonalausweis","deSteuerID","frNIR",
      "esNIF","esDNI","itCodiceFiscale","nlBSN","plPESEL",
      "sePersonnummer","ptNIF",
    ],
    description: "General Data Protection Regulation (EU)",
  },
  HIPAA: {
    name: "HIPAA", country: "US",
    patterns: [
      "ssn","names","email","usPhone","address","dateOfBirth",
      "ipAddress","usDriverLicense","usPassport",
    ],
    description: "Health Insurance Portability and Accountability Act (US)",
  },
  CCPA: {
    name: "CCPA", country: "US",
    patterns: [
      "ssn","itin","email","usPhone","creditCard","names","dateOfBirth",
      "ipAddress","usDriverLicense","usPassport","address",
    ],
    description: "California Consumer Privacy Act (US)",
  },
  LGPD: {
    name: "LGPD", country: "BR",
    patterns: [
      "brCPF","brCNPJ","email","phone","names","address","dateOfBirth",
      "ipAddress","creditCard","iban",
    ],
    description: "Lei Geral de Proteção de Dados (Brazil)",
  },
  PIPA: {
    name: "PIPA", country: "KR",
    patterns: [
      "krRRN","email","phone","names","dateOfBirth","address",
      "ipAddress","creditCard",
    ],
    description: "Personal Information Protection Act (South Korea)",
  },
  APPI: {
    name: "APPI", country: "JP",
    patterns: [
      "jpMyNumber","email","phone","names","dateOfBirth","address",
      "ipAddress","creditCard",
    ],
    description: "Act on Protection of Personal Information (Japan)",
  },
  PIPL: {
    name: "PIPL", country: "CN",
    patterns: [
      "email","phone","names","dateOfBirth","address",
      "ipAddress","creditCard",
    ],
    description: "Personal Information Protection Law (China)",
  },
  CUSTOM: {
    name: "CUSTOM", country: "ALL",
    patterns: ALL_TYPES,
    description: "Custom — select individual PII types",
  },
};

export function getRegulationPatterns(regulation: RegulationType): PIIType[] {
  return regulations[regulation]?.patterns || regulations.CUSTOM.patterns;
}

const EU_LOCALES = ["bg","hr","cs","da","nl","en","et","fi","fr","de","el","hu","ga","it","lv","lt","mt","pl","pt","ro","sk","sl","es","sv"];

export function getRegulationLocales(regulation: RegulationType, uiLocale: string): string[] {
  const unique = (arr: string[]) => [...new Set(arr)];
  switch (regulation) {
    case "GDPR": return unique([...EU_LOCALES, uiLocale]);
    case "KVKK": return unique(["tr", uiLocale]);
    case "HIPAA": case "CCPA": return unique(["en", "es", uiLocale]);
    case "LGPD": return unique(["pt", uiLocale]);
    case "PIPA": return unique(["ko", "en", uiLocale]);
    case "APPI": return unique(["ja", "en", uiLocale]);
    case "PIPL": return unique(["zh", "en", uiLocale]);
    case "COMPREHENSIVE": case "CUSTOM": return unique([...EU_LOCALES, "tr", "ko", "ja", "zh", "pt", uiLocale]);
    default: return [uiLocale];
  }
}
