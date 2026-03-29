import { browser, type Runtime } from "wxt/browser";
import { getSettings, updateSettings, recordScan } from "../src/lib/storage";
import { getProStatus, verifyProStatus, login, logout, getUserInfo, handleAuthTokenFromContentScript, tryDetectSessionFromCookies } from "../src/lib/auth";
import { detectPII } from "../src/lib/pii/detector";
import { getRegulationPatterns } from "../src/lib/pii/regulations";
import { maskText } from "../src/lib/masker";
import type { Message, ScanResponse, UsageResponse, FileWarningResponse } from "../src/utils/messaging";
import { detectLocale } from "../src/lib/i18n";

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
  "https://offlineredact.com",
];

// Simple scan lock to prevent race conditions
let scanInProgress = false;

export default defineBackground(() => {
  // Detect locale early so auth.ts login() can use getLocale()
  detectLocale();

  browser.runtime.onMessage.addListener(
    (message: unknown, sender: Runtime.MessageSender) => {
      if (!isValidSender(sender)) {
        console.warn("[OfflineRedact] Rejected message from:", sender.url);
        return Promise.resolve({ type: "ERROR", error: "Unauthorized" });
      }

      return handleMessage(message as Message, sender).catch((err) => {
        console.error("[OfflineRedact] Message handler error:", err);
        return { type: "ERROR", error: "Internal error" };
      });
    }
  );

  // Periodic Pro status check (survives MV3 worker restart)
  browser.alarms.create(PRO_CHECK_ALARM, { periodInMinutes: 60 });
  browser.alarms.onAlarm.addListener((alarm: { name: string }) => {
    if (alarm.name === PRO_CHECK_ALARM) {
      verifyProStatus().catch((err) =>
        console.error("[OfflineRedact] Periodic Pro check failed:", err)
      );
    }
  });

  // Initial check: try to detect session from offlineredact.com cookies,
  // then verify Pro status. This auto-detects login if user is already
  // logged in on the website.
  tryDetectSessionFromCookies()
    .then(() => verifyProStatus())
    .catch((err) =>
      console.error("[OfflineRedact] Initial session/Pro check failed:", err)
    );
});

function isValidSender(sender: Runtime.MessageSender): boolean {
  if (sender.id === browser.runtime.id && !sender.url?.startsWith("http")) {
    return true;
  }
  if (sender.url?.startsWith(browser.runtime.getURL("/popup.html").replace("/popup.html", ""))) {
    return true;
  }
  if (sender.url) {
    return ALLOWED_ORIGINS.some((origin) => sender.url!.startsWith(origin));
  }
  return false;
}

async function handleMessage(
  message: Message,
  sender: Runtime.MessageSender
): Promise<unknown> {
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

    case "AUTH_TOKEN_FOUND": {
      const success = await handleAuthTokenFromContentScript(
        message.accessToken,
        message.refreshToken,
        message.expiresIn
      );
      return { type: "AUTH_TOKEN_RESULT", success };
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

  // Simple lock to prevent race conditions
  if (scanInProgress) {
    await new Promise((r) => setTimeout(r, 50));
  }
  scanInProgress = true;

  try {
    const isPro = await getProStatus();

    // Determine which PII types to scan — no daily limit, all types available
    const piiTypes = settings.enabledPiiTypes && settings.enabledPiiTypes.length > 0
      ? settings.enabledPiiTypes
      : getRegulationPatterns(settings.regulation);

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
            type: "names" as any,
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

    // Record stats
    if (result.totalCount > 0) {
      const siteName = senderUrl
        ? new URL(senderUrl).hostname.replace("www.", "")
        : "unknown";
      await recordScan(
        result.totalCount,
        0,
        result.byType as Record<string, number>,
        siteName
      );
    }

    // Auto-mask if Pro and auto_censor detection action
    let masked: string | undefined;
    const shouldAutoMask = isPro && result.totalCount > 0 &&
      settings.detectionAction === "auto_censor";
    if (shouldAutoMask) {
      masked = maskText(text, result.matches);
    }

    return {
      type: "SCAN_RESULT",
      matches: result.matches,
      totalCount: result.totalCount,
      masked,
      detectionAction: settings.detectionAction,
    };
  } finally {
    scanInProgress = false;
  }
}

/**
 * Handle file scan — text extraction happens in the content script.
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

  const piiTypes = settings.enabledPiiTypes.length > 0
    ? settings.enabledPiiTypes
    : getRegulationPatterns(settings.regulation);

  const result = detectPII(text, 0, piiTypes);

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

  return {
    type: "USAGE_STATUS",
    isPro,
  };
}
