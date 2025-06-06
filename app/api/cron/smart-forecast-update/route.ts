import { NextResponse } from "next/server";
import { updateBeachForecasts } from "@/actions/forecast-actions";
import { getBeaches } from "@/actions/beach-actions";
import {
  getBeachesToUpdate,
  shouldSkipBeach,
  getBeachStrategy,
  BEACHES_TO_UPDATE,
} from "@/lib/beach-update-config";

/**
 * Smart Forecast Update Endpoint
 *
 * Updates only strategic "hub" beaches that provide maximum coverage
 * while minimizing API calls. Designed for 9 AM daily updates.
 *
 * DEVELOPMENT: Called manually or via local cron
 * PRODUCTION: Should be called via GitHub Actions cron job
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  const debug = searchParams.has("debug");
  const maxUpdates = parseInt(searchParams.get("maxUpdates") || "9");

  // Security check (same as existing cron endpoint)
  const secretToken = process.env.CRON_SECRET_TOKEN;
  if (token !== secretToken) {
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 401 }
    );
  }

  const startTime = Date.now();

  try {
    console.log("🏄‍♂️ Starting smart forecast update...");
    console.log(`📊 Target: Update ${maxUpdates} strategic beaches`);

    // Check API key
    if (!process.env.STORMGLASS_API_KEY) {
      console.error("❌ STORMGLASS_API_KEY not found");
      return NextResponse.json(
        {
          success: false,
          error: "API key not configured",
          debug: debug
            ? { env_vars_available: Object.keys(process.env).length }
            : undefined,
        },
        { status: 500 }
      );
    }

    // Get all beaches from database
    const beachesResult = await getBeaches();
    if (!beachesResult.success || !beachesResult.data) {
      throw new Error("Failed to fetch beaches from database");
    }

    const allBeaches = beachesResult.data;
    console.log(`📍 Found ${allBeaches.length} beaches in database`);

    // Get strategic beaches to update
    const targetBeachNames = getBeachesToUpdate(maxUpdates);
    console.log("🎯 Strategic beaches to update:", targetBeachNames);

    // Find matching beaches in database
    const beachesToUpdate = [];
    const notFound = [];

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
      } else {
        notFound.push(targetName);
      }
    }

    console.log(`✅ Found ${beachesToUpdate.length} beaches to update`);
    if (notFound.length > 0) {
      console.log("⚠️  Could not find these beaches:", notFound);
    }

    // Update forecasts for each strategic beach
    const results = [];
    let successCount = 0;
    let errorCount = 0;

    for (const { beach, strategy } of beachesToUpdate) {
      try {
        console.log(`🌊 Updating ${beach.name}...`);
        if (strategy) {
          console.log(`   Reason: ${strategy.reason}`);
          if (strategy.provides_fallback_for) {
            console.log(
              `   Provides fallback for: ${strategy.provides_fallback_for.join(
                ", "
              )}`
            );
          }
        }

        const result = await updateBeachForecasts(beach.id);

        if (result.success) {
          console.log(`✅ ${beach.name} updated successfully`);
          successCount++;
        } else {
          console.log(`❌ ${beach.name} failed: ${result.error}`);
          errorCount++;
        }

        results.push({
          beach: beach.name,
          id: beach.id,
          success: result.success,
          error: result.success ? undefined : result.error,
          strategy: strategy?.reason,
          provides_fallback_for: strategy?.provides_fallback_for,
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        console.log(`❌ ${beach.name} failed with exception: ${errorMessage}`);
        errorCount++;

        results.push({
          beach: beach.name,
          id: beach.id,
          success: false,
          error: errorMessage,
          strategy: strategy?.reason,
        });
      }
    }

    const duration = Math.round((Date.now() - startTime) / 1000);

    console.log("📈 Smart forecast update completed:");
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ❌ Failed: ${errorCount}`);
    console.log(`   ⏱️  Duration: ${duration}s`);
    console.log(
      `   💰 API calls used: ${beachesToUpdate.length}/${maxUpdates}`
    );

    // Calculate coverage
    const totalCoverageBeaches = BEACHES_TO_UPDATE.reduce((total, strategy) => {
      return total + 1 + (strategy.provides_fallback_for?.length || 0);
    }, 0);

    return NextResponse.json({
      success: true,
      message: "Smart forecast update completed",
      summary: {
        beaches_updated: successCount,
        beaches_failed: errorCount,
        api_calls_used: beachesToUpdate.length,
        api_calls_available: maxUpdates,
        duration_seconds: duration,
        estimated_coverage: `${totalCoverageBeaches} beaches`,
        timestamp: new Date().toISOString(),
      },
      results,
      strategy_info: debug
        ? {
            target_beaches: targetBeachNames,
            not_found: notFound,
            skip_list_size: "check BEACHES_TO_SKIP in config",
            total_beaches_in_db: allBeaches.length,
          }
        : undefined,
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    const duration = Math.round((Date.now() - startTime) / 1000);

    console.error("💥 Smart forecast update failed:", errorMessage);

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        duration_seconds: duration,
        timestamp: new Date().toISOString(),
        debug: debug
          ? { stack: error instanceof Error ? error.stack : undefined }
          : undefined,
      },
      { status: 500 }
    );
  }
}

// Force dynamic to ensure fresh data
export const dynamic = "force-dynamic";

/*
 * PRODUCTION DEPLOYMENT NOTES:
 *
 * When going live, replace local cron with GitHub Actions:
 *
 * 1. Create .github/workflows/forecast-update.yml:
 *
 * name: Update Surf Forecasts
 * on:
 *   schedule:
 *     - cron: '0 16 * * *'  # 9 AM PST = 4 PM UTC (winter) / 5 PM UTC (summer)
 * jobs:
 *   update-forecasts:
 *     runs-on: ubuntu-latest
 *     steps:
 *       - name: Call forecast update endpoint
 *         run: |
 *           curl -X GET "${{ secrets.APP_URL }}/api/cron/smart-forecast-update?token=${{ secrets.CRON_SECRET_TOKEN }}"
 *
 * 2. Add these GitHub Secrets:
 *    - APP_URL: https://yourdomain.com
 *    - CRON_SECRET_TOKEN: (same as in your .env)
 *
 * 3. Benefits of GitHub Actions:
 *    - Free for public repos
 *    - Reliable scheduling
 *    - No server dependencies
 *    - Runs even when your app is sleeping (Vercel/Netlify)
 */
