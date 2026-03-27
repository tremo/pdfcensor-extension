/**
 * Extension Auth Module — Pro doğrulama
 *
 * Extension farklı origin'de çalıştığı için pdfcensor.com'un cookie'lerine
 * erişemez. Bunun yerine şu akış kullanılır:
 *
 * LOGIN AKIŞI:
 *   1. Kullanıcı popup'tan "Giriş Yap" butonuna tıklar
 *   2. chrome.identity.launchWebAuthFlow() ile pdfcensor.com/login açılır
 *   3. Login sonrası pdfcensor.com/auth/extension-callback redirect'i
 *      URL hash'inde Supabase access_token ve refresh_token döner
 *   4. Extension token'ları chrome.storage.local'e kaydeder
 *
 * PRO DOĞRULAMA:
 *   1. Extension background worker chrome.alarms ile periyodik (1 saat) verify çağırır
 *   2. POST /api/extension/verify — Bearer token ile
 *   3. Sonuç cache'lenir (chrome.storage.local)
 *
 * TOKEN YENİLEME:
 *   - Access token süresi dolunca web app'teki /api/extension/refresh proxy endpoint'i kullanılır
 *   - Refresh de başarısız olursa kullanıcı tekrar login yapmalı
 */

const API_BASE = "https://pdfcensor.com";
const VERIFY_ENDPOINT = `${API_BASE}/api/extension/verify`;
const REFRESH_ENDPOINT = `${API_BASE}/api/extension/refresh`;
const PRO_CACHE_TTL = 3600000; // 1 saat

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
  const result = await chrome.storage.local.get("authTokens");
  return result.authTokens ?? null;
}

export async function saveTokens(tokens: AuthTokens): Promise<void> {
  await chrome.storage.local.set({ authTokens: tokens });
}

export async function clearTokens(): Promise<void> {
  await chrome.storage.local.remove(["authTokens", "proStatus"]);
}

export async function isLoggedIn(): Promise<boolean> {
  const tokens = await getTokens();
  return tokens !== null;
}

// ─── Login Flow ──────────────────────────────────────────────

export async function login(): Promise<boolean> {
  try {
    const redirectUrl = chrome.identity.getRedirectURL("callback");
    const authUrl =
      `${API_BASE}/login?` +
      `redirect_to=${encodeURIComponent(redirectUrl)}` +
      `&source=extension`;

    const responseUrl = await chrome.identity.launchWebAuthFlow({
      url: authUrl,
      interactive: true,
    });

    if (!responseUrl) return false;

    // Parse tokens from URL hash
    const url = new URL(responseUrl);
    const hash = new URLSearchParams(url.hash.slice(1));
    const accessToken = hash.get("access_token");
    const refreshToken = hash.get("refresh_token");
    const expiresIn = parseInt(hash.get("expires_in") || "3600", 10);

    if (!accessToken || !refreshToken) return false;

    await saveTokens({
      accessToken,
      refreshToken,
      expiresAt: Date.now() + expiresIn * 1000,
    });

    // Immediately verify Pro status
    await verifyProStatus();

    return true;
  } catch (error) {
    console.error("[PDFcensor] Login failed:", error);
    return false;
  }
}

export async function logout(): Promise<void> {
  await clearTokens();
}

// ─── Token Refresh ───────────────────────────────────────────

/**
 * Token yenileme — web app'teki server-side proxy endpoint'i kullanılır.
 *
 * NOT: Direkt Supabase GoTrue endpoint'ine istek ATILMAZ çünkü:
 *   - pdfcensor.com Supabase'i proxy etmiyor
 *   - Supabase URL extension'da expose edilmemeli
 *   - Server-side proxy daha güvenli (CORS, rate limit)
 */
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
      console.error("[PDFcensor] Token refresh failed:", response.status);
      return false;
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
    console.error("[PDFcensor] Token refresh error:", error);
    return false;
  }
}

/**
 * Geçerli bir access token döndürür.
 * Süresi dolmuşsa refresh dener, o da başarısızsa null döner.
 */
export async function getValidAccessToken(): Promise<string | null> {
  const tokens = await getTokens();
  if (!tokens) return null;

  // Token henüz geçerliyse direkt dön (5 dk buffer)
  if (tokens.expiresAt > Date.now() + 300000) {
    return tokens.accessToken;
  }

  // Refresh dene
  const refreshed = await refreshAccessToken();
  if (!refreshed) return null;

  const newTokens = await getTokens();
  return newTokens?.accessToken ?? null;
}

// ─── Pro Status Verification ─────────────────────────────────

/**
 * pdfcensor.com/api/extension/verify çağırarak Pro durumunu kontrol eder.
 * Sonucu 1 saat cache'ler.
 */
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
      console.error("[PDFcensor] Verify failed:", response.status);
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
    await chrome.storage.local.set({ proStatus });

    return data.isPro;
  } catch (error) {
    console.error("[PDFcensor] Verify error:", error);
    return false;
  }
}

/**
 * Cache'den Pro durumunu oku. Cache expired ise verify çağır.
 */
export async function getProStatus(): Promise<boolean> {
  const result = await chrome.storage.local.get("proStatus");
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
    return { isLoggedIn: false, isPro: false, email: null, subscriptionExpiresAt: null };
  }

  const result = await chrome.storage.local.get("proStatus");
  const cached = result.proStatus as ProStatusCache | undefined;

  return {
    isLoggedIn: true,
    isPro: cached?.isPro ?? false,
    email: cached?.email ?? null,
    subscriptionExpiresAt: cached?.expiresAt ?? null,
  };
}
