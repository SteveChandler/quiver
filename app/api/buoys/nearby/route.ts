import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Matches Ruby BuoysController functionality
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const latitude = parseFloat(searchParams.get("latitude") || "0");
  const longitude = parseFloat(searchParams.get("longitude") || "0");
  const limit = parseInt(searchParams.get("limit") || "4");
  const maxDistance = parseInt(searchParams.get("maxDistance") || "100000"); // meters, matches Ruby 100_000

  if (!latitude || !longitude) {
    return NextResponse.json(
      { error: "Latitude and longitude are required" },
      { status: 400 }
    );
  }

  try {
    const supabase = await createSupabaseServerClient();

    // TODO: Add admin authentication check
    // const { data: { session } } = await supabase.auth.getSession();
    // if (!session || !isAdmin(session.user)) {
    //   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    // }

    // Query active buoys within distance limit
    // Note: This assumes you have a 'buoys' table with PostGIS support
    // You'll need to adapt this query based on your actual database schema
    const { data: buoys, error } = await supabase.rpc("get_nearby_buoys", {
      lat: latitude,
      lng: longitude,
      max_distance_meters: maxDistance,
      limit_count: limit,
    });

    if (error) {
      console.error("Database error:", error);
      return NextResponse.json(
        { error: "Failed to fetch buoys" },
        { status: 500 }
      );
    }

    // Transform to match Ruby controller JSON format
    const buoysJson = (buoys || []).map((buoy: any) => ({
      id: buoy.buoy_uuid,
      latitude: buoy.latitude,
      longitude: buoy.longitude,
      name: buoy.buoy_name,
      measurements: buoy.conditions || {},
    }));

    return NextResponse.json(buoysJson);
  } catch (error) {
    console.error("Error fetching nearby buoys:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
