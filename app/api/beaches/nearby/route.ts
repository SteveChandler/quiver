import { NextRequest, NextResponse } from "next/server";
import { getNearbyBeaches } from "@/actions/beach-actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createSuccessResponse,
  createValidationError,
  handleApiError,
} from "@/lib/api-utils";

// Matches Ruby LocationsController functionality
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const latitude = parseFloat(searchParams.get("latitude") || "0");
  const longitude = parseFloat(searchParams.get("longitude") || "0");
  const maxDistance = parseFloat(searchParams.get("maxDistance") || "30");
  const limit = parseInt(searchParams.get("limit") || "20"); // matches Ruby default of 20

  if (!latitude || !longitude) {
    return createValidationError("Latitude and longitude are required");
  }

  try {
    // TODO: Add admin authentication check like Ruby controller
    // const supabase = await createSupabaseServerClient();
    // const { data: { session } } = await supabase.auth.getSession();
    // if (!session || !isAdmin(session.user)) {
    //   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    // }

    const result = await getNearbyBeaches(latitude, longitude, maxDistance);

    if (result.success && result.data) {
      // Transform to match Ruby controller JSON format: { id, latitude, longitude, name }
      const locationsJson = result.data.slice(0, limit).map((beach) => ({
        id: beach.id,
        latitude: beach.latitude,
        longitude: beach.longitude,
        name: beach.name,
      }));

      return createSuccessResponse(locationsJson);
    } else {
      return handleApiError(
        new Error(result.error || "Failed to fetch nearby beaches")
      );
    }
  } catch (error) {
    console.error("Error fetching nearby beaches:", error);
    return handleApiError(error, "Error fetching nearby beaches");
  }
}
