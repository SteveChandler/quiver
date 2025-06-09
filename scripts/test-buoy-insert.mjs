#!/usr/bin/env node

/**
 * Test script to manually test buoy database insertion
 * Usage: node scripts/test-buoy-insert.mjs
 */

import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, "../.env.local") });

async function testBuoyInsert() {
  try {
    console.log("🧪 Testing Buoy Database Insertion...\n");

    const testBuoy = {
      buoy_uuid: "TEST46086",
      buoy_name: "San Clemente Basin Test",
      kind: "buoy",
      coordinates: "POINT(-118.317 32.5)",
      active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    console.log("1️⃣ Testing direct API call to upsert buoy...");
    console.log("Test buoy data:", JSON.stringify(testBuoy, null, 2));

    const response = await fetch("http://localhost:3000/api/admin/sync-buoys", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        maxDistanceKm: 500, // Use wider radius to ensure we catch the test stations
        testMode: true,
      }),
    });

    console.log("Response status:", response.status);
    const result = await response.json();
    console.log("Response body:", JSON.stringify(result, null, 2));

    // Check if the buoy table exists and we can query it
    console.log("\n2️⃣ Testing buoy table query...");

    const queryResponse = await fetch(
      "http://localhost:3000/api/buoys/nearby?latitude=32.5&longitude=-118.3&limit=10",
      {
        headers: {
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      }
    );

    if (queryResponse.ok) {
      const buoys = await queryResponse.json();
      console.log(`Found ${buoys.length} buoys in database`);
      if (buoys.length > 0) {
        console.log("Sample buoys:", buoys.slice(0, 3));
      }
    } else {
      console.log("❌ Failed to query buoys:", queryResponse.status);
      const errorText = await queryResponse.text();
      console.log("Error:", errorText);
    }

    // Check database schema
    console.log("\n3️⃣ Checking database schema...");
    console.log("Expected buoys table columns:");
    console.log("  • id (UUID)");
    console.log("  • buoy_uuid (TEXT)");
    console.log("  • buoy_name (TEXT)");
    console.log("  • kind (TEXT)");
    console.log("  • active (BOOLEAN)");
    console.log("  • coordinates (GEOGRAPHY)");
    console.log("  • created_at, updated_at (TIMESTAMP)");
    console.log("  • Plus weather columns...");
  } catch (error) {
    console.error("❌ Test failed:", error.message);
  }
}

testBuoyInsert();
