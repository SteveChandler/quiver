"use client";

import { useRouter } from "next/navigation";
import { BeachCard } from "@/components/beach-card";
import { useBeachCardData } from "@/hooks/use-beach-card-data";
import { beachNavigation } from "@/lib/navigation-utils";
import { MAP_PRESET_USAGE } from "@/lib/constants/map-presets";
import type { Beach } from "@/types/database";

interface NearbyBeachScrollProps {
  nearbyBeachesForScroll: Beach[];
  selectedBeach: Beach | null;
  onBeachSelect: (beach: Beach) => void;
  onViewModeChange: (mode: "map" | "list") => void;
  getDistanceFromUser: (beachLat: number, beachLng: number) => string;
  userLocation: { lat: number; lng: number } | null;
  showForecastPreviews?: boolean;
}

export function NearbyBeachScroll({
  nearbyBeachesForScroll,
  selectedBeach,
  onBeachSelect,
  onViewModeChange,
  getDistanceFromUser,
  userLocation,
  showForecastPreviews = true,
}: NearbyBeachScrollProps) {
  const router = useRouter();

  // Use the centralized beach card data hook with standardized presets
  const { beachCardData } = useBeachCardData(nearbyBeachesForScroll, {
    userLocation,
    calculateDistance: userLocation ? getDistanceFromUser : undefined,
    defaultLocationText: "San Diego",
    mapOptions: MAP_PRESET_USAGE.BEACH_CARD_SCROLL,
  });

  if (nearbyBeachesForScroll.length === 0) {
    return null;
  }

  return (
    <div className="bg-background border-t">
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium text-sm">
            {selectedBeach
              ? `${nearbyBeachesForScroll.length} other nearby beaches`
              : `${nearbyBeachesForScroll.length} beaches nearby`}
          </h3>
          <button
            onClick={() => onViewModeChange("list")}
            className="text-primary text-sm font-medium"
          >
            View All
          </button>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {beachCardData.map((beach) => {
            // Find the original beach object to pass to onBeachSelect
            const originalBeach = nearbyBeachesForScroll.find(
              (b) => b.id === beach.id
            );

            return (
              <div key={beach.id} className="flex-shrink-0 w-48">
                <BeachCard
                  id={beach.id}
                  name={beach.name}
                  distance={beach.distance}
                  rating={beach.rating}
                  reviewCount={beach.reviewCount}
                  imageUrl={beach.mapImageUrl}
                  latitude={beach.latitude}
                  longitude={beach.longitude}
                  showForecastPreview={showForecastPreviews}
                  onViewDetails={() =>
                    originalBeach && onBeachSelect(originalBeach)
                  }
                  onMapClick={() =>
                    beachNavigation.navigateToBeach(router, beach.id)
                  }
                  onReviewsClick={() =>
                    beachNavigation.navigateToBeachReviews(router, beach.id)
                  }
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
