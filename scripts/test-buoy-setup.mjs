#!/usr/bin/env node

/**
 * Test script to verify NOAA buoy sync prerequisites
 * Usage: node scripts/test-buoy-setup.mjs
 *
 * Checks that all requirements are met before running the actual sync
 */

import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, "../.env.local") });

async function testSetup() {
  console.log("🧪 Testing NOAA Buoy Setup Prerequisites...\n");

  let allGood = true;

  // Test 1: Environment Variables
  console.log("1️⃣ Checking environment variables...");
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.log("   ❌ Missing NEXT_PUBLIC_SUPABASE_URL");
    allGood = false;
  } else {
    console.log("   ✅ NEXT_PUBLIC_SUPABASE_URL found");
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.log("   ❌ Missing SUPABASE_SERVICE_ROLE_KEY");
    allGood = false;
  } else {
    console.log("   ✅ SUPABASE_SERVICE_ROLE_KEY found");
  }

  // Test 2: Next.js Server
  console.log("\n2️⃣ Checking Next.js development server...");
  try {
    const healthUrl = "http://localhost:3000/api/health";
    const response = await fetch(healthUrl, {
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });
    if (response.ok) {
      console.log("   ✅ Next.js dev server is running");
    } else {
      console.log("   ❌ Next.js dev server returned error:", response.status);
      allGood = false;
    }
  } catch (error) {
    console.log(
      "   ❌ Cannot reach Next.js dev server (http://localhost:3000)"
    );
    console.log("      Make sure to run: npm run dev");
    allGood = false;
  }

  // Test 3: Database Connection
  console.log("\n3️⃣ Testing database connection...");
  try {
    const dbTestUrl = "http://localhost:3000/api/admin/sync-buoys";
    const response = await fetch(dbTestUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      signal: AbortSignal.timeout(10000),
    });

    if (response.ok) {
      console.log("   ✅ Database connection working");
    } else if (response.status === 401) {
      console.log("   ❌ Database authentication failed");
      console.log("      Check your SUPABASE_SERVICE_ROLE_KEY");
      allGood = false;
    } else {
      console.log("   ❌ Database connection error:", response.status);
      allGood = false;
    }
  } catch (error) {
    console.log("   ❌ Failed to test database connection:", error.message);
    allGood = false;
  }

  // Test 4: NOAA API Access
  console.log("\n4️⃣ Testing NOAA API access...");
  try {
    const noaaUrl = "https://www.ndbc.noaa.gov/data/stations/station_table.txt";
    const response = await fetch(noaaUrl, {
      signal: AbortSignal.timeout(15000), // 15 second timeout for external API
    });

    if (response.ok) {
      const data = await response.text();
      const lines = data.split("\n");
      console.log(
        `   ✅ NOAA API accessible (${lines.length} lines of station data)`
      );
    } else {
      console.log("   ❌ NOAA API returned error:", response.status);
      allGood = false;
    }
  } catch (error) {
    console.log("   ❌ Cannot access NOAA API:", error.message);
    console.log("      This might be a temporary network issue");
    allGood = false;
  }

  // Summary
  console.log("\n📋 Setup Status Summary:");
  if (allGood) {
    console.log("✅ All prerequisites met! You can run the buoy sync:");
    console.log("   node scripts/sync-noaa-buoys.mjs");
  } else {
    console.log(
      "❌ Some prerequisites are missing. Please fix the issues above."
    );
    console.log("\n🔧 Common fixes:");
    console.log("   • Run: npm run dev (to start Next.js server)");
    console.log("   • Check .env.local for correct Supabase credentials");
    console.log("   • Ensure PostGIS migrations have been run");
    console.log("   • Verify internet connection for NOAA API access");
  }

  return allGood;
}

// Run the test
testSetup().catch((error) => {
  console.error("\n💥 Test failed with error:", error.message);
  process.exit(1);
});
