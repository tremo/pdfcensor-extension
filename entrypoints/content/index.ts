import { browser } from "wxt/browser";
import { getAdapter } from "../../src/adapters";
import { createToast } from "../../src/ui/toast";
import type { ScanResponse, ScanTextMessage, ScanFileMessage, FileWarningResponse, ExtensionSettings, PlatformId } from "../../src/utils/messaging";
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

          if (response.limitReached) {
            scanState = "IDLE";
            toast.showLimit();
            return;
          }

          pendingMatches = response.matches;

          if (response.totalCount > 0) {
            scanState = "DETECTED";
            toast.showWarning(response.totalCount);
          } else {
            scanState = "IDLE";
            toast.hide();
          }
        }).catch((err: unknown) => {
          console.error("[PDFcensor] Scan failed:", err);
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
          console.error("[PDFcensor] Observer error:", err);
        }
      });

      // Intercept send button
      const cleanupIntercept = adapter.interceptSend(() => {
        // Allow send if no PII or already masked
        if (scanState === "IDLE" || scanState === "MASKED") return true;

        // If scanning, block and wait
        if (scanState === "SCANNING") {
          toast.showWarning(0); // "Taranıyor..."
          return false;
        }

        // DETECTED state — block send and show options
        toast.show({
          matchCount: pendingMatches.length,
          onMask: () => {
            const message: ScanTextMessage = { type: "SCAN_TEXT", text: adapter.getMessageText() };
            browser.runtime.sendMessage(message).then((raw: unknown) => {
              const response = raw as ScanResponse;
              if (response?.masked) {
                adapter.setMessageText(response.masked);
                pendingMatches = [];
                scanState = "MASKED";
                toast.hide();
              }
            }).catch((err: unknown) => {
              console.error("[PDFcensor] Mask request failed:", err);
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
        if (fileInput && !fileInput.dataset.pdfcensorWatched) {
          fileInput.dataset.pdfcensorWatched = "true";
          fileInput.addEventListener("change", handleFileUpload);
        }
      }

      async function handleFileUpload(e: Event) {
        const input = e.target as HTMLInputElement;
        const files = input.files;
        if (!files || files.length === 0) return;

        for (const file of Array.from(files)) {
          // Support txt, csv, pdf, docx
          const name = file.name.toLowerCase();
          const supported =
            name.endsWith(".txt") || name.endsWith(".csv") ||
            name.endsWith(".pdf") || name.endsWith(".docx") ||
            file.type.startsWith("text/");

          if (!supported) continue;

          try {
            const arrayBuffer = await file.arrayBuffer();
            const message: ScanFileMessage = {
              type: "SCAN_FILE",
              fileName: file.name,
              fileData: arrayBuffer,
              mimeType: file.type,
            };

            const raw = await browser.runtime.sendMessage(message);
            const response = raw as FileWarningResponse;

            if (response && response.type === "FILE_WARNING" && response.piiCount > 0) {
              toast.showFileWarning({
                fileName: response.fileName,
                piiCount: response.piiCount,
                matches: response.matches,
                onUpgradePro: () => {
                  window.open("https://pdfcensor.com/pricing", "_blank");
                },
                onDismiss: () => {
                  toast.hide();
                },
              });
            }
          } catch (err) {
            console.error("[PDFcensor] File scan failed:", err);
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
      console.error("[PDFcensor] Content script init failed:", err);
    }
  },
});
