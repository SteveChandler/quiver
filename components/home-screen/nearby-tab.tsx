"use client";

import { useCallback, useMemo } from "react";
import { Loader2 } from "lucide-react";
import { BeachCard } from "@/components/beach-card";
import { useMultipleBeachReviews } from "@/hooks/use-beach-reviews";
import { prepareMultipleBeachCardData } from "@/lib/utils/beach-card-utils";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { useGeolocation } from "@/hooks/use-geolocation";
import { getNearbyBeaches } from "@/actions/beach-actions";
import type { Beach } from "@/types/database";

interface NearbyTabProps {
  beaches: Beach[];
  loading: boolean;
}

export function NearbyTab({ beaches, loading }: NearbyTabProps) {
  // Get user location (falls back to Ocean Beach if denied by design of hook)
  const { userLocation, loading: locationLoading } = useGeolocation();

  // Fetch nearby beaches using standard data fetching pattern
  const fetchNearby = useCallback(async () => {
    if (!userLocation) return [] as Beach[];

    const result = await getNearbyBeaches(
      userLocation.lat,
      userLocation.lng,
      50
    );

    if (result.success && result.data) {
      return result.data as Beach[];
    }

    // Fallback to provided list (kept for resiliency)
    return beaches;
  }, [userLocation, beaches]);

  const { data: nearbyData, loading: nearbyLoading } = useDataFetcher<Beach[]>(
    fetchNearby,
    { skip: !userLocation }
  );

  // Prefer fetched nearby data; fallback to any provided list
  const displayBeaches = useMemo<Beach[]>(() => {
    if (nearbyData && nearbyData.length > 0) return nearbyData;
    return beaches;
  }, [nearbyData, beaches]);

  // Memoize the beach IDs to ensure stable dependencies
  const beachIds = useMemo(
    () => displayBeaches.map((beach) => beach.id),
    [displayBeaches]
  );

  const { reviewStats, loading: reviewsLoading } =
    useMultipleBeachReviews(beachIds);

  if (loading || nearbyLoading || locationLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (displayBeaches.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No beaches found nearby
      </div>
    );
  }

  const beachCardData = prepareMultipleBeachCardData(
    displayBeaches,
    userLocation || undefined,
    reviewStats,
    "BEACH_CARD_NEARBY"
  );

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {beachCardData.map((beachData) => (
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
        />
      ))}
    </div>
  );
}
