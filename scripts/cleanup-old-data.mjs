#!/usr/bin/env node

/**
 * Cleanup old data - Remove forecasts and other data older than specified days (default: 7)
 * Usage: node scripts/cleanup-old-data.mjs [days]
 * Example: node scripts/cleanup-old-data.mjs 14  (cleanup data older than 14 days)
 */

import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.join(__dirname, "../.env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Missing Supabase environment variables");
  console.error("Required:");
  console.error("- NEXT_PUBLIC_SUPABASE_URL");
  console.error("- SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Get days to keep from command line argument or default to 7
const DAYS_TO_KEEP = parseInt(process.argv[2]) || 7;

if (DAYS_TO_KEEP < 1) {
  console.error("❌ Days must be a positive number");
  process.exit(1);
}

async function checkSafetyWarning() {
  if (DAYS_TO_KEEP < 3) {
    console.log(
      "⚠️  WARNING: You're about to delete data less than 3 days old!"
    );
    console.log("   This might remove current/useful data.");
    console.log("   Press Ctrl+C to cancel, or wait 5 seconds to continue...");
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
}

// Calculate cutoff date
const cutoffDate = new Date();
cutoffDate.setDate(cutoffDate.getDate() - DAYS_TO_KEEP);
const cutoffDateString = cutoffDate.toISOString().split("T")[0]; // YYYY-MM-DD format
const cutoffTimestamp = cutoffDate.toISOString(); // Full timestamp

console.log(`🧹 QUIVER DATA CLEANUP`);
console.log("=".repeat(50));
console.log(
  `Removing data older than ${DAYS_TO_KEEP} days (before ${cutoffDateString})\n`
);

async function cleanupForecasts() {
  console.log("🔍 Cleaning up old forecasts...");

  try {
    // First, count what we're about to delete
    const { data: oldForecasts, error: countError } = await supabase
      .from("forecasts")
      .select("id, beach_id, forecast_date")
      .lt("forecast_date", cutoffDateString);

    if (countError) {
      throw countError;
    }

    const oldCount = oldForecasts?.length || 0;

    if (oldCount === 0) {
      console.log("   ✅ No old forecasts to clean up");
      return { deleted: 0 };
    }

    // Show breakdown by beach
    const beachBreakdown = oldForecasts.reduce((acc, forecast) => {
      acc[forecast.beach_id] = (acc[forecast.beach_id] || 0) + 1;
      return acc;
    }, {});

    console.log(
      `   📊 Found ${oldCount} old forecasts across ${
        Object.keys(beachBreakdown).length
      } beaches`
    );

    // Delete old forecasts
    const { error: deleteError } = await supabase
      .from("forecasts")
      .delete()
      .lt("forecast_date", cutoffDateString);

    if (deleteError) {
      throw deleteError;
    }

    console.log(`   ✅ Deleted ${oldCount} old forecasts`);
    return { deleted: oldCount };
  } catch (error) {
    console.error("   ❌ Error cleaning up forecasts:", error.message);
    return { deleted: 0, error: error.message };
  }
}

async function cleanupBuoyHistory() {
  console.log("🔍 Cleaning up old buoy data snapshots...");

  try {
    // Note: We keep the current buoy conditions but clean up any historical snapshots
    // For now, we'll just report on buoy data age since buoys store current conditions

    const { data: buoys, error } = await supabase
      .from("buoys")
      .select("buoy_uuid, updated_at")
      .lt("updated_at", cutoffTimestamp);

    if (error) {
      throw error;
    }

    const oldBuoyCount = buoys?.length || 0;

    if (oldBuoyCount === 0) {
      console.log("   ✅ No stale buoy data found");
      return { checked: 0, old: 0 };
    }

    console.log(
      `   ⚠️  Found ${oldBuoyCount} buoys with data older than ${DAYS_TO_KEEP} days`
    );
    console.log(
      "   💡 These might be inactive buoys - consider running: npm run buoy:cleanup-inactive"
    );

    return { checked: oldBuoyCount, old: oldBuoyCount };
  } catch (error) {
    console.error("   ❌ Error checking buoy data:", error.message);
    return { checked: 0, old: 0, error: error.message };
  }
}

async function cleanupSessions() {
  console.log("🔍 Cleaning up old session logs...");

  try {
    // Check if we have a sessions table with old data
    const { data: oldSessions, error: countError } = await supabase
      .from("sessions")
      .select("id, created_at")
      .lt("created_at", cutoffTimestamp);

    if (countError) {
      // Sessions table might not exist or might have different structure
      if (countError.code === "42P01") {
        // Table doesn't exist
        console.log("   ✅ No sessions table found");
        return { deleted: 0 };
      }
      throw countError;
    }

    const oldCount = oldSessions?.length || 0;

    if (oldCount === 0) {
      console.log("   ✅ No old sessions to clean up");
      return { deleted: 0 };
    }

    // Delete old sessions
    const { error: deleteError } = await supabase
      .from("sessions")
      .delete()
      .lt("created_at", cutoffTimestamp);

    if (deleteError) {
      throw deleteError;
    }

    console.log(`   ✅ Deleted ${oldCount} old sessions`);
    return { deleted: oldCount };
  } catch (error) {
    if (error.code === "42P01") {
      console.log("   ✅ No sessions table found");
      return { deleted: 0 };
    }
    console.error("   ❌ Error cleaning up sessions:", error.message);
    return { deleted: 0, error: error.message };
  }
}

async function getCurrentDataStats() {
  console.log("📊 Current data statistics...");

  try {
    // Count current forecasts
    const { data: currentForecasts, error: forecastError } = await supabase
      .from("forecasts")
      .select("id, beach_id")
      .gte("forecast_date", new Date().toISOString().split("T")[0]);

    const forecastCount = forecastError ? 0 : currentForecasts?.length || 0;
    const beachCount = forecastError
      ? 0
      : [...new Set(currentForecasts?.map((f) => f.beach_id) || [])].length;

    // Count active buoys
    const { data: activeBuoys, error: buoyError } = await supabase
      .from("buoys")
      .select("buoy_uuid")
      .eq("active", true);

    const buoyCount = buoyError ? 0 : activeBuoys?.length || 0;

    // Count buoys with recent data
    const { data: recentBuoys, error: recentError } = await supabase
      .from("buoys")
      .select("buoy_uuid")
      .eq("active", true)
      .gte("updated_at", cutoffTimestamp);

    const recentBuoyCount = recentError ? 0 : recentBuoys?.length || 0;

    console.log(`   📅 Current/future forecasts: ${forecastCount}`);
    console.log(`   🏖️  Beaches with forecasts: ${beachCount}`);
    console.log(`   📡 Active buoys: ${buoyCount}`);
    console.log(
      `   🔄 Buoys updated in last ${DAYS_TO_KEEP} days: ${recentBuoyCount}`
    );
  } catch (error) {
    console.error("   ❌ Error getting current stats:", error.message);
  }
}

async function performCleanup() {
  // Check safety warning first
  await checkSafetyWarning();

  const startTime = Date.now();

  // Run all cleanup operations
  const forecastResults = await cleanupForecasts();
  console.log("");

  const buoyResults = await cleanupBuoyHistory();
  console.log("");

  const sessionResults = await cleanupSessions();
  console.log("");

  // Show current stats
  await getCurrentDataStats();

  const duration = Math.round((Date.now() - startTime) / 1000);

  console.log("\n" + "=".repeat(50));
  console.log("🎉 CLEANUP SUMMARY");
  console.log("=".repeat(50));
  console.log(`⏱️  Duration: ${duration} seconds`);
  console.log(`📅 Cutoff date: ${cutoffDateString} (${DAYS_TO_KEEP} days ago)`);
  console.log(`🗑️  Forecasts deleted: ${forecastResults.deleted}`);
  console.log(`📡 Old buoys found: ${buoyResults.old || 0}`);
  console.log(`👤 Sessions deleted: ${sessionResults.deleted || 0}`);

  const totalDeleted = forecastResults.deleted + (sessionResults.deleted || 0);

  if (totalDeleted > 0) {
    console.log(`\n✅ Successfully cleaned up ${totalDeleted} old records`);
  } else {
    console.log("\n✅ Database is already clean - no old data found");
  }

  if (buoyResults.old > 0) {
    console.log(
      "\n💡 TIP: Run 'npm run buoy:cleanup-inactive' to remove inactive buoys"
    );
  }

  console.log("\n🚀 USAGE:");
  console.log("   npm run cleanup:old        # Clean data older than 7 days");
  console.log("   npm run cleanup:old 14     # Clean data older than 14 days");
  console.log("   npm run cleanup:old 30     # Clean data older than 30 days");
}

// Run the cleanup
performCleanup().catch((error) => {
  console.error("💥 Fatal error during cleanup:", error);
  process.exit(1);
});
