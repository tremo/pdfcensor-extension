import { getAdapter } from "../../src/adapters";
import { createToast } from "../../src/ui/toast";
import type { ScanResponse, ScanTextMessage } from "../../src/utils/messaging";
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

export default defineContentScript({
  matches: [
    "https://chatgpt.com/*",
    "https://chat.openai.com/*",
    "https://claude.ai/*",
    "https://gemini.google.com/*",
    "https://copilot.microsoft.com/*",
  ],
  runAt: "document_idle",
  main() {
    try {
      const adapter = getAdapter(window.location.hostname);
      if (!adapter) return;

      let lastScanText = "";
      let pendingMatches: PIIMatch[] = [];
      let scanState: ScanState = "IDLE";
      let scanDebounceTimer: ReturnType<typeof setTimeout> | null = null;
      const toast = createToast();

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
            chrome.runtime.sendMessage(message, (response: ScanResponse) => {
              if (chrome.runtime.lastError) {
                console.error("[PDFcensor] Mask request failed:", chrome.runtime.lastError);
                return;
              }
              if (response?.masked) {
                adapter.setMessageText(response.masked);
                pendingMatches = [];
                scanState = "MASKED";
                toast.hide();
              }
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

      function scanText(text: string) {
        scanState = "SCANNING";
        const message: ScanTextMessage = { type: "SCAN_TEXT", text };

        chrome.runtime.sendMessage(message, (response: ScanResponse) => {
          if (chrome.runtime.lastError) {
            console.error("[PDFcensor] Scan failed:", chrome.runtime.lastError);
            scanState = "IDLE";
            return;
          }
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
        });
      }

      // Cleanup on navigation
      window.addEventListener("beforeunload", () => {
        cleanup();
        cleanupIntercept();
        toast.destroy();
        if (scanDebounceTimer) clearTimeout(scanDebounceTimer);
      });
    } catch (err) {
      console.error("[PDFcensor] Content script init failed:", err);
    }
  },
});
