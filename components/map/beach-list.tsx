"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { BeachCard } from "@/components/beach-card";
import { BeachCardListSkeleton } from "@/components/skeletons/beach-card-skeleton";
import { useMultipleBeachReviews } from "@/hooks/use-beach-reviews";
import { prepareMultipleBeachCardData } from "@/lib/utils/beach-card-utils";
import {
  COVERAGE_MESSAGES,
  isLikelyOutOfAreaSearch,
} from "@/lib/constants/coverage-areas";
import { Info } from "lucide-react";
import type { Beach } from "@/types/database";

interface BeachListProps {
  filteredBeaches: Beach[];
  searchQuery: string;
  userLocation: { lat: number; lng: number } | null;
  usingDefaultLocation: boolean;
  loading?: boolean;
  onBeachSelect: (beach: Beach) => void;
  onClearSearch: () => void;
  onGetUserLocation: () => void;
  onLoadBeaches: () => void;
  getDistanceFromUser: (beachLat: number, beachLng: number) => string;
}

export function BeachList({
  filteredBeaches,
  searchQuery,
  userLocation,
  usingDefaultLocation,
  loading = false,
  onBeachSelect,
  onClearSearch,
  onGetUserLocation,
  onLoadBeaches,
  getDistanceFromUser,
}: BeachListProps) {
  // Memoize beach IDs to ensure stable dependencies
  const beachIds = useMemo(
    () => filteredBeaches.map((beach) => beach.id),
    [filteredBeaches]
  );

  const { reviewStats, loading: reviewsLoading } =
    useMultipleBeachReviews(beachIds);

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          <BeachCardListSkeleton count={6} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-4 space-y-4">
        {filteredBeaches.length === 0 ? (
          <div className="text-center py-8">
            {searchQuery ? (
              <>
                {/* Check if this might be an out-of-area search */}
                {isLikelyOutOfAreaSearch(searchQuery) ? (
                  <div className="text-left max-w-md mx-auto">
                    <div className="flex items-start gap-2 text-amber-700 text-sm p-4 bg-amber-50 rounded-lg mb-4 border border-amber-200">
                      <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="font-medium mb-2">
                          {COVERAGE_MESSAGES.OUT_OF_AREA_TITLE}
                        </p>
                        <p className="text-amber-700/80 mb-2">
                          {COVERAGE_MESSAGES.getOutOfAreaMessage(searchQuery)}
                        </p>
                        <p className="text-amber-700/80 mb-3 text-xs">
                          {COVERAGE_MESSAGES.COVERAGE_AREA_INFO}
                        </p>
                        <p className="text-xs text-amber-700/70">
                          {COVERAGE_MESSAGES.getCoverageExpansionMessage()}
                        </p>
                      </div>
                    </div>
                    <div className="text-center">
                      <Button onClick={onClearSearch} variant="outline">
                        Show San Diego Beaches
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="text-lg font-medium mb-2">No beaches found</p>
                    <p className="text-muted-foreground mb-2">
                      No beaches match "{searchQuery}"
                    </p>
                    <p className="text-xs text-muted-foreground mb-4">
                      {COVERAGE_MESSAGES.COVERAGE_AREA_INFO}
                    </p>
                    <Button onClick={onClearSearch} variant="outline">
                      Clear Search
                    </Button>
                  </div>
                )}
              </>
            ) : !userLocation ? (
              <div>
                <p className="text-lg font-medium mb-2">No location set</p>
                <p className="text-muted-foreground mb-4">
                  We need your location to find nearby beaches
                </p>
                <Button onClick={onGetUserLocation}>Get My Location</Button>
              </div>
            ) : (
              <div>
                <p className="text-lg font-medium mb-2">No beaches found</p>
                <p className="text-muted-foreground mb-4">
                  No beaches found in your area
                </p>
                <Button onClick={onLoadBeaches} variant="outline">
                  Try Again
                </Button>
              </div>
            )}
          </div>
        ) : (
          (() => {
            const beachCardData = prepareMultipleBeachCardData(
              filteredBeaches,
              userLocation,
              reviewStats,
              "BEACH_CARD_LIST"
            );

            return beachCardData.map((beachData) => (
              <BeachCard
                key={beachData.id}
                id={beachData.id}
                name={beachData.name}
                distance={beachData.distance}
                rating={beachData.rating}
                reviewCount={beachData.reviewCount}
                imageUrl={beachData.mapImageUrl}
                latitude={beachData.latitude}
                longitude={beachData.longitude}
                onViewDetails={() =>
                  onBeachSelect(
                    filteredBeaches.find((b) => b.id === beachData.id)!
                  )
                }
              />
            ));
          })()
        )}
      </div>
    </div>
  );
}
