"use client";

import { useMemo } from "react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { BeachCard } from "@/components/beach-card";
import { useBeachCardData } from "@/hooks/use-beach-card-data";
import { beachNavigation } from "@/lib/navigation-utils";
import { useMultipleBeachReviews } from "@/hooks/use-beach-reviews";
import { prepareMultipleBeachCardData } from "@/lib/utils/beach-card-utils";
import type { Beach } from "@/types/database";

// Ocean Beach, San Diego coordinates
const OCEAN_BEACH_LAT = 32.7503;
const OCEAN_BEACH_LNG = -117.2534;

interface NearbyTabProps {
  beaches: Beach[];
  loading: boolean;
}

export function NearbyTab({ beaches, loading }: NearbyTabProps) {
  // Memoize the display beaches to prevent unnecessary recalculations
  const displayBeaches = useMemo(() => beaches.slice(0, 5), [beaches]);

  // Memoize the beach IDs to ensure stable dependencies
  const beachIds = useMemo(
    () => displayBeaches.map((beach) => beach.id),
    [displayBeaches]
  );

  const { reviewStats, loading: reviewsLoading } =
    useMultipleBeachReviews(beachIds);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (beaches.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No beaches found nearby
      </div>
    );
  }

  const userLocation = { lat: OCEAN_BEACH_LAT, lng: OCEAN_BEACH_LNG };
  const beachCardData = prepareMultipleBeachCardData(
    displayBeaches,
    userLocation,
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
