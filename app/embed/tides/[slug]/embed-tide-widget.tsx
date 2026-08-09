"use client";

import { Suspense } from "react";
import { TideChartEnhanced } from "@/components/forecast/tide-chart-enhanced";
import type { EnhancedForecastEntity } from "@/types/forecast";
import { useEmbedImpression } from "@/hooks/use-embed-impression";

interface EmbedTideWidgetProps {
  beachName: string;
  beachUrl: string;
  slug: string;
  forecasts: EnhancedForecastEntity[];
  windowHours: number;
  status: "fresh" | "stale" | "unavailable";
  staleAsOf?: string;
  theme: "light" | "dark";
}

export function EmbedTideWidget({
  beachName,
  beachUrl,
  slug,
  forecasts,
  windowHours,
  status,
  staleAsOf,
  theme,
}: EmbedTideWidgetProps) {
  useEmbedImpression("tides", slug);

  const isDark = theme === "dark";
  const isUnavailable = status === "unavailable" || forecasts.length === 0;
  const staleLabel =
    status === "stale" ? `as of ${staleAsOf ?? "an earlier update"}` : null;

  return (
    <div
      className={`flex flex-col h-screen w-full ${
        isDark ? "bg-slate-900 text-white" : "bg-white text-slate-900"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 pt-2 pb-1">
        <h2 className="text-sm font-semibold truncate">{beachName} Tides</h2>
        {staleLabel && (
          <p
            className={`shrink-0 text-[10px] ${isDark ? "text-slate-500" : "text-slate-400"}`}
          >
            {staleLabel}
          </p>
        )}
      </div>

      {/* Chart */}
      <div className="flex-1 min-h-0 px-1">
        {isUnavailable ? (
          <div className="flex flex-col items-center justify-center gap-1 h-full text-center">
            <p className="text-sm text-slate-400">
              Tide conditions are temporarily unavailable.
            </p>
            <a
              href={beachUrl}
              target="_blank"
              rel="noopener"
              className={`text-xs font-medium hover:underline ${
                isDark
                  ? "text-slate-400 hover:text-slate-300"
                  : "text-slate-500 hover:text-ocean-blue"
              }`}
            >
              View {beachName} forecast
            </a>
          </div>
        ) : (
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
        )}
      </div>

      {/* Attribution */}
      <div className={`flex items-center justify-end px-3 py-1.5 border-t min-h-[44px] ${isDark ? "border-slate-700/50" : "border-slate-200/50"}`}>
        <a
          href={`${beachUrl}?utm_source=embed&utm_medium=widget&utm_campaign=tides_widget`}
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
