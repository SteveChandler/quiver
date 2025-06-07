"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Forecast, BeachWithForecasts } from "@/types/database";
import { updateForecasts, updateAllForecasts } from "@/lib/forecast-api";
import { revalidatePath } from "next/cache";
import {
  isInPacificBeachCluster,
  getCachedClusterForecast,
  setCachedClusterForecast,
  findPacificBeach,
  getCacheStatus,
  invalidateClusterCache,
} from "@/lib/beach-cluster-cache";
import { getBeaches } from "@/actions/beach-actions";

export async function getBeachForecasts(beachId: string, date?: string) {
  const supabase = await createSupabaseServerClient();

  try {
    // First, get the beach details to check if it's in the Pacific Beach cluster
    const { data: beach, error: beachError } = await supabase
      .from("beaches")
      .select("*")
      .eq("id", beachId)
      .single();

    if (beachError) {
      throw beachError;
    }

    // Check if this beach is part of the Pacific Beach cluster
    if (isInPacificBeachCluster(beach.name)) {
      console.log(
        `🏖️ ${beach.name} is in Pacific Beach cluster - checking cache`
      );

      // Check cache first
      const cachedData = getCachedClusterForecast();
      if (cachedData) {
        const cacheStatus = getCacheStatus();
        console.log(
          `✅ Using cached data for ${beach.name} (${cacheStatus.remainingTimeHuman})`
        );
        return { success: true, data: cachedData.forecasts };
      }

      console.log(
        `🔄 No valid cache for Pacific Beach cluster - fetching fresh data`
      );

      // Cache miss or expired - need to fetch Pacific Beach data
      const allBeachesResult = await getBeaches();
      if (!allBeachesResult.success || !allBeachesResult.data) {
        throw new Error("Failed to fetch beaches from database");
      }

      const pacificBeach = findPacificBeach(allBeachesResult.data);
      if (!pacificBeach) {
        console.log(
          "⚠️ Pacific Beach not found in database - falling back to regular fetch"
        );
        // Fall back to regular forecast fetching
      } else {
        // Try to get existing Pacific Beach forecasts first
        let query = supabase
          .from("forecasts")
          .select("*")
          .eq("beach_id", pacificBeach.id)
          .order("forecast_date")
          .order("forecast_time");

        if (date) {
          query = query.eq("forecast_date", date);
        } else {
          const today = new Date().toISOString().split("T")[0];
          query = query.gte("forecast_date", today);
        }

        const { data: pacificForecasts, error: pacificError } = await query;

        if (!pacificError && pacificForecasts && pacificForecasts.length > 0) {
          // Found Pacific Beach forecasts - cache them
          console.log(
            `📦 Caching Pacific Beach forecasts for cluster (${pacificForecasts.length} forecasts)`
          );
          setCachedClusterForecast(
            pacificForecasts as Forecast[],
            pacificBeach
          );
          return { success: true, data: pacificForecasts as Forecast[] };
        } else {
          console.log(`📭 No forecasts found for Pacific Beach in database`);
          // No forecasts available for Pacific Beach either
          // This would trigger an API update in the calling function
        }
      }
    }

    // Regular forecast fetching for non-cluster beaches or when cache fails
    let query = supabase
      .from("forecasts")
      .select("*")
      .eq("beach_id", beachId)
      .order("forecast_date")
      .order("forecast_time");

    // If date is provided, filter by date
    if (date) {
      query = query.eq("forecast_date", date);
    } else {
      // Otherwise, get forecasts for today and future dates
      const today = new Date().toISOString().split("T")[0];
      query = query.gte("forecast_date", today);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return { success: true, data: data as Forecast[] };
  } catch (error) {
    console.error("Error fetching beach forecasts:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// New function to get the most recent forecast available for a beach (including past forecasts)
export async function getLatestBeachForecast(beachId: string) {
  const supabase = await createSupabaseServerClient();

  try {
    const { data, error } = await supabase
      .from("forecasts")
      .select("*")
      .eq("beach_id", beachId)
      .order("forecast_date", { ascending: false })
      .order("forecast_time", { ascending: false })
      .limit(1);

    if (error) {
      throw error;
    }

    return { success: true, data: data as Forecast[] };
  } catch (error) {
    console.error("Error fetching latest beach forecast:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export async function getBeachWithForecasts(beachId: string, date?: string) {
  const supabase = await createSupabaseServerClient();

  try {
    // Get beach details
    const { data: beach, error: beachError } = await supabase
      .from("beaches")
      .select("*")
      .eq("id", beachId)
      .single();

    if (beachError) {
      throw beachError;
    }

    // Get forecasts for the beach
    const { data: forecasts, error: forecastsError } = await getBeachForecasts(
      beachId,
      date
    );

    if (!forecasts || forecastsError) {
      throw forecastsError || new Error("Failed to fetch forecasts");
    }

    return {
      success: true,
      data: {
        ...beach,
        forecasts: forecasts,
      } as BeachWithForecasts,
    };
  } catch (error) {
    console.error("Error fetching beach with forecasts:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// New function to update forecasts for a specific beach
export async function updateBeachForecasts(beachId: string) {
  const supabase = await createSupabaseServerClient();

  try {
    // Get the API key from environment variables
    const apiKey = process.env.STORMGLASS_API_KEY;
    if (!apiKey) {
      throw new Error("Stormglass API key not found");
    }

    // Get beach details
    const { data: beachData, error: beachError } = await supabase
      .from("beaches")
      .select("*")
      .eq("id", beachId)
      .single();

    if (beachError) {
      throw beachError;
    }

    let beach = beachData; // Use let so we can reassign it
    let targetBeachId = beachId; // Use let so we can reassign it

    // Check if this beach is in the Pacific Beach cluster
    if (isInPacificBeachCluster(beach.name)) {
      console.log(`🏖️ ${beach.name} is in Pacific Beach cluster`);

      // For cluster beaches, always update Pacific Beach (the source)
      const allBeachesResult = await getBeaches();
      if (allBeachesResult.success && allBeachesResult.data) {
        const pacificBeach = findPacificBeach(allBeachesResult.data);

        if (pacificBeach && pacificBeach.id !== beachId) {
          console.log(
            `🔄 Updating Pacific Beach instead of ${beach.name} (cluster optimization)`
          );
          beach = pacificBeach; // Update Pacific Beach instead
          targetBeachId = pacificBeach.id;
        }
      }
    }

    // Update forecasts
    const result = await updateForecasts(beach, apiKey);

    if (!result.success) {
      throw new Error(result.error || "Failed to update forecasts");
    }

    // If we updated Pacific Beach, cache the new forecasts for the cluster
    if (isInPacificBeachCluster(beach.name)) {
      // Fetch the fresh forecasts we just created
      const { data: freshForecasts, error: fetchError } = await supabase
        .from("forecasts")
        .select("*")
        .eq("beach_id", beach.id)
        .order("forecast_date")
        .order("forecast_time");

      if (!fetchError && freshForecasts && freshForecasts.length > 0) {
        console.log(`📦 Caching fresh forecasts for Pacific Beach cluster`);
        setCachedClusterForecast(freshForecasts as Forecast[], beach);
      }
    }

    // Revalidate paths that display forecasts
    revalidatePath("/");
    revalidatePath(`/beach/${targetBeachId}`);

    return { success: true };
  } catch (error) {
    console.error("Error updating beach forecasts:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// New function to update forecasts for all beaches
export async function updateAllBeachForecasts() {
  try {
    // Get the API key from environment variables
    const apiKey = process.env.STORMGLASS_API_KEY;
    if (!apiKey) {
      throw new Error("Stormglass API key not found");
    }

    // Update forecasts for all beaches
    const result = await updateAllForecasts(apiKey);

    if (!result.success) {
      throw new Error(result.error || "Failed to update forecasts");
    }

    // Revalidate paths that display forecasts
    revalidatePath("/");
    revalidatePath("/map");

    return { success: true, results: result.results };
  } catch (error) {
    console.error("Error updating all beach forecasts:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
