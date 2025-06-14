import {
  updateBeachForecasts,
  updateAllBeachForecasts,
} from "@/actions/forecast-actions";
import { getBeaches } from "@/actions/beach-actions";
import {
  getBeachesToUpdate,
  shouldSkipBeach,
  getBeachStrategy,
} from "@/lib/beach-update-config";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const beachId = searchParams.get("beachId");
  const debug = searchParams.has("debug");
  const useSmartStrategy = searchParams.get("smartStrategy") !== "false"; // Default to true
  const maxUpdates = parseInt(searchParams.get("maxUpdates") || "9");

  try {
    console.log(
      `Forecast update request received: ${
        beachId
          ? `for beach ID ${beachId}`
          : useSmartStrategy
          ? "using smart strategy"
          : "for all beaches"
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
    } else if (useSmartStrategy) {
      // Use smart strategy by default to avoid quota exhaustion
      console.log(
        `🧠 Using smart strategy - updating ${maxUpdates} strategic beaches only`
      );

      // Get all beaches from database
      const beachesResult = await getBeaches();
      if (!beachesResult.success || !beachesResult.data) {
        throw new Error("Failed to fetch beaches from database");
      }

      const allBeaches = beachesResult.data;
      const targetBeachNames = getBeachesToUpdate(maxUpdates);

      console.log("🎯 Strategic beaches to update:", targetBeachNames);

      // Find matching beaches in database
      const beachesToUpdate = [];
      for (const targetName of targetBeachNames) {
        const matchingBeach = allBeaches.find(
          (beach) =>
            beach.name.toLowerCase().includes(targetName.toLowerCase()) ||
            targetName.toLowerCase().includes(beach.name.toLowerCase())
        );

        if (matchingBeach) {
          const strategy = getBeachStrategy(targetName);
          beachesToUpdate.push({
            beach: matchingBeach,
            strategy,
          });
        }
      }

      console.log(
        `✅ Found ${beachesToUpdate.length} strategic beaches to update`
      );

      // Update forecasts for each strategic beach
      const results = [];
      let successCount = 0;
      let errorCount = 0;

      for (const { beach, strategy } of beachesToUpdate) {
        try {
          console.log(`🌊 Updating ${beach.name}...`);
          if (strategy?.provides_fallback_for) {
            console.log(
              `   Provides fallback for: ${strategy.provides_fallback_for.join(
                ", "
              )}`
            );
          }

          const updateResult = await updateBeachForecasts(beach.id);

          if (updateResult.success) {
            console.log(`✅ ${beach.name} updated successfully`);
            successCount++;
          } else {
            console.log(`❌ ${beach.name} failed: ${updateResult.error}`);
            errorCount++;
          }

          results.push({
            beach: beach.name,
            success: updateResult.success,
            error: updateResult.success ? undefined : updateResult.error,
          });
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          console.log(
            `❌ ${beach.name} failed with exception: ${errorMessage}`
          );
          errorCount++;

          results.push({
            beach: beach.name,
            success: false,
            error: errorMessage,
          });
        }
      }

      result = {
        success: true,
        message: `Smart update completed: ${successCount} successful, ${errorCount} failed`,
        summary: {
          beaches_updated: successCount,
          beaches_failed: errorCount,
          api_calls_used: beachesToUpdate.length,
          strategy: "smart",
        },
        results,
      };
    } else {
      // Update forecasts for all beaches (use with caution - can exhaust quota)
      console.log(
        "⚠️  Updating forecasts for ALL beaches - this may exhaust API quota!"
      );
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
