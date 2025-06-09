#!/usr/bin/env node

/**
 * Update NOAA buoy conditions - fetches live weather data for all buoys
 * Usage: npm run buoy:update-conditions
 */

import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.join(__dirname, "../.env.local") });

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
const ADMIN_TOKEN = process.env.ADMIN_API_TOKEN || "dev-token-123";

async function updateBuoyConditions() {
  console.log("🌊 NOAA Buoy Conditions Update");
  console.log("================================\n");

  try {
    console.log("📡 Sending update request to API...");

    const response = await fetch(
      `${API_BASE}/api/admin/update-buoy-conditions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ADMIN_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error("Authentication failed - check ADMIN_API_TOKEN");
      }
      const errorData = await response.text();
      throw new Error(`API request failed: ${response.status} ${errorData}`);
    }

    const result = await response.json();

    console.log("\n✅ Update completed successfully!");
    console.log(`   • Updated: ${result.updated} buoys`);
    console.log(`   • Failed: ${result.failed} buoys`);
    console.log(`   • Timestamp: ${result.timestamp}`);

    if (result.failed > 0) {
      console.log("\n⚠️  Some buoys failed to update - check server logs");
    }

    return result;
  } catch (error) {
    console.error("\n❌ Update failed:", error.message);

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

    await updateBuoyConditions();
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
