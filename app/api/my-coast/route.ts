import type { NextRequest } from "next/server";

import {
  createSuccessResponse,
  createValidationError,
  handleApiError,
  isValidUuid,
  withNoStore,
  withRateLimit,
} from "@/lib/middleware/api-wrappers";
import {
  MY_COAST_FOLLOW_LIMIT,
  loadMyCoastBatch,
  type MyCoastForecastSourceRow,
  type MyCoastWaterQualitySourceRow,
} from "@/lib/beach-follow/my-coast-loader";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const FORECAST_LOOKBACK_MS = 36 * 60 * 60 * 1000;
const FORECAST_LOOKAHEAD_MS = 6 * 60 * 60 * 1000;
const FORECAST_ROWS_PER_BEACH = 44;

async function myCoastHandler(request: NextRequest) {
  try {
    const rawBeachIds = request.nextUrl.searchParams.get("beachIds") ?? "";
    const beachIds = [...new Set(
      rawBeachIds.split(",").map((value) => value.trim()).filter(Boolean),
    )];
    if (
      beachIds.length === 0
      || beachIds.length > MY_COAST_FOLLOW_LIMIT
      || beachIds.some((beachId) => !isValidUuid(beachId))
    ) {
      return createValidationError(
        `beachIds must contain 1-${MY_COAST_FOLLOW_LIMIT} UUIDs`,
      );
    }

    const supabase = await createSupabaseServerClient();
    const now = Date.now();
    const result = await loadMyCoastBatch(beachIds, {
      loadBeaches: async (ids) => {
        const { data, error } = await supabase
          .from("beaches")
          .select("id, name, slug, city, state, country, wind_offshore_deg, wind_offshore_tol_deg")
          .in("id", ids)
          .eq("is_private", false)
          .is("deleted_at", null)
          .limit(MY_COAST_FOLLOW_LIMIT);
        if (error) throw error;
        return (data ?? []).map((row) => ({
          id: row.id,
          name: row.name,
          slug: row.slug,
          city: row.city,
          state: row.state,
          country: row.country,
          windOffshoreDeg: row.wind_offshore_deg,
          windOffshoreToleranceDeg: row.wind_offshore_tol_deg,
        }));
      },
      loadForecasts: async (ids) => {
        const { data, error } = await supabase
          .from("enhanced_forecasts")
          .select("beach_id, forecast_at, updated_at, water_temp, tide_status, next_tide_at, next_tide_height, next_tide_type, wind_speed, wind_direction, wind_direction_deg, wave_height, data_source")
          .in("beach_id", ids)
          .gte("forecast_at", new Date(now - FORECAST_LOOKBACK_MS).toISOString())
          .lte("forecast_at", new Date(now + FORECAST_LOOKAHEAD_MS).toISOString())
          .order("forecast_at", { ascending: false })
          .limit(ids.length * FORECAST_ROWS_PER_BEACH);
        if (error) throw error;

        const closestByBeach = new Map<string, MyCoastForecastSourceRow>();
        for (const row of data ?? []) {
          const candidateDistance = Math.abs(Date.parse(row.forecast_at) - now);
          const current = closestByBeach.get(row.beach_id);
          if (
            current
            && Math.abs(Date.parse(current.forecastAt) - now) <= candidateDistance
          ) continue;
          closestByBeach.set(row.beach_id, {
            beachId: row.beach_id,
            forecastAt: row.forecast_at,
            updatedAt: row.updated_at,
            waterTemp: row.water_temp,
            tideStatus: row.tide_status,
            nextTideAt: row.next_tide_at,
            nextTideHeight: row.next_tide_height,
            nextTideType: row.next_tide_type,
            windSpeed: row.wind_speed,
            windDirection: row.wind_direction,
            windDirectionDeg: row.wind_direction_deg,
            waveHeight: row.wave_height,
            dataSource: row.data_source,
          });
        }
        return [...closestByBeach.values()];
      },
      loadWaterQuality: async (ids) => {
        const { data, error } = await supabase
          .from("beach_water_quality")
          .select("beach_id, status, latest_enterococcus, latest_fecal_coliform, latest_sample_date, exceedance_count_30d, total_samples_30d, status_reason, status_changed_at")
          .in("beach_id", ids)
          .limit(MY_COAST_FOLLOW_LIMIT);
        if (error) throw error;
        return (data ?? []).flatMap((row): MyCoastWaterQualitySourceRow[] => {
          if (![
            "good",
            "advisory",
            "closure",
            "unknown",
          ].includes(row.status)) return [];
          return [{
            beachId: row.beach_id,
            status: row.status as MyCoastWaterQualitySourceRow["status"],
            latestEnterococcus: row.latest_enterococcus,
            latestFecalColiform: row.latest_fecal_coliform,
            latestSampleDate: row.latest_sample_date,
            exceedanceCount30d: row.exceedance_count_30d,
            totalSamples30d: row.total_samples_30d,
            statusReason: row.status_reason,
            statusChangedAt: row.status_changed_at,
          }];
        });
      },
    });

    return createSuccessResponse(result);
  } catch (error) {
    return handleApiError(error, "Failed to load My Coast");
  }
}

export const GET = withNoStore(withRateLimit(myCoastHandler, "public-default"));
