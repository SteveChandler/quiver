import { NextRequest, NextResponse } from "next/server";
import { NOAABuoySync } from "@/lib/services/noaa-sync";
import { authenticateAdmin } from "@/lib/auth/admin";

// Admin endpoint to sync NOAA buoys for existing beaches
export async function POST(request: NextRequest) {
  try {
    // Check for service role authentication (for scripts) or admin authentication
    const authHeader = request.headers.get("authorization");
    const isServiceRole =
      authHeader?.startsWith("Bearer ") &&
      authHeader.includes(process.env.SUPABASE_SERVICE_ROLE_KEY || "");

    if (!isServiceRole) {
      // Regular admin authentication for web users
      const authResult = await authenticateAdmin();
      if (!authResult.success) {
        return NextResponse.json(
          { error: authResult.error },
          { status: authResult.status }
        );
      }
      console.log(
        `NOAA buoy sync initiated by admin: ${authResult.user.email}`
      );
    } else {
      console.log(
        "NOAA buoy sync initiated via service role (script/automation)"
      );
    }

    // Get sync parameters from request body
    const body = await request.json().catch(() => ({}));
    const maxDistanceKm = body.maxDistanceKm || 200; // Default 200km radius

    // Initialize sync service and run
    const syncService = new NOAABuoySync();
    const result = await syncService.syncBuoysForExistingBeaches(maxDistanceKm);

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `Successfully synced NOAA data`,
        data: {
          buoysAdded: result.buoysAdded,
          stationsAdded: result.stationsAdded,
          maxDistanceKm,
        },
      });
    } else {
      return NextResponse.json(
        {
          error: result.error || "Sync failed",
          data: {
            buoysAdded: result.buoysAdded,
            stationsAdded: result.stationsAdded,
          },
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("NOAA sync API error:", error);
    return NextResponse.json(
      { error: "Internal server error during sync" },
      { status: 500 }
    );
  }
}

// Get sync status/info (admin only)
export async function GET(request: NextRequest) {
  try {
    // Check for service role authentication (for scripts) or admin authentication
    const authHeader = request.headers.get("authorization");
    const isServiceRole =
      authHeader?.startsWith("Bearer ") &&
      authHeader.includes(process.env.SUPABASE_SERVICE_ROLE_KEY || "");

    if (!isServiceRole) {
      // Regular admin authentication for web users
      const authResult = await authenticateAdmin();
      if (!authResult.success) {
        return NextResponse.json(
          { error: authResult.error },
          { status: authResult.status }
        );
      }
    }

    // For now, just return basic info - could extend to show sync history
    return NextResponse.json({
      endpoint: "/api/admin/sync-buoys",
      description: "Sync NOAA buoys for areas near existing beaches",
      method: "POST",
      parameters: {
        maxDistanceKm:
          "Maximum distance from beaches to include buoys (default: 200km)",
      },
      note: "This endpoint filters NOAA stations to only include those relevant to your existing beach locations",
    });
  } catch (error) {
    console.error("Sync info API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
