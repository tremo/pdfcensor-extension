/**
 * Content script that runs on offlineredact.com to detect Supabase login.
 *
 * After the user logs in on offlineredact.com, Supabase stores session tokens
 * in localStorage under a key like `sb-{ref}-auth-token`. This script polls
 * localStorage for that key and sends the tokens back to the background script.
 */
import { browser } from "wxt/browser";

export default defineContentScript({
  matches: ["https://offlineredact.com/*"],
  runAt: "document_idle",
  main() {
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let sent = false;

    function findSupabaseSession(): {
      accessToken: string;
      refreshToken: string;
      expiresIn: number;
    } | null {
      // Supabase stores session under `sb-{project-ref}-auth-token`
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith("sb-") || !key.endsWith("-auth-token")) continue;

        try {
          const raw = localStorage.getItem(key);
          if (!raw) continue;
          const data = JSON.parse(raw);

          // Supabase stores the session object directly or nested
          const accessToken = data.access_token || data?.currentSession?.access_token;
          const refreshToken = data.refresh_token || data?.currentSession?.refresh_token;
          const expiresIn = data.expires_in || data?.currentSession?.expires_in || 3600;

          if (accessToken && refreshToken) {
            return { accessToken, refreshToken, expiresIn };
          }
        } catch {
          // ignore parse errors
        }
      }
      return null;
    }

    function checkAndSend() {
      if (sent) return;
      const session = findSupabaseSession();
      if (!session) return;

      sent = true;
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }

      browser.runtime
        .sendMessage({
          type: "AUTH_TOKEN_FOUND",
          accessToken: session.accessToken,
          refreshToken: session.refreshToken,
          expiresIn: session.expiresIn,
        })
        .catch((err) => {
          console.error("[OfflineRedact] Failed to send auth tokens:", err);
          sent = false; // retry on next poll
        });
    }

    // Check immediately in case user is already logged in
    checkAndSend();

    // Poll every second for session changes (login completion)
    if (!sent) {
      pollTimer = setInterval(checkAndSend, 1000);
    }

    // Also listen for storage events (another tab might set the token)
    window.addEventListener("storage", checkAndSend);

    // Cleanup on navigation
    window.addEventListener("beforeunload", () => {
      if (pollTimer) clearInterval(pollTimer);
      window.removeEventListener("storage", checkAndSend);
    });
  },
});
