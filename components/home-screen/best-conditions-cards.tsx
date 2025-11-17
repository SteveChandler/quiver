"use client";

import { useCallback, useMemo, memo } from "react";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { getBestBeachesNearHome } from "@/actions/beach/best-beaches-simple";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Waves, Wind, TrendingUp } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import type { BeachRecommendation } from "@/types/beach-recommendations";
import type { Beach } from "@/types/database";
import { useGeo } from "@/hooks/useGeo";
import {
  getSkillLevelStyle,
  getCrowdLevelStyle,
} from "@/lib/constants/beach-badge-styles";
import { getBestConditionsHeading } from "@/lib/utils/best-conditions-helpers";
import { beachNavigation } from "@/lib/navigation-utils";
import { PersonalizedBadge } from "@/components/recommendations/PersonalizedBadge";
import { getBeachLocation } from "@/lib/utils/beach-card-utils";

interface BestConditionsCardsProps {
  homeBeach?: Beach | null;
}

const BestConditionsCardsComponent = ({ homeBeach }: BestConditionsCardsProps) => {
  const router = useRouter();
  const { coords, source } = useGeo();

  const fetchData = useCallback(async () => {
    return await getBestBeachesNearHome(coords);
  }, [coords]);

  const { data: result, loading, error } = useDataFetcher(fetchData);

  // Determine heading based on location source from metadata
  // Memoized to avoid recalculating on every render
  // Must be called before any conditional returns to follow Rules of Hooks
  const headingText = useMemo(
    () => getBestConditionsHeading(
      result?.metadata?.locationSource === 'gps' ? 'gps' : 'home-beach',
      homeBeach?.name
    ),
    [result?.metadata?.locationSource, homeBeach?.name]
  );

  if (loading) {
    return <BestConditionsCardsSkeleton data-testid="best-conditions-skeleton" />;
  }

  if (error) {
    // Show error state instead of hiding
    return (
      <div className="space-y-4" data-testid="best-conditions-error">
        <div>
          <h3 className="text-2xl font-roboto font-bold text-gray-900">{headingText}</h3>
          <p className="text-sm text-gray-600 mt-1">
            Top surf spots within 10 miles right now
          </p>
        </div>
        <div className="p-8 bg-red-50 border-2 border-red-200 rounded-lg text-center">
          <p className="text-lg font-medium text-red-900" data-testid="error-message">
            Error loading beaches: {error}
          </p>
        </div>
      </div>
    );
  }

  if (!result?.success || !result.data || result.data.length === 0) {
    return null; // Hide if no beaches within range
  }

  const beaches = result.data as BeachRecommendation[];

  return (
    <div className="space-y-4" data-testid="best-conditions-section">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-2xl font-roboto font-bold text-gray-900" data-testid="best-conditions-heading">{headingText}</h3>
          <p className="text-sm text-gray-600 mt-1">
            Top surf spots within 10 miles right now
          </p>
        </div>
      </div>

      {/* Horizontal Scrollable Cards */}
      <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide" data-testid="best-conditions-cards-container">
        {beaches.map((beach) => (
          <Card
            key={beach.id}
            data-testid="best-conditions-card"
            className="flex-shrink-0 w-[280px] sm:w-[320px] cursor-pointer hover:shadow-lg transition-all duration-200 active:scale-[0.99] snap-start rounded-lg"
            onClick={() => beachNavigation.navigateToBeach(router, beach)}
          >
            {/* Beach Image */}
            <div className="relative h-48 w-full bg-gray-200">
              {beach.image_url ? (
                <Image
                  src={beach.image_url}
                  alt={beach.name}
                  fill
                  loading="lazy"
                  className="object-cover rounded-t-lg"
                  sizes="(max-width: 640px) 280px, 320px"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-blue-100 to-blue-200">
                  <Waves className="h-12 w-12 text-blue-400" />
                </div>
              )}

              {/* Personalized match badge - top left */}
              {beach.personalized && (
                <div className="absolute top-3 left-3 z-10">
                  <PersonalizedBadge
                    personalized={beach.personalized}
                    breakdown={beach.scoreBreakdown}
                    affinityData={beach.affinityData ? {
                      sessionCount: beach.affinityData.sessionCount,
                      lastSurfed: new Date(beach.affinityData.lastSurfed)
                    } : undefined}
                    className="shadow-lg backdrop-blur-sm bg-white/95"
                  />
                </div>
              )}

              {/* Hidden gem badge - top right */}
              {beach.is_hidden_gem && (
                <Badge className="absolute top-3 right-3 z-10 bg-purple-500 hover:bg-purple-600 shadow-lg">
                  <span className="mr-1">💎</span>
                  Hidden Gem
                </Badge>
              )}
            </div>

            <CardContent className="p-4 space-y-3">
              {/* Beach Name & Location */}
              <div>
                <h4 className="font-semibold text-lg line-clamp-1">
                  {beach.name}
                </h4>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <span>📍</span> {getBeachLocation(beach)} · {beach.distance_miles} mi
                </p>
              </div>

              {/* Conditions */}
              <div className="space-y-2">
                {/* Wave Height */}
                <div className="flex items-center gap-2 text-sm">
                  <Waves className="h-4 w-4 text-blue-600 flex-shrink-0" />
                  <span className="font-medium">{beach.wave_height}</span>
                  <span className="text-muted-foreground">
                    {beach.wave_direction}
                  </span>
                </div>

                {/* Wind */}
                <div className="flex items-center gap-2 text-sm">
                  <Wind className="h-4 w-4 text-green-600 flex-shrink-0" />
                  <span className="text-muted-foreground line-clamp-1">
                    {beach.wind_description}
                  </span>
                </div>

                {/* Tide */}
                <div className="flex items-center gap-2 text-sm">
                  <TrendingUp className="h-4 w-4 text-purple-600 flex-shrink-0" />
                  <span className="text-muted-foreground line-clamp-1">
                    {beach.tide_status}
                  </span>
                </div>
              </div>

              {/* Badges */}
              <div className="flex gap-2 pt-2 flex-wrap">
                <Badge
                  variant="outline"
                  className={getSkillLevelStyle(beach.skill_level)}
                  data-testid="skill-badge"
                >
                  {beach.skill_level}
                </Badge>
                <Badge
                  variant="outline"
                  className={getCrowdLevelStyle(beach.crowd_level)}
                  data-testid="crowd-badge"
                >
                  <span className="mr-1">👥</span>
                  {beach.crowd_level}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

/**
 * Custom comparison function for BestConditionsCards memoization
 * Handles homeBeach object prop correctly
 */
const areBestConditionsCardsPropsEqual = (
  prev: BestConditionsCardsProps,
  next: BestConditionsCardsProps
): boolean => {
  // Compare homeBeach objects by ID (most stable identifier)
  // If both null/undefined, they're equal
  if (!prev.homeBeach && !next.homeBeach) return true;

  // If one is defined and the other isn't, they're different
  if (!prev.homeBeach || !next.homeBeach) return false;

  // Compare by ID and name (key properties)
  return (
    prev.homeBeach.id === next.homeBeach.id &&
    prev.homeBeach.name === next.homeBeach.name
  );
};

// Memoized to prevent unnecessary re-renders when parent re-renders
// Uses custom comparison to handle homeBeach object prop correctly
export const BestConditionsCards = memo(
  BestConditionsCardsComponent,
  areBestConditionsCardsPropsEqual
);
BestConditionsCards.displayName = 'BestConditionsCards';

function BestConditionsCardsSkeleton({ "data-testid": dataTestId }: { "data-testid"?: string }) {
  return (
    <div className="space-y-4" data-testid={dataTestId}>
      <div className="space-y-2">
        <div className="h-6 w-48 bg-gray-200 animate-pulse rounded" />
        <div className="h-4 w-64 bg-gray-200 animate-pulse rounded" />
      </div>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="flex-shrink-0 w-[280px] sm:w-[320px]">
            <div className="h-48 bg-gray-200 animate-pulse rounded-t-lg" />
            <CardContent className="p-4 space-y-3">
              <div className="space-y-2">
                <div className="h-5 bg-gray-200 animate-pulse rounded w-3/4" />
                <div className="h-4 bg-gray-200 animate-pulse rounded w-1/2" />
              </div>
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 animate-pulse rounded" />
                <div className="h-4 bg-gray-200 animate-pulse rounded" />
                <div className="h-4 bg-gray-200 animate-pulse rounded" />
              </div>
              <div className="flex gap-2 pt-2">
                <div className="h-6 w-20 bg-gray-200 animate-pulse rounded" />
                <div className="h-6 w-24 bg-gray-200 animate-pulse rounded" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

