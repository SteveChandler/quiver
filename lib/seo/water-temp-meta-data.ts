/**
 * Water Temperature Meta Data Helper for SEO
 *
 * Fetches water temperature data for beach pages to generate dynamic SEO metadata
 * with specific temperature values and wetsuit recommendations.
 */

import { cache } from "react";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { getWetsuitRecommendation, parseWaterTempF } from "@/lib/utils/wetsuit-utils";

export interface WaterTempMetaData {
  /** Current water temperature in Fahrenheit */
  tempF: number | null;
  /** Wetsuit thickness recommendation (e.g., "3/2mm fullsuit") */
  wetsuitRec: string | null;
}

/**
 * Get water temperature metadata for SEO purposes.
 *
 * Uses React's cache() for request deduplication between generateMetadata
 * and page component calls.
 *
 * @param beachId Beach UUID to fetch water temp for
 * @returns Water temp meta data with temperature and wetsuit recommendation
 */
export const getWaterTempMetaData = cache(
  async (beachId: string): Promise<WaterTempMetaData> => {
    const nullResult: WaterTempMetaData = {
      tempF: null,
      wetsuitRec: null,
    };

    if (!beachId) return nullResult;

    try {
      const supabase = await createSupabaseServiceRoleClient();
      const today = new Date().toISOString().split("T")[0];
      const nextDay = new Date(new Date(today + 'T00:00:00Z').getTime() + 86400000).toISOString().split('T')[0];

      // Get the most recent forecast with water_temp data
      const { data: forecast, error } = await supabase
        .from("enhanced_forecasts")
        .select("water_temp")
        .eq("beach_id", beachId)
        .gte("forecast_at", `${today}T00:00:00Z`)
        .lt("forecast_at", `${nextDay}T00:00:00Z`)
        .not("water_temp", "is", null)
        .order("forecast_at", { ascending: false })
        .limit(1)
        .single();

      if (error || !forecast) {
        // Try yesterday if today has no data
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split("T")[0];

        const { data: fallbackForecast, error: fallbackError } = await supabase
          .from("enhanced_forecasts")
          .select("water_temp")
          .eq("beach_id", beachId)
          .gte("forecast_at", `${yesterdayStr}T00:00:00Z`)
          .lt("forecast_at", `${today}T00:00:00Z`)
          .not("water_temp", "is", null)
          .order("forecast_at", { ascending: false })
          .limit(1)
          .single();

        if (fallbackError || !fallbackForecast) {
          return nullResult;
        }

        const tempF = parseWaterTempF(fallbackForecast.water_temp);
        if (tempF === null) return nullResult;

        const wetsuitRec = getWetsuitRecommendation(tempF);
        return {
          tempF: Math.round(tempF),
          wetsuitRec: wetsuitRec.thickness,
        };
      }

      const tempF = parseWaterTempF(forecast.water_temp);
      if (tempF === null) return nullResult;

      const wetsuitRec = getWetsuitRecommendation(tempF);
      return {
        tempF: Math.round(tempF),
        wetsuitRec: wetsuitRec.thickness,
      };
    } catch (error) {
      console.error("[getWaterTempMetaData] Error fetching water temp:", {
        beachId,
        message: error instanceof Error ? error.message : "Unknown error",
      });
      return nullResult;
    }
  }
);
