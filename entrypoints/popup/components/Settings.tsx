import { browser } from "wxt/browser";
import React, { useState } from "react";
import type { ExtensionSettings, PlatformId, DetectionAction } from "../../../src/utils/messaging";
import { AVAILABLE_PLATFORMS } from "../../../src/utils/messaging";
import { regulations } from "../../../src/lib/pii/regulations";
import { PII_LABELS } from "../../../src/lib/pii/types";
import type { RegulationType, PIIType } from "../../../src/lib/pii/types";
import { t } from "../../../src/lib/i18n";

interface SettingsProps {
  settings: ExtensionSettings;
  onUpdate: (settings: ExtensionSettings) => void;
  isPro: boolean;
}

export default function Settings({ settings, onUpdate, isPro }: SettingsProps) {
  const [newKeyword, setNewKeyword] = useState("");

  function update(partial: Partial<ExtensionSettings>) {
    const updated = { ...settings, ...partial };
    onUpdate(updated);
    browser.storage.local.set({ settings: updated });
  }

  function togglePlatform(id: PlatformId) {
    const current = settings.enabledPlatforms || [];
    const updated = current.includes(id)
      ? current.filter((p) => p !== id)
      : [...current, id];
    update({ enabledPlatforms: updated });
  }

  function togglePiiType(type: PIIType) {
    const current = settings.enabledPiiTypes || [];
    const updated = current.includes(type)
      ? current.filter((t) => t !== type)
      : [...current, type];
    update({ enabledPiiTypes: updated });
  }

  function addKeyword() {
    const kw = newKeyword.trim();
    if (!kw || (settings.customKeywords || []).includes(kw)) return;
    update({ customKeywords: [...(settings.customKeywords || []), kw] });
    setNewKeyword("");
  }

  function removeKeyword(kw: string) {
    update({ customKeywords: (settings.customKeywords || []).filter((k) => k !== kw) });
  }

  const regulationTypes = regulations[settings.regulation]?.patterns || [];

  return (
    <div className="space-y-5">
      {/* Regulation selector */}
      <div>
        <label className="text-sm text-gray-400 block mb-1">{t("regulationProfile")}</label>
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

      {/* Platform selection */}
      <div>
        <label className="text-sm text-gray-400 block mb-2">{t("activePlatforms")}</label>
        <div className="space-y-1.5">
          {AVAILABLE_PLATFORMS.map((platform) => (
            <label
              key={platform.id}
              className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-900 rounded px-2 py-1.5 transition-colors"
            >
              <input
                type="checkbox"
                checked={(settings.enabledPlatforms || []).includes(platform.id)}
                onChange={() => togglePlatform(platform.id)}
                className="w-4 h-4 rounded border-gray-600 accent-teal-500"
              />
              <span className="text-gray-200">
                {platform.id === "generic" ? t("otherSites") : platform.label}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* PII type selection */}
      <div>
        <label className="text-sm text-gray-400 block mb-1">{t("detectionTypes")}</label>
        <p className="text-xs text-gray-600 mb-2">{t("detectionTypesHint")}</p>
        <div className="max-h-48 overflow-y-auto bg-gray-900 rounded-lg p-2 space-y-1">
          {regulationTypes.map((type) => (
            <label
              key={type}
              className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-800 rounded px-2 py-1 transition-colors"
            >
              <input
                type="checkbox"
                checked={(settings.enabledPiiTypes || []).includes(type)}
                onChange={() => togglePiiType(type)}
                className="w-3.5 h-3.5 rounded border-gray-600 accent-teal-500"
              />
              <span className="text-gray-300">{PII_LABELS[type] || type}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Detection action */}
      <div>
        <label className="text-sm text-gray-400 block mb-1">{t("detectionAction")}</label>
        <p className="text-xs text-gray-600 mb-2">{t("detectionActionDesc")}</p>
        <div className="space-y-1.5 bg-gray-900 rounded-lg p-2">
          {([
            { value: "warn_only" as DetectionAction, label: t("warnOnly"), desc: t("warnOnlyDesc"), pro: false },
            { value: "auto_censor" as DetectionAction, label: t("autoCensor"), desc: t("autoCensorDesc"), pro: true },
            { value: "block_and_confirm" as DetectionAction, label: t("blockAndConfirm"), desc: t("blockAndConfirmDesc"), pro: true },
          ]).map((option) => (
            <label
              key={option.value}
              className={`flex items-start gap-2 text-sm cursor-pointer hover:bg-gray-800 rounded px-2 py-2 transition-colors ${
                !isPro && option.pro ? "opacity-60" : ""
              }`}
              onClick={(e) => {
                if (!isPro && option.pro) {
                  e.preventDefault();
                  window.open("https://offlineredact.com/en/pricing", "_blank");
                }
              }}
            >
              <input
                type="radio"
                name="detectionAction"
                value={option.value}
                checked={settings.detectionAction === option.value}
                onChange={() => {
                  if (!isPro && option.pro) {
                    window.open("https://offlineredact.com/en/pricing", "_blank");
                    return;
                  }
                  update({ detectionAction: option.value });
                }}
                className="mt-0.5 w-4 h-4 accent-teal-500"
                disabled={!isPro && option.pro}
              />
              <div className="flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-200">{option.label}</span>
                  {option.pro && !isPro && (
                    <span className="text-[10px] bg-teal-600 px-1.5 py-0.5 rounded font-medium text-white">PRO</span>
                  )}
                </div>
                <div className="text-xs text-gray-500">{option.desc}</div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Custom keywords (Pro only) */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <label className="text-sm text-gray-400">{t("customKeywords")}</label>
          {!isPro && (
            <span className="text-[10px] bg-teal-600 px-1.5 py-0.5 rounded font-medium text-white">PRO</span>
          )}
        </div>
        <p className="text-xs text-gray-600 mb-2">{t("customKeywordsHint")}</p>
        {isPro ? (
          <>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addKeyword()}
                placeholder={t("addKeywordPlaceholder")}
                className="flex-1 bg-gray-900 text-white border border-gray-700 rounded-lg px-3 py-1.5 text-sm placeholder:text-gray-600"
              />
              <button
                onClick={addKeyword}
                className="bg-teal-600 hover:bg-teal-500 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
              >
                {t("add")}
              </button>
            </div>
            {(settings.customKeywords || []).length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {settings.customKeywords.map((kw) => (
                  <span
                    key={kw}
                    className="inline-flex items-center gap-1 bg-gray-800 text-gray-300 text-xs px-2 py-1 rounded-full"
                  >
                    {kw}
                    <button
                      onClick={() => removeKeyword(kw)}
                      className="text-gray-500 hover:text-red-400 font-bold"
                    >
                      {"\u00d7"}
                    </button>
                  </span>
                ))}
              </div>
            )}
          </>
        ) : (
          <a
            href="https://offlineredact.com/en/pricing"
            target="_blank"
            rel="noopener noreferrer"
            className="block text-center bg-teal-600/20 border border-teal-600/40 hover:bg-teal-600/30 text-teal-400 text-xs font-medium py-2 rounded-lg transition-colors"
          >
            {t("customKeywordsProCta")}
          </a>
        )}
      </div>

      {/* Auto-mask toggle */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium">{t("autoMask")}</div>
          <div className="text-xs text-gray-500">{t("autoMaskDesc")}</div>
        </div>
        <button
          onClick={() => isPro && update({ autoMask: !settings.autoMask })}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            !isPro
              ? "bg-gray-700 cursor-not-allowed opacity-50"
              : settings.autoMask
                ? "bg-teal-500"
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
          <div className="text-sm font-medium">{t("notifications")}</div>
          <div className="text-xs text-gray-500">{t("notificationsDesc")}</div>
        </div>
        <button
          onClick={() => update({ showNotifications: !settings.showNotifications })}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            settings.showNotifications ? "bg-teal-500" : "bg-gray-600"
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
