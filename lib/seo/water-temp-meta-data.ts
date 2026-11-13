/**
 * Water Temperature Meta Data Helper for SEO
 *
 * Fetches water temperature data for beach pages to generate dynamic SEO metadata
 * with specific temperature values and wetsuit recommendations.
 */

import { cache } from "react";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import {
  SUB_PAGE_DATA_UNKNOWN,
  SubPageDataUnavailableError,
  createLastGoodSubPageData,
  isProgrammingError,
  reportSubPageDataUnavailable,
  subPageErrorMessage,
} from "@/lib/seo/sub-page-data-availability";
import { getWetsuitRecommendation, parseWaterTempF } from "@/lib/utils/wetsuit-utils";

export interface WaterTempMetaData {
  /** Current water temperature in Fahrenheit */
  tempF: number | null;
  /** Wetsuit thickness recommendation (e.g., "3/2mm fullsuit") */
  wetsuitRec: string | null;
  /**
   * Set only when the read failed and no earlier read on this instance found
   * the beach without a water temperature. The display fields are then null;
   * the indexing gate stays open (see hasSubPageDataOrUnknown).
   */
  availability?: typeof SUB_PAGE_DATA_UNKNOWN;
}

const WATER_TEMP_META_SOURCE = "getWaterTempMetaData";
/** PostgREST answers `.single()` with no matching row this way: no data, not a failure. */
const NO_ROWS_ERROR_CODE = "PGRST116";
const lastGoodWaterTempData = createLastGoodSubPageData();

/**
 * Get water temperature metadata for SEO purposes.
 *
 * Uses React's cache() for request deduplication between generateMetadata
 * and page component calls. A failed read returns nulls for display; a
 * programming error is not a failed read and propagates.
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

    let waterTemp: string | null;
    try {
      waterTemp = await readNewestWaterTemp(beachId);
    } catch (error) {
      if (!(error instanceof SubPageDataUnavailableError)) throw error;
      reportSubPageDataUnavailable(WATER_TEMP_META_SOURCE, error);
      return lastGoodWaterTempData.get(beachId) === false
        ? nullResult
        : { ...nullResult, availability: SUB_PAGE_DATA_UNKNOWN };
    }

    const tempF = parseWaterTempF(waterTemp);
    lastGoodWaterTempData.remember(beachId, tempF !== null);
    if (tempF === null) return nullResult;

    const wetsuitRec = getWetsuitRecommendation(tempF);
    return {
      tempF: Math.round(tempF),
      wetsuitRec: wetsuitRec.thickness,
    };
  }
);

/**
 * Today's newest water_temp, else yesterday's, else null. Throws
 * SubPageDataUnavailableError when the database cannot answer.
 */
async function readNewestWaterTemp(beachId: string): Promise<string | null> {
  let supabase: Awaited<ReturnType<typeof createSupabaseServiceRoleClient>>;
  try {
    supabase = await createSupabaseServiceRoleClient();
  } catch (error) {
    if (isProgrammingError(error)) throw error;
    throw new SubPageDataUnavailableError(WATER_TEMP_META_SOURCE, subPageErrorMessage(error));
  }

  const today = new Date().toISOString().split("T")[0];
  const nextDay = new Date(new Date(today + 'T00:00:00Z').getTime() + 86400000).toISOString().split('T')[0];
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  for (const [from, to] of [
    [today, nextDay],
    [yesterdayStr, today],
  ]) {
    let response: {
      data: { water_temp: string | null } | null;
      error: { code?: string; message: string } | null;
    };
    try {
      response = await supabase
        .from("enhanced_forecasts")
        .select("water_temp")
        .eq("beach_id", beachId)
        .gte("forecast_at", `${from}T00:00:00Z`)
        .lt("forecast_at", `${to}T00:00:00Z`)
        .not("water_temp", "is", null)
        .order("forecast_at", { ascending: false })
        .limit(1)
        .single();
    } catch (error) {
      if (isProgrammingError(error)) throw error;
      throw new SubPageDataUnavailableError(WATER_TEMP_META_SOURCE, subPageErrorMessage(error));
    }
    const { data: forecast, error } = response;

    if (error && error.code !== NO_ROWS_ERROR_CODE) {
      throw new SubPageDataUnavailableError(WATER_TEMP_META_SOURCE, error.message);
    }
    // An unparseable today row still falls back to nothing, as before: only a
    // missing today row reads yesterday.
    if (!error && forecast) return forecast.water_temp;
  }
  return null;
}
