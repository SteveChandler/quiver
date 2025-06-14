import { NextRequest, NextResponse } from "next/server";
import { getNearbyBeaches } from "@/actions/beach-actions";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Matches Ruby LocationsController functionality
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const latitude = parseFloat(searchParams.get("latitude") || "0");
  const longitude = parseFloat(searchParams.get("longitude") || "0");
  const maxDistance = parseFloat(searchParams.get("maxDistance") || "30");
  const limit = parseInt(searchParams.get("limit") || "20"); // matches Ruby default of 20

  if (!latitude || !longitude) {
    return NextResponse.json(
      { error: "Latitude and longitude are required" },
      { status: 400 }
    );
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

      return NextResponse.json(locationsJson);
    } else {
      return NextResponse.json(
        { error: result.error || "Failed to fetch nearby beaches" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error fetching nearby beaches:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
