"use server";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { withAuthenticatedAction } from "@/lib/server-action-utils";
import { updateBeachForecast } from "@/lib/utils/forecast-server-utils";
import { isDataStale } from "@/lib/utils/forecast-client-utils";
import { trackFallback } from "@/lib/monitoring/fallback-tracker";
import { resolveConfidence } from "@/lib/monitoring/fallback-helpers";
import type { Beach, Forecast } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";

// Metadata interface for forecast transparency
export interface ForecastMetadata {
  primarySource: "NOAA_NWS" | "CDIP" | "FALLBACK" | string;
  allSources: string[];
  confidenceScore: number;
  lastUpdated: string;
  cdipStation?: string;
  cdipStationName?: string;
  cdipDistance?: number;
  isRealTimeData?: boolean;
  isStaleData?: boolean;
}

// Helper function to extract metadata from enhanced forecast
function extractForecastMetadata(
  forecast: EnhancedForecastEntity
): ForecastMetadata {
  const dataSource = forecast.data_source || "FALLBACK";

  // Use source-specific staleness thresholds
  const staleData = isDataStale(forecast.updated_at, dataSource);

  return {
    primarySource: dataSource,
    allSources: forecast.raw_forecast?.data_sources || [dataSource],
    confidenceScore: resolveConfidence(forecast.confidence_score, 'forecast', { beachId: forecast.beach_id }),
    lastUpdated: forecast.updated_at,
    cdipStation: forecast.raw_forecast?.cdip_data?.stationId,
    cdipStationName: forecast.raw_forecast?.cdip_data?.stationName,
    // CDIP is real-time data
    isRealTimeData: forecast.data_source === "CDIP",
    // Use source-specific staleness threshold instead of hardcoded 6 hours
    isStaleData: staleData,
  };
}

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

// Enhanced forecast with metadata interface
export interface EnhancedForecastWithMetadata extends EnhancedForecastEntity {
  metadata: ForecastMetadata;
}

// Get enhanced forecast data for a beach with transparency metadata
export async function getEnhancedBeachForecasts(
  beachId: string,
  days: number = 12
) {
  try {
    const supabase = await createSupabaseServiceRoleClient();

    // Prefer the legacy compatibility view if present (tests assert against it), fallback to table
    const start = new Date();
    const startDate = start.toISOString().split("T")[0];
    const endDate = new Date(start.getTime() + days * 86400000)
      .toISOString()
      .split("T")[0];

    let data: any[] | null = null;
    let error: any = null;

    // Try view
    const viewAttempt = await supabase
      .from("ten_day_enhanced_forecasts")
      .select("*")
      .eq("beach_id", beachId)
      .order("forecast_date", { ascending: true })
      .order("forecast_time", { ascending: true });

    if (!viewAttempt.error) {
      data = viewAttempt.data as any[];
    } else {
      // Fallback to table with explicit range
      const tableAttempt = await supabase
        .from("enhanced_forecasts")
        .select("*")
        .eq("beach_id", beachId)
        .gte("forecast_date", startDate)
        .lte("forecast_date", endDate)
        .order("forecast_date", { ascending: true })
        .order("forecast_time", { ascending: true });
      data = tableAttempt.data as any[];
      error = tableAttempt.error;
    }

    if (error) {
      console.error("Error fetching enhanced forecasts:", error);
      return { success: false, error: error.message };
    }

    console.log("✅ Fetched enhanced_forecasts rows:", {
      beachId,
      totalRows: data?.length || 0,
      firstRowDate: data?.[0]?.forecast_date,
      lastRowDate: data?.[data.length - 1]?.forecast_date,
    });

    // Enrich forecasts with metadata for transparency
    const forecastsWithMetadata: EnhancedForecastWithMetadata[] = (
      data || []
    ).map((forecast: EnhancedForecastEntity) => ({
      ...forecast,
      metadata: extractForecastMetadata(forecast),
    }));

    return { success: true, data: forecastsWithMetadata };
  } catch (error) {
    console.error("Error in getEnhancedBeachForecasts:", error);
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
    const { getCurrentForecast } = await import(
      "@/lib/utils/current-forecast-utils"
    );

    const today = new Date().toISOString().split("T")[0];
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    // Get today's and tomorrow's forecasts from enhanced_forecasts table (to handle forward-looking logic)
    const { data: enhancedForecasts, error: enhancedError } = await supabase
      .from("enhanced_forecasts")
      .select(
        "forecast_date, forecast_time, wave_height, wind_speed, wind_direction, weather_condition, confidence_score, data_source"
      )
      .eq("beach_id", beachId)
      .in("forecast_date", [today, tomorrow])
      .order("forecast_date", { ascending: true })
      .order("forecast_time", { ascending: true });

    if (enhancedError) {
      console.error("Error fetching enhanced forecast preview:", enhancedError);
    }

    if (enhancedForecasts && enhancedForecasts.length > 0) {
      // Use time-aware selection to get the most appropriate forecast
      const currentForecast = getCurrentForecast(enhancedForecasts);

      if (currentForecast) {
        return {
          success: true,
          data: {
            type: "enhanced",
            wave_height: currentForecast.wave_height,
            wind_speed: currentForecast.wind_speed,
            wind_direction: currentForecast.wind_direction,
            weather_condition: currentForecast.weather_condition,
            confidence_score: currentForecast.confidence_score,
            // Include metadata for transparency
            metadata: {
              primarySource: currentForecast.data_source || "FALLBACK",
              allSources: [currentForecast.data_source || "FALLBACK"],
              confidenceScore: resolveConfidence(currentForecast.confidence_score, 'forecast'),
              lastUpdated: new Date().toISOString(), // Will be from DB if available
              isRealTimeData: currentForecast.data_source === "CDIP",
              isStaleData: false, // Can't determine without updated_at
            },
          },
        };
      }
    }

    // Fallback to basic forecasts table with time-aware selection
    const { data: basicForecasts, error: basicError } = await supabase
      .from("forecasts")
      .select(
        "forecast_date, forecast_time, wave_height, wind_speed, wind_direction, weather_condition"
      )
      .eq("beach_id", beachId)
      .in("forecast_date", [today, tomorrow])
      .order("forecast_date", { ascending: true })
      .order("forecast_time", { ascending: true });

    if (basicError) {
      console.error("Error fetching basic forecast preview:", basicError);
    }

    if (basicForecasts && basicForecasts.length > 0) {
      const currentForecast = getCurrentForecast(basicForecasts);

      if (currentForecast) {
        return {
          success: true,
          data: {
            type: "basic",
            wave_height: currentForecast.wave_height,
            wind_speed: currentForecast.wind_speed,
            wind_direction: currentForecast.wind_direction,
            weather_condition: currentForecast.weather_condition,
            confidence_score: null,
          },
        };
      }
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
    const { updateBeachForecast } = await import(
      "@/lib/utils/forecast-service-utils"
    );
    const data = await updateBeachForecast(beachId);

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
    const { updateAllBeachForecasts: updateAll } = await import(
      "@/lib/utils/forecast-service-utils"
    );
    const result = await updateAll();

    const successful = result.results?.filter((r) => r.success).length || 0;
    const failed = (result.results?.length || 0) - successful;

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

// Get today's forecast for a beach (used by home page)
// NOTE: This function is being deprecated in favor of direct API calls to /api/forecasts/update-enhanced
// for better consistency across pages. New code should use the API endpoint directly.
// Keeping this for backwards compatibility with any remaining consumers.
export async function getForecastForToday(beachId: string) {
  try {
    console.log("🏠 getForecastForToday called with beachId:", beachId);

    const supabase = await createSupabaseServiceRoleClient();
    const { getCurrentForecast } = await import(
      "@/lib/utils/current-forecast-utils"
    );

    const today = new Date().toISOString().split("T")[0];
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    console.log("📅 Searching for forecasts between:", today, "and", tomorrow);

    // Use same data fetching logic as beach detail page to ensure consistency
    const enhancedForecastResult = await getEnhancedBeachForecasts(beachId, 10);
    let enhancedForecasts: any[] | null = null;
    let enhancedError: any = null;
    
    if (enhancedForecastResult.success && enhancedForecastResult.data) {
      enhancedForecasts = enhancedForecastResult.data;
    } else {
      enhancedError = new Error(enhancedForecastResult.error || "Failed to fetch enhanced forecasts");
    }

    console.log("🔍 Enhanced forecasts query result:", {
      error: enhancedError,
      count: enhancedForecasts?.length || 0,
      sampleForecast: enhancedForecasts?.[0]
        ? {
            date: enhancedForecasts[0].forecast_date,
            time: enhancedForecasts[0].forecast_time,
            tide: enhancedForecasts[0].tide_status,
            wind: enhancedForecasts[0].wind_speed,
          }
        : null,
    });

    if (enhancedError) {
      console.error(
        "❌ Error fetching enhanced forecast for today:",
        enhancedError
      );
    }

    if (enhancedForecasts && enhancedForecasts.length > 0) {
      // Use time-aware selection to match beach detail page behavior
      const { getCurrentForecast, formatCurrentTime } = await import(
        "@/lib/utils/current-forecast-utils"
      );
      const currentForecast = getCurrentForecast(enhancedForecasts);

      if (currentForecast) {
        console.log(
          `✅ Home page forecast found (time-aware): ${currentForecast.forecast_date} ${currentForecast.forecast_time}, wave: ${currentForecast.wave_height}, tide: ${currentForecast.tide_status}, wind: ${currentForecast.wind_speed}`
        );
        console.log(`🕐 Current time: ${formatCurrentTime()}, total forecasts: ${enhancedForecasts.length}`);
        console.log(`📊 First forecast: ${enhancedForecasts[0]?.forecast_time} (${enhancedForecasts[0]?.wave_height})`);
        return currentForecast;
      }
    }

    // Fallback to basic forecasts table if enhanced not available
    console.log("🔄 Trying fallback to basic forecasts table...");

    const { data: basicForecasts, error: basicError } = await supabase
      .from("forecasts")
      .select("*")
      .eq("beach_id", beachId)
      .in("forecast_date", [today, tomorrow])
      .order("forecast_date", { ascending: true })
      .order("forecast_time", { ascending: true });

    console.log("📊 Basic forecasts query result:", {
      error: basicError,
      count: basicForecasts?.length || 0,
      sampleForecast: basicForecasts?.[0]
        ? {
            date: basicForecasts[0].forecast_date,
            time: basicForecasts[0].forecast_time,
            beachId: basicForecasts[0].beach_id,
          }
        : null,
    });

    if (basicError) {
      console.error("❌ Error fetching basic forecast for today:", basicError);
    }

    if (basicForecasts && basicForecasts.length > 0) {
      const currentForecast = getCurrentForecast(basicForecasts);
      if (currentForecast) {
        console.log(
          `✅ Home page forecast (fallback): ${currentForecast.forecast_date} ${currentForecast.forecast_time}`
        );
        return currentForecast;
      }
    }

    console.log("❌ No forecast data found for beach:", beachId);

    // Attempt an on-demand refresh/generation as a last resort
    try {
      console.log("🛠️ Attempting on-demand enhanced forecast generation for", beachId);
      const { updateBeachForecast } = await import(
        "@/lib/utils/forecast-service-utils"
      );
      await updateBeachForecast(beachId);

      // Re-query enhanced forecasts after generation
      const { data: regenForecasts, error: regenError } = await supabase
        .from("enhanced_forecasts")
        .select("*")
        .eq("beach_id", beachId)
        .in("forecast_date", [today, tomorrow])
        .order("forecast_date", { ascending: true })
        .order("forecast_time", { ascending: true });

      if (regenError) {
        console.warn("Post-generation query error:", regenError);
      }

      if (regenForecasts && regenForecasts.length > 0) {
        const currentForecast = getCurrentForecast(regenForecasts);
        if (currentForecast) {
          console.log(
            `✅ Home page forecast after generation: ${currentForecast.forecast_date} ${currentForecast.forecast_time}`
          );
          return currentForecast as any;
        }
      }
    } catch (genErr) {
      console.warn("On-demand forecast generation failed:", genErr);
    }

    return null;
  } catch (error) {
    console.error("Error in getForecastForToday:", error);
    throw error;
  }
}
