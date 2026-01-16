#!/usr/bin/env npx tsx
/**
 * One-time script to sync NOAA buoys for all beaches.
 *
 * Usage:
 *   npx tsx scripts/sync-buoys-once.ts
 *
 * Or after deployment, trigger via cron endpoint:
 *   curl -H "Authorization: Bearer $CRON_SECRET" \
 *     "https://quiver.app/api/cron/sync-buoys?maxDistanceKm=250"
 */

// Load environment variables from .env.local
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { NOAABuoySync } from "../lib/services/noaa-sync";

async function main() {
  console.log("=".repeat(60));
  console.log("NOAA Buoy Sync - One Time Run");
  console.log("=".repeat(60));
  console.log("");

  const maxDistanceKm = parseInt(process.env.MAX_DISTANCE_KM || "250");
  console.log(`Configuration:`);
  console.log(`  - Max distance from beaches: ${maxDistanceKm}km`);
  console.log("");

  const syncService = new NOAABuoySync();

  console.log("Starting sync...");
  console.log("");

  const result = await syncService.syncBuoysForExistingBeaches(maxDistanceKm);

  console.log("");
  console.log("=".repeat(60));
  console.log("Results:");
  console.log("=".repeat(60));

  if (result.success) {
    console.log(`  Status: SUCCESS`);
    console.log(`  Buoys added/updated: ${result.buoysAdded}`);
    console.log(`  Stations added: ${result.stationsAdded}`);
  } else {
    console.log(`  Status: FAILED`);
    console.log(`  Error: ${result.error}`);
  }

  console.log("");
  console.log("Done!");

  process.exit(result.success ? 0 : 1);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
