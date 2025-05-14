import {
  updateBeachForecasts,
  updateAllBeachForecasts,
} from "@/actions/forecast-actions";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const beachId = searchParams.get("beachId");
  const debug = searchParams.has("debug");

  try {
    console.log(
      `Forecast update request received: ${
        beachId ? `for beach ID ${beachId}` : "for all beaches"
      }`
    );

    // Check if API key is available in environment
    if (!process.env.STORMGLASS_API_KEY) {
      console.error("STORMGLASS_API_KEY not found in environment variables");
      return NextResponse.json(
        {
          success: false,
          error:
            "API key not configured. Please add STORMGLASS_API_KEY to environment variables.",
          debug: debug
            ? {
                availableEnvVars: Object.keys(process.env).filter(
                  (key) =>
                    !key.toLowerCase().includes("secret") &&
                    !key.toLowerCase().includes("password") &&
                    !key.toLowerCase().includes("token")
                ),
              }
            : undefined,
        },
        { status: 500 }
      );
    }

    let result;
    if (beachId) {
      // Update forecasts for a specific beach
      console.log(`Updating forecasts for beach ID: ${beachId}`);
      result = await updateBeachForecasts(beachId);
    } else {
      // Update forecasts for all beaches
      console.log("Updating forecasts for all beaches");
      result = await updateAllBeachForecasts();
    }

    if (!result.success) {
      console.error("Forecast update failed:", result.error);
      return NextResponse.json(
        {
          success: false,
          error: result.error || "Unknown error during forecast update",
          details: debug ? result : undefined,
        },
        { status: 500 }
      );
    }

    console.log("Forecast update completed successfully");
    return NextResponse.json(result);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    const stack = error instanceof Error ? error.stack : undefined;

    console.error("Error updating forecasts:", errorMessage);
    if (stack) console.error(stack);

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        details: debug ? { stack } : undefined,
      },
      { status: 500 }
    );
  }
}

// Force-dynamic route to ensure we get fresh data
export const dynamic = "force-dynamic";
