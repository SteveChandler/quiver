import Link from "next/link";
import { MapPin, ChevronRight } from "lucide-react";
import { getBeachUrlSafe } from "@/lib/utils/beach-url-utils";
import { cn } from "@/lib/utils";
import { formatDistanceDisplay } from "@/lib/utils/distance-utils";
import type { Beach } from "@/types/database";

interface NearbyBeach extends Beach {
  distance?: number;
}

interface NearbySpotsServerProps {
  /** Pre-fetched nearby beaches */
  nearbyBeaches: NearbyBeach[];
  /** Optional className for the container */
  className?: string;
}

/**
 * NearbySpots Server Component
 *
 * SSR variant that accepts pre-fetched nearby beaches as props.
 * Renders SEO-friendly links to nearby surf spots.
 * No loading state or client-side fetching - data is passed from parent.
 */
export function NearbySpotsSsr({
  nearbyBeaches,
  className,
}: NearbySpotsServerProps) {
  // Don't render anything if no nearby beaches
  if (!nearbyBeaches || nearbyBeaches.length === 0) {
    return null;
  }

  return (
    <section className={cn("py-6", className)}>
      <h2 className="text-xl font-semibold text-gray-900 mb-4">
        Nearby Surf Spots
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {nearbyBeaches.map((nearbyBeach) => {
          const url = getBeachUrlSafe(nearbyBeach) || `/beach/${nearbyBeach.id}`;
          const location = [nearbyBeach.city, nearbyBeach.state]
            .filter(Boolean)
            .join(", ");

          const distanceText = formatDistanceDisplay(nearbyBeach.distance, "compact");

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
                {distanceText && (
                  <p className="text-xs text-gray-400 mt-1">
                    {distanceText}
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
