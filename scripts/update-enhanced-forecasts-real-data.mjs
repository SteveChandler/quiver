#!/usr/bin/env node

/**
 * Script to populate enhanced_forecasts table with real NOAA API data
 * Replaces mock data with actual WaveWatch III, CO-OPS, and weather service data
 *
 * Usage: node scripts/update-enhanced-forecasts-real-data.mjs
 *
 * This script:
 * 1. Fetches all beaches from the database
 * 2. Uses EnhancedForecastService to get real NOAA data for each beach
 * 3. Stores the real forecast data in enhanced_forecasts table
 * 4. Validates that data is varying properly across time periods
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname } from "path";

// Load environment variables
dotenv.config({ path: ".env.local" });

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Missing required environment variables:");
  console.error("   - NEXT_PUBLIC_SUPABASE_URL");
  console.error("   - SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Use the existing API endpoint instead of importing TypeScript modules
const apiBaseUrl =
  process.env.NODE_ENV === "production"
    ? process.env.NEXT_PUBLIC_SITE_URL
    : "http://localhost:3000";

/**
 * Fetch all beaches from the database
 */
async function fetchAllBeaches() {
  console.log("📍 Fetching all beaches from database...");

  const { data: beaches, error } = await supabase
    .from("beaches")
    .select("*")
    .order("name");

  if (error) {
    throw new Error(`Failed to fetch beaches: ${error.message}`);
  }

  console.log(`✅ Found ${beaches.length} beaches`);
  return beaches;
}

/**
 * Update enhanced forecasts for a single beach using real NOAA data via API
 */
async function updateBeachEnhancedForecasts(beach) {
  try {
    console.log(`\n🌊 Updating enhanced forecasts for ${beach.name}...`);
    console.log(`   Location: ${beach.latitude}, ${beach.longitude}`);

    // Use the existing API endpoint to update enhanced forecasts
    console.log(
      "📊 Calling API to fetch real NOAA data (WaveWatch III, CO-OPS, Weather Service, NDBC buoys)..."
    );

    const response = await fetch(
      `${apiBaseUrl}/api/forecasts/update-enhanced`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ beachId: beach.id }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed: ${response.status} ${errorText}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || "API returned error");
    }

    // Validate that data is varying across time periods by fetching some data
    await validateForecastVariationFromDB(beach.id);

    console.log(`✅ Successfully updated ${beach.name}`);
    console.log(
      `   Generated forecasts: ${result.data?.forecastsCount || "unknown"}`
    );
    console.log(
      `   Data sources: NOAA WaveWatch III, CO-OPS, Weather Service, NDBC buoys`
    );

    return {
      success: true,
      beach: beach.name,
      forecastsGenerated: result.data?.forecastsCount || 0,
    };
  } catch (error) {
    console.error(`❌ Failed to update ${beach.name}: ${error.message}`);
    return {
      success: false,
      beach: beach.name,
      error: error.message,
    };
  }
}

/**
 * Validate that forecast data is varying properly across time periods
 */
async function validateForecastVariationFromDB(beachId) {
  try {
    // Fetch recent forecasts for this beach to check variation
    const { data: forecasts, error } = await supabase
      .from("enhanced_forecasts")
      .select("wave_height, wave_period, forecast_time, data_source")
      .eq("beach_id", beachId)
      .gte("forecast_date", new Date().toISOString().split("T")[0])
      .order("forecast_date", { ascending: true })
      .order("forecast_time", { ascending: true })
      .limit(10);

    if (error) {
      console.warn(
        `⚠️  Could not validate forecast variation: ${error.message}`
      );
      return;
    }

    if (!forecasts || forecasts.length < 3) {
      console.warn(
        `⚠️  Not enough forecast data to validate variation (${
          forecasts?.length || 0
        } records)`
      );
      return;
    }

    const waveHeights = forecasts
      .filter((f) => f.wave_height)
      .map((f) => f.wave_height);

    const periods = forecasts
      .filter((f) => f.wave_period)
      .map((f) => f.wave_period);

    const dataSources = [...new Set(forecasts.map((f) => f.data_source))];

    // Check if all values are identical (indicating static mock data)
    const allHeightsSame =
      waveHeights.length > 1 && waveHeights.every((h) => h === waveHeights[0]);
    const allPeriodsSame =
      periods.length > 1 && periods.every((p) => p === periods[0]);

    console.log(`📊 Data validation for beach ${beachId}:`);
    console.log(`   Data sources: ${dataSources.join(", ")}`);
    console.log(
      `   Wave height samples: ${waveHeights.slice(0, 3).join(" → ")}...`
    );
    console.log(
      `   Wave period samples: ${periods.slice(0, 3).join(" → ")}...`
    );

    if (allHeightsSame && allPeriodsSame) {
      console.warn(
        `⚠️  Warning: Forecast data appears static (possible mock data)`
      );
    } else {
      console.log(`✅ Forecast data is varying properly across time periods`);
    }
  } catch (error) {
    console.warn(`⚠️  Error validating forecast variation: ${error.message}`);
  }
}

/**
 * Update all beaches with real enhanced forecasts
 */
async function updateAllEnhancedForecasts() {
  try {
    console.log(
      "🚀 Starting enhanced forecasts update with real NOAA data...\n"
    );

    // Fetch all beaches
    const beaches = await fetchAllBeaches();

    if (beaches.length === 0) {
      console.log("ℹ️  No beaches found to update");
      return;
    }

    // Update forecasts for each beach
    console.log(
      `\n📊 Updating enhanced forecasts for ${beaches.length} beaches...\n`
    );

    const results = [];
    for (const beach of beaches) {
      const result = await updateBeachEnhancedForecasts(beach);
      results.push(result);

      // Add a small delay between requests to be nice to NOAA APIs
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // Summary
    const successful = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);

    console.log("\n" + "=".repeat(50));
    console.log("📈 ENHANCED FORECASTS UPDATE SUMMARY");
    console.log("=".repeat(50));
    console.log(
      `✅ Successful: ${successful.length}/${beaches.length} beaches`
    );
    console.log(`❌ Failed: ${failed.length}/${beaches.length} beaches`);

    if (successful.length > 0) {
      const totalForecasts = successful.reduce(
        (sum, r) => sum + r.forecastsGenerated,
        0
      );
      console.log(`📊 Total forecasts generated: ${totalForecasts}`);
      console.log(
        `🌊 Data sources: NOAA WaveWatch III, CO-OPS, Weather Service, NDBC buoys`
      );
    }

    if (failed.length > 0) {
      console.log("\n❌ Failed beaches:");
      failed.forEach((r) => {
        console.log(`   - ${r.beach}: ${r.error}`);
      });
    }

    console.log("\n✅ Enhanced forecasts update completed!");
    console.log(
      "🔍 Check the enhanced_forecasts table to verify varying wave data"
    );
  } catch (error) {
    console.error("❌ Critical error during enhanced forecasts update:", error);
    process.exit(1);
  }
}

/**
 * Verify current enhanced_forecasts data status
 */
async function checkCurrentDataStatus() {
  console.log("🔍 Checking current enhanced_forecasts data status...\n");

  try {
    // Count total records
    const { count: totalCount } = await supabase
      .from("enhanced_forecasts")
      .select("*", { count: "exact", head: true });

    // Count by data source
    const { data: sourceCounts } = await supabase
      .from("enhanced_forecasts")
      .select("data_source")
      .then(({ data }) => {
        const counts = {};
        data?.forEach((row) => {
          const source = row.data_source || "NULL";
          counts[source] = (counts[source] || 0) + 1;
        });
        return { data: counts };
      });

    console.log("📊 Current enhanced_forecasts status:");
    console.log(`   Total records: ${totalCount || 0}`);
    console.log("   By data source:");
    Object.entries(sourceCounts || {}).forEach(([source, count]) => {
      console.log(`     ${source}: ${count}`);
    });

    // Check for recent updates
    const { data: recentData } = await supabase
      .from("enhanced_forecasts")
      .select("updated_at, data_source")
      .order("updated_at", { ascending: false })
      .limit(5);

    if (recentData && recentData.length > 0) {
      console.log("\n📅 Most recent updates:");
      recentData.forEach((row) => {
        const time = new Date(row.updated_at).toLocaleString();
        console.log(`   ${time} (${row.data_source || "NULL"})`);
      });
    }

    console.log("");
  } catch (error) {
    console.error("❌ Error checking data status:", error);
  }
}

// Main execution
async function main() {
  console.log("🌊 Enhanced Forecasts Real Data Update Script");
  console.log("=".repeat(50));

  await checkCurrentDataStatus();
  await updateAllEnhancedForecasts();
}

// Run the script
main().catch((error) => {
  console.error("❌ Script failed:", error);
  process.exit(1);
});
