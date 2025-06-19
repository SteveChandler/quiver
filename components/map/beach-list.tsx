"use client";

import { Button } from "@/components/ui/button";
import { BeachCard } from "@/components/beach-card";
import { getStaticMapImageUrl } from "@/lib/map-utils";
import { BeachCardListSkeleton } from "@/components/skeletons/beach-card-skeleton";
import { useMultipleBeachReviews } from "@/hooks/use-beach-reviews";
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
  // Fetch review stats for all beaches
  const beachIds = filteredBeaches.map((beach) => beach.id);
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
          filteredBeaches.map((beach) => {
            const beachStats = reviewStats[beach.id];
            const rating = beachStats?.average_overall || 0;
            const reviewCount = beachStats?.total_reviews || 0;

            return (
              <BeachCard
                key={beach.id}
                id={beach.id}
                name={beach.name}
                distance={
                  userLocation
                    ? getDistanceFromUser(beach.latitude, beach.longitude)
                    : beach.location_text || "San Diego"
                }
                rating={rating}
                reviewCount={reviewCount}
                imageUrl={getStaticMapImageUrl(
                  beach.latitude,
                  beach.longitude,
                  {
                    width: 300,
                    height: 200,
                    zoom: 14,
                  }
                )}
                latitude={beach.latitude}
                longitude={beach.longitude}
                onViewDetails={() => onBeachSelect(beach)}
              />
            );
          })
        )}
      </div>
    </div>
  );
}
