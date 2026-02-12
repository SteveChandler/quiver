import { NextRequest, NextResponse } from "next/server";
import { NOAABuoySync } from "@/lib/services/noaa-sync";
import { withBearerAuth } from "@/lib/middleware/api-wrappers";

// Admin endpoint to sync NOAA buoys for existing beaches
export const POST = withBearerAuth(async (request: NextRequest, { user, authMethod }) => {
  if (authMethod === "admin" && user) {
    console.log(`NOAA buoy sync initiated by admin: ${user.email}`);
  } else {
    console.log("NOAA buoy sync initiated via service role (script/automation)");
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
}, { errorMessage: "Internal server error during sync" });

// Get sync status/info (admin only)
export const GET = withBearerAuth(async () => {
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
}, { errorMessage: "Internal server error" });
