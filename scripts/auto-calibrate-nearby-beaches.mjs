#!/usr/bin/env node

/**
 * Auto-calibrate beaches by copying preferences from nearby calibrated beaches
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import * as readline from "readline";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: resolve(__dirname, "../.env") });
dotenv.config({ path: resolve(__dirname, "../.env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Calculate distance between two lat/lng points in miles
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 3959; // Earth's radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Prompt user for confirmation
 */
function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) =>
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans);
    })
  );
}

async function autoCalibrateBeaches() {
  console.log("🏖️  Auto-calibrating beaches from nearby references...\n");

  // Get beaches WITH calibration data (tide + wind)
  const { data: calibratedBeaches, error: calibratedError } = await supabase
    .from("beaches")
    .select(
      "id, name, latitude, longitude, tide_min_ft, tide_max_ft, wind_offshore_deg, wind_offshore_tol_deg, break_type, shoreline_aspect_deg"
    )
    .not("tide_min_ft", "is", null)
    .not("wind_offshore_deg", "is", null)
    .order("name");

  if (calibratedError) {
    console.error("❌ Error querying calibrated beaches:", calibratedError);
    return;
  }

  // Get beaches WITHOUT calibration data
  const { data: uncalibratedBeaches, error: uncalibratedError } = await supabase
    .from("beaches")
    .select(
      "id, name, latitude, longitude, tide_min_ft, wind_offshore_deg, break_type, shoreline_aspect_deg"
    )
    .or("tide_min_ft.is.null,wind_offshore_deg.is.null")
    .order("name");

  if (uncalibratedError) {
    console.error("❌ Error querying uncalibrated beaches:", uncalibratedError);
    return;
  }

  console.log(
    `📊 ${calibratedBeaches.length} calibrated beaches (have tide + wind)`
  );
  console.log(
    `📊 ${uncalibratedBeaches.length} uncalibrated beaches (missing data)`
  );
  console.log();

  // Find nearby beaches for each uncalibrated beach
  const updates = [];

  for (const uncalibrated of uncalibratedBeaches) {
    if (!uncalibrated.latitude || !uncalibrated.longitude) continue;

    // Find closest calibrated beach
    let closestBeach = null;
    let closestDistance = Infinity;

    for (const calibrated of calibratedBeaches) {
      if (!calibrated.latitude || !calibrated.longitude) continue;

      const distance = calculateDistance(
        uncalibrated.latitude,
        uncalibrated.longitude,
        calibrated.latitude,
        calibrated.longitude
      );

      if (distance < closestDistance) {
        closestDistance = distance;
        closestBeach = calibrated;
      }
    }

    // Only auto-calibrate if within 10 miles
    if (closestBeach && closestDistance < 10) {
      updates.push({
        id: uncalibrated.id,
        name: uncalibrated.name,
        distance: closestDistance,
        reference: closestBeach.name,
        updates: {
          tide_min_ft: closestBeach.tide_min_ft,
          tide_max_ft: closestBeach.tide_max_ft,
          wind_offshore_deg: closestBeach.wind_offshore_deg,
          wind_offshore_tol_deg: closestBeach.wind_offshore_tol_deg || 30,
        },
      });
    }
  }

  if (updates.length === 0) {
    console.log("✅ No beaches to auto-calibrate (all done or too far away)");
    return;
  }

  // Display preview
  console.log("=".repeat(100));
  console.log(
    `📋 PREVIEW: ${updates.length} beaches ready for auto-calibration`
  );
  console.log("=".repeat(100));
  console.log();

  updates.forEach((update, idx) => {
    console.log(`${idx + 1}. ${update.name}`);
    console.log(
      `   📍 Reference: ${update.reference} (${update.distance.toFixed(
        2
      )} miles away)`
    );
    console.log(
      `   🌊 Will set tide: ${update.updates.tide_min_ft}-${update.updates.tide_max_ft}ft`
    );
    console.log(
      `   💨 Will set offshore wind: ${update.updates.wind_offshore_deg}° (±${update.updates.wind_offshore_tol_deg}°)`
    );
    console.log();
  });

  console.log("=".repeat(100));
  console.log();

  // Ask for confirmation
  const answer = await askQuestion(
    "❓ Do you want to proceed with these updates? (yes/no): "
  );

  if (answer.toLowerCase() !== "yes" && answer.toLowerCase() !== "y") {
    console.log("\n❌ Cancelled. No changes made.");
    return;
  }

  console.log("\n🚀 Starting auto-calibration...\n");

  // Perform updates
  let successCount = 0;
  let errorCount = 0;

  for (const update of updates) {
    const { error } = await supabase
      .from("beaches")
      .update(update.updates)
      .eq("id", update.id);

    if (error) {
      console.error(`❌ Failed to update ${update.name}:`, error.message);
      errorCount++;
    } else {
      console.log(
        `✅ Updated ${update.name} (from ${
          update.reference
        }, ${update.distance.toFixed(2)}mi away)`
      );
      successCount++;
    }
  }

  console.log();
  console.log("=".repeat(100));
  console.log("SUMMARY");
  console.log("=".repeat(100));
  console.log(`✅ Successfully updated: ${successCount} beaches`);
  console.log(`❌ Failed: ${errorCount} beaches`);
  console.log(
    `📊 Total calibrated beaches: ${calibratedBeaches.length} → ${
      calibratedBeaches.length + successCount
    }`
  );
  console.log("=".repeat(100));

  // Show which beaches still need manual calibration
  const remainingUncalibrated = uncalibratedBeaches.length - updates.length;
  if (remainingUncalibrated > 0) {
    console.log();
    console.log("📝 Next steps:");
    console.log(
      `   - ${remainingUncalibrated} beaches still need manual calibration`
    );
    console.log("   - These are too far from any calibrated beach (>10 miles)");
    console.log(
      '   - Run "node scripts/list-uncalibrated-beaches.mjs" to see them'
    );
  }
}

autoCalibrateBeaches()
  .then(() => {
    console.log("\n✅ Auto-calibration complete");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
