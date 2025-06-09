#!/usr/bin/env node

/**
 * Direct test of PostGIS functions to debug API issues
 */

import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, "../.env.local") });

async function testPostGISFunctions() {
  try {
    console.log("🔍 Testing PostGIS functions directly...\n");

    // Import Supabase client
    const { createClient } = await import("@supabase/supabase-js");

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Test 1: Check if functions exist
    console.log("1️⃣ Checking if PostGIS functions exist...");
    const { data: functions, error: funcError } = await supabase
      .from("information_schema.routines")
      .select("routine_name")
      .in("routine_name", ["get_nearby_buoys", "consolidate_buoy_conditions"]);

    if (funcError) {
      console.error("❌ Error checking functions:", funcError);
    } else {
      console.log(
        "✅ Functions found:",
        functions?.map((f) => f.routine_name) || []
      );
    }

    // Test 2: Check buoy count
    console.log("\n2️⃣ Checking buoy count...");
    const { data: buoyCount, error: countError } = await supabase
      .from("buoys")
      .select("*", { count: "exact", head: true });

    if (countError) {
      console.error("❌ Error counting buoys:", countError);
    } else {
      console.log(`✅ Found ${buoyCount?.length || 0} buoys in database`);
    }

    // Test 3: Check a few sample buoys
    console.log("\n3️⃣ Checking sample buoys...");
    const { data: sampleBuoys, error: sampleError } = await supabase
      .from("buoys")
      .select("buoy_uuid, buoy_name, kind, active")
      .limit(3);

    if (sampleError) {
      console.error("❌ Error fetching sample buoys:", sampleError);
    } else {
      console.log("✅ Sample buoys:", sampleBuoys);
    }

    // Test 4: Direct function call
    console.log("\n4️⃣ Testing get_nearby_buoys function directly...");
    const { data: nearbyResult, error: nearbyError } = await supabase.rpc(
      "get_nearby_buoys",
      {
        lat: 32.714,
        lng: -117.174,
        max_distance_meters: 100000,
        limit_count: 3,
      }
    );

    if (nearbyError) {
      console.error("❌ Error calling get_nearby_buoys:", nearbyError);
    } else {
      console.log("✅ Nearby buoys result:", nearbyResult);
    }

    // Test 5: Test consolidate function
    console.log("\n5️⃣ Testing consolidate_buoy_conditions function...");
    const { data: consolidateResult, error: consolidateError } =
      await supabase.rpc("consolidate_buoy_conditions", {
        lat: 32.714,
        lng: -117.174,
        limit_count: 10,
        max_distance_meters: 200000,
      });

    if (consolidateError) {
      console.error(
        "❌ Error calling consolidate_buoy_conditions:",
        consolidateError
      );
    } else {
      console.log("✅ Consolidate result:", consolidateResult);
    }
  } catch (error) {
    console.error("💥 Test failed:", error);
  }
}

testPostGISFunctions();
