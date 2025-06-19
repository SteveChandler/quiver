"use client";

import { Loader2 } from "lucide-react";
import { BeachCard } from "@/components/beach-card";
import { getStaticMapImageUrl, resolveBeachCoordinates } from "@/lib/map-utils";
import { useMultipleBeachReviews } from "@/hooks/use-beach-reviews";
import type { Beach } from "@/types/database";

// Ocean Beach, San Diego coordinates
const OCEAN_BEACH_LAT = 32.7503;
const OCEAN_BEACH_LNG = -117.2534;

interface NearbyTabProps {
  beaches: Beach[];
  loading: boolean;
}

function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 3958.8; // Earth's radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function NearbyTab({ beaches, loading }: NearbyTabProps) {
  // Get the beach IDs for the beaches we'll display (first 5)
  const displayBeaches = beaches.slice(0, 5);
  const beachIds = displayBeaches.map((beach) => beach.id);
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

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {displayBeaches.map((beach) => {
        // Get beach coordinates using the unified resolution function
        const coords = resolveBeachCoordinates(beach);

        // Generate the map image URL with same dimensions as Community tab
        const mapImageUrl = getStaticMapImageUrl(
          coords?.latitude,
          coords?.longitude,
          { width: 300, height: 200, zoom: 15 }
        );

        // Calculate actual distance if we have user location and beach coordinates
        let distance = `${Math.floor(Math.random() * 20) + 1} miles`;
        if (coords && OCEAN_BEACH_LAT && OCEAN_BEACH_LNG) {
          const calculatedDistance = calculateDistance(
            OCEAN_BEACH_LAT,
            OCEAN_BEACH_LNG,
            coords.latitude,
            coords.longitude
          );
          distance = `${calculatedDistance.toFixed(1)} miles`;
        }

        // Get real review stats for this beach
        const beachStats = reviewStats[beach.id];
        const rating = beachStats?.average_overall || 0;
        const reviewCount = beachStats?.total_reviews || 0;

        return (
          <BeachCard
            key={beach.id}
            id={beach.id}
            name={beach.name}
            distance={distance}
            rating={rating}
            reviewCount={reviewCount}
            imageUrl={mapImageUrl}
            latitude={coords?.latitude}
            longitude={coords?.longitude}
          />
        );
      })}
    </div>
  );
}
