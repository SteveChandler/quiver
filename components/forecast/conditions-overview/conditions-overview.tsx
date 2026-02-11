"use client";

/**
 * Conditions Overview Component
 *
 * Orchestrates BestDayHero, OutlookBarChart, and ExploreMoreLinks
 * to provide a comprehensive 12-day surf outlook.
 *
 * In public mode, the hero is visible as a teaser, while the full
 * outlook chart and other good days are gated behind authentication.
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
import { PublicContentGate } from "@/components/ui/public-content-gate";

// Dynamic import for chart (code splitting since it's a subtab)
const OutlookBarChart = dynamic(
  () => import("./outlook-bar-chart").then((m) => ({ default: m.OutlookBarChart })),
  { ssr: false }
);

interface ConditionsOverviewProps {
  horizonDaySummaries: DaySummary[];
  forecasts: EnhancedForecastEntity[];
  beach: Beach;
  publicMode?: boolean;
}

export function ConditionsOverview({
  horizonDaySummaries,
  forecasts,
  beach,
  publicMode = false,
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

  // In public mode, only consider first 3 days for bestDay
  const daysForBest = publicMode ? enrichedDays.slice(0, 3) : enrichedDays;
  const bestDay = daysForBest.reduce((prev, curr) =>
    curr.score > prev.score ? curr : prev
  );

  // Compute other good days: remaining days sorted by score, take top 4
  const otherDays = enrichedDays.filter((d) => d.fullDate !== bestDay.fullDate);
  const sortedOthers = [...otherDays].sort((a, b) => b.score - a.score);

  // If all days score below "good", show top 3 with actual tier colors
  const allBelowGood = sortedOthers.every((d) => d.score < CONDITION_TIER_THRESHOLDS.good);
  const otherGoodDays = allBelowGood
    ? sortedOthers.slice(0, 3)
    : sortedOthers.filter((d) => d.score >= CONDITION_TIER_THRESHOLDS.good).slice(0, 4);

  return (
    <div className="space-y-6">
      {/* Hero - always visible (in public mode, only best from first 3 days) */}
      <BestDayHero bestDay={bestDay} otherGoodDays={publicMode ? [] : otherGoodDays} />

      {/* Other good days + chart - gated for public */}
      {publicMode ? (
        <PublicContentGate
          ctaTitle="Unlock the Full 12-Day Outlook"
          ctaDescription="Sign up to see all surf conditions and plan your week"
          blurLevel="md"
          source="conditions-overview-gate"
        >
          <div className="space-y-6">
            {otherGoodDays.length > 0 && (
              <BestDayHero bestDay={bestDay} otherGoodDays={otherGoodDays} />
            )}
            <ErrorBoundary fallback={() => <p className="text-sm text-muted-foreground py-4">Unable to load chart.</p>}>
              <OutlookBarChart days={enrichedDays} />
            </ErrorBoundary>
          </div>
        </PublicContentGate>
      ) : (
        <ErrorBoundary fallback={() => <p className="text-sm text-muted-foreground py-4">Unable to load chart.</p>}>
          <OutlookBarChart days={enrichedDays} />
        </ErrorBoundary>
      )}

      <ExploreMoreLinks beach={beach} />
    </div>
  );
}
