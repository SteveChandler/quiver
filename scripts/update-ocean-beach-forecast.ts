#!/usr/bin/env tsx

/**
 * Script to update Ocean Beach forecast using enhanced forecast system
 * Usage: npm run update-ocean-beach
 */

import { createSupabaseServiceRoleClient } from "../lib/supabase/server";
import { EnhancedForecastService } from "../lib/services/enhanced-forecast-service";
import type { Beach } from "../types/database";

const OCEAN_BEACH_LAT = 32.7507;
const OCEAN_BEACH_LNG = -117.254;

async function updateOceanBeachForecast() {
  try {
    console.log("🚀 Starting Ocean Beach enhanced forecast update...");

    const supabase = await createSupabaseServiceRoleClient();

    // 1. Look for Ocean Beach in the database
    console.log("🔍 Looking for Ocean Beach in database...");

    let { data: oceanBeaches, error } = await supabase
      .from("beaches")
      .select("*")
      .ilike("name", "%Ocean Beach%");

    if (error) {
      console.error("Error searching for Ocean Beach:", error);
      throw error;
    }

    let oceanBeach: Beach | null = null;

    // 2. If we have multiple matches, find the best one
    if (oceanBeaches && oceanBeaches.length > 0) {
      // Find the one closest to our known coordinates
      oceanBeach = oceanBeaches.reduce((closest, beach) => {
        const closestDist = Math.sqrt(
          Math.pow(closest.latitude - OCEAN_BEACH_LAT, 2) +
            Math.pow(closest.longitude - OCEAN_BEACH_LNG, 2)
        );
        const beachDist = Math.sqrt(
          Math.pow(beach.latitude - OCEAN_BEACH_LAT, 2) +
            Math.pow(beach.longitude - OCEAN_BEACH_LNG, 2)
        );
        return beachDist < closestDist ? beach : closest;
      });

      console.log(
        `✅ Found Ocean Beach: ${oceanBeach.name} (ID: ${oceanBeach.id})`
      );
    }

    // 3. If still not found, create it
    if (!oceanBeach) {
      console.log("Ocean Beach not found in database, creating it...");
      const { data: newBeach, error: createError } = await supabase
        .from("beaches")
        .insert({
          name: "Ocean Beach",
          location: "San Diego, CA",
          latitude: OCEAN_BEACH_LAT,
          longitude: OCEAN_BEACH_LNG,
          description: "A popular surf spot in San Diego",
          wave_quality_rating: 4.2,
          crowd_density_rating: 3.8,
          parking_rating: 3.5,
          accessibility_rating: 4.0,
        })
        .select()
        .single();

      if (createError) {
        console.error("Error creating beach:", createError);
        throw new Error("Failed to create Ocean Beach record");
      }

      oceanBeach = newBeach;
      console.log(`Created new beach record with ID: ${oceanBeach.id}`);
    }

    // 4. Now we have the beach, update its enhanced forecast
    console.log("🌊 Updating enhanced forecast data for Ocean Beach...");

    const enhancedForecastService = new EnhancedForecastService();

    // Generate comprehensive forecast
    console.log(
      "📊 Generating comprehensive forecast from NOAA data sources..."
    );
    const forecasts =
      await enhancedForecastService.generateComprehensiveForecast(
        oceanBeach as Beach
      );

    // Store enhanced forecasts
    console.log("💾 Storing enhanced forecasts...");
    const result = await enhancedForecastService.storeEnhancedForecasts(
      oceanBeach as Beach,
      forecasts
    );

    if (!result.success) {
      throw new Error(result.error || "Failed to store enhanced forecasts");
    }

    console.log(`✅ Successfully updated Ocean Beach enhanced forecasts!`);
    console.log(`📈 Generated ${forecasts.length} forecast points`);
    console.log(`🎯 Stored ${result.stored} enhanced forecasts`);
    console.log(
      `📊 Data sources: NOAA WaveWatch III, CO-OPS, Weather Service, NDBC buoys`
    );
  } catch (error) {
    console.error("❌ Error updating Ocean Beach forecast:", error);
    process.exit(1);
  }
}

// Run the update
updateOceanBeachForecast();
