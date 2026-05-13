"use client";

/**
 * Conditions Overview Component
 *
 * Orchestrates BestDayHero, OutlookBarChart, and ExploreMoreLinks
 * to provide a comprehensive 12-day surf outlook for every viewer.
 *
 * @module components/forecast/conditions-overview/conditions-overview
 */

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
    () => enrichDaySummaries(horizonDaySummaries, forecasts, beach.wind_offshore_deg),
    [horizonDaySummaries, forecasts, beach.wind_offshore_deg]
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

      <ErrorBoundary fallback={() => <p className="text-sm text-muted-foreground py-4">Unable to load chart.</p>}>
        <OutlookBarChart days={enrichedDays} />
      </ErrorBoundary>

      <DetailedForecastTable
        forecasts={forecasts}
        beachTimezone={beachTimezone}
      />

      <ExploreMoreLinks beach={beach} />
    </div>
  );
}
