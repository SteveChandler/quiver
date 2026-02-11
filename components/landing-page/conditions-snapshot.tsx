"use client";

/**
 * Conditions Snapshot - Live forecast data for the landing page
 *
 * Displays the best regional surf conditions for today so anonymous visitors
 * see real data above the fold. Fetches data via a server action using the
 * standard useDataFetcher pattern.
 *
 * @module components/landing-page/conditions-snapshot
 */

import { useCallback } from "react";
import Link from "next/link";
import { MapPin, Wind, Waves, TrendingUp } from "lucide-react";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import {
  getBestConditionsToday,
  type BestConditionsData,
} from "@/actions/forecast/get-best-conditions-today";
import { getScoreColorClasses } from "@/lib/utils/score-color-utils";
import { ForecastSectionContainer } from "@/components/forecast/forecast-section-container";

function ConditionsSnapshotSkeleton() {
  return (
    <ForecastSectionContainer testId="conditions-snapshot-skeleton">
      <div className="rounded-xl border border-sky-200 bg-gradient-to-br from-sky-50 via-blue-50 to-cyan-50 p-6 animate-pulse">
        <div className="flex items-center gap-3 mb-4">
          <div className="h-5 w-40 bg-sky-200/60 rounded" />
        </div>
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-full bg-sky-200/60" />
          <div className="flex-1 space-y-2">
            <div className="h-5 w-48 bg-sky-200/60 rounded" />
            <div className="h-4 w-64 bg-sky-200/60 rounded" />
          </div>
        </div>
      </div>
    </ForecastSectionContainer>
  );
}

function windLabel(conditions: BestConditionsData["windConditions"]): string {
  switch (conditions) {
    case "offshore":
      return "Offshore";
    case "light":
      return "Light winds";
    case "onshore":
      return "Onshore";
  }
}

export function ConditionsSnapshot() {
  const fetchBestConditions = useCallback(() => getBestConditionsToday(), []);
  const { data, loading } = useDataFetcher<BestConditionsData | null>(
    fetchBestConditions
  );

  if (loading) {
    return <ConditionsSnapshotSkeleton />;
  }

  if (!data) {
    return null;
  }

  const scoreColors = getScoreColorClasses(data.score);
  const waveMin = Math.round(data.waveRange[0]);
  const waveMax = Math.round(data.waveRange[1]);
  const waveDisplay =
    waveMin === waveMax ? `${waveMin}ft` : `${waveMin}-${waveMax}ft`;

  return (
    <ForecastSectionContainer testId="conditions-snapshot">
      <Link
        href={`/forecast/${data.regionSlug}`}
        className="block group rounded-xl border border-sky-200 bg-gradient-to-br from-sky-50 via-blue-50 to-cyan-50 p-6 transition-shadow hover:shadow-md"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-sky-700 uppercase tracking-wide">
            Best Conditions Today
          </h2>
          <span className="text-sm text-sky-600 font-medium group-hover:underline flex items-center gap-1">
            View Full Forecast
            <TrendingUp className="h-3.5 w-3.5" />
          </span>
        </div>

        {/* Content */}
        <div className="flex items-center gap-5">
          {/* Score circle */}
          <div
            className={`flex-shrink-0 flex items-center justify-center h-14 w-14 rounded-full text-white font-bold text-xl ${scoreColors.bg}`}
          >
            {data.score}
          </div>

          {/* Details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <MapPin className="h-4 w-4 text-sky-600 flex-shrink-0" />
              <span className="font-semibold text-gray-900 truncate">
                {data.regionName}
              </span>
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-full ${scoreColors.bg} text-white`}
              >
                {scoreColors.label}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
              <span className="flex items-center gap-1">
                <Waves className="h-3.5 w-3.5" />
                {waveDisplay}
              </span>
              <span className="flex items-center gap-1">
                <Wind className="h-3.5 w-3.5" />
                {windLabel(data.windConditions)}
              </span>
              {data.topBeachName && (
                <span className="text-gray-500 hidden sm:inline">
                  Top spot: {data.topBeachName}
                </span>
              )}
            </div>
          </div>
        </div>
      </Link>
    </ForecastSectionContainer>
  );
}
