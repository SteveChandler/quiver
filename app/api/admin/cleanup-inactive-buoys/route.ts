import { NextRequest, NextResponse } from "next/server";
import { InactiveBuoyCleanup } from "@/lib/services/inactive-buoy-cleanup";
import { withBearerAuth } from "@/lib/middleware/api-wrappers";

export const POST = withBearerAuth(async (request: NextRequest) => {
  // Parse request options
  const body = await request.json();
  const { dryRun = false, remove = false } = body;

  console.log(
    `🧹 Inactive buoy cleanup requested - Mode: ${
      dryRun ? "DRY RUN" : remove ? "REMOVE" : "DEACTIVATE"
    }`
  );

  const cleanup = new InactiveBuoyCleanup();
  const result = await cleanup.cleanupInactiveBuoys({
    remove,
    dryRun,
  });

  if (result.success) {
    return NextResponse.json({
      success: true,
      tested: result.tested,
      deactivated: result.deactivated,
      removed: result.removed,
      inactive_buoys: result.inactive_buoys,
      message: dryRun
        ? `Found ${result.inactive_buoys.length} inactive buoys`
        : remove
        ? `Removed ${result.removed} inactive buoys`
        : `Deactivated ${result.deactivated} inactive buoys`,
      timestamp: new Date().toISOString(),
    });
  } else {
    return NextResponse.json(
      {
        error: "Cleanup failed",
        details: result.error,
      },
      { status: 500 }
    );
  }
}, { errorMessage: "Buoy cleanup error" });

export const GET = withBearerAuth(async () => {
  return NextResponse.json({
    message: "Use POST to trigger inactive buoy cleanup",
    endpoint: "/api/admin/cleanup-inactive-buoys",
    method: "POST",
    body: {
      dryRun: "boolean (optional) - if true, only identify without removing",
      remove:
        "boolean (optional) - if true, remove completely; if false, deactivate",
    },
  });
});
