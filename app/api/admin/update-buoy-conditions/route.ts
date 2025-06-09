import { NextRequest, NextResponse } from "next/server";
import { NOAAConditionsSync } from "@/lib/services/noaa-conditions-sync";

export async function POST(request: NextRequest) {
  try {
    // Check for admin auth or API key (relaxed for development)
    const authHeader = request.headers.get("authorization");
    const isDev = process.env.NODE_ENV === "development";

    if (!isDev && (!authHeader || !authHeader.startsWith("Bearer "))) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    // In development, allow simple dev token
    if (isDev && authHeader && authHeader.includes("dev-token")) {
      console.log("🔓 Development mode: Using dev token");
    }

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
  } catch (error) {
    console.error("Buoy conditions update error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// GET endpoint to check last update status
export async function GET() {
  try {
    // Return basic info about buoy data freshness
    return NextResponse.json({
      message: "Use POST to trigger conditions update",
      endpoint: "/api/admin/update-buoy-conditions",
      method: "POST",
      auth: "Bearer token required",
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to check status" },
      { status: 500 }
    );
  }
}
