import { NextRequest, NextResponse } from "next/server";
import { InactiveBuoyCleanup } from "@/lib/services/inactive-buoy-cleanup";

export async function POST(request: NextRequest) {
  try {
    // Simple auth check for development
    const authHeader = request.headers.get("authorization");
    const isDev = process.env.NODE_ENV === "development";

    if (!isDev && (!authHeader || !authHeader.startsWith("Bearer "))) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

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
  } catch (error) {
    console.error("Buoy cleanup error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
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
}
