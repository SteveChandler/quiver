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
const UTC_DAY_MS = 86_400_000;
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

  const utcMidnight = new Date().setUTCHours(0, 0, 0, 0);
  const from = new Date(utcMidnight - UTC_DAY_MS).toISOString();
  const to = new Date(utcMidnight + UTC_DAY_MS).toISOString();

  let response;
  try {
    response = await supabase
      .from("enhanced_forecasts")
      .select("water_temp")
      .eq("beach_id", beachId)
      .gte("forecast_at", from)
      .lt("forecast_at", to)
      .not("water_temp", "is", null)
      .order("forecast_at", { ascending: false })
      .limit(1)
      .maybeSingle();
  } catch (error) {
    if (isProgrammingError(error)) throw error;
    throw new SubPageDataUnavailableError(WATER_TEMP_META_SOURCE, subPageErrorMessage(error));
  }
  if (response.error) {
    throw new SubPageDataUnavailableError(WATER_TEMP_META_SOURCE, response.error.message);
  }
  return response.data?.water_temp ?? null;
}
