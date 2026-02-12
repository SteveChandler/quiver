import { NextResponse } from "next/server";
import { NOAAConditionsSync } from "@/lib/services/noaa-conditions-sync";
import { withBearerAuth } from "@/lib/middleware/api-wrappers";

export const POST = withBearerAuth(async () => {
  const sync = new NOAAConditionsSync();
  const result = await sync.updateAllBuoyConditions();

  if (result.success) {
    return NextResponse.json({
      message: "Buoy conditions updated successfully",
      updated: result.updated,
      failed: result.failed,
      timestamp: new Date().toISOString(),
    });
  } else {
    return NextResponse.json(
      {
        error: "Conditions update failed",
        details: result.error,
      },
      { status: 500 }
    );
  }
}, { errorMessage: "Buoy conditions update error" });

// GET endpoint to check last update status
export const GET = withBearerAuth(async () => {
  return NextResponse.json({
    message: "Use POST to trigger conditions update",
    endpoint: "/api/admin/update-buoy-conditions",
    method: "POST",
    auth: "Bearer token or admin session required",
  });
});
