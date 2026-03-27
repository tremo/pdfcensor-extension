import React, { useEffect, useState } from "react";
import Toggle from "./components/Toggle";
import Stats from "./components/Stats";
import Settings from "./components/Settings";
import ProGate from "./components/ProGate";
import type { ExtensionSettings, UsageResponse } from "../../src/utils/messaging";

type Tab = "general" | "settings" | "stats";

export default function App() {
  const [tab, setTab] = useState<Tab>("general");
  const [settings, setSettings] = useState<ExtensionSettings | null>(null);
  const [usage, setUsage] = useState<UsageResponse | null>(null);

  useEffect(() => {
    chrome.runtime.sendMessage({ type: "GET_SETTINGS" }, (res) => {
      if (res?.settings) setSettings(res.settings);
    });
    chrome.runtime.sendMessage({ type: "CHECK_USAGE" }, (res) => {
      if (res) setUsage(res);
    });
  }, []);

  if (!settings) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="bg-gray-950 text-white min-h-[400px] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold">PDFcensor</span>
          {usage?.isPro && (
            <span className="text-xs bg-blue-600 px-1.5 py-0.5 rounded font-medium">PRO</span>
          )}
        </div>
        <Toggle
          enabled={settings.enabled}
          onChange={(enabled) => {
            setSettings({ ...settings, enabled });
            chrome.storage.local.set({
              settings: { ...settings, enabled },
            });
          }}
        />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-800">
        {(["general", "settings", "stats"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              tab === t
                ? "text-blue-400 border-b-2 border-blue-400"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            {t === "general" ? "Genel" : t === "settings" ? "Ayarlar" : "Istatistik"}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 p-4 overflow-y-auto">
        {tab === "general" && (
          <div className="space-y-4">
            {/* Usage info */}
            {usage && !usage.isPro && (
              <div className="bg-gray-900 rounded-lg p-3">
                <div className="text-sm text-gray-400 mb-1">Kalan tarama</div>
                <div className="text-2xl font-bold">
                  {usage.remaining}
                  <span className="text-sm text-gray-500 font-normal"> / 5 gun</span>
                </div>
              </div>
            )}

            {/* Status */}
            <div className="bg-gray-900 rounded-lg p-3">
              <div className="text-sm text-gray-400 mb-1">Durum</div>
              <div className={`font-medium ${settings.enabled ? "text-green-400" : "text-red-400"}`}>
                {settings.enabled ? "Aktif — mesajlar taranıyor" : "Devre disi"}
              </div>
            </div>

            {/* Regulation */}
            <div className="bg-gray-900 rounded-lg p-3">
              <div className="text-sm text-gray-400 mb-1">Regulasyon</div>
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
