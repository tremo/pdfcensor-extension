import React from "react";
import { t } from "../../../src/lib/i18n";

export default function ProGate() {
  return (
    <div className="bg-gradient-to-br from-teal-900/50 to-emerald-900/50 border border-teal-700/50 rounded-lg p-4">
      <div className="text-sm font-semibold mb-2">{t("upgradePro")}</div>
      <ul className="text-xs text-gray-300 space-y-1 mb-3">
        <li>{"\u2713"} {t("proFeature1")}</li>
        <li>{"\u2713"} {t("proFeature2")}</li>
        <li>{"\u2713"} {t("proFeature3")}</li>
        <li>{"\u2713"} {t("proFeature4")}</li>
        <li>{"\u2713"} {t("proFeature5")}</li>
      </ul>
      <a
        href="https://offlineredact.com/en/pricing"
        target="_blank"
        rel="noopener noreferrer"
        className="block text-center bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium py-2 rounded-lg transition-colors"
      >
        {t("goToPro")}
      </a>
    </div>
  );
}
