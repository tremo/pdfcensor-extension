import { browser } from "wxt/browser";
import React, { useEffect, useState } from "react";
import Toggle from "./components/Toggle";
import Stats from "./components/Stats";
import Settings from "./components/Settings";
import ProGate from "./components/ProGate";
import type { ExtensionSettings, UsageResponse } from "../../src/utils/messaging";
import { detectLocale, t } from "../../src/lib/i18n";

type Tab = "general" | "settings" | "stats";

interface UserInfo {
  isLoggedIn: boolean;
  isPro: boolean;
  email: string | null;
  subscriptionExpiresAt: string | null;
}

export default function App() {
  const [tab, setTab] = useState<Tab>("general");
  const [settings, setSettings] = useState<ExtensionSettings | null>(null);
  const [usage, setUsage] = useState<UsageResponse | null>(null);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  // Detect locale once
  useEffect(() => {
    detectLocale();
  }, []);

  useEffect(() => {
    browser.runtime.sendMessage({ type: "GET_SETTINGS" }).then((res: any) => {
      if (res?.settings) setSettings(res.settings);
    });
    browser.runtime.sendMessage({ type: "CHECK_USAGE" }).then((res: any) => {
      if (res) setUsage(res);
    });
    browser.runtime.sendMessage({ type: "GET_USER_INFO" }).then((res: any) => {
      if (res) setUserInfo(res);
    });
  }, []);

  const handleLogin = async () => {
    setLoginLoading(true);
    try {
      const res = await browser.runtime.sendMessage({ type: "LOGIN" }) as any;
      if (res?.success) {
        // Refresh user info and usage after login
        const info = await browser.runtime.sendMessage({ type: "GET_USER_INFO" }) as any;
        if (info) setUserInfo(info);
        const usageRes = await browser.runtime.sendMessage({ type: "CHECK_USAGE" }) as any;
        if (usageRes) setUsage(usageRes);
      }
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    await browser.runtime.sendMessage({ type: "LOGOUT" });
    setUserInfo({ isLoggedIn: false, isPro: false, email: null, subscriptionExpiresAt: null });
    const usageRes = await browser.runtime.sendMessage({ type: "CHECK_USAGE" }) as any;
    if (usageRes) setUsage(usageRes);
  };

  if (!settings) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="animate-spin w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="bg-gray-950 text-white min-h-[400px] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L3 6v5c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V6L12 2z" fill="#14b8a6"/>
            <path d="M10 15.5l-3.5-3.5 1.41-1.41L10 12.67l5.59-5.59L17 8.5l-7 7z" fill="white"/>
          </svg>
          <span className="text-lg font-bold">OfflineRedact</span>
          {usage?.isPro && (
            <span className="text-xs bg-teal-500 px-1.5 py-0.5 rounded font-medium">PRO</span>
          )}
        </div>
        <Toggle
          enabled={settings.enabled}
          onChange={(enabled) => {
            setSettings({ ...settings, enabled });
            browser.storage.local.set({
              settings: { ...settings, enabled },
            });
          }}
        />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-800">
        {(["general", "settings", "stats"] as const).map((tb) => (
          <button
            key={tb}
            onClick={() => setTab(tb)}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              tab === tb
                ? "text-teal-400 border-b-2 border-teal-400"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            {tb === "general" ? t("general") : tb === "settings" ? t("settings") : t("stats")}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 p-4 overflow-y-auto">
        {tab === "general" && (
          <div className="space-y-4">
            {/* Account / Login */}
            <div className="bg-gray-900 rounded-lg p-3">
              {userInfo?.isLoggedIn ? (
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-gray-400">{t("loggedInAs")}</div>
                    <div className="text-sm font-medium truncate">{userInfo.email}</div>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="text-xs text-gray-500 hover:text-red-400 transition-colors"
                  >
                    {t("logout")}
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-400">{t("loginDesc")}</div>
                  <button
                    onClick={handleLogin}
                    disabled={loginLoading}
                    className="bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                  >
                    {loginLoading ? "..." : t("login")}
                  </button>
                </div>
              )}
            </div>

            {/* Status */}
            <div className="bg-gray-900 rounded-lg p-3">
              <div className="text-sm text-gray-400 mb-1">{t("status")}</div>
              <div className={`font-medium ${settings.enabled ? "text-green-400" : "text-red-400"}`}>
                {settings.enabled ? t("statusActive") : t("statusDisabled")}
              </div>
            </div>

            {/* Regulation */}
            <div className="bg-gray-900 rounded-lg p-3">
              <div className="text-sm text-gray-400 mb-1">{t("regulation")}</div>
              <div className="font-medium">{settings.regulation}</div>
            </div>

            {!usage?.isPro && <ProGate />}
          </div>
        )}

        {tab === "settings" && (
          <Settings settings={settings} onUpdate={setSettings} isPro={usage?.isPro || false} />
        )}

        {tab === "stats" && <Stats />}
      </div>
    </div>
  );
}
