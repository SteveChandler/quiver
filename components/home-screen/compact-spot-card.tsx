"use client";

import React from "react";
import { Waves, Ruler, Wind } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatDiscoveryScore } from "@/lib/utils/rating-formatters";
import type { SurfDiscoveryRecommendation } from "@/types/personalization";

/**
 * Props for CompactSpotCard component
 */
export interface CompactSpotCardProps {
  /** Surf spot recommendation data */
  recommendation: SurfDiscoveryRecommendation;
  /** Callback when user taps the card */
  onTap: (beachId: string) => void;
  /** Whether this is a featured/first card */
  featured?: boolean;
}

/**
 * Get background class for card - unified white style
 */
function getBackgroundClass(): string {
  return "bg-white border-gray-100 shadow-sm";
}

/**
 * Get score circle color - unified orange style
 */
function getScoreColor(): string {
  return "bg-accent-orange text-white";
}

/**
 * CompactSpotCard - A compact square card for horizontal carousel display
 *
 * Displays a surf spot recommendation in a compact format suitable for
 * the "Your Top Spots" horizontal carousel on the home screen.
 *
 * Features:
 * - Score circle in top-right corner
 * - Wave icon in top-left
 * - Beach name (truncated if long)
 * - Conditions summary (wave height, wind)
 * - Optional distance display
 * - Background color based on match quality
 *
 * @example
 * ```tsx
 * <CompactSpotCard
 *   recommendation={recommendation}
 *   onTap={(beachId) => router.push(`/beach/${beachId}`)}
 *   featured={index === 0}
 * />
 * ```
 */
export const CompactSpotCard = React.memo(function CompactSpotCard({
  recommendation,
  onTap,
  featured = false,
}: CompactSpotCardProps) {
  const { beach, score, window, matchQuality, distanceMiles } = recommendation;
  const formattedScore = formatDiscoveryScore(score);

  return (
    <Card
      className={cn(
        // Responsive width: smaller on tiny screens, larger on tablets+
        "w-[140px] xs:w-[160px] sm:w-[180px] h-[160px] xs:h-[180px] sm:h-[200px]",
        "shrink-0 snap-start cursor-pointer",
        "transition-all duration-200 hover:shadow-md motion-safe:hover:scale-[1.02]",
        "motion-safe:active:scale-[0.98]",
        // Touch-friendly: ensure minimum touch target
        "touch-manipulation",
        getBackgroundClass(),
        featured && "ring-2 ring-accent-orange ring-offset-2"
      )}
      onClick={() => onTap(beach.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onTap(beach.id);
        }
      }}
      aria-label={`${beach.name}, score ${formattedScore} out of 10`}
      data-testid="compact-spot-card"
    >
      <div className="relative h-full p-2.5 xs:p-3 sm:p-4 flex flex-col">
        {/* Top row: Wave icon and score */}
        <div className="flex items-start justify-between">
          {/* Wave icon */}
          <div className="p-1 xs:p-1.5 rounded-md bg-blue-50">
            <Waves className="h-3.5 w-3.5 xs:h-4 xs:w-4 text-blue-500" />
          </div>

          {/* Score circle - maintains 44px touch target */}
          <div
            className={cn(
              "w-9 h-9 xs:w-10 xs:h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center",
              "font-bold text-xs xs:text-sm shadow-sm",
              getScoreColor()
            )}
          >
            {formattedScore}
          </div>
        </div>

        {/* Spacer to push content to bottom */}
        <div className="flex-1 min-h-2" />

        {/* Bottom content */}
        <div className="space-y-1 xs:space-y-1.5">
          {/* Beach name */}
          <h3
            className="font-semibold text-xs xs:text-sm text-gray-900 leading-tight line-clamp-2"
            title={beach.name}
          >
            {beach.name}
          </h3>

          {/* Conditions with icons */}
          <div className="flex items-center gap-1 xs:gap-1.5 text-[10px] xs:text-xs text-gray-600">
            <Ruler className="h-3 w-3 text-gray-400 shrink-0" />
            <span className="font-medium truncate">{window.waveHeight}</span>
            <Wind className="h-3 w-3 text-gray-400 shrink-0 ml-1" />
            <span className="truncate">{window.wind}</span>
          </div>

          {/* Distance (if available) */}
          {distanceMiles !== undefined && distanceMiles > 0 && (
            <p className="text-[10px] xs:text-xs text-gray-500">
              {distanceMiles < 10
                ? distanceMiles.toFixed(1)
                : Math.round(distanceMiles)}{" "}
              mi away
            </p>
          )}
        </div>
      </div>
    </Card>
  );
});

/**
 * Loading skeleton for CompactSpotCard
 */
export function CompactSpotCardSkeleton() {
  return (
    <div
      className="w-[140px] xs:w-[160px] sm:w-[180px] h-[160px] xs:h-[180px] sm:h-[200px] shrink-0 snap-start rounded-lg border border-gray-100 bg-white shadow-sm animate-pulse"
      data-testid="compact-spot-card-skeleton"
    >
      <div className="relative h-full p-2.5 xs:p-3 sm:p-4 flex flex-col">
        {/* Top row skeleton */}
        <div className="flex items-start justify-between">
          <div className="w-7 h-7 xs:w-8 xs:h-8 rounded-md bg-gray-100" />
          <div className="w-9 h-9 xs:w-10 xs:h-10 sm:w-11 sm:h-11 rounded-full bg-orange-100" />
        </div>

        <div className="flex-1 min-h-2" />

        {/* Bottom content skeleton */}
        <div className="space-y-1.5 xs:space-y-2">
          <div className="h-3 xs:h-4 bg-gray-100 rounded w-4/5" />
          <div className="h-2.5 xs:h-3 bg-gray-100 rounded w-3/5" />
          <div className="h-2.5 xs:h-3 bg-gray-100 rounded w-2/5" />
        </div>
      </div>
    </div>
  );
}

export default CompactSpotCard;
