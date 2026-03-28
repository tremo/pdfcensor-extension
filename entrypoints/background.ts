import { browser, type Runtime } from "wxt/browser";
import { getSettings, updateSettings, incrementUsage, getUsage, recordScan } from "../src/lib/storage";
import { getProStatus, verifyProStatus, login, logout, getUserInfo } from "../src/lib/auth";
import { detectPII } from "../src/lib/pii/detector";
import { getRegulationPatterns } from "../src/lib/pii/regulations";
import { maskText } from "../src/lib/masker";
import type { Message, ScanResponse, UsageResponse, FileWarningResponse } from "../src/utils/messaging";

const FREE_DAILY_LIMIT = 5;
const FREE_PII_TYPES = ["email", "phone", "tcKimlik"] as const;
const PRO_CHECK_ALARM = "pro-status-check";

// Allowed origins for message validation
const ALLOWED_ORIGINS = [
  "https://chatgpt.com",
  "https://chat.openai.com",
  "https://claude.ai",
  "https://gemini.google.com",
  "https://copilot.microsoft.com",
  "https://mail.google.com",
  "https://outlook.live.com",
  "https://notion.so",
  "https://app.slack.com",
  "https://discord.com",
];

// Simple scan lock to prevent race conditions on usage counter
let scanInProgress = false;

export default defineBackground(() => {
  // Message handler with sender validation
  browser.runtime.onMessage.addListener(
    (message: unknown, sender: Runtime.MessageSender) => {
      // Validate sender — only allow from our content scripts or popup
      if (!isValidSender(sender)) {
        console.warn("[PDFcensor] Rejected message from:", sender.url);
        return Promise.resolve({ type: "ERROR", error: "Unauthorized" });
      }

      return handleMessage(message as Message, sender).catch((err) => {
        console.error("[PDFcensor] Message handler error:", err);
        return { type: "ERROR", error: "Internal error" };
      });
    }
  );

  // browser.alarms for persistent periodic Pro check (survives MV3 worker restart)
  browser.alarms.create(PRO_CHECK_ALARM, { periodInMinutes: 60 });
  browser.alarms.onAlarm.addListener((alarm: { name: string }) => {
    if (alarm.name === PRO_CHECK_ALARM) {
      verifyProStatus().catch((err) =>
        console.error("[PDFcensor] Periodic Pro check failed:", err)
      );
    }
  });

  // Initial Pro check on startup
  verifyProStatus().catch((err) =>
    console.error("[PDFcensor] Initial Pro check failed:", err)
  );
});

function isValidSender(sender: Runtime.MessageSender): boolean {
  // Allow messages from our own extension (popup, options)
  if (sender.id === browser.runtime.id && !sender.url?.startsWith("http")) {
    return true;
  }
  // Allow from popup (chrome-extension:// or moz-extension:// URLs)
  if (sender.url?.startsWith(browser.runtime.getURL("/popup.html").replace("/popup.html", ""))) {
    return true;
  }
  // Allow from approved content script origins
  if (sender.url) {
    return ALLOWED_ORIGINS.some((origin) => sender.url!.startsWith(origin));
  }
  return false;
}

async function handleMessage(
  message: Message,
  sender: Runtime.MessageSender
): Promise<unknown> {
  // Runtime type check
  if (!message || typeof message.type !== "string") {
    return { type: "ERROR", error: "Invalid message" };
  }

  switch (message.type) {
    case "SCAN_TEXT":
      if (typeof message.text !== "string") {
        return { type: "ERROR", error: "Invalid text" };
      }
      return handleScanText(message.text, sender.url);

    case "SCAN_FILE":
      return handleScanFile(message.text, message.fileName, sender.url);

    case "UPDATE_SETTINGS": {
      const updated = await updateSettings(message.settings);
      return { type: "SETTINGS", settings: updated };
    }

    case "CHECK_USAGE":
      return handleCheckUsage();

    case "GET_SETTINGS": {
      const settings = await getSettings();
      return { type: "SETTINGS", settings };
    }

    case "LOGIN": {
      const success = await login();
      return { type: "LOGIN_RESULT", success };
    }

    case "LOGOUT": {
      await logout();
      return { type: "LOGOUT_RESULT", success: true };
    }

    case "GET_USER_INFO": {
      const info = await getUserInfo();
      return { type: "USER_INFO", ...info };
    }

    default:
      return { type: "ERROR", error: "Unknown message type" };
  }
}

async function handleScanText(text: string, senderUrl?: string): Promise<ScanResponse> {
  const settings = await getSettings();
  if (!settings.enabled) {
    return { type: "SCAN_RESULT", matches: [], totalCount: 0 };
  }

  // Simple lock to prevent usage counter race condition
  if (scanInProgress) {
    // Wait briefly then proceed (doesn't reject, just serializes)
    await new Promise((r) => setTimeout(r, 50));
  }
  scanInProgress = true;

  try {
    const isPro = await getProStatus();

    // Free tier: check daily limit
    if (!isPro) {
      const usage = await getUsage();
      const today = new Date().toISOString().slice(0, 10);
      if (usage.date === today && usage.count >= FREE_DAILY_LIMIT) {
        return { type: "SCAN_RESULT", matches: [], totalCount: 0, limitReached: true };
      }
    }

    // Determine which PII types to scan
    let piiTypes = settings.enabledPiiTypes && settings.enabledPiiTypes.length > 0
      ? settings.enabledPiiTypes
      : getRegulationPatterns(settings.regulation);
    if (!isPro) {
      piiTypes = piiTypes.filter((t) =>
        (FREE_PII_TYPES as readonly string[]).includes(t)
      );
    }

    const result = detectPII(text, 0, piiTypes);

    // Custom keyword detection (Pro only)
    if (isPro && settings.customKeywords && settings.customKeywords.length > 0) {
      for (const keyword of settings.customKeywords) {
        if (!keyword) continue;
        const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regex = new RegExp(escaped, "gi");
        let match;
        while ((match = regex.exec(text)) !== null) {
          result.matches.push({
            type: "names" as any, // Use 'names' as fallback type for custom keywords
            value: match[0],
            startIndex: match.index,
            endIndex: match.index + match[0].length,
            pageIndex: 0,
            confidence: 1.0,
          });
          result.totalCount += 1;
          result.byType["customKeyword"] = (result.byType["customKeyword"] || 0) + 1;
        }
      }
    }

    // Increment usage counter + record stats
    if (result.totalCount > 0) {
      await incrementUsage();

      const siteName = senderUrl
        ? new URL(senderUrl).hostname.replace("www.", "")
        : "unknown";
      await recordScan(
        result.totalCount,
        0, // masked count — will be updated if user masks
        result.byType as Record<string, number>,
        siteName
      );
    }

    // Auto-mask if Pro
    let masked: string | undefined;
    if (isPro && settings.autoMask && result.totalCount > 0) {
      masked = maskText(text, result.matches);
    }

    return {
      type: "SCAN_RESULT",
      matches: result.matches,
      totalCount: result.totalCount,
      masked,
    };
  } finally {
    scanInProgress = false;
  }
}

/**
 * Handle file scan — NO daily limit applied to file scanning.
 * Text extraction happens in the content script; we receive pre-extracted text.
 */
async function handleScanFile(
  text: string,
  fileName: string,
  senderUrl?: string
): Promise<FileWarningResponse> {
  if (!text) {
    return { type: "FILE_WARNING", fileName, piiCount: 0, matches: [] };
  }

  const settings = await getSettings();

  // Determine PII types to scan
  const piiTypes = settings.enabledPiiTypes.length > 0
    ? settings.enabledPiiTypes
    : getRegulationPatterns(settings.regulation);

  const result = detectPII(text, 0, piiTypes);

  // Record stats (no limit check — file scanning is unlimited)
  if (result.totalCount > 0) {
    const siteName = senderUrl
      ? new URL(senderUrl).hostname.replace("www.", "")
      : "unknown";
    await recordScan(result.totalCount, 0, result.byType as Record<string, number>, siteName);
  }

  return {
    type: "FILE_WARNING",
    fileName,
    piiCount: result.totalCount,
    matches: result.matches,
  };
}

async function handleCheckUsage(): Promise<UsageResponse> {
  const isPro = await getProStatus();
  const usage = await getUsage();
  const today = new Date().toISOString().slice(0, 10);
  const todayCount = usage.date === today ? usage.count : 0;

  return {
    type: "USAGE_STATUS",
    remaining: isPro ? Infinity : Math.max(0, FREE_DAILY_LIMIT - todayCount),
    isPro,
  };
}
