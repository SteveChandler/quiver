#!/usr/bin/env node

/**
 * Script to sync NOAA buoys for existing beaches
 * Usage: node scripts/sync-noaa-buoys.mjs [maxDistanceKm]
 *
 * This script bypasses authentication and directly calls the sync service
 * Useful for initial setup and testing
 */

import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, "../.env.local") });

// Dynamic import of the sync service (since it uses TypeScript)
async function runSync() {
  try {
    console.log("🌊 Starting NOAA Buoy Sync for Quiver...\n");

    // Get max distance from command line arg or default to 200km
    const maxDistanceKm = parseInt(process.argv[2]) || 200;
    console.log(
      `📍 Syncing buoys within ${maxDistanceKm}km of existing beaches`
    );

    // Check required environment variables
    if (
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.SUPABASE_SERVICE_ROLE_KEY
    ) {
      throw new Error(
        "Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY"
      );
    }

    // Import the TypeScript modules (this requires the build to be available)
    console.log("📦 Loading sync service...");

    // For development, we'll make a direct API call instead of importing TS modules
    const apiUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const syncUrl = `${apiUrl}/api/admin/sync-buoys`;

    console.log(`🔄 Calling sync API: ${syncUrl}`);

    const response = await fetch(syncUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // For development - in production you'd need proper admin auth
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ maxDistanceKm }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `API call failed: ${response.status} ${response.statusText}\n${errorText}`
      );
    }

    const result = await response.json();

    if (result.success) {
      console.log("\n✅ Sync completed successfully!");
      console.log(`📊 Results:`);
      console.log(`   • Buoys added: ${result.data.buoysAdded}`);
      console.log(`   • Stations added: ${result.data.stationsAdded}`);
      console.log(`   • Search radius: ${result.data.maxDistanceKm}km`);
    } else {
      console.error("\n❌ Sync failed:", result.error);
      if (result.data) {
        console.log(`📊 Partial results:`);
        console.log(`   • Buoys added: ${result.data.buoysAdded}`);
        console.log(`   • Stations added: ${result.data.stationsAdded}`);
      }
    }
  } catch (error) {
    console.error("\n💥 Script failed:", error.message);
    console.error("\n🔧 Troubleshooting:");
    console.error(
      "   1. Ensure your Next.js development server is running (npm run dev)"
    );
    console.error("   2. Check your .env.local file has required variables");
    console.error(
      "   3. Verify the buoys table exists in your Supabase database"
    );
    console.error("   4. Ensure PostGIS migrations have been run");
    process.exit(1);
  }
}

// Alternative direct database approach (commented out - requires compilation)
async function runSyncDirect() {
  console.log("📦 This would require TypeScript compilation...");
  console.log("💡 For now, use the API approach or run via Next.js dev server");

  // This would work if we had a compiled version:
  // const { NOAABuoySync } = await import('../lib/services/noaa-sync.js');
  // const syncService = new NOAABuoySync();
  // const result = await syncService.syncBuoysForExistingBeaches(maxDistanceKm);
}

// Usage information
function showUsage() {
  console.log(`
🌊 NOAA Buoy Sync Script for Quiver

Usage:
  node scripts/sync-noaa-buoys.mjs [maxDistanceKm]

Examples:
  node scripts/sync-noaa-buoys.mjs          # Use default 200km radius
  node scripts/sync-noaa-buoys.mjs 100      # Use 100km radius
  node scripts/sync-noaa-buoys.mjs 500      # Use 500km radius (California coast)

Prerequisites:
  1. Next.js dev server running (npm run dev)
  2. .env.local configured with Supabase credentials
  3. PostGIS migrations completed
  4. Beaches table populated with your surf spots

This script will:
  • Fetch NOAA's master station list
  • Filter to stations within [maxDistanceKm] of your beaches
  • Create buoy and station records in your database
  • Skip inactive/decommissioned stations
`);
}

// Main execution
if (process.argv.includes("--help") || process.argv.includes("-h")) {
  showUsage();
} else {
  runSync();
}
