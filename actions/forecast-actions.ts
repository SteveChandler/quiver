"use server";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { withAuthenticatedAction } from "@/lib/server-action-utils";
import { updateBeachForecast } from "@/lib/utils/forecast-service-utils";
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

// Check if enhanced forecast data exists for a beach
export async function checkEnhancedForecastExists(beachId: string) {
  try {
    const supabase = await createSupabaseServiceRoleClient();

    const today = new Date().toISOString().split("T")[0];

    const { data, error } = await supabase
      .from("enhanced_forecasts")
      .select("id, forecast_date, updated_at")
      .eq("beach_id", beachId)
      .gte("forecast_date", today)
      .order("forecast_date", { ascending: true })
      .limit(1);

    if (error) {
      console.error("Error checking enhanced forecast existence:", error);
      return { success: false, error: error.message };
    }

    const exists = data && data.length > 0;
    const isStale =
      exists && data[0].updated_at
        ? Date.now() - new Date(data[0].updated_at).getTime() >
          24 * 60 * 60 * 1000 // 24 hours
        : false;

    return {
      success: true,
      exists,
      isStale,
      lastUpdated: exists ? data[0].updated_at : null,
    };
  } catch (error) {
    console.error("Error in checkEnhancedForecastExists:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Get enhanced forecast data for a beach
export async function getEnhancedBeachForecasts(
  beachId: string,
  days: number = 12
) {
  try {
    const supabase = await createSupabaseServiceRoleClient();

    const { data, error } = await supabase
      .from("enhanced_forecasts")
      .select("*")
      .eq("beach_id", beachId)
      .gte("forecast_date", new Date().toISOString().split("T")[0])
      .lte(
        "forecast_date",
        new Date(Date.now() + days * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0]
      )
      .order("forecast_date", { ascending: true })
      .order("forecast_time", { ascending: true });

    if (error) {
      console.error("Error fetching enhanced beach forecasts:", error);
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error) {
    console.error("Error in getEnhancedBeachForecasts:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Generate enhanced forecast for a beach (server action)
export async function generateBeachForecast(beachId: string) {
  try {
    console.log(`Generating enhanced forecast for beach ${beachId}`);

    // First, verify the beach exists
    const supabase = await createSupabaseServiceRoleClient();
    const { data: beach, error: beachError } = await supabase
      .from("beaches")
      .select("*")
      .eq("id", beachId)
      .single();

    if (beachError || !beach) {
      console.error("Beach lookup error:", beachError);
      return {
        success: false,
        error: `Beach not found: ${beachId}. Please verify the beach exists in the database.`,
      };
    }

    console.log(`Found beach: ${beach.name}`);

    const result = await updateBeachForecast(beachId);

    return {
      success: true,
      message: result.message,
      forecastsGenerated: result.forecastsGenerated,
      beach: result.beach,
    };
  } catch (error) {
    console.error("Error generating beach forecast:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Get basic forecast preview for a beach (used in map components)
export async function getBeachForecastPreview(beachId: string) {
  try {
    const supabase = await createSupabaseServiceRoleClient();

    const today = new Date().toISOString().split("T")[0];

    // Get today's forecast from enhanced_forecasts table
    const { data: enhancedForecasts, error: enhancedError } = await supabase
      .from("enhanced_forecasts")
      .select(
        "wave_height, wind_speed, wind_direction, weather_condition, confidence_score"
      )
      .eq("beach_id", beachId)
      .eq("forecast_date", today)
      .order("forecast_time", { ascending: true })
      .limit(1);

    if (enhancedError) {
      console.error("Error fetching enhanced forecast preview:", enhancedError);
    }

    if (enhancedForecasts && enhancedForecasts.length > 0) {
      return {
        success: true,
        data: {
          type: "enhanced",
          ...enhancedForecasts[0],
        },
      };
    }

    // Fallback to basic forecasts table
    const { data: basicForecasts, error: basicError } = await supabase
      .from("forecasts")
      .select("wave_height, wind_speed, wind_direction, weather_condition")
      .eq("beach_id", beachId)
      .eq("forecast_date", today)
      .order("forecast_time", { ascending: true })
      .limit(1);

    if (basicError) {
      console.error("Error fetching basic forecast preview:", basicError);
    }

    if (basicForecasts && basicForecasts.length > 0) {
      return {
        success: true,
        data: {
          type: "basic",
          ...basicForecasts[0],
          confidence_score: null,
        },
      };
    }

    return {
      success: true,
      data: null, // No forecast data available
    };
  } catch (error) {
    console.error("Error in getBeachForecastPreview:", error);
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
