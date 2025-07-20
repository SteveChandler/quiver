#!/usr/bin/env node

/**
 * Cleanup Invalid Buoys
 *
 * This script identifies and removes buoys with invalid or unparsable
 * coordinate data from the database. This helps to clean up the data
 * and prevent warnings during the forecast update process.
 */

import { config } from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
config({ path: path.join(__dirname, "../.env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Missing Supabase environment variables");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Parses buoy coordinates from either JSON or POINT string format.
 * @param {string} coordinates - The coordinate data from the database.
 * @returns {{lat: number, lng: number} | null} - The parsed coordinates or null if invalid.
 */
function parseBuoyCoordinates(coordinates) {
  if (!coordinates) return null;

  try {
    const coords = JSON.parse(coordinates);
    if (coords.coordinates && Array.isArray(coords.coordinates)) {
      return { lng: coords.coordinates[0], lat: coords.coordinates[1] };
    }
  } catch (e) {
    const pointMatch = coordinates.match(/POINT\(([^)]+)\)/);
    if (pointMatch) {
      const parts = pointMatch[1].split(" ");
      if (parts.length === 2) {
        return { lng: parseFloat(parts[0]), lat: parseFloat(parts[1]) };
      }
    }
  }

  return null;
}

/**
 * Main function to find and remove invalid buoys.
 */
async function cleanupInvalidBuoys() {
  console.log("🌊 Starting cleanup of invalid buoys...");

  try {
    // 1. Fetch all buoys from the database
    const { data: buoys, error: fetchError } = await supabase
      .from("buoys")
      .select("*");

    if (fetchError) {
      console.error("❌ Error fetching buoys:", fetchError);
      return;
    }

    console.log(`🔍 Found ${buoys.length} total buoys to inspect.`);

    // 2. Identify buoys with invalid coordinates
    const invalidBuoyIds = [];
    for (const buoy of buoys) {
      const parsedCoords = parseBuoyCoordinates(buoy.coordinates);
      if (!parsedCoords) {
        invalidBuoyIds.push(buoy.id);
        console.log(
          `🚩 Flagged invalid buoy: ${buoy.buoy_uuid} (ID: ${buoy.id})`
        );
      }
    }

    // 3. Delete the invalid buoys if any are found
    if (invalidBuoyIds.length > 0) {
      console.log(`🗑️ Deleting ${invalidBuoyIds.length} invalid buoys...`);
      const { error: deleteError } = await supabase
        .from("buoys")
        .delete()
        .in("id", invalidBuoyIds);

      if (deleteError) {
        console.error("❌ Error deleting invalid buoys:", deleteError);
      } else {
        console.log("✅ Successfully deleted invalid buoys.");
      }
    } else {
      console.log("👍 No invalid buoys found. Database is clean!");
    }

    console.log("🎉 Cleanup process completed.");
  } catch (error) {
    console.error("🔥 A fatal error occurred during cleanup:", error);
    process.exit(1);
  }
}

cleanupInvalidBuoys();
