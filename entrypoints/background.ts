import { getSettings, incrementUsage, getUsage, recordScan } from "../src/lib/storage";
import { getProStatus, verifyProStatus, login, logout, getUserInfo } from "../src/lib/auth";
import { detectPII } from "../src/lib/pii/detector";
import { getRegulationPatterns } from "../src/lib/pii/regulations";
import { maskText } from "../src/lib/masker";
import type { Message, ScanResponse, UsageResponse } from "../src/utils/messaging";

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
];

// Simple scan lock to prevent race conditions on usage counter
let scanInProgress = false;

export default defineBackground(() => {
  // Message handler with sender validation
  chrome.runtime.onMessage.addListener(
    (message: Message, sender, sendResponse) => {
      // Validate sender — only allow from our content scripts or popup
      if (!isValidSender(sender)) {
        console.warn("[PDFcensor] Rejected message from:", sender.url);
        sendResponse({ type: "ERROR", error: "Unauthorized" });
        return true;
      }

      handleMessage(message, sender).then(sendResponse).catch((err) => {
        console.error("[PDFcensor] Message handler error:", err);
        sendResponse({ type: "ERROR", error: "Internal error" });
      });
      return true; // async response
    }
  );

  // chrome.alarms for persistent periodic Pro check (survives MV3 worker restart)
  chrome.alarms.create(PRO_CHECK_ALARM, { periodInMinutes: 60 });
  chrome.alarms.onAlarm.addListener((alarm) => {
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

function isValidSender(sender: chrome.runtime.MessageSender): boolean {
  // Allow messages from our own extension (popup, options)
  if (sender.id === chrome.runtime.id && !sender.url?.startsWith("http")) {
    return true;
  }
  // Allow from popup (chrome-extension:// URLs)
  if (sender.url?.startsWith(`chrome-extension://${chrome.runtime.id}`)) {
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
  sender: chrome.runtime.MessageSender
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
    let piiTypes = getRegulationPatterns(settings.regulation);
    if (!isPro) {
      piiTypes = piiTypes.filter((t) =>
        (FREE_PII_TYPES as readonly string[]).includes(t)
      );
    }

    const result = detectPII(text, 0, piiTypes);

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
