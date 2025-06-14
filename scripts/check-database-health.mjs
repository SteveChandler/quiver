#!/usr/bin/env node

/**
 * Check database health and SRID fix status
 */

import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, "../.env.local") });

async function checkDatabaseHealth() {
  try {
    console.log("🔍 Checking Database Health...\n");

    // Import Supabase client
    const { createClient } = await import("@supabase/supabase-js");

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Test 1: Check PostGIS functions
    console.log("1️⃣ Testing PostGIS spatial functions...");

    const { data: nearbyBuoys, error: nearbyError } = await supabase.rpc(
      "get_nearby_buoys",
      {
        lat: 32.714,
        lng: -117.174,
        max_distance_meters: 100000,
        limit_count: 3,
      }
    );

    if (nearbyError) {
      console.log("❌ SRID Fix Status: NOT APPLIED");
      console.log(`   Error: ${nearbyError.message}`);
      if (nearbyError.message.includes("mixed SRID geometries")) {
        console.log("\n💡 Next Step: Apply the SRID fix manually:");
        console.log("   1. Go to your Supabase SQL Editor");
        console.log(
          "   2. Copy/paste the contents of scripts/fix-srid-issue.sql"
        );
        console.log("   3. Execute the SQL");
      }
      console.log("\n⚠️  This is likely causing many test failures!\n");
    } else {
      console.log("✅ SRID Fix Status: APPLIED");
      console.log(`   Found ${nearbyBuoys?.length || 0} nearby buoys`);
    }

    // Test 2: Check buoy data
    console.log("\n2️⃣ Checking buoy data...");
    const { data: buoyCount, error: countError } = await supabase
      .from("buoys")
      .select("*", { count: "exact", head: true });

    if (countError) {
      console.log("❌ Buoy table access failed:", countError.message);
    } else {
      console.log(
        `✅ Buoy table accessible with ${buoyCount?.length || 0} records`
      );
    }

    // Test 3: Check beaches
    console.log("\n3️⃣ Checking beaches...");
    const { data: beachCount, error: beachError } = await supabase
      .from("beaches")
      .select("*", { count: "exact", head: true });

    if (beachError) {
      console.log("❌ Beach table access failed:", beachError.message);
    } else {
      console.log(
        `✅ Beach table accessible with ${beachCount?.length || 0} records`
      );
    }

    console.log("\n🏁 Database health check complete!");
  } catch (error) {
    console.error("💥 Health check failed:", error.message);
  }
}

console.log("🌊 Database Health Checker");
console.log("🎯 Checking if SRID fix and other database issues are resolved\n");

checkDatabaseHealth();
