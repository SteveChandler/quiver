#!/usr/bin/env node

/**
 * Complete data update - Updates buoy conditions AND forecasts
 * This ensures you have the most up-to-date surf information
 */

import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

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

async function checkCurrentStatus() {
  console.log("🔍 Checking current data status...\n");

  // Check buoy conditions
  const { data: buoys, error: buoyError } = await supabase
    .from("buoys")
    .select("buoy_uuid, updated_at, wave_height, water_temperature")
    .eq("active", true)
    .not("wave_height", "is", null)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (buoyError || !buoys || buoys.length === 0) {
    console.log("❌ No active buoys with live data found");
  } else {
    const latestBuoy = buoys[0];
    const hoursOld = Math.round(
      (new Date() - new Date(latestBuoy.updated_at)) / (1000 * 60 * 60)
    );
    console.log(`📡 Latest buoy data: ${hoursOld} hours old`);
  }

  // Check forecast status
  const { data: forecasts, error: forecastError } = await supabase
    .from("forecasts")
    .select("updated_at")
    .order("updated_at", { ascending: false })
    .limit(1);

  if (forecastError || !forecasts || forecasts.length === 0) {
    console.log("❌ No forecasts found");
  } else {
    const latestForecast = forecasts[0];
    const hoursOld = Math.round(
      (new Date() - new Date(latestForecast.updated_at)) / (1000 * 60 * 60)
    );
    console.log(`🌊 Latest forecast: ${hoursOld} hours old`);
  }

  console.log("");
}

async function updateBuoyConditions() {
  console.log("🚀 Step 1: Updating buoy conditions...\n");

  try {
    const { stdout, stderr } = await execAsync(
      "npm run buoy:update-conditions",
      {
        cwd: path.join(__dirname, ".."),
      }
    );

    console.log(stdout);
    if (stderr) console.error(stderr);

    console.log("✅ Buoy conditions update completed\n");
    return true;
  } catch (error) {
    console.error("❌ Buoy conditions update failed:", error.message);
    return false;
  }
}

async function updateForecasts() {
  console.log("🚀 Step 2: Updating forecasts with live buoy data...\n");

  try {
    const { stdout, stderr } = await execAsync("npm run forecast:update", {
      cwd: path.join(__dirname, ".."),
    });

    console.log(stdout);
    if (stderr) console.error(stderr);

    console.log("✅ Forecast update completed\n");
    return true;
  } catch (error) {
    console.error("❌ Forecast update failed:", error.message);
    return false;
  }
}

async function showFinalStatus() {
  console.log("📊 Final Status Check...\n");

  // Count updated buoys
  const { data: buoys, error: buoyError } = await supabase
    .from("buoys")
    .select("buoy_uuid")
    .eq("active", true)
    .not("wave_height", "is", null);

  const buoyCount = buoyError ? 0 : buoys?.length || 0;

  // Count forecasts
  const { data: forecasts, error: forecastError } = await supabase
    .from("forecasts")
    .select("id, beach_id")
    .gte("forecast_date", new Date().toISOString().split("T")[0]);

  const forecastCount = forecastError ? 0 : forecasts?.length || 0;
  const beachCount = forecastError
    ? 0
    : [...new Set(forecasts?.map((f) => f.beach_id) || [])].length;

  console.log("🎉 Update Complete!");
  console.log(`📡 Active buoys with live data: ${buoyCount}`);
  console.log(`🏖️  Beaches with current forecasts: ${beachCount}`);
  console.log(`📅 Total current/future forecasts: ${forecastCount}`);
  console.log("\n💡 Your surf forecast system is now up-to-date!");
}

async function updateAllData() {
  console.log("🏄‍♂️ QUIVER SURF DATA UPDATE");
  console.log("=".repeat(50));
  console.log("Updating buoy conditions and forecasts...\n");

  const startTime = Date.now();

  // Check current status
  await checkCurrentStatus();

  // Step 1: Update buoy conditions
  const buoySuccess = await updateBuoyConditions();

  // Step 2: Update forecasts (regardless of buoy success, since forecasts work without buoys too)
  const forecastSuccess = await updateForecasts();

  // Show final status
  await showFinalStatus();

  const duration = Math.round((Date.now() - startTime) / 1000);
  console.log(`\n⏱️  Total update time: ${duration} seconds`);

  if (buoySuccess && forecastSuccess) {
    console.log("\n🎯 Complete success! All data is fresh and ready.");
  } else if (forecastSuccess) {
    console.log(
      "\n⚠️  Forecasts updated successfully, but buoy conditions had issues."
    );
  } else {
    console.log("\n❌ Some updates failed. Check the logs above for details.");
  }
}

// Run the update
updateAllData().catch((error) => {
  console.error("💥 Fatal error:", error);
  process.exit(1);
});
