"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MapPin, ChevronRight, Loader2 } from "lucide-react";
import { getNearbyBeaches } from "@/actions/beach/beach-location-actions";
import { getBeachHrefSafe } from "@/lib/utils/beach-url-utils";
import { cn } from "@/lib/utils";
import { formatDistanceDisplay } from "@/lib/utils/distance-utils";
import type { Beach } from "@/types/database";

interface NearbyBeach extends Beach {
  distance?: number;
}

interface NearbySpotsProps {
  /** Current beach to find nearby spots for */
  beach: Beach;
  /** Maximum number of nearby spots to display */
  maxSpots?: number;
  /** Search radius in miles */
  radiusMiles?: number;
  /** Optional className for the container */
  className?: string;
}

/**
 * NearbySpots Component
 *
 * Displays a list of nearby surf spots with SEO-friendly links.
 * Fetches nearby beaches based on the current beach's coordinates
 * and excludes the current beach from results.
 */
export function NearbySpots({
  beach,
  maxSpots = 6,
  radiusMiles = 25,
  className,
}: NearbySpotsProps) {
  const [nearbyBeaches, setNearbyBeaches] = useState<NearbyBeach[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchNearbyBeaches() {
      // Need coordinates to find nearby beaches
      if (!beach.lat || !beach.lon) {
        setLoading(false);
        return;
      }

      try {
        const result = await getNearbyBeaches(beach.lat, beach.lon, radiusMiles);

        if (!result.success || !result.data) {
          setError(result.error || "Failed to load nearby beaches");
          setLoading(false);
          return;
        }

        // Filter out the current beach and limit results
        const filtered = result.data
          .filter((b) => b.id !== beach.id && b.slug !== beach.slug)
          .slice(0, maxSpots);

        setNearbyBeaches(filtered);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching nearby beaches:", err);
        setError("Failed to load nearby beaches");
        setLoading(false);
      }
    }

    fetchNearbyBeaches();
  }, [beach.id, beach.slug, beach.lat, beach.lon, maxSpots, radiusMiles]);

  // Don't render anything if no coordinates
  if (!beach.lat || !beach.lon) {
    return null;
  }

  // Loading state
  if (loading) {
    return (
      <section className={cn("py-6", className)}>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Closest Surf Spots
        </h2>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      </section>
    );
  }

  // Error state - fail silently for UX
  if (error || nearbyBeaches.length === 0) {
    return null;
  }

  return (
    <section className={cn("py-6", className)}>
      <h2 className="text-xl font-semibold text-gray-900 mb-4">
        Closest Surf Spots
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {nearbyBeaches.map((nearbyBeach) => {
          const url = getBeachHrefSafe(nearbyBeach);
          if (!url) return null;
          const location = [nearbyBeach.city, nearbyBeach.state]
            .filter(Boolean)
            .join(", ");

          return (
            <Link
              key={nearbyBeach.id}
              href={url}
              className="group flex items-start gap-3 p-4 rounded-lg border border-gray-200 bg-white hover:border-sky-300 hover:shadow-md transition-all"
            >
              <MapPin className="h-5 w-5 text-sky-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-gray-900 truncate group-hover:text-sky-700 transition-colors">
                  {nearbyBeach.name}
                </h3>
                {location && (
                  <p className="text-sm text-gray-500 truncate">{location}</p>
                )}
                {formatDistanceDisplay((nearbyBeach as NearbyBeach).distance, "compact") && (
                  <p className="text-xs text-gray-400 mt-1">
                    {formatDistanceDisplay((nearbyBeach as NearbyBeach).distance, "compact")}
                  </p>
                )}
              </div>
              <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0 group-hover:text-sky-600 transition-colors" />
            </Link>
          );
        })}
      </div>
    </section>
  );
}




