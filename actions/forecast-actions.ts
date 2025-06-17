"use server";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type { Beach, Forecast } from "@/types/database";

// Get forecast data for a specific beach
export async function getBeachForecasts(beachId: string) {
  try {
    const supabase = await createSupabaseServiceRoleClient();

    const { data, error } = await supabase
      .from("forecasts")
      .select("*")
      .eq("beach_id", beachId)
      .gte("forecast_date", new Date().toISOString().split("T")[0])
      .order("forecast_date", { ascending: true })
      .order("forecast_time", { ascending: true })
      .limit(50);

    if (error) {
      console.error("Error fetching beach forecasts:", error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    console.error("Error in getBeachForecasts:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Get latest forecast for a beach (including past forecasts)
export async function getLatestBeachForecast(beachId: string) {
  try {
    const supabase = await createSupabaseServiceRoleClient();

    const { data, error } = await supabase
      .from("forecasts")
      .select("*")
      .eq("beach_id", beachId)
      .order("forecast_date", { ascending: false })
      .order("forecast_time", { ascending: false })
      .limit(5);

    if (error) {
      console.error("Error fetching latest beach forecast:", error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    console.error("Error in getLatestBeachForecast:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Update forecasts for a specific beach using enhanced forecast system
export async function updateBeachForecasts(beachId: string) {
  try {
    console.log(`Updating enhanced forecasts for beach: ${beachId}`);

    const { updateBeachForecast } = await import(
      "@/lib/utils/forecast-service-utils"
    );
    const data = await updateBeachForecast(beachId);

    console.log(
      `Successfully updated enhanced forecasts for ${data.beach}: ${data.forecastsGenerated} forecasts`
    );

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error("Error updating beach forecasts:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Update forecasts for all beaches using enhanced forecast system
export async function updateAllBeachForecasts() {
  try {
    console.log("Starting enhanced forecast update for all beaches");

    const { updateAllBeachForecasts: updateAll } = await import(
      "@/lib/utils/forecast-service-utils"
    );
    const result = await updateAll();

    const successful = result.results?.filter((r) => r.success).length || 0;
    const failed = (result.results?.length || 0) - successful;

    console.log(
      `Enhanced forecast update complete: ${successful} successful, ${failed} failed`
    );

    return {
      success: true,
      data: {
        total: result.results?.length || 0,
        successful,
        failed,
        results: result.results || [],
      },
    };
  } catch (error) {
    console.error("Error updating all beach forecasts:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
