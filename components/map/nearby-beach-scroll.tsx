"use client";

import { Card } from "@/components/ui/card";
import { MapPin } from "lucide-react";
import { MapImage } from "@/components/map-image";
import { getStaticMapImageUrl } from "@/lib/map-utils";
import type { Beach } from "@/types/database";

interface NearbyBeachScrollProps {
  nearbyBeachesForScroll: Beach[];
  selectedBeach: Beach | null;
  onBeachSelect: (beach: Beach) => void;
  onViewModeChange: (mode: "map" | "list") => void;
  getDistanceFromUser: (beachLat: number, beachLng: number) => string;
  userLocation: { lat: number; lng: number } | null;
}

export function NearbyBeachScroll({
  nearbyBeachesForScroll,
  selectedBeach,
  onBeachSelect,
  onViewModeChange,
  getDistanceFromUser,
  userLocation,
}: NearbyBeachScrollProps) {
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
          {nearbyBeachesForScroll.map((beach) => (
            <div
              key={beach.id}
              onClick={() => onBeachSelect(beach)}
              className="cursor-pointer flex-shrink-0 w-48"
            >
              <Card className="overflow-hidden hover:shadow-md transition-shadow">
                <div className="relative h-24">
                  <MapImage
                    src={getStaticMapImageUrl(beach.latitude, beach.longitude, {
                      width: 200,
                      height: 96,
                      zoom: 15,
                    })}
                    alt={beach.name}
                    latitude={beach.latitude}
                    longitude={beach.longitude}
                    fill
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-0 left-0 p-2 text-white">
                    <h4 className="font-medium text-sm truncate">
                      {beach.name}
                    </h4>
                    <div className="flex items-center text-xs">
                      <MapPin className="h-3 w-3 mr-1" />
                      <span className="truncate">
                        {userLocation
                          ? getDistanceFromUser(beach.latitude, beach.longitude)
                          : beach.location || "San Diego"}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
