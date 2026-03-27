import type { PIIMatch, PIIType, RegulationType } from "../lib/pii/types";

// --- Content → Background messages ---

export interface ScanTextMessage {
  type: "SCAN_TEXT";
  text: string;
}

export interface ScanFileMessage {
  type: "SCAN_FILE";
  fileName: string;
  fileData: ArrayBuffer;
  mimeType: string;
}

export interface CheckUsageMessage {
  type: "CHECK_USAGE";
}

export interface GetSettingsMessage {
  type: "GET_SETTINGS";
}

export interface LoginMessage {
  type: "LOGIN";
}

export interface LogoutMessage {
  type: "LOGOUT";
}

export interface GetUserInfoMessage {
  type: "GET_USER_INFO";
}

export type Message =
  | ScanTextMessage
  | ScanFileMessage
  | CheckUsageMessage
  | GetSettingsMessage
  | LoginMessage
  | LogoutMessage
  | GetUserInfoMessage;

// --- Background → Content responses ---

export interface ScanResponse {
  type: "SCAN_RESULT";
  matches: PIIMatch[];
  totalCount: number;
  masked?: string;
  limitReached?: boolean;
}

export interface UsageResponse {
  type: "USAGE_STATUS";
  remaining: number;
  isPro: boolean;
}

export interface SettingsResponse {
  type: "SETTINGS";
  settings: ExtensionSettings;
}

// --- Settings ---

export interface ExtensionSettings {
  enabled: boolean;
  regulation: RegulationType;
  customPiiTypes: PIIType[];
  autoMask: boolean;
  showNotifications: boolean;
}

export interface UsageData {
  date: string;
  count: number;
}

export interface StatsData {
  totalScans: number;
  totalPiiFound: number;
  totalMasked: number;
  byType: Partial<Record<PIIType, number>>;
  bySite: Record<string, number>;
}
