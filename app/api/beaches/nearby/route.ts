import { NextRequest } from "next/server";
// Import directly from util to avoid pulling a "use server" module here
import { calculateDistanceInMiles } from "@/lib/utils/distance-utils";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createSuccessResponse,
  createValidationError,
  handleApiError,
} from "@/lib/api-utils";
import { withRateLimit } from "@/lib/middleware/rate-limiter";

// Matches Ruby LocationsController functionality
async function nearbyBeachesHandler(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const latitude = parseFloat(searchParams.get("latitude") || "0");
  const longitude = parseFloat(searchParams.get("longitude") || "0");
  const maxDistance = parseFloat(searchParams.get("maxDistance") || "30");
  const limit = parseInt(searchParams.get("limit") || "20"); // matches Ruby default of 20

  if (!latitude || !longitude) {
    return createValidationError("Latitude and longitude are required");
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data: allBeaches, error: fallbackError } = await supabase
      .from("beaches")
      .select("id, name, lat, lon");

    if (fallbackError) throw fallbackError;

    const filtered = (allBeaches || [])
      .map((b: any) => ({
        ...b,
        distance: calculateDistanceInMiles(
          latitude,
          longitude,
          b.lat,
          b.lon
        ),
      }))
      .filter((b: any) => isFinite(b.distance) && b.distance <= maxDistance)
      .sort((a: any, b: any) => a.distance - b.distance)
      .slice(0, limit)
      .map((b: any) => ({
        id: b.id,
        lat: b.lat,
        lon: b.lon,
        name: b.name,
      }));

    return createSuccessResponse(filtered);
  } catch (error) {
    console.error("Error fetching nearby beaches:", error);
    return handleApiError(error, "Error fetching nearby beaches");
  }
}

// Apply rate limiting
export const GET = withRateLimit(nearbyBeachesHandler, "public-default");
