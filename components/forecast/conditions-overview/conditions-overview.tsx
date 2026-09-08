"use client";

/**
 * Conditions Overview Component
 *
 * Orchestrates BestDayHero, OutlookBarChart, and ExploreMoreLinks
 * to provide a comprehensive 12-day surf outlook for every viewer.
 *
 * @module components/forecast/conditions-overview/conditions-overview
 */

import { extractForecastDate } from "@/lib/utils/forecast-at-adapter";
import { resolveBeachTimezone } from "@/lib/utils/timezone-utils";
import { useMemo } from "react";
import dynamic from "next/dynamic";
import type { DaySummary } from "@/lib/utils/horizon-strip-utils";
import type { EnhancedForecastEntity } from "@/types/forecast";
import type { Beach } from "@/types/database";
import { enrichDaySummaries } from "@/lib/utils/enriched-day-summary";
import { CONDITION_TIER_THRESHOLDS } from "@/lib/utils/condition-tier-utils";
import { ErrorBoundary } from "@/components/error-boundaries";
import { BestDayHero } from "./best-day-hero";
import { ExploreMoreLinks } from "./explore-more-links";
import { DetailedForecastTable } from "./detailed-forecast-table";

// Dynamic import for chart (code splitting since it's a subtab)
const OutlookBarChart = dynamic(
  () => import("./outlook-bar-chart").then((m) => ({ default: m.OutlookBarChart })),
  { ssr: false }
);

interface ConditionsOverviewProps {
  horizonDaySummaries: DaySummary[];
  forecasts: EnhancedForecastEntity[];
  beach: Beach;
  /** When set, the hero shows this day instead of the overall best */
  selectedDate?: string;
  beachTimezone?: string | null;
}

export function ConditionsOverview({
  horizonDaySummaries,
  forecasts,
  beach,
  selectedDate,
  beachTimezone,
}: ConditionsOverviewProps) {
  const enrichedDays = useMemo(
    () => enrichDaySummaries(
      horizonDaySummaries,
      forecasts,
      beach.wind_offshore_deg,
      beachTimezone ?? beach.timezone,
    ),
    [
      horizonDaySummaries,
      forecasts,
      beach.wind_offshore_deg,
      beach.timezone,
      beachTimezone,
    ]
  );

  // No data available
  if (enrichedDays.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-100 bg-white/95 p-6 text-center shadow-sm">
        <p className="text-sm text-slate-500">No forecast data available</p>
      </div>
    );
  }

  const overallBest = enrichedDays.reduce((prev, curr) =>
    curr.score > prev.score ? curr : prev
  );

  // If user selected a specific date in the horizon strip, show that day;
  // otherwise fall back to the overall best day.
  const selectedDay = selectedDate
    ? enrichedDays.find((d) => d.fullDate === selectedDate)
    : undefined;
  if (selectedDate && !selectedDay) {
    return <p role="status" className="p-4 text-base">Forecast unavailable for {selectedDate}. Choose another day above.</p>;
  }
  const heroDay = selectedDay ?? overallBest;
  const isUserSelected = !!selectedDay;

  // Compute other good days: remaining days sorted by score, take top 4
  const otherDays = enrichedDays.filter((d) => d.fullDate !== heroDay.fullDate);
  const sortedOthers = [...otherDays].sort((a, b) => b.score - a.score);

  // If all days score below "good", show top 3 with actual tier colors
  const allBelowGood = sortedOthers.every((d) => d.score < CONDITION_TIER_THRESHOLDS.good);
  const otherGoodDays = allBelowGood
    ? sortedOthers.slice(0, 3)
    : sortedOthers.filter((d) => d.score >= CONDITION_TIER_THRESHOLDS.good).slice(0, 4);

  return (
    <div className="space-y-6">
      <BestDayHero
        bestDay={heroDay}
        otherGoodDays={otherGoodDays}
        isUserSelected={isUserSelected}
        isPersonalized={heroDay.isPersonalized}
      />

      <details className="border-t-2 border-[#11100D]/30 pt-4"><summary className="cursor-pointer text-base font-bold focus-visible:outline focus-visible:outline-2">Advanced forecast · swell, wind, tide &amp; hourly data</summary>
      <ErrorBoundary fallback={() => <p className="text-sm text-muted-foreground py-4">Unable to load chart.</p>}>
        <OutlookBarChart days={enrichedDays} />
      </ErrorBoundary>

      <DetailedForecastTable
        forecasts={selectedDate ? forecasts.filter((row) => extractForecastDate(row.forecast_at, resolveBeachTimezone(beachTimezone ?? beach.timezone)) === selectedDate) : forecasts}
        beachTimezone={beachTimezone}
      />

      </details>

      <ExploreMoreLinks beach={beach} />
    </div>
  );
}
