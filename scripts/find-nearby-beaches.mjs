#!/usr/bin/env node

/**
 * Find beaches near calibrated beaches (those with tide and wind data)
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

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

async function findNearbyBeaches() {
  console.log("🏖️  Finding beaches near calibrated beaches...\n");

  // Get beaches WITH calibration data (tide + wind)
  const { data: calibratedBeaches, error: calibratedError } = await supabase
    .from("beaches")
    .select(
      "id, name, latitude, longitude, tide_min_ft, tide_max_ft, wind_offshore_deg"
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
    .select("id, name, latitude, longitude, tide_min_ft, wind_offshore_deg")
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
  const nearbyMatches = [];

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

    if (closestBeach && closestDistance < 10) {
      // Within 10 miles
      nearbyMatches.push({
        uncalibrated: uncalibrated.name,
        calibrated: closestBeach.name,
        distance: closestDistance,
        tideRange: `${closestBeach.tide_min_ft}-${closestBeach.tide_max_ft}ft`,
        windOffshore: `${closestBeach.wind_offshore_deg}°`,
      });
    }
  }

  // Sort by distance
  nearbyMatches.sort((a, b) => a.distance - b.distance);

  console.log("=".repeat(100));
  console.log("UNCALIBRATED BEACHES WITH NEARBY CALIBRATED REFERENCE");
  console.log("=".repeat(100));
  console.log();

  nearbyMatches.forEach((match, idx) => {
    console.log(`${idx + 1}. ${match.uncalibrated}`);
    console.log(
      `   📍 Nearest calibrated: ${match.calibrated} (${match.distance.toFixed(
        2
      )} miles away)`
    );
    console.log(`   🌊 Reference tide: ${match.tideRange}`);
    console.log(`   💨 Reference offshore wind: ${match.windOffshore}`);
    console.log();
  });

  console.log("=".repeat(100));
  console.log(
    `Total: ${nearbyMatches.length} uncalibrated beaches within 10 miles of calibrated beaches`
  );
  console.log("=".repeat(100));
  console.log();

  // Group by calibrated beach
  const groupedByCalibrated = {};
  nearbyMatches.forEach((match) => {
    if (!groupedByCalibrated[match.calibrated]) {
      groupedByCalibrated[match.calibrated] = [];
    }
    groupedByCalibrated[match.calibrated].push(match.uncalibrated);
  });

  console.log("=".repeat(100));
  console.log("CALIBRATED BEACHES WITH NEARBY UNCALIBRATED NEIGHBORS");
  console.log("=".repeat(100));
  console.log();

  Object.entries(groupedByCalibrated)
    .sort((a, b) => b[1].length - a[1].length)
    .forEach(([calibrated, uncalibrated]) => {
      console.log(`📍 ${calibrated} (${uncalibrated.length} nearby beaches)`);
      uncalibrated.forEach((beach) => {
        console.log(`   - ${beach}`);
      });
      console.log();
    });

  console.log("=".repeat(100));
  console.log(
    "RECOMMENDATION: Use nearby calibrated beach preferences as starting point"
  );
  console.log("=".repeat(100));
}

findNearbyBeaches()
  .then(() => {
    console.log("\n✅ Analysis complete");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
