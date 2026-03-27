import type { RegulationType, PIIType } from "./pii/types";
import type { ExtensionSettings, UsageData, StatsData } from "../utils/messaging";

const DEFAULT_SETTINGS: ExtensionSettings = {
  enabled: true,
  regulation: "COMPREHENSIVE",
  customPiiTypes: [],
  autoMask: false,
  showNotifications: true,
};

const DEFAULT_USAGE: UsageData = {
  date: "",
  count: 0,
};

const DEFAULT_STATS: StatsData = {
  totalScans: 0,
  totalPiiFound: 0,
  totalMasked: 0,
  byType: {},
  bySite: {},
};

// --- Settings ---

export async function getSettings(): Promise<ExtensionSettings> {
  const result = await chrome.storage.local.get("settings");
  return { ...DEFAULT_SETTINGS, ...result.settings };
}

export async function updateSettings(
  partial: Partial<ExtensionSettings>
): Promise<ExtensionSettings> {
  const current = await getSettings();
  const updated = { ...current, ...partial };
  await chrome.storage.local.set({ settings: updated });
  return updated;
}

// --- Usage (Free tier counter) ---

export async function getUsage(): Promise<UsageData> {
  const result = await chrome.storage.local.get("usage");
  return { ...DEFAULT_USAGE, ...result.usage };
}

export async function incrementUsage(): Promise<UsageData> {
  const usage = await getUsage();
  const today = new Date().toISOString().slice(0, 10);

  if (usage.date !== today) {
    // New day — reset counter
    const updated: UsageData = { date: today, count: 1 };
    await chrome.storage.local.set({ usage: updated });
    return updated;
  }

  usage.count += 1;
  await chrome.storage.local.set({ usage });
  return usage;
}

// --- Stats ---

export async function getStats(): Promise<StatsData> {
  const result = await chrome.storage.local.get("stats");
  return { ...DEFAULT_STATS, ...result.stats };
}

export async function recordScan(
  piiCount: number,
  maskedCount: number,
  byType: Partial<Record<PIIType, number>>,
  site: string
): Promise<void> {
  const stats = await getStats();
  stats.totalScans += 1;
  stats.totalPiiFound += piiCount;
  stats.totalMasked += maskedCount;

  for (const [type, count] of Object.entries(byType)) {
    const key = type as PIIType;
    stats.byType[key] = (stats.byType[key] || 0) + (count || 0);
  }

  stats.bySite[site] = (stats.bySite[site] || 0) + 1;

  await chrome.storage.local.set({ stats });
}

// Pro status is now managed by src/lib/auth.ts
// which handles token-based verification with pdfcensor.com
