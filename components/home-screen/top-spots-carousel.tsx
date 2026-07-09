"use client";

import React from "react";
import { MapPin, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getWindowDayLabel } from "@/lib/utils/date-time";
import type { SurfDiscoveryRecommendation, PersonalizedForecastWindow, TimeSlot } from "@/types/personalization";
import {
  CompactSpotCard,
  CompactSpotCardSkeleton,
} from "./compact-spot-card";

/**
 * Props for TopSpotsCarousel component
 */
/** Labels for time slot filter display */
const TIME_SLOT_LABELS: Record<TimeSlot, string> = {
  'any': 'Any time',
  'dawn-patrol': 'Dawn patrol',
  'late-morning': 'Late morning',
  'lunch-session': 'Lunch session',
  'afternoon': 'Afternoon',
};

export interface TopSpotsCarouselProps {
  /** Array of surf spot recommendations to display */
  spots: SurfDiscoveryRecommendation[];
  /** Hero recommendation's forecast window (for time context) */
  heroWindow?: PersonalizedForecastWindow;
  /** Currently selected time slot filter */
  timeSlot?: TimeSlot;
  /** Whether data is currently loading */
  loading?: boolean;
  /** Callback when user taps to view spot details */
  onViewSpot: (beachId: string) => void;
  /** Callback when user wants to use their location */
  onUseMyLocation?: () => void;
  /** Whether to show the location CTA in empty state */
  showLocationCta?: boolean;
  /** Whether location is currently being fetched */
  locationLoading?: boolean;
}

/**
 * TopSpotsCarousel - Horizontal scrolling carousel of top surf spot recommendations
 *
 * Displays a "Your Top Spots" section with horizontally scrolling compact cards.
 * Features smooth snap scrolling, loading skeletons, and empty state handling.
 *
 * Features:
 * - Horizontal scroll with snap-to-card behavior
 * - Loading skeleton state (3 placeholder cards)
 * - Empty state with optional location CTA
 * - Edge fade effect to indicate scrollability
 * - First card gets featured styling
 *
 * @example
 * ```tsx
 * <TopSpotsCarousel
 *   spots={recommendations}
 *   loading={isLoading}
 *   onViewSpot={(id) => router.push(`/beach/${id}`)}
 *   onUseMyLocation={handleLocationRequest}
 *   showLocationCta={!hasLocation}
 * />
 * ```
 */
export const TopSpotsCarousel = React.memo(function TopSpotsCarousel({
  spots,
  heroWindow,
  timeSlot,
  loading = false,
  onViewSpot,
  onUseMyLocation,
  showLocationCta = false,
  locationLoading = false,
}: TopSpotsCarouselProps) {
  // Derive dynamic header and context from hero window
  const dayLabel = heroWindow
    ? getWindowDayLabel(heroWindow.start, heroWindow.timezone)
    : null;
  const sectionTitle = dayLabel
    ? `Top spots for ${dayLabel}`
    : "Your Top Spots";
  const contextChip = timeSlot ? TIME_SLOT_LABELS[timeSlot] : null;
  // Loading state - show skeleton cards
  if (loading) {
    return (
      <section className="space-y-3" aria-label="Your Top Spots">
        {/* Section Header */}
        <div className="px-4 sm:px-6 lg:px-8">
          <h2 className="text-base xs:text-lg sm:text-xl font-bold text-gray-900">Your Top Spots</h2>
        </div>

        {/* Skeleton Carousel */}
        <div className="relative">
          <div
            className={cn(
              "flex gap-2.5 xs:gap-3 sm:gap-4 overflow-x-auto pb-3",
              "snap-x snap-mandatory scrollbar-hide",
              // Smooth momentum scrolling on iOS
              "-webkit-overflow-scrolling-touch",
              // Full-bleed on mobile, contained on desktop
              "px-4 sm:px-6 lg:px-8"
            )}
          >
            {[1, 2, 3].map((i) => (
              <CompactSpotCardSkeleton key={i} />
            ))}
            {/* Spacer for right padding on scroll */}
            <div className="shrink-0 w-1 sm:hidden" aria-hidden="true" />
          </div>
          {/* Right fade indicator */}
          <div
            className="absolute right-0 top-0 bottom-3 w-8 sm:w-12 pointer-events-none bg-gradient-to-l from-white to-transparent md:hidden"
            aria-hidden="true"
          />
        </div>
      </section>
    );
  }

  // Empty state
  if (!spots || spots.length === 0) {
    return (
      <section className="space-y-3" aria-label="Your Top Spots">
        {/* Section Header */}
        <div className="px-4 sm:px-6 lg:px-8">
          <h2 className="text-base xs:text-lg sm:text-xl font-bold text-gray-900">Your Top Spots</h2>
        </div>

        {/* Empty State Content */}
        <div className="mx-4 sm:mx-6 lg:mx-8 rounded-xl border border-dashed border-gray-300 bg-gray-50/50 p-4 sm:p-6">
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="p-2.5 sm:p-3 rounded-full bg-blue-50">
              <MapPin className="h-5 w-5 sm:h-6 sm:w-6 text-blue-500" />
            </div>
            <div className="space-y-1">
              <p className="text-xs sm:text-sm font-medium text-gray-700">
                No spots found yet
              </p>
              <p className="text-[10px] xs:text-xs text-gray-500 max-w-[240px] sm:max-w-none">
                {showLocationCta
                  ? "Share your location to discover nearby surf spots"
                  : "Check back soon for personalized recommendations"}
              </p>
            </div>
            {showLocationCta && onUseMyLocation && (
              <Button
                size="sm"
                variant="outline"
                onClick={onUseMyLocation}
                disabled={locationLoading}
                className="mt-2 min-h-[44px] px-4"
              >
                <Navigation className="h-4 w-4 mr-2 shrink-0" />
                {locationLoading ? "Detecting..." : "Use My Location"}
              </Button>
            )}
          </div>
        </div>
      </section>
    );
  }

  // Main carousel with spots
  return (
    <section
      className="space-y-3"
      aria-label={sectionTitle}
      data-testid="top-spots-carousel"
    >
      {/* Section Header */}
      <div className="px-4 sm:px-6 lg:px-8">
        <h2 className="text-base xs:text-lg sm:text-xl font-bold text-gray-900">{sectionTitle}</h2>
        {contextChip && (
          <p className="text-xs text-gray-500 mt-0.5" data-testid="top-spots-context">
            {contextChip}
          </p>
        )}
      </div>

      {/* Carousel Container */}
      <div className="relative">
        <div
          className={cn(
            "flex gap-2.5 xs:gap-3 sm:gap-4 overflow-x-auto pb-3",
            "snap-x snap-mandatory scrollbar-hide",
            // Smooth momentum scrolling on iOS
            "-webkit-overflow-scrolling-touch",
            // Full-bleed on mobile, contained on desktop
            "px-4 sm:px-6 lg:px-8"
          )}
          role="list"
          aria-label="Top surf spots carousel"
        >
          {spots.map((spot, index) => (
            <CompactSpotCard
              key={spot.beach.id}
              recommendation={spot}
              onTap={onViewSpot}
              featured={index === 0}
              impressionRank={index + 1}
              impressionSurface="home_top_spots"
              timeSlot={timeSlot}
            />
          ))}
          {/* Spacer for right padding on scroll */}
          <div className="shrink-0 w-1 sm:hidden" aria-hidden="true" />
        </div>

        {/* Right fade indicator - shows on mobile only */}
        {spots.length > 2 && (
          <div
            className="absolute right-0 top-0 bottom-3 w-8 sm:w-12 pointer-events-none bg-gradient-to-l from-white to-transparent md:hidden"
            aria-hidden="true"
          />
        )}
      </div>
    </section>
  );
});

export default TopSpotsCarousel;
