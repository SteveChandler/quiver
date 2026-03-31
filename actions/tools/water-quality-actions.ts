"use server";

import { createPublicReadClient } from "@/lib/supabase/server";
import { withServerAction, type ServerActionResponse } from "@/lib/server-action-utils";
import {
  EPA_BEACH_CRITERIA,
  WQ_STATUS,
  type WQStatus,
} from "@/lib/constants/water-quality";

export interface BeachWaterQualityData {
  beachId: string;
  beachName: string;
  beachSlug: string;
  state: string;
  city: string | null;
  status: WQStatus;
  latestEnterococcus: number | null;
  latestFecalColiform: number | null;
  latestSampleDate: string | null;
  exceedanceCount30d: number;
  totalSamples30d: number;
  updatedAt: string;
  /** EPA thresholds for display */
  epaEnterococcusSTV: number;
  epaFecalColiformSTV: number;
}

/**
 * Get water quality data for a beach by its slug.
 * Returns null if no water quality data is available for the beach.
 *
 * Coverage is CA + HI only.
 */
export async function getBeachWaterQuality(
  beachSlug: string
): Promise<ServerActionResponse<BeachWaterQualityData | null>> {
  return withServerAction(async () => {
    const supabase = createPublicReadClient();

    const { data, error } = await supabase
      .from("beaches")
      .select(`
        id,
        name,
        slug,
        state,
        city,
        beach_water_quality (
          status,
          latest_enterococcus,
          latest_fecal_coliform,
          latest_sample_date,
          exceedance_count_30d,
          total_samples_30d,
          updated_at
        )
      `)
      .eq("slug", beachSlug)
      .or("is_private.is.null,is_private.eq.false")
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return null;

    const wq = Array.isArray(data.beach_water_quality)
      ? data.beach_water_quality[0]
      : data.beach_water_quality;

    if (!wq) return null;

    return {
      beachId: data.id,
      beachName: data.name,
      beachSlug: data.slug ?? beachSlug,
      state: data.state ?? "",
      city: data.city,
      status: (wq.status as WQStatus) ?? WQ_STATUS.UNKNOWN,
      latestEnterococcus: wq.latest_enterococcus,
      latestFecalColiform: wq.latest_fecal_coliform,
      latestSampleDate: wq.latest_sample_date,
      exceedanceCount30d: wq.exceedance_count_30d,
      totalSamples30d: wq.total_samples_30d,
      updatedAt: wq.updated_at,
      epaEnterococcusSTV: EPA_BEACH_CRITERIA.enterococcus.stv,
      epaFecalColiformSTV: EPA_BEACH_CRITERIA.fecalColiform.stv,
    };
  });
}

/**
 * Get all beaches with water quality data (for map/list view).
 * Returns beaches in CA and HI only.
 */
export async function getBeachesWithWaterQuality(): Promise<
  ServerActionResponse<Array<{
    beachId: string;
    beachName: string;
    beachSlug: string;
    state: string;
    city: string | null;
    lat: number;
    lon: number;
    status: WQStatus;
    latestSampleDate: string | null;
  }>>
> {
  return withServerAction(async () => {
    const supabase = createPublicReadClient();

    const { data, error } = await supabase
      .from("beach_water_quality")
      .select(`
        status,
        latest_sample_date,
        beach:beaches!beach_water_quality_beach_id_fkey (
          id,
          name,
          slug,
          state,
          city,
          center_lat,
          center_lng
        )
      `)
      .in("beach.state" as never, ["CA", "HI"]);

    if (error) throw new Error(error.message);
    if (!data) return [];

    type BeachRow = {
      id: string;
      name: string;
      slug: string | null;
      state: string | null;
      city: string | null;
      center_lat: number;
      center_lng: number;
    };

    return data
      .filter((row) => row.beach && (row.beach as unknown as BeachRow).center_lat)
      .map((row) => {
        const beach = row.beach as unknown as BeachRow;
        return {
          beachId: beach.id,
          beachName: beach.name,
          beachSlug: beach.slug ?? "",
          state: beach.state ?? "",
          city: beach.city,
          lat: beach.center_lat,
          lon: beach.center_lng,
          status: (row.status as WQStatus) ?? WQ_STATUS.UNKNOWN,
          latestSampleDate: row.latest_sample_date,
        };
      });
  });
}
