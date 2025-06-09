"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin } from "lucide-react";
import type { Beach } from "@/types/database";

interface SelectedBeachCardProps {
  selectedBeach: Beach | null;
  getDistanceFromUser: (beachLat: number, beachLng: number) => string;
  userLocation: { lat: number; lng: number } | null;
}

export function SelectedBeachCard({
  selectedBeach,
  getDistanceFromUser,
  userLocation,
}: SelectedBeachCardProps) {
  const router = useRouter();

  if (!selectedBeach) {
    return null;
  }

  return (
    <div className="px-4 py-3 bg-background border-t">
      <Card
        className="cursor-pointer hover:shadow-lg transition-shadow border-primary border-2"
        onClick={() => router.push(`/beach/${selectedBeach.id}`)}
      >
        <CardContent className="p-3">
          <div className="flex items-center gap-3">
            <div className="h-16 w-16 rounded-md bg-primary/10 flex items-center justify-center">
              <MapPin className="h-8 w-8 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-primary">{selectedBeach.name}</h3>
              <div className="flex items-center text-sm text-muted-foreground">
                <MapPin className="h-3 w-3 mr-1" />
                <span>
                  {userLocation
                    ? getDistanceFromUser(
                        selectedBeach.latitude,
                        selectedBeach.longitude
                      )
                    : selectedBeach.location || "San Diego"}
                </span>
              </div>
              <div className="flex items-center mt-1">
                {Array(5)
                  .fill(0)
                  .map((_, i) => (
                    <MapPin
                      key={i}
                      className={`h-3 w-3 ${
                        i < (selectedBeach.wave_quality_rating || 4)
                          ? "text-yellow-500 fill-yellow-500"
                          : "text-gray-300"
                      }`}
                    />
                  ))}
                <span className="text-xs ml-1 text-muted-foreground">
                  (128)
                </span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">
                Selected Beach
              </div>
              <div className="text-primary font-medium text-sm">
                View Details →
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
