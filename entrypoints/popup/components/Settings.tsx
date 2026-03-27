import React from "react";
import type { ExtensionSettings } from "../../../src/utils/messaging";
import { regulations } from "../../../src/lib/pii/regulations";
import type { RegulationType } from "../../../src/lib/pii/types";

interface SettingsProps {
  settings: ExtensionSettings;
  onUpdate: (settings: ExtensionSettings) => void;
  isPro: boolean;
}

export default function Settings({ settings, onUpdate, isPro }: SettingsProps) {
  function update(partial: Partial<ExtensionSettings>) {
    const updated = { ...settings, ...partial };
    onUpdate(updated);
    chrome.storage.local.set({ settings: updated });
  }

  return (
    <div className="space-y-4">
      {/* Regulation selector */}
      <div>
        <label className="text-sm text-gray-400 block mb-1">Regulasyon Profili</label>
        <select
          value={settings.regulation}
          onChange={(e) => update({ regulation: e.target.value as RegulationType })}
          disabled={!isPro && settings.regulation === "COMPREHENSIVE"}
          className="w-full bg-gray-900 text-white border border-gray-700 rounded-lg px-3 py-2 text-sm"
        >
          {Object.entries(regulations).map(([key, reg]) => (
            <option
              key={key}
              value={key}
              disabled={!isPro && key !== "COMPREHENSIVE"}
            >
              {reg.description}
              {!isPro && key !== "COMPREHENSIVE" ? " (Pro)" : ""}
            </option>
          ))}
        </select>
      </div>

      {/* Auto-mask toggle */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium">Otomatik Maskeleme</div>
          <div className="text-xs text-gray-500">
            PII tespit edildiginde otomatik maskele
          </div>
        </div>
        <button
          onClick={() => isPro && update({ autoMask: !settings.autoMask })}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            !isPro
              ? "bg-gray-700 cursor-not-allowed opacity-50"
              : settings.autoMask
                ? "bg-blue-600"
                : "bg-gray-600"
          }`}
          disabled={!isPro}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              settings.autoMask ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      {/* Notifications toggle */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium">Bildirimler</div>
          <div className="text-xs text-gray-500">
            PII tespit edildiginde uyari goster
          </div>
        </div>
        <button
          onClick={() => update({ showNotifications: !settings.showNotifications })}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            settings.showNotifications ? "bg-blue-600" : "bg-gray-600"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              settings.showNotifications ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>
    </div>
  );
}
