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

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Waves, Trophy } from "lucide-react";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { getTopBeachesNow } from "@/actions/forecast/get-top-beaches-now";
import type { TopBeachEntry } from "@/lib/utils/forecast-hub-utils";
import { getScoreColorClasses } from "@/lib/utils/score-color-utils";
import { formatWaveHeightRange as formatWaveHeight } from "@/lib/formatters/surf-data";
import {
  parseIPLocationCookie,
  getIPLocationCookieName,
} from "@/lib/location/ip-location";
import { ForecastSectionContainer } from "./forecast-section-container";

// Sticker shapes + rotations cycle per row so the list reads hand-cut,
// not templated. Indexing by position keeps SSR/CSR output stable.
const THUMB_SHAPES = [
  "rounded-[18px_6px_20px_8px]",
  "rounded-[8px_20px_6px_18px]",
  "rounded-[22px_10px_6px_16px]",
  "rounded-[10px_18px_20px_8px]",
  "rounded-[16px_8px_18px_22px]",
];
const THUMB_ROTATIONS = ["-rotate-1", "rotate-1", "-rotate-[0.5deg]", "rotate-[1.5deg]", "-rotate-[1.25deg]"];

function BestRightNowSkeleton() {
  return (
    <div className="space-y-3" data-testid="best-right-now-skeleton">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 animate-pulse">
          <div
            className={`h-12 w-12 shrink-0 bg-white/[0.08] ${THUMB_SHAPES[i % THUMB_SHAPES.length]}`}
          />
          <div className="flex-1 h-4 bg-white/[0.08] rounded" />
          <div className="h-6 w-10 rounded-full bg-white/[0.08]" />
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
      <div className="flex items-center justify-center h-7 w-7 rounded-full bg-[#F78E42]/20 text-[#F78E42] border border-[#F78E42]/40">
        <Trophy className="h-3.5 w-3.5" />
      </div>
    );
  }
  return (
    <div className="flex items-center justify-center h-7 w-7 rounded-full bg-white/[0.08] text-white/60 text-xs font-semibold">
      {rank}
    </div>
  );
}

interface BeachThumbProps {
  imageUrl: string | null;
  beachName: string;
  index: number;
}

function BeachThumb({ imageUrl, beachName, index }: BeachThumbProps) {
  const shape = THUMB_SHAPES[index % THUMB_SHAPES.length];
  const rotation = THUMB_ROTATIONS[index % THUMB_ROTATIONS.length];
  const common = `relative h-12 w-12 shrink-0 overflow-hidden ${shape} ${rotation} shadow-[0_2px_0_rgba(0,0,0,0.3)] motion-reduce:rotate-0`;

  if (imageUrl) {
    return (
      <div className={`${common} bg-[#1b2255]`}>
        <Image
          src={imageUrl}
          alt={beachName}
          fill
          sizes="48px"
          className="object-cover"
        />
      </div>
    );
  }
  return (
    <div
      className={`${common} flex items-center justify-center bg-[#F78E42]/20 border border-[#F78E42]/40 text-[#F78E42]`}
    >
      <Waves className="h-5 w-5" aria-hidden="true" />
    </div>
  );
}

export interface BestRightNowProps {
  /**
   * Optional explicit coordinates to scope the leaderboard to the closest
   * region. When provided, bypasses the client-side cookie lookup — used by
   * the /forecast hub to pin results to the active region.
   */
  userCoordsOverride?: { lat: number; lon: number } | null;
  /** Optional heading override (e.g. "Top spots in Southern California"). */
  headingOverride?: string;
}

export function BestRightNow({
  userCoordsOverride,
  headingOverride,
}: BestRightNowProps = {}) {
  const [userCoords, setUserCoords] = useState<{
    lat: number;
    lon: number;
  } | null>(userCoordsOverride ?? null);

  useEffect(() => {
    if (userCoordsOverride) {
      setUserCoords(userCoordsOverride);
      return;
    }
    const cookieName = getIPLocationCookieName();
    const cookieEntry = document.cookie
      .split("; ")
      .find((c) => c.startsWith(`${cookieName}=`));
    if (cookieEntry) {
      const rawValue = cookieEntry.split("=").slice(1).join("=");
      const ipLocation = parseIPLocationCookie(decodeURIComponent(rawValue));
      if (
        ipLocation?.latitude != null &&
        ipLocation?.longitude != null
      ) {
        setUserCoords({ lat: ipLocation.latitude, lon: ipLocation.longitude });
      }
    }
  }, [userCoordsOverride]);

  const fetchTopBeaches = useCallback(
    () => getTopBeachesNow(5, userCoords?.lat, userCoords?.lon),
    [userCoords]
  );
  const { data, loading } = useDataFetcher<TopBeachEntry[]>(fetchTopBeaches);

  const heading =
    headingOverride ?? (userCoords !== null ? "Best Near You" : "Best Right Now");

  if (loading) {
    return (
      <div data-testid="best-right-now" className="sr-heading">
        <h2 className="sr-only">{heading}</h2>
        <BestRightNowSkeleton />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return null;
  }

  return (
    <div data-testid="best-right-now">
      <h2 className="sr-only">{heading}</h2>

      <ul className="divide-y divide-white/[0.06] rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden">
        {data.map((beach, index) => {
          const scoreColors = getScoreColorClasses(beach.score);
          const waveDisplay = formatWaveHeight(beach.waveHeight);

          const content = (
            <div className="flex items-center gap-3 px-4 py-3">
              <RankBadge rank={index + 1} />

              <BeachThumb
                imageUrl={beach.imageUrl}
                beachName={beach.beachName}
                index={index}
              />

              <div className="flex-1 min-w-0">
                <span className="block truncate font-medium text-white">
                  {beach.beachName}
                </span>
                <span className="text-xs text-white/55">
                  {beach.regionName}
                </span>
              </div>

              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="flex items-center gap-1 text-sm text-white/70">
                  <Waves className="h-3.5 w-3.5" aria-hidden="true" />
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
              <li key={beach.beachId}>
                <Link
                  href={beach.href}
                  className="block transition-colors hover:bg-white/[0.05] focus-visible:outline-none focus-visible:bg-white/[0.08]"
                >
                  {content}
                </Link>
              </li>
            );
          }

          return <li key={beach.beachId}>{content}</li>;
        })}
      </ul>
    </div>
  );
}
