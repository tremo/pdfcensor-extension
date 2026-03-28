/**
 * Content script that runs on offlineredact.com to detect Supabase login.
 *
 * offlineredact.com uses @supabase/ssr which stores the session in COOKIES
 * (not localStorage). The cookie name follows the pattern:
 *   sb-{project-ref}-auth-token
 * For large sessions it may be chunked:
 *   sb-{ref}-auth-token.0, sb-{ref}-auth-token.1, ...
 *
 * This script polls document.cookie for the Supabase auth cookie,
 * extracts the tokens, and sends them to the background script.
 */
import { browser } from "wxt/browser";

export default defineContentScript({
  matches: ["https://offlineredact.com/*"],
  runAt: "document_idle",
  main() {
    let pollTimer: ReturnType<typeof setInterval> | null = null;
    let sent = false;

    /**
     * Parse all cookies into a key→value map.
     */
    function parseCookies(): Record<string, string> {
      const cookies: Record<string, string> = {};
      for (const part of document.cookie.split(";")) {
        const eq = part.indexOf("=");
        if (eq < 0) continue;
        const key = part.slice(0, eq).trim();
        const val = part.slice(eq + 1).trim();
        cookies[key] = decodeURIComponent(val);
      }
      return cookies;
    }

    /**
     * Find the Supabase auth session from cookies.
     * @supabase/ssr stores session as:
     *   - Single cookie: sb-{ref}-auth-token = JSON
     *   - Chunked cookies: sb-{ref}-auth-token.0, .1, .2, ... = JSON parts
     * Also check localStorage as fallback (some Supabase configs use it).
     */
    function findSupabaseSession(): {
      accessToken: string;
      refreshToken: string;
      expiresIn: number;
    } | null {
      // --- Try cookies first (used by @supabase/ssr) ---
      const cookies = parseCookies();
      const cookieNames = Object.keys(cookies);

      // Find auth token cookie(s) with sb-{ref}-auth-token pattern
      const authCookieBase = cookieNames.find(
        (name) => name.startsWith("sb-") && name.endsWith("-auth-token")
      );

      if (authCookieBase) {
        // Try single cookie first
        const singleValue = cookies[authCookieBase];
        const session = tryParseSession(singleValue);
        if (session) return session;
      }

      // Try chunked cookies: sb-{ref}-auth-token.0, .1, .2, ...
      const chunkBases = cookieNames
        .filter((name) => /^sb-.+-auth-token\.\d+$/.test(name))
        .sort();

      if (chunkBases.length > 0) {
        // Reconstruct the full JSON from chunks
        const fullValue = chunkBases.map((name) => cookies[name]).join("");
        const session = tryParseSession(fullValue);
        if (session) return session;
      }

      // --- Fallback: check localStorage ---
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith("sb-") || !key.endsWith("-auth-token")) continue;
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const session = tryParseSession(raw);
        if (session) return session;
      }

      return null;
    }

    /**
     * Decode a base64url-encoded string to UTF-8.
     * Base64url uses '-' instead of '+', '_' instead of '/', and no padding.
     */
    function base64urlDecode(str: string): string {
      let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
      const pad = base64.length % 4;
      if (pad === 2) base64 += "==";
      else if (pad === 3) base64 += "=";
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return new TextDecoder().decode(bytes);
    }

    /**
     * Try to parse a JSON string as a Supabase session object.
     * Handles plain JSON and base64url-encoded format (Supabase SSR v0.5+).
     */
    function tryParseSession(raw: string | undefined): {
      accessToken: string;
      refreshToken: string;
      expiresIn: number;
    } | null {
      if (!raw) return null;

      // Supabase SSR v0.5+ stores cookies as "base64-" + base64url(JSON)
      let jsonStr = raw;
      if (raw.startsWith("base64-")) {
        try {
          jsonStr = base64urlDecode(raw.substring(7));
        } catch {
          // not valid base64url, try as-is
        }
      }

      try {
        const data = JSON.parse(jsonStr);
        // Supabase session can be the object directly or nested
        const accessToken =
          data.access_token ||
          data?.currentSession?.access_token;
        const refreshToken =
          data.refresh_token ||
          data?.currentSession?.refresh_token;
        const expiresIn =
          data.expires_in ||
          data?.currentSession?.expires_in ||
          3600;

        if (accessToken && refreshToken) {
          return { accessToken, refreshToken, expiresIn };
        }
      } catch {
        // ignore parse errors
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
        .catch((err: unknown) => {
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

    // Cleanup on navigation
    window.addEventListener("beforeunload", () => {
      if (pollTimer) clearInterval(pollTimer);
    });
  },
});
