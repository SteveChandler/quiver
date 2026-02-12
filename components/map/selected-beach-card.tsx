"use client";

import { memo } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Database, Activity } from "lucide-react";
import { useForecastPreview } from "@/hooks/use-forecast-preview";
import { ForecastPreview } from "@/components/ui/forecast-preview";
import { StarRating } from "@/components/ui/star-rating";
import type { Beach } from "@/types/database";
import { getBeachUrlSafe } from "@/lib/utils/beach-url-utils";
import { getBeachLocation } from "@/lib/utils/beach-card-utils";

interface SelectedBeachCardProps {
  selectedBeach: Beach | null;
  getDistanceFromUser: (beachLat: number, beachLng: number) => string;
  userLocation: { lat: number; lon: number } | null;
}

const SelectedBeachCardComponent = function SelectedBeachCard({
  selectedBeach,
  getDistanceFromUser,
  userLocation,
}: SelectedBeachCardProps) {
  const router = useRouter();

  // Use shared forecast preview hook
  const {
    forecastPreview,
    loading: loadingForecast,
    error: forecastError,
  } = useForecastPreview({
    enabled: !!selectedBeach,
    beachId: selectedBeach?.id,
  });

  if (!selectedBeach) {
    return null;
  }

  // Generate hierarchical URL (with fallback to ID-based URL)
  const beachUrl = getBeachUrlSafe({
    id: selectedBeach.id,
    slug: selectedBeach.slug,
    city: selectedBeach.city,
    state: selectedBeach.state,
  });

  return (
    <div className="px-4 py-3 bg-background border-t">
      <Card
        className="cursor-pointer hover:shadow-lg transition-shadow border-primary border-2"
        onClick={() => beachUrl && router.push(beachUrl)}
      >
        <CardContent className="p-3">
          <div className="flex items-center gap-3">
            <div className="h-16 w-16 rounded-md bg-primary/10 flex items-center justify-center">
              <MapPin className="h-8 w-8 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-primary">{selectedBeach.name}</h3>
              <div className="flex items-center text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 mr-1" />
                <span>
                  {userLocation && selectedBeach.lat != null && selectedBeach.lon != null
                    ? getDistanceFromUser(
                        selectedBeach.lat,
                        selectedBeach.lon
                      )
                    : getBeachLocation(selectedBeach)}
                </span>
              </div>
              {(selectedBeach.review_count ?? 0) > 0 && (
                <div className="flex items-center mt-1">
                  <StarRating rating={Math.round(selectedBeach.average_rating ?? 0)} size="sm" />
                  <span className="text-sm ml-1 text-muted-foreground">
                    ({selectedBeach.review_count})
                  </span>
                </div>
              )}

              {/* Forecast Preview */}
              <div className="mt-2">
                <ForecastPreview
                  forecastPreview={forecastPreview}
                  loading={loadingForecast}
                  error={forecastError}
                  variant="grid"
                  showConfidenceScore={true}
                />

                {/* Data Source Badge (Transparency) */}
                {forecastPreview && (forecastPreview as any).metadata && (
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    {(forecastPreview as any).metadata.isRealTimeData ? (
                      <div className="flex items-center gap-1 text-green-600">
                        <Activity className="h-3 w-3" />
                        <span className="font-medium">Real-time Data</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-blue-600">
                        <Database className="h-3 w-3" />
                        <span>{(forecastPreview as any).metadata.primarySource}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-muted-foreground">
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
};

/**
 * Custom comparison function for SelectedBeachCard memoization
 * Handles Beach object and location props correctly
 *
 * Note: getDistanceFromUser function prop is NOT compared
 * (expected to be stable via parent's useCallback)
 */
const areSelectedBeachCardPropsEqual = (
  prev: SelectedBeachCardProps,
  next: SelectedBeachCardProps
): boolean => {
  // Compare selectedBeach by ID (most stable identifier)
  if (!prev.selectedBeach && !next.selectedBeach) return true;
  if (!prev.selectedBeach || !next.selectedBeach) return false;

  // Different beach selected
  if (prev.selectedBeach.id !== next.selectedBeach.id) return false;

  // Beach properties that affect display
  if (prev.selectedBeach.name !== next.selectedBeach.name) return false;
  if (prev.selectedBeach.city !== next.selectedBeach.city) return false;
  if (prev.selectedBeach.average_rating !== next.selectedBeach.average_rating) return false;
  if (prev.selectedBeach.review_count !== next.selectedBeach.review_count) return false;

  // User location changed (affects distance calculation)
  if (prev.userLocation && next.userLocation) {
    if (
      prev.userLocation.lat !== next.userLocation.lat ||
      prev.userLocation.lon !== next.userLocation.lon
    ) {
      return false;
    }
  } else if (prev.userLocation !== next.userLocation) {
    // One is defined, the other isn't
    return false;
  }

  // All checks passed
  return true;
};

// Export memoized component for performance optimization
// Uses custom comparison to handle Beach object and location props
export const SelectedBeachCard = memo(
  SelectedBeachCardComponent,
  areSelectedBeachCardPropsEqual
);
SelectedBeachCard.displayName = 'SelectedBeachCard';
