"use client";

import React, { useEffect } from "react";
import Image from "next/image";
import { Ruler, Wind, Heart } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatDiscoveryScore } from "@/lib/utils/rating-formatters";
import { getProxiedImageUrl } from "@/lib/utils/image-utils";
import { formatDistanceDisplay } from "@/lib/utils/distance-utils";
import type { SurfDiscoveryRecommendation } from "@/types/personalization";
import { track } from "@/lib/analytics";

/**
 * Short variants for condition badge labels on mobile
 */
const SHORT_BADGE_LABELS: Record<string, string> = {
  "Light Offshore": "Offshore",
  "Clean Swell": "Clean",
  "Rising Tide": "Rising",
  "Falling Tide": "Falling",
};

/**
 * Get the short variant of a badge label for compact display
 */
function getShortBadgeLabel(label: string): string {
  return SHORT_BADGE_LABELS[label] ?? label;
}

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
 * CompactSpotCard - A compact square card for horizontal carousel display
 *
 * Displays a surf spot recommendation in a compact format suitable for
 * the "Your Top Spots" horizontal carousel on the home screen.
 *
 * Features:
 * - Photo background with Next.js Image (optimized loading)
 * - Blue gradient fallback when no photo available
 * - Dark gradient overlay for text readability
 * - Score circle in top-right corner
 * - Wave icon in top-left with backdrop blur
 * - Beach name (truncated if long)
 * - Conditions summary (wave height, wind)
 * - Optional distance display
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
  const { beach, score, window, distanceMiles, conditionBadges } = recommendation;
  const formattedScore = formatDiscoveryScore(score);
  const photoUrl = beach.photo_url;
  const formattedDistance = formatDistanceDisplay(distanceMiles, "compact");
  const primaryBadge = conditionBadges?.[0]?.label
    ? getShortBadgeLabel(conditionBadges[0].label)
    : null;

  // Track when favorite is shown in carousel
  useEffect(() => {
    if (recommendation.isFavorite) {
      track("favorite_shown_in_carousel", {
        beach_id: beach.id,
        score: score,
      });
    }
  }, [recommendation.isFavorite, beach.id, score]);

  return (
    <Card
      className={cn(
        "w-[140px] xs:w-[160px] sm:w-[180px] h-[160px] xs:h-[180px] sm:h-[200px]",
        "shrink-0 snap-start cursor-pointer",
        "transition-all duration-200 hover:shadow-md motion-safe:hover:scale-[1.02]",
        "motion-safe:active:scale-[0.98]",
        "touch-manipulation",
        "relative overflow-hidden",
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
      {/* Background: Photo or Gradient */}
      {photoUrl ? (
        <Image
          src={getProxiedImageUrl(photoUrl)}
          alt=""
          fill
          className="object-cover"
          sizes="(max-width: 640px) 160px, 180px"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-blue-400 to-blue-600" />
      )}

      {/* Dark gradient overlay for text readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />

      {/* Content */}
      <div className="relative z-10 h-full p-2.5 xs:p-3 sm:p-4 flex flex-col">
        {/* Top row: Wave icon and score */}
        <div className="flex items-start justify-between">
          {/* Top-left icon: Heart (if favorite) or Wave emoji */}
          <div className="p-1 xs:p-1.5 rounded-md bg-white/20 backdrop-blur-sm text-sm xs:text-base leading-none">
            {recommendation.isFavorite ? (
              <Heart
                data-testid="favorite-heart"
                aria-label="Favorited spot"
                className="h-4 w-4 xs:h-5 xs:w-5 text-red-500 fill-red-500 motion-safe:animate-pulse"
              />
            ) : (
              "🌊"
            )}
          </div>

          {/* Score circle */}
          <div
            className={cn(
              "w-9 h-9 xs:w-10 xs:h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center",
              "font-bold text-xs xs:text-sm shadow-sm",
              "bg-accent-orange text-white"
            )}
          >
            {formattedScore}
          </div>
        </div>

        {/* Spacer */}
        <div className="flex-1 min-h-2" />

        {/* Bottom content */}
        <div className="space-y-1 xs:space-y-1.5">
          {/* Beach name */}
          <h3
            className="font-semibold text-xs xs:text-sm text-white leading-tight line-clamp-2"
            title={beach.name}
          >
            {beach.name}
          </h3>

          {/* Conditions - stacked for mobile */}
          <div className="space-y-0.5 text-[10px] xs:text-xs text-white/80">
            <div className="flex items-center gap-1">
              <Ruler className="h-3 w-3 text-white/70 shrink-0" />
              <span className="font-medium">{window.waveHeight}</span>
              {primaryBadge && (
                <span className="text-white font-semibold bg-white/20 px-1 rounded">
                  {primaryBadge}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Wind className="h-3 w-3 text-white/70 shrink-0" />
              <span className="truncate">{window.wind}</span>
            </div>
          </div>

          {/* Distance */}
          {formattedDistance && (
            <p className="text-[10px] xs:text-xs text-white/60">
              {formattedDistance}
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
      className="w-[140px] xs:w-[160px] sm:w-[180px] h-[160px] xs:h-[180px] sm:h-[200px] shrink-0 snap-start rounded-lg overflow-hidden animate-pulse relative"
      data-testid="compact-spot-card-skeleton"
    >
      {/* Gradient background placeholder */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-200 to-gray-300" />

      {/* Dark overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />

      <div className="relative z-10 h-full p-2.5 xs:p-3 sm:p-4 flex flex-col">
        {/* Top row skeleton */}
        <div className="flex items-start justify-between">
          <div className="w-7 h-7 xs:w-8 xs:h-8 rounded-md bg-white/30" />
          <div className="w-9 h-9 xs:w-10 xs:h-10 sm:w-11 sm:h-11 rounded-full bg-orange-200" />
        </div>

        <div className="flex-1 min-h-2" />

        {/* Bottom content skeleton */}
        <div className="space-y-1.5 xs:space-y-2">
          <div className="h-3 xs:h-4 bg-white/40 rounded w-4/5" />
          <div className="h-2.5 xs:h-3 bg-white/30 rounded w-3/5" />
          <div className="h-2.5 xs:h-3 bg-white/20 rounded w-2/5" />
        </div>
      </div>
    </div>
  );
}

export default CompactSpotCard;
