"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { BeachCard } from "@/components/beach-card";
import { useBeachCardData } from "@/hooks/use-beach-card-data";
import { beachNavigation } from "@/lib/navigation-utils";
import { MAP_PRESET_USAGE } from "@/lib/constants/map-presets";
import { getStaticMapImageUrl, resolveBeachCoordinates } from "@/lib/map-utils";
import { calculateDistance } from "@/lib/utils/distance-utils";
import type { Beach } from "@/types/database";

// Ocean Beach, San Diego coordinates
const OCEAN_BEACH_LAT = 32.7503;
const OCEAN_BEACH_LNG = -117.2534;

interface NearbyTabProps {
  beaches: Beach[];
  loading: boolean;
}

export function NearbyTab({ beaches, loading }: NearbyTabProps) {
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
      {beaches.slice(0, 5).map((beach) => {
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
            coords.longitude,
            "miles"
          );
          distance = `${calculatedDistance.toFixed(1)} miles`;
        }

        return (
          <BeachCard
            key={beach.id}
            id={beach.id}
            name={beach.name}
            distance={distance}
            rating={4.0}
            reviewCount={Math.floor(Math.random() * 200) + 50}
            imageUrl={mapImageUrl}
            latitude={coords?.latitude}
            longitude={coords?.longitude}
          />
        );
      })}
    </div>
  );
}
