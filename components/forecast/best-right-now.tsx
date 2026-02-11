"use client";

/**
 * Best Right Now - Ranked beach leaderboard by current score
 *
 * Displays the top 5 beaches by current forecast score in a compact
 * leaderboard format. Each row shows rank, beach name, score badge,
 * wave height, and region.
 *
 * @module components/forecast/best-right-now
 */

import { useCallback } from "react";
import Link from "next/link";
import { Waves, Trophy } from "lucide-react";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { getTopBeachesNow } from "@/actions/forecast/get-top-beaches-now";
import type { TopBeachEntry } from "@/lib/utils/forecast-hub-utils";
import { getScoreColorClasses } from "@/lib/utils/score-color-utils";
import { ForecastSectionContainer } from "./forecast-section-container";

function BestRightNowSkeleton() {
  return (
    <div className="space-y-3" data-testid="best-right-now-skeleton">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 animate-pulse">
          <div className="h-6 w-6 rounded-full bg-sky-200/60" />
          <div className="flex-1 h-4 bg-sky-200/60 rounded" />
          <div className="h-6 w-10 rounded-full bg-sky-200/60" />
        </div>
      ))}
    </div>
  );
}

interface RankBadgeProps {
  rank: number;
}

function RankBadge({ rank }: RankBadgeProps) {
  if (rank === 1) {
    return (
      <div className="flex items-center justify-center h-7 w-7 rounded-full bg-amber-100 text-amber-700">
        <Trophy className="h-3.5 w-3.5" />
      </div>
    );
  }
  return (
    <div className="flex items-center justify-center h-7 w-7 rounded-full bg-gray-100 text-gray-500 text-xs font-semibold">
      {rank}
    </div>
  );
}

export function BestRightNow() {
  const fetchTopBeaches = useCallback(() => getTopBeachesNow(5), []);
  const { data, loading } = useDataFetcher<TopBeachEntry[]>(fetchTopBeaches);

  if (loading) {
    return (
      <ForecastSectionContainer testId="best-right-now">
        <h2 className="text-sm font-semibold text-sky-700 uppercase tracking-wide mb-4">
          Best Right Now
        </h2>
        <BestRightNowSkeleton />
      </ForecastSectionContainer>
    );
  }

  if (!data || data.length === 0) {
    return null;
  }

  return (
    <ForecastSectionContainer testId="best-right-now">
      <h2 className="text-sm font-semibold text-sky-700 uppercase tracking-wide mb-4">
        Best Right Now
      </h2>

      <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100">
        {data.map((beach, index) => {
          const scoreColors = getScoreColorClasses(beach.score);
          const waveDisplay = `${Math.round(beach.waveHeight)}ft`;

          const content = (
            <div className="flex items-center gap-3 px-4 py-3">
              <RankBadge rank={index + 1} />

              <div className="flex-1 min-w-0">
                <span className="font-medium text-gray-900 truncate block">
                  {beach.beachName}
                </span>
                <span className="text-xs text-gray-500">
                  {beach.regionName}
                </span>
              </div>

              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="flex items-center gap-1 text-sm text-gray-600">
                  <Waves className="h-3.5 w-3.5" />
                  {waveDisplay}
                </span>
                <span
                  className={`inline-flex items-center justify-center h-7 min-w-[2rem] px-1.5 rounded-full text-xs font-bold text-white ${scoreColors.bg}`}
                >
                  {beach.score}
                </span>
              </div>
            </div>
          );

          if (beach.href) {
            return (
              <Link
                key={beach.beachId}
                href={beach.href}
                className="block hover:bg-gray-50 transition-colors first:rounded-t-xl last:rounded-b-xl"
              >
                {content}
              </Link>
            );
          }

          return (
            <div key={beach.beachId} className="first:rounded-t-xl last:rounded-b-xl">
              {content}
            </div>
          );
        })}
      </div>

      <div className="mt-3 text-center">
        <Link
          href="/forecast"
          className="text-sm font-medium text-sky-600 hover:text-sky-700 hover:underline transition-colors"
        >
          See All Forecasts &rarr;
        </Link>
      </div>
    </ForecastSectionContainer>
  );
}
