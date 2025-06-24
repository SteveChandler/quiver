"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { BeachCard } from "@/components/beach-card";
import { BeachCardListSkeleton } from "@/components/skeletons/beach-card-skeleton";
import { useMultipleBeachReviews } from "@/hooks/use-beach-reviews";
import { prepareMultipleBeachCardData } from "@/lib/utils/beach-card-utils";
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
              <div>
                <p className="text-lg font-medium mb-2">No beaches found</p>
                <p className="text-muted-foreground mb-4">
                  No beaches match "{searchQuery}"
                </p>
                <Button onClick={onClearSearch} variant="outline">
                  Clear Search
                </Button>
              </div>
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
