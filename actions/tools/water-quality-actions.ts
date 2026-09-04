"use server";

import { unstable_cache } from "next/cache";
import { currentWaterQuality, type CountyStatusMetadata } from "@/lib/services/water-quality/current-status";
import { createPublicReadClient } from "@/lib/supabase/server";
import { withServerAction, type ServerActionResponse } from "@/lib/server-action-utils";
import {
  EPA_BEACH_CRITERIA,
  WQ_STATUS,
  type WQStatus,
} from "@/lib/constants/water-quality";

export interface BeachWaterQualityData extends CountyStatusMetadata {
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

    const effective = (await currentWaterQuality([{ ...wq, beach_id: data.id }]))[0];
    return {
      county_advisory_status: effective.county_advisory_status,
      county_checked_at: effective.county_checked_at,
      beachId: data.id,
      beachName: data.name,
      beachSlug: data.slug ?? beachSlug,
      state: data.state ?? "",
      city: data.city,
      status: (effective.status as WQStatus) ?? WQ_STATUS.UNKNOWN,
      latestEnterococcus: effective.county_advisory_status ? null : wq.latest_enterococcus,
      latestFecalColiform: effective.county_advisory_status ? null : wq.latest_fecal_coliform,
      latestSampleDate: effective.county_advisory_status ? null : wq.latest_sample_date,
      exceedanceCount30d: effective.county_advisory_status ? 0 : wq.exceedance_count_30d,
      totalSamples30d: effective.county_advisory_status ? 0 : wq.total_samples_30d,
      updatedAt: wq.updated_at,
      epaEnterococcusSTV: EPA_BEACH_CRITERIA.enterococcus.stv,
      epaFecalColiformSTV: EPA_BEACH_CRITERIA.fecalColiform.stv,
    };
  });
}

type WaterQualityBeachListItem = {
  beachId: string;
  beachName: string;
  beachSlug: string;
  state: string;
  city: string | null;
  lat: number;
  lon: number;
  status: WQStatus;
  latestSampleDate: string | null;
};

// Cached at the data-layer because the same payload is rendered for every
// `?beach=<slug>` variant of /tools/water-quality. Without this, each unique
// slug becomes a fresh ISR cache miss and runs the same DB query.
const fetchMonitoredBeachesList = unstable_cache(
  async (): Promise<WaterQualityBeachListItem[]> => {
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
          lat,
          lon
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
      lat: number;
      lon: number;
    };

    return data
      .filter((row) => row.beach && (row.beach as unknown as BeachRow).lat)
      .map((row) => {
        const beach = row.beach as unknown as BeachRow;
        return {
          beachId: beach.id,
          beachName: beach.name,
          beachSlug: beach.slug ?? "",
          state: beach.state ?? "",
          city: beach.city,
          lat: beach.lat,
          lon: beach.lon,
          status: (row.status as WQStatus) ?? WQ_STATUS.UNKNOWN,
          latestSampleDate: row.latest_sample_date,
        };
      });
  },
  ["water-quality-monitored-beaches-v1"],
  { revalidate: 3600 },
);

/**
 * Get all beaches with water quality data (for map/list view).
 * Returns beaches in CA and HI only.
 */
export async function getBeachesWithWaterQuality(): Promise<
  ServerActionResponse<WaterQualityBeachListItem[]>
> {
  return withServerAction(async () => {
    const rows = await fetchMonitoredBeachesList();
    const effective = await currentWaterQuality(rows.map((row) => ({ ...row, beach_id: row.beachId })));
    return effective.map((row) => ({ ...row,
      latestSampleDate: row.county_advisory_status ? null : row.latestSampleDate,
    }));
  });
}
