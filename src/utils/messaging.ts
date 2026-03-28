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

export interface UpdateSettingsMessage {
  type: "UPDATE_SETTINGS";
  settings: Partial<ExtensionSettings>;
}

export type Message =
  | ScanTextMessage
  | ScanFileMessage
  | CheckUsageMessage
  | GetSettingsMessage
  | LoginMessage
  | LogoutMessage
  | GetUserInfoMessage
  | UpdateSettingsMessage;

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

// --- File upload warning response ---

export interface FileWarningResponse {
  type: "FILE_WARNING";
  fileName: string;
  piiCount: number;
  matches: PIIMatch[];
}

// --- Settings ---

/** Supported platform identifiers for selective blocking */
export type PlatformId =
  | "chatgpt"
  | "claude"
  | "gemini"
  | "copilot"
  | "gmail"
  | "outlook"
  | "notion"
  | "slack"
  | "discord"
  | "generic";

export interface PlatformOption {
  id: PlatformId;
  label: string;
  hostname: string;
}

export const AVAILABLE_PLATFORMS: PlatformOption[] = [
  { id: "chatgpt", label: "ChatGPT (OpenAI)", hostname: "chatgpt.com" },
  { id: "claude", label: "Claude (Anthropic)", hostname: "claude.ai" },
  { id: "gemini", label: "Gemini (Google)", hostname: "gemini.google.com" },
  { id: "copilot", label: "Copilot (Microsoft)", hostname: "copilot.microsoft.com" },
  { id: "gmail", label: "Gmail", hostname: "mail.google.com" },
  { id: "outlook", label: "Outlook", hostname: "outlook.live.com" },
  { id: "notion", label: "Notion", hostname: "notion.so" },
  { id: "slack", label: "Slack", hostname: "app.slack.com" },
  { id: "discord", label: "Discord", hostname: "discord.com" },
  { id: "generic", label: "Diğer siteler", hostname: "" },
];

export interface ExtensionSettings {
  enabled: boolean;
  regulation: RegulationType;
  customPiiTypes: PIIType[];
  autoMask: boolean;
  showNotifications: boolean;
  /** Which platforms to actively monitor — empty array = all */
  enabledPlatforms: PlatformId[];
  /** Which PII types to detect — empty array = use regulation default */
  enabledPiiTypes: PIIType[];
  /** Custom keywords to detect (Pro only) */
  customKeywords: string[];
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
