import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Matches Ruby BuoysController#conditions functionality
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const latitude = parseFloat(searchParams.get("latitude") || "0");
  const longitude = parseFloat(searchParams.get("longitude") || "0");
  const limit = parseInt(searchParams.get("limit") || "50"); // matches Ruby default of 50

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

    // Consolidate buoy data - find the best/nearest active buoy with conditions
    // This corresponds to Ruby's Buoy.active.consolidate(point, limit: 50)
    const { data: buoy, error } = await supabase.rpc(
      "consolidate_buoy_conditions",
      {
        lat: latitude,
        lng: longitude,
        limit_count: limit,
      }
    );

    if (error) {
      console.error("Database error:", error);
      return NextResponse.json(
        { error: "Failed to fetch buoy conditions" },
        { status: 500 }
      );
    }

    if (!buoy) {
      return NextResponse.json(
        { error: "No active buoy found for location" },
        { status: 404 }
      );
    }

    // Transform to match Ruby controller JSON format
    const buoyJson = {
      id: buoy.buoy_uuid,
      latitude: buoy.latitude,
      longitude: buoy.longitude,
      name: buoy.buoy_name,
      measurements: buoy.conditions || {},
    };

    return NextResponse.json(buoyJson);
  } catch (error) {
    console.error("Error fetching buoy conditions:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
