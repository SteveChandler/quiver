"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Beach } from "@/types/database";

// Helper function to calculate distance between two points using Haversine formula
function calculateDistanceInMiles(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 3958.8; // Earth's radius in miles
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

export async function getNearbyBeaches(
  latitude: number,
  longitude: number,
  radiusMiles = 50
) {
  const supabase = await createSupabaseServerClient();

  try {
    // Convert miles to meters for the PostGIS function (round to integer)
    const radiusMeters = Math.round(radiusMiles * 1609.34);

    // Use the optimized database function instead of client-side filtering
    const { data: nearbyBeaches, error } = await supabase.rpc(
      "get_nearby_beaches",
      {
        lat: latitude,
        lng: longitude,
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
          const distance = calculateDistanceInMiles(
            latitude,
            longitude,
            beach.latitude,
            beach.longitude
          );

          return {
            ...beach,
            distance,
          };
        })
        .filter(
          (beach: Beach & { distance: number }) => beach.distance <= radiusMiles
        )
        .sort(
          (a: Beach & { distance: number }, b: Beach & { distance: number }) =>
            a.distance - b.distance
        );

      return { success: true, data: filteredBeaches as Beach[] };
    }

    // Transform the spatial function results to match Beach interface
    const transformedBeaches = nearbyBeaches.map((beach: any) => ({
      id: beach.id,
      name: beach.name,
      latitude: beach.latitude,
      longitude: beach.longitude,
      location: beach.location,
      distance: beach.distance_meters / 1609.34, // Convert back to miles
      // Add other Beach properties with defaults if needed
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    return { success: true, data: transformedBeaches as Beach[] };
  } catch (error) {
    console.error("Error fetching nearby beaches:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export { calculateDistanceInMiles, toRadians };
