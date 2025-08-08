#!/usr/bin/env node

/**
 * Script to clean up old enhanced_forecasts data and regenerate with fresh NOAA API data
 * This fixes the upsert issue where old data prevented fresh updates
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Missing required environment variables");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const apiBaseUrl = "http://localhost:3000";

async function cleanAndRegenerateForecasts() {
  try {
    console.log(
      "🧹 Starting cleanup and regeneration of enhanced forecasts...\n"
    );

    // Step 1: Get all beaches
    const { data: beaches, error: beachError } = await supabase
      .from("beaches")
      .select("id, name")
      .order("name");

    if (beachError) {
      throw new Error(`Failed to fetch beaches: ${beachError.message}`);
    }

    console.log(`📍 Found ${beaches.length} beaches\n`);

    // Step 2: Clean up old data
    console.log("🗑️  Cleaning up old enhanced_forecasts data...");
    const { error: deleteError } = await supabase
      .from("enhanced_forecasts")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000"); // Delete all records

    if (deleteError) {
      throw new Error(`Failed to clean up old data: ${deleteError.message}`);
    }

    console.log("✅ Old data cleaned up successfully\n");

    // Step 3: Regenerate all beaches with fresh NOAA data
    console.log("🌊 Regenerating all beaches with fresh NOAA data...\n");

    const results = [];
    for (const beach of beaches) {
      try {
        console.log(`🏖️  Updating ${beach.name}...`);

        const response = await fetch(
          `${apiBaseUrl}/api/forecasts/update-enhanced`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ beachId: beach.id }),
          }
        );

        if (!response.ok) {
          throw new Error(`API request failed: ${response.status}`);
        }

        const result = await response.json();
        if (result.success) {
          console.log(
            `✅ ${beach.name}: ${result.data.forecastsCount} forecasts`
          );
          results.push({
            beach: beach.name,
            success: true,
            count: result.data.forecastsCount,
          });
        } else {
          console.log(`❌ ${beach.name}: ${result.error}`);
          results.push({
            beach: beach.name,
            success: false,
            error: result.error,
          });
        }

        // Small delay between requests
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (error) {
        console.log(`❌ ${beach.name}: ${error.message}`);
        results.push({
          beach: beach.name,
          success: false,
          error: error.message,
        });
      }
    }

    // Step 4: Summary
    const successful = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);

    console.log("\n" + "=".repeat(50));
    console.log("📊 CLEANUP AND REGENERATION SUMMARY");
    console.log("=".repeat(50));
    console.log(
      `✅ Successful: ${successful.length}/${beaches.length} beaches`
    );
    console.log(`❌ Failed: ${failed.length}/${beaches.length} beaches`);

    if (successful.length > 0) {
      const totalForecasts = successful.reduce((sum, r) => sum + r.count, 0);
      console.log(`📈 Total fresh forecasts: ${totalForecasts}`);
    }

    if (failed.length > 0) {
      console.log("\n❌ Failed beaches:");
      failed.forEach((r) => console.log(`   - ${r.beach}: ${r.error}`));
    }

    console.log("\n✅ Enhanced forecasts cleanup and regeneration completed!");
    console.log("🔍 All data is now fresh with real NOAA API sources");
  } catch (error) {
    console.error("❌ Critical error:", error);
    process.exit(1);
  }
}

// Run the script
cleanAndRegenerateForecasts();
