import { createServerClient } from "@/lib/supabase";
import { fetchForecastData, updateForecasts } from "@/lib/forecast-api";
import dotenv from "dotenv";
import type { Beach } from "@/types/database";

// Load environment variables from .env file
dotenv.config();

// Ocean Beach, San Diego coordinates
const OCEAN_BEACH_LAT = 32.7503;
const OCEAN_BEACH_LNG = -117.2534;

async function updateOceanBeachForecast() {
  console.log("Starting Ocean Beach forecast update script...");
  const supabase = createServerClient();

  try {
    // 1. First, try to find Ocean Beach in the database
    console.log("Looking for Ocean Beach in database...");
    let oceanBeach = null;

    const { data: beaches, error: beachError } = await supabase
      .from("beaches")
      .select("*")
      .or(`name.ilike.%Ocean Beach%, location.ilike.%San Diego%`);

    if (beachError) {
      console.error("Error querying beaches:", beachError);
    } else if (beaches && beaches.length > 0) {
      oceanBeach = beaches[0];
      console.log(
        `Found beach in database: ${oceanBeach.name} (${oceanBeach.id})`
      );
    }

    // 2. If Ocean Beach not found, try to find by coordinates
    if (!oceanBeach) {
      console.log("Searching by coordinates...");
      // Look for beaches near Ocean Beach coordinates
      const { data: nearbyBeaches, error: nearbyError } = await supabase.rpc(
        "get_beaches_within_radius",
        {
          lat: OCEAN_BEACH_LAT,
          lng: OCEAN_BEACH_LNG,
          radius_km: 5,
        }
      );

      if (nearbyError) {
        console.error("Error finding nearby beaches:", nearbyError);
      } else if (nearbyBeaches && nearbyBeaches.length > 0) {
        oceanBeach = nearbyBeaches[0];
        console.log(
          `Found nearby beach: ${oceanBeach.name} (${oceanBeach.id})`
        );
      }
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

    // 4. Now we have the beach, update its forecast
    console.log("Updating forecast data for Ocean Beach...");
    const apiKey = process.env.STORMGLASS_API_KEY;

    if (!apiKey) {
      throw new Error("STORMGLASS_API_KEY not found in environment variables");
    }

    // Delete existing forecasts
    const { error: deleteError } = await supabase
      .from("forecasts")
      .delete()
      .eq("beach_id", oceanBeach.id);

    if (deleteError) {
      console.error("Error deleting existing forecasts:", deleteError);
    }

    // Fetch fresh forecast data
    console.log("Fetching fresh forecast data from Stormglass API...");
    const forecasts = await fetchForecastData(oceanBeach as Beach, apiKey);

    // Insert new forecasts
    const { data: newForecasts, error: insertError } = await supabase
      .from("forecasts")
      .insert(
        forecasts.map((forecast: any) => ({
          id: crypto.randomUUID(),
          ...forecast,
        }))
      );

    if (insertError) {
      console.error("Error inserting forecasts:", insertError);
      throw new Error("Failed to insert forecast data");
    }

    console.log(
      `Successfully updated ${forecasts.length} forecast records for Ocean Beach`
    );

    // 5. Verify we can retrieve the forecasts
    const { data: verifyForecasts, error: verifyError } = await supabase
      .from("forecasts")
      .select("*")
      .eq("beach_id", oceanBeach.id)
      .order("forecast_date")
      .order("forecast_time");

    if (verifyError) {
      console.error("Error verifying forecasts:", verifyError);
    } else {
      console.log(
        `Verified ${verifyForecasts.length} forecast records in database`
      );
    }

    console.log("Ocean Beach forecast update completed successfully!");
  } catch (error) {
    console.error("Script failed:", error);
  }
}

// Run the script
updateOceanBeachForecast();
