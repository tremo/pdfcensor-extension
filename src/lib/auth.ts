/**
 * Extension Auth Module — Pro verification
 *
 * The extension runs on a different origin so it cannot access
 * offlineredact.com cookies via document.cookie. Uses chrome.cookies
 * API instead (works with HttpOnly cookies too).
 *
 * LOGIN FLOW:
 *   1. User clicks "Log in" in the popup
 *   2. A new tab opens to offlineredact.com/{locale}/login
 *   3. Background script polls chrome.cookies for Supabase auth cookie
 *   4. When session cookie found, tokens are extracted and stored
 *   5. Login tab is automatically closed
 *
 * AUTO-DETECT:
 *   - On startup and periodically, the extension checks if the user
 *     is already logged in on offlineredact.com by reading cookies
 *
 * PRO VERIFICATION:
 *   1. Background worker uses chrome.alarms for periodic (1 hour) verify
 *   2. POST /api/extension/verify — with Bearer token
 *   3. Result is cached in browser.storage.local
 *
 * TOKEN REFRESH:
 *   - When access token expires, /api/extension/refresh proxy endpoint is used
 *   - If refresh also fails, tries to re-read cookies from offlineredact.com
 */

import { browser } from "wxt/browser";
import { getLocale } from "./i18n";

const API_BASE = "https://offlineredact.com";
const VERIFY_ENDPOINT = `${API_BASE}/api/extension/verify`;
const REFRESH_ENDPOINT = `${API_BASE}/api/extension/refresh`;
const PRO_CACHE_TTL = 3600000; // 1 hour

// ─── Token Storage ───────────────────────────────────────────

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // timestamp (ms)
}

interface ProStatusCache {
  isPro: boolean;
  email: string | null;
  expiresAt: string | null; // subscription expiry
  timestamp: number;
}

export async function getTokens(): Promise<AuthTokens | null> {
  const result = await browser.storage.local.get("authTokens") as Record<string, any>;
  return result.authTokens ?? null;
}

export async function saveTokens(tokens: AuthTokens): Promise<void> {
  await browser.storage.local.set({ authTokens: tokens });
}

export async function clearTokens(): Promise<void> {
  await browser.storage.local.remove(["authTokens", "proStatus"]);
}

export async function isLoggedIn(): Promise<boolean> {
  const tokens = await getTokens();
  return tokens !== null;
}

// ─── Cookie-based Session Detection ─────────────────────────

/**
 * Read Supabase auth session from offlineredact.com cookies using
 * chrome.cookies API. This works with HttpOnly cookies too.
 *
 * @supabase/ssr stores session as:
 *   - Single cookie: sb-{ref}-auth-token = JSON
 *   - Chunked: sb-{ref}-auth-token.0, .1, .2, ... = JSON parts
 */
export async function readSessionFromCookies(): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
} | null> {
  try {
    const allCookies = await browser.cookies.getAll({
      url: "https://offlineredact.com",
    });

    // Find sb-{ref}-auth-token cookies
    const authCookies = allCookies.filter(
      (c: { name: string }) => c.name.startsWith("sb-") && c.name.includes("-auth-token")
    );

    if (authCookies.length === 0) return null;

    // Sort: try non-chunked first, then chunked (.0, .1, ...)
    const single = authCookies.find(
      (c: { name: string }) => /^sb-.+-auth-token$/.test(c.name)
    );

    let sessionJson: string | null = null;

    if (single) {
      sessionJson = (single as { value: string }).value;
    } else {
      // Chunked cookies — reassemble in order
      const chunks = authCookies
        .filter((c: { name: string }) => /^sb-.+-auth-token\.\d+$/.test(c.name))
        .sort((a: { name: string }, b: { name: string }) => {
          const numA = parseInt(a.name.split(".").pop() || "0", 10);
          const numB = parseInt(b.name.split(".").pop() || "0", 10);
          return numA - numB;
        });

      if (chunks.length > 0) {
        sessionJson = chunks.map((c: { value: string }) => c.value).join("");
      }
    }

    if (!sessionJson) return null;

    return parseSessionJson(sessionJson);
  } catch (error) {
    console.error("[OfflineRedact] Cookie read failed:", error);
    return null;
  }
}

/**
 * Try to parse session JSON. Handles plain JSON, base64url-encoded (Supabase SSR v0.5+),
 * legacy base64-encoded, and URL-encoded formats.
 *
 * @supabase/ssr v0.5+ stores cookies as: "base64-" + base64url(JSON)
 */
function parseSessionJson(raw: string): {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
} | null {
  // Try plain JSON first
  let data = tryParseJson(raw);

  // Try Supabase SSR v0.5+ base64url format: "base64-" prefix + base64url encoded JSON
  if (!data && raw.startsWith("base64-")) {
    try {
      const encoded = raw.substring(7); // strip "base64-" prefix
      const decoded = base64urlDecode(encoded);
      data = tryParseJson(decoded);
    } catch {
      // not valid base64url
    }
  }

  // Try standard base64 decode if plain JSON fails
  if (!data) {
    try {
      const decoded = atob(raw);
      data = tryParseJson(decoded);
    } catch {
      // not base64
    }
  }

  // Try URL-decoded JSON
  if (!data) {
    try {
      const decoded = decodeURIComponent(raw);
      data = tryParseJson(decoded);
    } catch {
      // not URL-encoded
    }
  }

  if (!data) return null;

  const accessToken = data.access_token;
  const refreshToken = data.refresh_token;
  const expiresIn = data.expires_in || 3600;

  if (accessToken && refreshToken) {
    return { accessToken, refreshToken, expiresIn };
  }

  return null;
}

/**
 * Decode a base64url-encoded string to UTF-8.
 * Base64url uses '-' instead of '+', '_' instead of '/', and no padding.
 */
function base64urlDecode(str: string): string {
  // Convert base64url to standard base64
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  // Add padding if needed
  const pad = base64.length % 4;
  if (pad === 2) base64 += "==";
  else if (pad === 3) base64 += "=";

  // Decode base64 to binary string, then decode as UTF-8
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

function tryParseJson(str: string): Record<string, any> | null {
  try {
    const obj = JSON.parse(str);
    if (obj && typeof obj === "object") return obj;
  } catch {
    // not JSON
  }
  return null;
}

/**
 * Try to detect an existing session from offlineredact.com cookies.
 * If found, stores tokens and verifies Pro status.
 * Returns true if session was detected and tokens were stored.
 */
export async function tryDetectSessionFromCookies(): Promise<boolean> {
  const session = await readSessionFromCookies();
  if (!session) return false;

  // Check if we already have valid tokens — don't overwrite
  const existing = await getTokens();
  if (existing && existing.expiresAt > Date.now() + 300000) {
    return true; // already have valid tokens
  }

  await saveTokens({
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
    expiresAt: Date.now() + session.expiresIn * 1000,
  });

  await verifyProStatus();
  return true;
}

// ─── Login Flow ──────────────────────────────────────────────

let loginResolver: ((success: boolean) => void) | null = null;
let loginTabId: number | null = null;
let loginPollTimer: ReturnType<typeof setInterval> | null = null;

export async function login(): Promise<boolean> {
  try {
    const locale = getLocale();
    const tab = await browser.tabs.create({
      url: `${API_BASE}/${locale}/login`,
      active: true,
    });

    loginTabId = tab.id ?? null;

    return new Promise<boolean>((resolve) => {
      loginResolver = resolve;

      // Poll cookies every 2 seconds to detect login
      loginPollTimer = setInterval(async () => {
        const session = await readSessionFromCookies();
        if (session) {
          // Login detected!
          clearLoginPoll();

          await saveTokens({
            accessToken: session.accessToken,
            refreshToken: session.refreshToken,
            expiresAt: Date.now() + session.expiresIn * 1000,
          });

          await verifyProStatus();

          // Close the login tab
          if (loginTabId !== null) {
            try {
              await browser.tabs.remove(loginTabId);
            } catch {
              // Tab may already be closed
            }
            loginTabId = null;
          }

          if (loginResolver === resolve) {
            loginResolver = null;
            resolve(true);
          }
        }
      }, 2000);

      // Timeout after 5 minutes
      setTimeout(() => {
        if (loginResolver === resolve) {
          clearLoginPoll();
          loginResolver = null;
          loginTabId = null;
          resolve(false);
        }
      }, 300000);
    });
  } catch (error) {
    console.error("[OfflineRedact] Login failed:", error);
    return false;
  }
}

function clearLoginPoll() {
  if (loginPollTimer) {
    clearInterval(loginPollTimer);
    loginPollTimer = null;
  }
}

/**
 * Called by background script when AUTH_TOKEN_FOUND message arrives
 * from the offlineredact-auth content script (fallback path).
 */
export async function handleAuthTokenFromContentScript(
  accessToken: string,
  refreshToken: string,
  expiresIn: number
): Promise<boolean> {
  try {
    await saveTokens({
      accessToken,
      refreshToken,
      expiresAt: Date.now() + expiresIn * 1000,
    });

    await verifyProStatus();

    // Close the login tab
    if (loginTabId !== null) {
      try {
        await browser.tabs.remove(loginTabId);
      } catch {
        // Tab may already be closed
      }
      loginTabId = null;
    }

    // Resolve the pending login promise
    clearLoginPoll();
    if (loginResolver) {
      loginResolver(true);
      loginResolver = null;
    }

    return true;
  } catch (error) {
    console.error("[OfflineRedact] Token handling failed:", error);
    if (loginResolver) {
      loginResolver(false);
      loginResolver = null;
    }
    return false;
  }
}

export async function logout(): Promise<void> {
  await clearTokens();
}

// ─── Token Refresh ───────────────────────────────────────────

async function refreshAccessToken(): Promise<boolean> {
  const tokens = await getTokens();
  if (!tokens?.refreshToken) return false;

  try {
    const response = await fetch(REFRESH_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: tokens.refreshToken }),
    });

    if (!response.ok) {
      console.error("[OfflineRedact] Token refresh failed:", response.status);
      // If refresh fails, try to re-read from cookies
      return tryDetectSessionFromCookies();
    }

    const data = await response.json();
    if (!data.accessToken || !data.refreshToken) return false;

    await saveTokens({
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      expiresAt: Date.now() + (data.expiresIn || 3600) * 1000,
    });

    return true;
  } catch (error) {
    console.error("[OfflineRedact] Token refresh error:", error);
    return false;
  }
}

export async function getValidAccessToken(): Promise<string | null> {
  let tokens = await getTokens();

  // No tokens stored — try to detect from cookies
  if (!tokens) {
    const detected = await tryDetectSessionFromCookies();
    if (!detected) return null;
    tokens = await getTokens();
    if (!tokens) return null;
  }

  // Token still valid (5 min buffer)
  if (tokens.expiresAt > Date.now() + 300000) {
    return tokens.accessToken;
  }

  // Try refresh
  const refreshed = await refreshAccessToken();
  if (!refreshed) return null;

  const newTokens = await getTokens();
  return newTokens?.accessToken ?? null;
}

// ─── Pro Status Verification ─────────────────────────────────

export async function verifyProStatus(): Promise<boolean> {
  const accessToken = await getValidAccessToken();
  if (!accessToken) return false;

  try {
    const response = await fetch(VERIFY_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (response.status === 401) {
      await clearTokens();
      return false;
    }

    if (!response.ok) {
      console.error("[OfflineRedact] Verify failed:", response.status);
      return false;
    }

    const data: { isPro: boolean; email: string | null; expiresAt: string | null } =
      await response.json();

    const proStatus: ProStatusCache = {
      isPro: data.isPro,
      email: data.email,
      expiresAt: data.expiresAt,
      timestamp: Date.now(),
    };
    await browser.storage.local.set({ proStatus });

    return data.isPro;
  } catch (error) {
    console.error("[OfflineRedact] Verify error:", error);
    return false;
  }
}

export async function getProStatus(): Promise<boolean> {
  const result = await browser.storage.local.get("proStatus") as Record<string, any>;
  const cached = result.proStatus as ProStatusCache | undefined;

  if (cached && Date.now() - cached.timestamp < PRO_CACHE_TTL) {
    return cached.isPro;
  }

  return verifyProStatus();
}

export async function getUserInfo(): Promise<{
  isLoggedIn: boolean;
  isPro: boolean;
  email: string | null;
  subscriptionExpiresAt: string | null;
}> {
  const tokens = await getTokens();
  if (!tokens) {
    // Try auto-detect from cookies before giving up
    const detected = await tryDetectSessionFromCookies();
    if (!detected) {
      return { isLoggedIn: false, isPro: false, email: null, subscriptionExpiresAt: null };
    }
  }

  const result = await browser.storage.local.get("proStatus") as Record<string, any>;
  const cached = result.proStatus as ProStatusCache | undefined;

  return {
    isLoggedIn: true,
    isPro: cached?.isPro ?? false,
    email: cached?.email ?? null,
    subscriptionExpiresAt: cached?.expiresAt ?? null,
  };
}
