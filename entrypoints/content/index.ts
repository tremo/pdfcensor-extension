import { browser } from "wxt/browser";
import { getAdapter } from "../../src/adapters";
import { createToast } from "../../src/ui/toast";
import { extractText } from "../../src/lib/file-scanner";
import type { ScanResponse, ScanTextMessage, ScanFileMessage, FileWarningResponse, ExtensionSettings, PlatformId, DetectionAction } from "../../src/utils/messaging";
import { AVAILABLE_PLATFORMS } from "../../src/utils/messaging";
import type { PIIMatch } from "../../src/lib/pii/types";

/**
 * Scan state machine — prevents race condition between scan and send.
 *
 * States:
 *   IDLE      — no PII detected, send allowed
 *   SCANNING  — scan in progress, send should wait
 *   DETECTED  — PII found, send blocked until resolved
 *   MASKED    — text was masked, send allowed
 */
type ScanState = "IDLE" | "SCANNING" | "DETECTED" | "MASKED";

/** Check if the current hostname is enabled in settings */
function isPlatformEnabled(hostname: string, enabledPlatforms: PlatformId[]): boolean {
  // If no platforms configured, allow all
  if (!enabledPlatforms || enabledPlatforms.length === 0) return true;

  const platform = AVAILABLE_PLATFORMS.find((p) =>
    p.hostnames.some((h) => hostname === h || hostname.endsWith(`.${h}`))
  );

  // If it's a known platform, check if it's enabled
  if (platform) return enabledPlatforms.includes(platform.id);

  // Unknown platform — check if "generic" is enabled
  return enabledPlatforms.includes("generic");
}

export default defineContentScript({
  matches: [
    "https://chatgpt.com/*",
    "https://chat.openai.com/*",
    "https://claude.ai/*",
    "https://gemini.google.com/*",
    "https://copilot.microsoft.com/*",
    "https://mail.google.com/*",
    "https://outlook.live.com/*",
    "https://notion.so/*",
    "https://app.slack.com/*",
    "https://discord.com/*",
  ],
  runAt: "document_idle",
  async main() {
    try {
      // Check if this platform is enabled in settings
      const settingsRes = await browser.runtime.sendMessage({ type: "GET_SETTINGS" }).catch(() => null) as { settings?: ExtensionSettings } | null;
      if (settingsRes?.settings) {
        const { enabledPlatforms } = settingsRes.settings;
        if (!isPlatformEnabled(window.location.hostname, enabledPlatforms)) return;
      }

      const adapter = getAdapter(window.location.hostname);
      if (!adapter) return;

      let lastScanText = "";
      let pendingMatches: PIIMatch[] = [];
      let scanState: ScanState = "IDLE";
      let scanDebounceTimer: ReturnType<typeof setTimeout> | null = null;
      let currentDetectionAction: DetectionAction = "warn_only";
      const toast = createToast();

      const scanText = (text: string) => {
        scanState = "SCANNING";
        const message: ScanTextMessage = { type: "SCAN_TEXT", text };

        browser.runtime.sendMessage(message).then((raw: unknown) => {
          const response = raw as ScanResponse;
          if (!response || response.type !== "SCAN_RESULT") {
            scanState = "IDLE";
            return;
          }

          pendingMatches = response.matches;
          if (response.detectionAction) {
            currentDetectionAction = response.detectionAction;
          }

          if (response.totalCount > 0) {
            // auto_censor: apply masked text immediately if available
            if (currentDetectionAction === "auto_censor" && response.masked) {
              adapter.setMessageText(response.masked);
              pendingMatches = [];
              scanState = "MASKED";
              toast.showWarning(response.totalCount);
              // Auto-hide after 2 seconds
              setTimeout(() => toast.hide(), 2000);
            } else {
              scanState = "DETECTED";
              toast.showWarning(response.totalCount);
            }
          } else {
            scanState = "IDLE";
            toast.hide();
          }
        }).catch((err: unknown) => {
          console.error("[OfflineRedact] Scan failed:", err);
          scanState = "IDLE";
        });
      };

      // Observe input changes — debounced to avoid spam
      const cleanup = adapter.observe(() => {
        try {
          const text = adapter.getMessageText();
          if (!text || text === lastScanText) return;
          lastScanText = text;

          // Reset state on new text
          if (scanState === "MASKED") {
            scanState = "IDLE";
          }

          // Debounce scan — 300ms after last keystroke
          if (scanDebounceTimer) clearTimeout(scanDebounceTimer);
          scanDebounceTimer = setTimeout(() => scanText(text), 300);
        } catch (err) {
          console.error("[OfflineRedact] Observer error:", err);
        }
      });

      // Intercept send button
      const cleanupIntercept = adapter.interceptSend(() => {
        // Allow send if no PII or already masked
        if (scanState === "IDLE" || scanState === "MASKED") return true;

        // warn_only mode — show warning but allow send
        if (currentDetectionAction === "warn_only") {
          if (scanState === "DETECTED") {
            toast.showWarning(pendingMatches.length);
          }
          return true; // don't block
        }

        // auto_censor mode — if masked text wasn't applied yet, block briefly
        if (currentDetectionAction === "auto_censor") {
          if (scanState === "SCANNING") {
            toast.showWarning(0);
            return false; // wait for scan to finish
          }
          // DETECTED but not masked — request mask and auto-apply
          if (scanState === "DETECTED") {
            const msg: ScanTextMessage = { type: "SCAN_TEXT", text: adapter.getMessageText() };
            browser.runtime.sendMessage(msg).then((raw: unknown) => {
              const response = raw as ScanResponse;
              if (response?.masked) {
                adapter.setMessageText(response.masked);
                pendingMatches = [];
                scanState = "MASKED";
                toast.hide();
                // Re-click send after masking
                setTimeout(() => adapter.getSendButton()?.click(), 50);
              }
            }).catch((err: unknown) => {
              console.error("[OfflineRedact] Auto-mask request failed:", err);
            });
            return false;
          }
          return true;
        }

        // block_and_confirm mode — block send and show options
        if (scanState === "SCANNING") {
          toast.showWarning(0); // "Scanning..."
          return false;
        }

        // DETECTED state — block send and show mask/ignore/review
        toast.show({
          matchCount: pendingMatches.length,
          onMask: () => {
            const msg: ScanTextMessage = { type: "SCAN_TEXT", text: adapter.getMessageText() };
            browser.runtime.sendMessage(msg).then((raw: unknown) => {
              const response = raw as ScanResponse;
              if (response?.masked) {
                adapter.setMessageText(response.masked);
                pendingMatches = [];
                scanState = "MASKED";
                toast.hide();
              }
            }).catch((err: unknown) => {
              console.error("[OfflineRedact] Mask request failed:", err);
            });
          },
          onIgnore: () => {
            pendingMatches = [];
            scanState = "IDLE";
            toast.hide();
            // Re-click send after state reset
            setTimeout(() => adapter.getSendButton()?.click(), 50);
          },
          onReview: () => {
            toast.showDetails(pendingMatches);
          },
        });

        return false; // block send
      });

      // --- File upload interception ---
      function watchFileInputs() {
        const fileInput = adapter.getFileInput();
        if (fileInput && !fileInput.dataset.offlineredactWatched) {
          fileInput.dataset.offlineredactWatched = "true";
          fileInput.addEventListener("change", handleFileUpload);
        }
      }

      // Chunk size for large file scanning — stays safely under Chrome's message limit
      const CHUNK_SIZE = 512 * 1024; // 512 KB per chunk
      const CHUNK_OVERLAP = 200; // chars overlap to catch PII at boundaries

      async function scanFileText(fileName: string, text: string): Promise<FileWarningResponse> {
        // Small enough to send in one message
        if (text.length <= CHUNK_SIZE) {
          const raw = await browser.runtime.sendMessage({
            type: "SCAN_FILE",
            fileName,
            text,
          } as ScanFileMessage);
          return raw as FileWarningResponse;
        }

        // Large text — split into overlapping chunks and merge results
        const allMatches: PIIMatch[] = [];
        const seenKeys = new Set<string>();

        for (let offset = 0; offset < text.length; offset += CHUNK_SIZE - CHUNK_OVERLAP) {
          const chunk = text.slice(offset, offset + CHUNK_SIZE);

          const raw = await browser.runtime.sendMessage({
            type: "SCAN_FILE",
            fileName,
            text: chunk,
          } as ScanFileMessage);
          const res = raw as FileWarningResponse;

          if (res?.matches) {
            for (const match of res.matches) {
              // Deduplicate matches from overlapping regions using value + adjusted position
              const adjustedStart = match.startIndex + offset;
              const key = `${match.type}:${adjustedStart}:${match.value}`;
              if (!seenKeys.has(key)) {
                seenKeys.add(key);
                allMatches.push({ ...match, startIndex: adjustedStart, endIndex: match.endIndex + offset });
              }
            }
          }
        }

        return {
          type: "FILE_WARNING",
          fileName,
          piiCount: allMatches.length,
          matches: allMatches,
        };
      }

      async function handleFileUpload(e: Event) {
        const input = e.target as HTMLInputElement;
        const files = input.files;
        if (!files || files.length === 0) return;

        for (const file of Array.from(files)) {
          try {
            const text = await extractText(file);
            if (!text) continue;

            const response = await scanFileText(file.name, text);

            if (response && response.piiCount > 0) {
              toast.showFileWarning({
                fileName: response.fileName,
                piiCount: response.piiCount,
                matches: response.matches,
                onUpgradePro: () => {
                  window.open("https://offlineredact.com/en/pricing", "_blank");
                },
                onDismiss: () => {
                  toast.hide();
                },
              });
            }
          } catch (err) {
            console.error("[OfflineRedact] File scan failed:", err);
          }
        }
      }

      // Watch for file inputs (poll because they can appear dynamically)
      watchFileInputs();
      const fileInputPoll = setInterval(watchFileInputs, 2000);

      // Also observe DOM for dynamically added file inputs
      const fileInputObserver = new MutationObserver(() => watchFileInputs());
      fileInputObserver.observe(document.body, { childList: true, subtree: true });

      // Cleanup on navigation
      window.addEventListener("beforeunload", () => {
        cleanup();
        cleanupIntercept();
        toast.destroy();
        clearInterval(fileInputPoll);
        fileInputObserver.disconnect();
        if (scanDebounceTimer) clearTimeout(scanDebounceTimer);
      });
    } catch (err) {
      console.error("[OfflineRedact] Content script init failed:", err);
    }
  },
});
