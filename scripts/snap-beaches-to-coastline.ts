#!/usr/bin/env tsx

/**
 * Beach Coordinate Coastline Snapping Script
 *
 * This script fetches all beach coordinates from the Supabase database and uses
 * Mapbox Geocoding API to verify coordinate accuracy. It generates a SQL migration
 * file for beaches that need coordinate corrections.
 *
 * Usage:
 *   npx tsx scripts/snap-beaches-to-coastline.ts              # Dry run (shows changes, no file)
 *   npx tsx scripts/snap-beaches-to-coastline.ts --write      # Generate migration file
 *   npx tsx scripts/snap-beaches-to-coastline.ts --verbose    # Show detailed API responses
 *   npx tsx scripts/snap-beaches-to-coastline.ts --limit=10   # Test with first 10 beaches only
 *
 * Environment Variables Required:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import fetch from "node-fetch";
import fs from "fs";
import path from "path";

// Validation utilities
import {
  assertValidCoordinates,
  getCoordinateValidationError,
} from "../lib/coordinate-validation";

// Parse command line arguments
const args = new Map<string, string>();
for (let i = 2; i < process.argv.length; i++) {
  const arg = process.argv[i];
  if (arg.startsWith("--")) {
    const [key, value] = arg.slice(2).split("=");
    if (value !== undefined) {
      args.set(key, value);
    } else {
      args.set(key, "true");
    }
  }
}

const WRITE_MODE = args.get("write") === "true";
const VERBOSE = args.get("verbose") === "true";
const DRY_RUN = !WRITE_MODE;
const LIMIT = args.get("limit") ? Number(args.get("limit")) : undefined;

// Minimum distance (in meters) to consider a coordinate change significant
const SIGNIFICANT_DISTANCE_M = 50;

// Rate limiting delay between Mapbox API calls (in milliseconds)
const API_DELAY_MS = 200;

// Environment validation
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MAPBOX_ACCESS_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !MAPBOX_ACCESS_TOKEN) {
  console.error("❌ Missing required environment variables:");
  if (!SUPABASE_URL) console.error("   - NEXT_PUBLIC_SUPABASE_URL");
  if (!SUPABASE_SERVICE_ROLE_KEY) console.error("   - SUPABASE_SERVICE_ROLE_KEY");
  if (!MAPBOX_ACCESS_TOKEN) console.error("   - NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN");
  process.exit(1);
}

// Initialize Supabase client with service role key
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

type Beach = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  city: string | null;
  state: string | null;
  country: string | null;
};

type CoordinateCorrection = {
  beach: Beach;
  oldLat: number;
  oldLon: number;
  newLat: number;
  newLon: number;
  distanceM: number;
  mapboxPlaceName: string;
};

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in meters
 */
function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Fetch all beaches with coordinates from Supabase
 */
async function fetchBeaches(): Promise<Beach[]> {
  console.log("📡 Fetching beaches from Supabase...");

  let query = supabase
    .from("beaches")
    .select("id, name, lat, lon, city, state, country")
    .not("lat", "is", null)
    .not("lon", "is", null)
    .is("deleted_at", null)
    .order("name");

  if (LIMIT) {
    query = query.limit(LIMIT);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch beaches: ${error.message}`);
  }

  if (!data || data.length === 0) {
    throw new Error("No beaches found in database");
  }

  console.log(`✅ Found ${data.length} beaches with coordinates${LIMIT ? ` (limited to ${LIMIT})` : ""}\n`);

  return data as Beach[];
}

/**
 * Use Mapbox reverse geocoding to find the nearest feature
 * Returns refined coordinates if available, otherwise null
 */
async function reverseGeocode(
  lat: number,
  lon: number,
  beachName: string
): Promise<{ lat: number; lon: number; placeName: string } | null> {
  // Validate input coordinates
  const validationError = getCoordinateValidationError(lat, lon, beachName);
  if (validationError) {
    console.warn(`⚠️  Skipping ${beachName}: ${validationError}`);
    return null;
  }

  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lon},${lat}.json`;
  const params = new URLSearchParams({
    access_token: MAPBOX_ACCESS_TOKEN,
    limit: "1",
  });

  try {
    const response = await fetch(`${url}?${params.toString()}`);

    if (!response.ok) {
      console.warn(`⚠️  Mapbox API error ${response.status} for ${beachName}`);
      return null;
    }

    const data: any = await response.json();

    if (!data.features || data.features.length === 0) {
      if (VERBOSE) {
        console.log(`   No Mapbox features found for ${beachName}`);
      }
      return null;
    }

    const feature = data.features[0];
    const [newLon, newLat] = feature.center as [number, number];
    const placeName = feature.place_name || "Unknown";

    if (VERBOSE) {
      console.log(`   Mapbox result: ${placeName}`);
      console.log(`   Coordinates: ${newLat}, ${newLon}`);
    }

    // Validate result coordinates
    const resultError = getCoordinateValidationError(newLat, newLon, `${beachName} result`);
    if (resultError) {
      console.warn(`⚠️  Invalid result for ${beachName}: ${resultError}`);
      return null;
    }

    return { lat: newLat, lon: newLon, placeName };
  } catch (error) {
    console.error(`❌ Error reverse geocoding ${beachName}:`, error);
    return null;
  }
}

/**
 * Check all beaches and find those needing coordinate corrections
 */
async function findCoordinateCorrections(
  beaches: Beach[]
): Promise<CoordinateCorrection[]> {
  const corrections: CoordinateCorrection[] = [];

  console.log("🔍 Analyzing beach coordinates...\n");

  for (let i = 0; i < beaches.length; i++) {
    const beach = beaches[i];
    const progress = `[${i + 1}/${beaches.length}]`;

    console.log(`${progress} Checking ${beach.name}...`);

    const result = await reverseGeocode(beach.lat, beach.lon, beach.name);

    if (result) {
      const distanceM = haversineDistance(
        beach.lat,
        beach.lon,
        result.lat,
        result.lon
      );

      if (distanceM >= SIGNIFICANT_DISTANCE_M) {
        corrections.push({
          beach,
          oldLat: beach.lat,
          oldLon: beach.lon,
          newLat: result.lat,
          newLon: result.lon,
          distanceM,
          mapboxPlaceName: result.placeName,
        });

        console.log(`   ⚠️  Significant deviation: ${distanceM.toFixed(0)}m`);
      } else {
        if (VERBOSE) {
          console.log(`   ✅ Coordinates OK (${distanceM.toFixed(0)}m deviation)`);
        }
      }
    }

    // Rate limiting delay
    if (i < beaches.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, API_DELAY_MS));
    }
  }

  return corrections;
}

/**
 * Generate SQL migration file for coordinate corrections
 */
function generateMigrationFile(corrections: CoordinateCorrection[]): string {
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "")
    .slice(0, 14);

  const filename = `${timestamp}_snap_beach_coordinates.sql`;
  const filepath = path.join(
    process.cwd(),
    "supabase",
    "migrations",
    filename
  );

  const lines: string[] = [];

  // Header
  lines.push("-- Beach coordinate snap-to-coastline corrections");
  lines.push(`-- Generated by scripts/snap-beaches-to-coastline.ts on ${new Date().toISOString()}`);
  lines.push("-- REVIEW CAREFULLY before applying");
  lines.push("");
  lines.push(`-- Found ${corrections.length} beaches with significant coordinate deviations (>${SIGNIFICANT_DISTANCE_M}m)`);
  lines.push("");
  lines.push("BEGIN;");
  lines.push("");

  // Generate UPDATE statements
  for (const correction of corrections) {
    const { beach, oldLat, oldLon, newLat, newLon, distanceM, mapboxPlaceName } = correction;

    lines.push(`-- Beach: ${beach.name} (${beach.id})`);
    if (beach.city || beach.state) {
      lines.push(`--   Location: ${[beach.city, beach.state].filter(Boolean).join(", ")}`);
    }
    lines.push(`--   Mapbox: ${mapboxPlaceName}`);
    lines.push(`--   Old: ${oldLat.toFixed(6)}, ${oldLon.toFixed(6)}`);
    lines.push(`--   New: ${newLat.toFixed(6)}, ${newLon.toFixed(6)}`);
    lines.push(`--   Distance: ${distanceM.toFixed(0)}m`);
    lines.push("");
    lines.push(`UPDATE beaches`);
    lines.push(`SET lat = ${newLat.toFixed(6)}, lon = ${newLon.toFixed(6)}`);
    lines.push(`WHERE id = '${beach.id}';`);
    lines.push("");
  }

  lines.push("COMMIT;");
  lines.push("");

  const content = lines.join("\n");

  if (WRITE_MODE) {
    fs.writeFileSync(filepath, content, "utf8");
    console.log(`\n✅ Migration file written to: ${filepath}`);
  }

  return filepath;
}

/**
 * Print summary statistics
 */
function printSummary(
  totalBeaches: number,
  corrections: CoordinateCorrection[]
): void {
  console.log("\n" + "=".repeat(70));
  console.log("SUMMARY");
  console.log("=".repeat(70));
  console.log(`Total beaches analyzed: ${totalBeaches}`);
  console.log(`Beaches needing correction: ${corrections.length}`);
  console.log(
    `Significant distance threshold: ${SIGNIFICANT_DISTANCE_M}m`
  );

  if (corrections.length > 0) {
    const distances = corrections.map((c) => c.distanceM);
    const avgDistance = distances.reduce((a, b) => a + b, 0) / distances.length;
    const maxDistance = Math.max(...distances);
    const minDistance = Math.min(...distances);

    console.log(`\nDeviation statistics:`);
    console.log(`  Average: ${avgDistance.toFixed(0)}m`);
    console.log(`  Min: ${minDistance.toFixed(0)}m`);
    console.log(`  Max: ${maxDistance.toFixed(0)}m`);

    console.log(`\nTop 5 largest deviations:`);
    const sorted = [...corrections].sort((a, b) => b.distanceM - a.distanceM);
    for (let i = 0; i < Math.min(5, sorted.length); i++) {
      const c = sorted[i];
      console.log(`  ${i + 1}. ${c.beach.name}: ${c.distanceM.toFixed(0)}m`);
    }
  }

  console.log("=".repeat(70));
}

/**
 * Main execution
 */
async function main() {
  console.log("🏖️  Beach Coordinate Coastline Snapping Script\n");
  console.log(`Mode: ${DRY_RUN ? "DRY RUN (no files written)" : "WRITE MODE (will generate migration)"}`);
  console.log(`Significant distance threshold: ${SIGNIFICANT_DISTANCE_M}m`);
  console.log(`API rate limit delay: ${API_DELAY_MS}ms\n`);

  try {
    // Fetch beaches from database
    const beaches = await fetchBeaches();

    // Analyze coordinates
    const corrections = await findCoordinateCorrections(beaches);

    // Print summary
    printSummary(beaches.length, corrections);

    // Generate migration file if needed
    if (corrections.length > 0) {
      console.log("");
      if (DRY_RUN) {
        console.log("📋 DRY RUN: No migration file written.");
        console.log("   Run with --write flag to generate the migration file:");
        console.log("   npx tsx scripts/snap-beaches-to-coastline.ts --write");
      } else {
        generateMigrationFile(corrections);
        console.log("\n⚠️  IMPORTANT: Review the migration file carefully before applying!");
        console.log("   Use Supabase Dashboard or `supabase db reset` to test locally first.");
      }
    } else {
      console.log("\n✅ All beach coordinates are within acceptable range.");
      console.log("   No migration needed.");
    }
  } catch (error) {
    console.error("\n❌ Script failed:");
    console.error(error);
    process.exit(1);
  }
}

// Run the script
main().catch((error) => {
  console.error("Unexpected error:", error);
  process.exit(1);
});
