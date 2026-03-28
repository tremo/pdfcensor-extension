import { browser } from "wxt/browser";
import React, { useEffect, useState } from "react";
import type { StatsData } from "../../../src/utils/messaging";
import { PII_LABELS } from "../../../src/lib/pii/types";
import { t } from "../../../src/lib/i18n";

export default function Stats() {
  const [stats, setStats] = useState<StatsData | null>(null);

  useEffect(() => {
    (browser.storage.local.get("stats") as Promise<Record<string, any>>).then((result) => {
      setStats(
        result.stats || {
          totalScans: 0,
          totalPiiFound: 0,
          totalMasked: 0,
          byType: {},
          bySite: {},
        }
      );
    });
  }, []);

  if (!stats) return null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <StatCard label={t("scans")} value={stats.totalScans} />
        <StatCard label={t("pii")} value={stats.totalPiiFound} />
        <StatCard label={t("masked")} value={stats.totalMasked} />
      </div>

      {Object.keys(stats.byType).length > 0 && (
        <div className="bg-gray-900 rounded-lg p-3">
          <div className="text-sm text-gray-400 mb-2">{t("byType")}</div>
          {Object.entries(stats.byType).map(([type, count]) => (
            <div key={type} className="flex justify-between text-sm py-1">
              <span className="text-gray-300">
                {PII_LABELS[type as keyof typeof PII_LABELS] || type}
              </span>
              <span className="text-gray-500">{count}</span>
            </div>
          ))}
        </div>
      )}

      {Object.keys(stats.bySite).length > 0 && (
        <div className="bg-gray-900 rounded-lg p-3">
          <div className="text-sm text-gray-400 mb-2">{t("bySite")}</div>
          {Object.entries(stats.bySite).map(([site, count]) => (
            <div key={site} className="flex justify-between text-sm py-1">
              <span className="text-gray-300">{site}</span>
              <span className="text-gray-500">{count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-gray-900 rounded-lg p-2 text-center">
      <div className="text-xl font-bold">{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}
