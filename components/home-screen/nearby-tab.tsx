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
  homeBeach?: Beach | null;
}

export function NearbyTab({ beaches, loading, homeBeach }: NearbyTabProps) {
  // Get user location (falls back to home beach → Ocean Beach)
  const { userLocation, loading: locationLoading } = useGeolocation({
    defaultLocation: homeBeach
      ? { lat: homeBeach.lat, lng: homeBeach.lon }
      : null,
  });

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

  // Limit to top 10 nearby beaches for UI clarity and performance
  const limitedBeaches = useMemo<Beach[]>(
    () => displayBeaches.slice(0, 10),
    [displayBeaches]
  );

  // Memoize the beach IDs to ensure stable dependencies
  const beachIds = useMemo(
    () => limitedBeaches.map((beach) => beach.id),
    [limitedBeaches]
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

  if (limitedBeaches.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No beaches found nearby
      </div>
    );
  }

  const beachCardData = prepareMultipleBeachCardData(
    limitedBeaches,
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
          slug={beachData.slug}
          city={beachData.city}
          state={beachData.state}
        />
      ))}
    </div>
  );
}
