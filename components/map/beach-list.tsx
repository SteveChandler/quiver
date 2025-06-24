"use client";

import { Button } from "@/components/ui/button";
import { BeachCard } from "@/components/beach-card";
import { BeachCardListSkeleton } from "@/components/skeletons/beach-card-skeleton";
import { useBeachCardData } from "@/hooks/use-beach-card-data";
import { MAP_PRESET_USAGE } from "@/lib/constants/map-presets";
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
  // Use the centralized beach card data hook with standardized presets
  const { beachCardData, loading: cardDataLoading } = useBeachCardData(
    filteredBeaches,
    {
      userLocation: userLocation || undefined,
      calculateDistance: userLocation ? getDistanceFromUser : undefined,
      defaultLocationText: "San Diego",
      mapOptions: MAP_PRESET_USAGE.BEACH_CARD_LIST,
    }
  );

  if (loading || cardDataLoading) {
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
          beachCardData.map((beach) => {
            // Find the original beach object to pass to onBeachSelect
            const originalBeach = filteredBeaches.find(
              (b) => b.id === beach.id
            );

            return (
              <BeachCard
                key={beach.id}
                id={beach.id}
                name={beach.name}
                distance={beach.distance}
                rating={beach.rating}
                reviewCount={beach.reviewCount}
                imageUrl={beach.mapImageUrl}
                latitude={beach.latitude}
                longitude={beach.longitude}
                onViewDetails={() =>
                  originalBeach && onBeachSelect(originalBeach)
                }
              />
            );
          })
        )}
      </div>
    </div>
  );
}
