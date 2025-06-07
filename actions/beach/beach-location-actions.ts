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
    // Get all beaches first
    const { data: allBeaches, error } = await supabase
      .from("beaches")
      .select("*");

    if (error) {
      throw error;
    }

    if (!allBeaches || allBeaches.length === 0) {
      return { success: true, data: [] };
    }

    // Calculate distances and filter beaches within radius
    const nearbyBeaches = allBeaches
      .map((beach: Beach) => {
        // Calculate distance using Haversine formula
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
      ); // Sort by distance

    return { success: true, data: nearbyBeaches as Beach[] };
  } catch (error) {
    console.error("Error fetching nearby beaches:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export { calculateDistanceInMiles, toRadians };
