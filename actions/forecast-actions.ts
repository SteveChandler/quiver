"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Forecast, BeachWithForecasts } from "@/types/database";
import { updateForecasts, updateAllForecasts } from "@/lib/forecast-api";
import { revalidatePath } from "next/cache";

export async function getBeachForecasts(beachId: string, date?: string) {
  const supabase = await createSupabaseServerClient();

  try {
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
    const { data: beach, error: beachError } = await supabase
      .from("beaches")
      .select("*")
      .eq("id", beachId)
      .single();

    if (beachError) {
      throw beachError;
    }

    // Update forecasts
    const result = await updateForecasts(beach, apiKey);

    if (!result.success) {
      throw new Error(result.error || "Failed to update forecasts");
    }

    // Revalidate paths that display forecasts
    revalidatePath("/");
    revalidatePath(`/beach/${beachId}`);

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
