#!/usr/bin/env node

/**
 * One-time cleanup of inactive buoys that don't return data from NOAA
 * Usage: npm run buoy:cleanup-inactive
 */

import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.join(__dirname, "../.env.local") });

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

async function cleanupInactiveBuoys() {
  console.log("🧹 One-Time Inactive Buoy Cleanup");
  console.log("==================================\n");

  try {
    // First, do a dry run to see what we'd remove
    console.log("1️⃣ Identifying inactive buoys (dry run)...\n");

    const dryRunResponse = await fetch(
      `${API_BASE}/api/admin/cleanup-inactive-buoys`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer dev-token-123`,
        },
        body: JSON.stringify({
          dryRun: true,
          remove: true, // We want to completely remove them
        }),
      }
    );

    if (!dryRunResponse.ok) {
      const errorText = await dryRunResponse.text();
      throw new Error(`Dry run failed: ${dryRunResponse.status} ${errorText}`);
    }

    const dryRunResult = await dryRunResponse.json();

    if (dryRunResult.inactive_buoys.length === 0) {
      console.log(
        "✅ No inactive buoys found! All buoys are working properly."
      );
      return;
    }

    console.log(
      `🎯 Found ${dryRunResult.inactive_buoys.length} inactive buoys:`
    );
    console.log(
      "┌─────────────┬─────────────────────────────────┬──────────────┐"
    );
    console.log(
      "│ Buoy ID     │ Name                            │ Last Update  │"
    );
    console.log(
      "├─────────────┼─────────────────────────────────┼──────────────┤"
    );

    dryRunResult.inactive_buoys.forEach((buoy) => {
      const id = buoy.buoy_uuid.padEnd(11);
      const name = (buoy.buoy_name || "Unknown").substring(0, 31).padEnd(31);
      const lastUpdate = buoy.last_successful_update
        ? new Date(buoy.last_successful_update).toLocaleDateString()
        : "Never";
      console.log(`│ ${id} │ ${name} │ ${lastUpdate.padEnd(12)} │`);
    });
    console.log(
      "└─────────────┴─────────────────────────────────┴──────────────┘\n"
    );

    // Ask for confirmation (in a script, we'll just proceed)
    console.log("2️⃣ Proceeding with removal...\n");

    const removeResponse = await fetch(
      `${API_BASE}/api/admin/cleanup-inactive-buoys`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer dev-token-123`,
        },
        body: JSON.stringify({
          dryRun: false,
          remove: true,
        }),
      }
    );

    if (!removeResponse.ok) {
      const errorText = await removeResponse.text();
      throw new Error(`Removal failed: ${removeResponse.status} ${errorText}`);
    }

    const removeResult = await removeResponse.json();

    console.log("✅ Cleanup completed successfully!");
    console.log(`   • Tested: ${removeResult.tested} buoys`);
    console.log(`   • Removed: ${removeResult.removed} inactive buoys`);
    console.log(
      `   • Remaining: ${
        removeResult.tested - removeResult.removed
      } active buoys\n`
    );

    if (removeResult.removed > 0) {
      console.log(
        "🎉 The inactive buoys have been permanently removed from the database."
      );
      console.log(
        "   Future buoy condition updates will be faster and more reliable!"
      );
    }
  } catch (error) {
    console.error("\n❌ Cleanup failed:", error.message);

    if (error.message.includes("ECONNREFUSED")) {
      console.log("\n💡 Make sure the Next.js dev server is running:");
      console.log("   npm run dev");
    }

    throw error;
  }
}

async function checkServerStatus() {
  try {
    const response = await fetch(`${API_BASE}/api/health`, {
      method: "GET",
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function main() {
  try {
    // Check if server is running
    const serverRunning = await checkServerStatus();

    if (!serverRunning) {
      console.log("🚨 Next.js server not running at", API_BASE);
      console.log("   Please start the server first: npm run dev");
      process.exit(1);
    }

    await cleanupInactiveBuoys();
  } catch (error) {
    console.error("\n💥 Script failed:", error.message);
    process.exit(1);
  }
}

// Handle uncaught errors
process.on("unhandledRejection", (error) => {
  console.error("\n💥 Unhandled error:", error);
  process.exit(1);
});

// Run the main function
main();
