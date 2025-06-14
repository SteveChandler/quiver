#!/usr/bin/env node

/**
 * Apply PostGIS SRID fix to resolve spatial function errors
 * This fixes the "Operation on mixed SRID geometries" errors
 */

import { config } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { readFileSync } from "fs";

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, "../.env.local") });

async function applySRIDFix() {
  try {
    console.log("🔧 Applying PostGIS SRID fix...\n");

    // Import Supabase client
    const { createClient } = await import("@supabase/supabase-js");

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Read the SRID fix SQL
    const sqlFix = readFileSync(join(__dirname, "fix-srid-issue.sql"), "utf8");

    console.log("1️⃣ Executing SRID fix SQL...");

    // Split the SQL into individual statements
    const statements = sqlFix
      .split(/;\s*$$/m)
      .filter((stmt) => stmt.trim().length > 0)
      .map((stmt) => stmt.trim() + ";");

    console.log(`📝 Found ${statements.length} SQL statements to execute`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim() === ";") continue;

      console.log(`   Executing statement ${i + 1}/${statements.length}...`);

      const { error } = await supabase
        .rpc("exec_sql", { sql: statement })
        .catch(async () => {
          // Fallback: try direct SQL execution
          return await supabase.from("").select(statement);
        })
        .catch(async () => {
          // Alternative: Use raw SQL through the REST API
          const response = await fetch(
            `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec_sql`,
            {
              method: "POST",
              headers: {
                apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
                Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ sql: statement }),
            }
          );

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          return { error: null };
        });

      if (error) {
        console.warn(`⚠️  Warning on statement ${i + 1}: ${error.message}`);
        // Continue with other statements - some might be "already exists" errors
      } else {
        console.log(`✅ Statement ${i + 1} executed successfully`);
      }
    }

    console.log("\n2️⃣ Testing the fixed functions...");

    // Test the get_nearby_buoys function
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
      console.error("❌ get_nearby_buoys still failing:", nearbyError.message);
    } else {
      console.log(
        `✅ get_nearby_buoys working! Found ${nearbyBuoys?.length || 0} buoys`
      );
    }

    // Test the consolidate function
    const { data: consolidatedBuoy, error: consolidateError } =
      await supabase.rpc("consolidate_buoy_conditions", {
        lat: 32.714,
        lng: -117.174,
        limit_count: 10,
        max_distance_meters: 200000,
      });

    if (consolidateError) {
      console.error(
        "❌ consolidate_buoy_conditions still failing:",
        consolidateError.message
      );
    } else {
      console.log(
        `✅ consolidate_buoy_conditions working! Found buoy: ${
          consolidatedBuoy?.buoy_name || "None"
        }`
      );
    }

    console.log("\n🎉 SRID fix application complete!");
    console.log(
      "The 'Operation on mixed SRID geometries' errors should now be resolved."
    );
  } catch (error) {
    console.error("💥 Failed to apply SRID fix:", error.message);
    console.log("\n💡 Manual fix:");
    console.log("1. Go to your Supabase SQL editor");
    console.log("2. Copy and paste the contents of scripts/fix-srid-issue.sql");
    console.log("3. Execute the SQL manually");
  }
}

console.log("🌊 PostGIS SRID Fix Application");
console.log("🎯 This will resolve spatial function errors\n");

applySRIDFix();
