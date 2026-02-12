"use client";

import { Suspense, useEffect, useRef } from "react";
import { TideChartEnhanced } from "@/components/forecast/tide-chart-enhanced";
import type { EnhancedForecastEntity } from "@/types/forecast";

interface EmbedTideWidgetProps {
  beachName: string;
  beachUrl: string;
  slug: string;
  forecasts: EnhancedForecastEntity[];
  windowHours: number;
  theme: "light" | "dark";
}

export function EmbedTideWidget({
  beachName,
  beachUrl,
  slug,
  forecasts,
  windowHours,
  theme,
}: EmbedTideWidgetProps) {
  const hasTracked = useRef(false);

  useEffect(() => {
    if (hasTracked.current) return;
    hasTracked.current = true;
    fetch('/api/embed-impressions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ widgetType: 'tides', beachSlug: slug }),
      keepalive: true,
    }).catch((e) => { if (process.env.NODE_ENV === 'development') console.warn('[Embed] impression tracking failed:', e); });
  }, [slug]);
  const isDark = theme === "dark";

  return (
    <div
      className={`flex flex-col h-screen w-full ${
        isDark ? "bg-slate-900 text-white" : "bg-white text-slate-900"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 pt-2 pb-1">
        <h2 className="text-sm font-semibold truncate">{beachName} Tides</h2>
      </div>

      {/* Chart */}
      <div className="flex-1 min-h-0 px-1">
        <Suspense
          fallback={
            <div className="flex items-center justify-center h-full text-sm text-slate-400">
              Loading tide data...
            </div>
          }
        >
          <TideChartEnhanced
            forecasts={forecasts}
            windowHours={windowHours}
            compact
            compactLayout
            showDiagnostics={false}
            showNextExtreme={false}
            showHourlyTable={false}
            showWarnings={false}
            showVerifiedBadge={false}
            className="h-full"
          />
        </Suspense>
      </div>

      {/* Attribution */}
      <div className={`flex items-center justify-end px-3 py-1.5 border-t min-h-[44px] ${isDark ? "border-slate-700/50" : "border-slate-200/50"}`}>
        <a
          href={beachUrl}
          target="_blank"
          rel="noopener" // noreferrer intentionally omitted to preserve Referer header for embed analytics
          className={`text-xs font-medium hover:underline flex items-center ${
            isDark ? "text-slate-400 hover:text-slate-300" : "text-slate-500 hover:text-ocean-blue"
          }`}
        >
          Powered by Quiver
        </a>
      </div>
    </div>
  );
}
