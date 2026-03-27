export type PIIType =
  // Global
  | "email"
  | "phone"
  | "iban"
  | "creditCard"
  | "passport"
  | "names"
  | "address"
  | "dateOfBirth"
  | "ipAddress"
  | "macAddress"
  | "cryptoWallet"
  | "gpsCoordinates"
  // Turkey
  | "tcKimlik"
  | "trPhone"
  | "trPlate"
  | "trVKN"
  | "trSGK"
  | "trDriverLicense"
  // US
  | "ssn"
  | "itin"
  | "usPhone"
  | "usDriverLicense"
  | "usPassport"
  // EU — Country-specific national IDs
  | "ukNHS"
  | "ukNINO"
  | "dePersonalausweis"
  | "deSteuerID"
  | "frNIR"
  | "esNIF"
  | "esDNI"
  | "itCodiceFiscale"
  | "nlBSN"
  | "plPESEL"
  | "sePersonnummer"
  | "ptNIF"
  // LATAM
  | "brCPF"
  | "brCNPJ"
  // Asia
  | "inAadhaar"
  | "inPAN"
  | "krRRN"
  | "jpMyNumber";

export interface PIIMatch {
  type: PIIType;
  value: string;
  startIndex: number;
  endIndex: number;
  pageIndex: number;
  confidence: number;
}

export type RegulationType =
  | "COMPREHENSIVE"
  | "KVKK"
  | "GDPR"
  | "HIPAA"
  | "CCPA"
  | "LGPD"
  | "PIPA"
  | "APPI"
  | "PIPL"
  | "CUSTOM";

export interface RegulationProfile {
  name: RegulationType;
  country: string;
  patterns: PIIType[];
  description: string;
}

export interface PIIDetectionResult {
  matches: PIIMatch[];
  totalCount: number;
  byType: Record<string, number>;
}

export const PII_LABELS: Record<PIIType, string> = {
  // Global
  email: "E-posta",
  phone: "Telefon",
  iban: "IBAN",
  creditCard: "Kredi Kartı",
  passport: "Pasaport",
  names: "İsim",
  address: "Adres",
  dateOfBirth: "Doğum Tarihi",
  ipAddress: "IP Adresi",
  macAddress: "MAC Adresi",
  cryptoWallet: "Kripto Cüzdan",
  gpsCoordinates: "GPS Koordinat",
  // Turkey
  tcKimlik: "TC Kimlik",
  trPhone: "TR Telefon",
  trPlate: "TR Plaka",
  trVKN: "Vergi Kimlik No",
  trSGK: "SGK No",
  trDriverLicense: "TR Ehliyet",
  // US
  ssn: "SSN",
  itin: "ITIN",
  usPhone: "US Telefon",
  usDriverLicense: "US Ehliyet",
  usPassport: "US Pasaport",
  // EU
  ukNHS: "NHS No",
  ukNINO: "NINO",
  dePersonalausweis: "DE Kimlik",
  deSteuerID: "DE Steuer-ID",
  frNIR: "FR NIR",
  esNIF: "ES NIF",
  esDNI: "ES DNI",
  itCodiceFiscale: "IT Codice Fiscale",
  nlBSN: "NL BSN",
  plPESEL: "PL PESEL",
  sePersonnummer: "SE Personnummer",
  ptNIF: "PT NIF",
  // LATAM
  brCPF: "BR CPF",
  brCNPJ: "BR CNPJ",
  // Asia
  inAadhaar: "IN Aadhaar",
  inPAN: "IN PAN",
  krRRN: "KR RRN",
  jpMyNumber: "JP My Number",
};
