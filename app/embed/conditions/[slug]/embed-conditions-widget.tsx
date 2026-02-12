"use client";

import { useEffect, useRef } from "react";

export interface ConditionData {
  waveHeight?: string | null;
  wavePeriod?: string | null;
  waveDirection?: string | null;
  windSpeed?: string | null;
  windDirection?: string | null;
  waterTemp?: string | null;
  tideStatus?: string | null;
  tideHeight?: string | null;
}

interface EmbedConditionsWidgetProps {
  beachName: string;
  beachUrl: string;
  slug: string;
  conditions: ConditionData;
  theme: "light" | "dark";
}

function ConditionRow({
  label,
  value,
  isDark,
}: {
  label: string;
  value: string | null | undefined;
  isDark: boolean;
}) {
  if (!value) return null;
  return (
    <div className="flex items-center justify-between py-1.5">
      <span
        className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}
      >
        {label}
      </span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

export function EmbedConditionsWidget({
  beachName,
  beachUrl,
  slug,
  conditions,
  theme,
}: EmbedConditionsWidgetProps) {
  const hasTracked = useRef(false);

  useEffect(() => {
    if (hasTracked.current) return;
    hasTracked.current = true;
    fetch('/api/embed-impressions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ widgetType: 'conditions', beachSlug: slug }),
      keepalive: true,
    }).catch((e) => { if (process.env.NODE_ENV === 'development') console.warn('[Embed] impression tracking failed:', e); });
  }, [slug]);

  const isDark = theme === "dark";
  const hasData = Object.values(conditions).some(Boolean);

  return (
    <div
      className={`flex flex-col h-screen w-full ${
        isDark ? "bg-slate-900 text-white" : "bg-white text-slate-900"
      }`}
    >
      {/* Header */}
      <div className="px-3 pt-3 pb-1">
        <h2 className="text-sm font-semibold truncate">{beachName}</h2>
        <p
          className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}
        >
          Current Conditions
        </p>
      </div>

      {/* Conditions */}
      <div className="flex-1 min-h-0 px-3 overflow-auto">
        {hasData ? (
          <div
            className={`divide-y ${isDark ? "divide-slate-700" : "divide-slate-100"}`}
          >
            <ConditionRow
              label="Waves"
              value={
                conditions.waveHeight
                  ? `${conditions.waveHeight}${conditions.wavePeriod ? ` @ ${conditions.wavePeriod}` : ""}${conditions.waveDirection ? ` ${conditions.waveDirection}` : ""}`
                  : null
              }
              isDark={isDark}
            />
            <ConditionRow
              label="Wind"
              value={
                conditions.windSpeed
                  ? `${conditions.windSpeed}${conditions.windDirection ? ` ${conditions.windDirection}` : ""}`
                  : null
              }
              isDark={isDark}
            />
            <ConditionRow
              label="Water Temp"
              value={conditions.waterTemp}
              isDark={isDark}
            />
            <ConditionRow
              label="Tide"
              value={
                conditions.tideStatus
                  ? `${conditions.tideStatus}${conditions.tideHeight ? ` (${conditions.tideHeight})` : ""}`
                  : null
              }
              isDark={isDark}
            />
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-slate-400">
            No conditions available
          </div>
        )}
      </div>

      {/* Attribution */}
      <div className={`flex items-center justify-end px-3 py-1.5 border-t min-h-[44px] ${isDark ? "border-slate-700/50" : "border-slate-200/50"}`}>
        <a
          href={beachUrl}
          target="_blank"
          rel="noopener" // noreferrer intentionally omitted to preserve Referer header for embed analytics
          className={`text-xs font-medium hover:underline flex items-center ${
            isDark
              ? "text-slate-400 hover:text-slate-300"
              : "text-slate-500 hover:text-ocean-blue"
          }`}
        >
          Powered by Quiver
        </a>
      </div>
    </div>
  );
}
