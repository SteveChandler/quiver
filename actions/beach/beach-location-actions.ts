"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { calculateDistanceInMiles } from "@/lib/utils/distance-utils";
import type { Beach } from "@/types/database";

export async function getNearbyBeaches(
  latitude: number,
  longitude: number,
  radiusMiles = 50
) {
  // Note: return shape is intentionally simple for server + client callers:
  // - success: boolean
  // - data?: Beach[]
  // - error?: string
  // - fallbackUsed?: boolean (true when RPC path fails and we fall back to client-side filtering)
  const supabase = await createSupabaseServerClient();

  try {
    // Convert miles to meters for the PostGIS function (round to integer)
    const radiusMeters = Math.round(radiusMiles * 1609.34);

    // Use the optimized database function instead of client-side filtering
    const { data: nearbyBeaches, error } = await supabase.rpc(
      "get_nearby_beaches",
      {
        input_lat: latitude,
        input_lng: longitude,
        max_distance_meters: radiusMeters,
        limit_count: 50,
      }
    );

    if (error) {
      console.warn(
        "Spatial function failed, falling back to client-side filtering:",
        error
      );

      // Fallback to original method if spatial function fails
      const { data: allBeaches, error: fallbackError } = await supabase
        .from("beaches")
        .select("*");

      if (fallbackError) {
        throw fallbackError;
      }

      if (!allBeaches || allBeaches.length === 0) {
        return { success: true, data: [] };
      }

      // Calculate distances and filter beaches within radius
      const filteredBeaches = allBeaches
        .map((beach: Beach) => {
          // Normalize nullable coordinates to numbers; invalid coordinates become NaN
          const lat2 = beach.lat ?? Number.NaN;
          const lng2 = beach.lon ?? Number.NaN;

          const distance = calculateDistanceInMiles(
            latitude,
            longitude,
            lat2,
            lng2
          );

          return {
            ...beach,
            distance,
          };
        })
        .filter(
          (beach: Beach & { distance: number }) =>
            Number.isFinite(beach.distance) && beach.distance <= radiusMiles
        )
        .sort(
          (a: Beach & { distance: number }, b: Beach & { distance: number }) =>
            a.distance - b.distance
        );

      return {
        success: true,
        data: filteredBeaches as Beach[],
        fallbackUsed: true,
      };
    }

    // Success with spatial function
    return {
      success: true,
      data: nearbyBeaches as Beach[],
      fallbackUsed: false,
    };
  } catch (error) {
    console.error("Error getting nearby beaches:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Do not re-export non-async utility values from a "use server" module; this
// causes Next.js to error in production builds. Import from
// "@/lib/utils/distance-utils" directly where needed.
