import { NextRequest } from "next/server";
import { createAPIServerClient } from "@/lib/supabase/api-server-client";
import {
  createSuccessResponse,
  createValidationError,
  handleApiError,
} from "@/lib/api-utils";
import { scoreRecommendation } from "@/lib/utils/recommendation-scorer";
import { withRateLimit } from "@/lib/middleware/rate-limiter";
import type { Beach } from "@/types/database";
import type {
  BeachWithDistance,
  DegradationInfo,
  MarineForecastPoint,
  NearbyBeach,
  Recommendation,
  RecommendationsResponse,
  TideForecastPoint,
  TopPick,
} from "@/types/api/recommendations";
import {
  calculateConfidenceLevel,
  calculateDataFreshness,
  calculateForecastAgeHours,
  combineFreshness,
} from "@/lib/utils/forecast-freshness";

export const dynamic = "force-dynamic";

type ScoredRecommendation = Recommendation & {
  marine_created_at: string | null;
  tide_created_at: string | null;
};

function hasDegradation(degradation: DegradationInfo): boolean {
  return Object.keys(degradation).length > 0;
}

async function recommendationsHandler(request: NextRequest) {
  try {
    const DEBUG_RECOMMENDATIONS_PERF =
      process.env.DEBUG_RECOMMENDATIONS_PERF === "true" ||
      process.env.NEXT_PUBLIC_DEBUG_PERF === "true";

    const apiStartTime = Date.now();
    const supabase = createAPIServerClient();
    const url = new URL(request.url);

    const latParam = url.searchParams.get("lat");
    const lonParam = url.searchParams.get("lon");
    const timeParam = url.searchParams.get("time");
    const userSkill = url.searchParams.get("skill") || null;

    if (!latParam || !lonParam) {
      return createValidationError("Missing required parameters", {
        required: ["lat", "lon"],
        received: { lat: latParam, lon: lonParam },
      });
    }

    const lat = Number(latParam);
    const lon = Number(lonParam);

    if (!isFinite(lat) || !isFinite(lon)) {
      return createValidationError("Invalid coordinate format", {
        lat: latParam,
        lon: lonParam,
        reason: "Coordinates must be finite numbers",
      });
    }

    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return createValidationError("Coordinates out of valid range", {
        lat,
        lon,
        valid_range: { lat: [-90, 90], lon: [-180, 180] },
      });
    }

    if (timeParam && isNaN(Date.parse(timeParam))) {
      return createValidationError("Invalid time format", {
        time: timeParam,
        expected: "ISO 8601 timestamp",
      });
    }

    const timeIso = timeParam || new Date().toISOString();
    const queryTime = new Date(timeIso);

    // 1) Nearby beaches via PostGIS helper
    const postGisStart = Date.now();
    const degradation: DegradationInfo = {};
    let beaches: BeachWithDistance[] = [];

    const nearby = await supabase.rpc("get_nearby_beaches", {
      input_lat: lat,
      input_lng: lon,
      max_distance_meters: 25000,
      limit_count: 25,
    });

    if (!nearby.error) {
      const nearbyRows = (nearby.data || []) as NearbyBeach[];
      const distanceById = new Map<string, number>();
      const orderedIds: string[] = [];

      for (const row of nearbyRows) {
        if (row.is_private) continue;
        distanceById.set(row.id, row.distance_meters);
        orderedIds.push(row.id);
      }

      if (orderedIds.length > 0) {
        const beachResult = await supabase
          .from("beaches")
          .select("*")
          .in("id", orderedIds)
          .eq("is_private", false)
          .limit(25);

        const beachRows = (beachResult.data || []) as Beach[];
        const beachById = new Map(beachRows.map((b) => [b.id, b]));

        beaches = orderedIds
          .map((id): BeachWithDistance | null => {
            const b = beachById.get(id);
            if (!b) return null;

            const distance_meters = distanceById.get(id);
            const distance_km =
              typeof distance_meters === "number" ? distance_meters / 1000 : null;

            return {
              ...b,
              ...(typeof distance_meters === "number" && { distance_meters }),
              distance_km,
            };
          })
          .filter((b): b is BeachWithDistance => b != null);
      }
    } else {
      console.warn(
        "[DEGRADED] PostGIS RPC unavailable, using fallback query:",
        nearby.error
      );
      degradation.postgis_unavailable = true;
      degradation.fallback_to_simple_query = true;

      const raw = await supabase
        .from("beaches")
        .select("*")
        .eq("is_private", false)
        .limit(25);

      beaches = ((raw.data || []) as Beach[]).map((b) => ({
        ...b,
        distance_km: null,
      }));
    }

    const postGisTime = Date.now() - postGisStart;

    if (beaches.length === 0) {
      return createSuccessResponse<RecommendationsResponse>({
        recommendations: [],
        top_picks: [],
        metadata: {
          query_time: timeIso,
          location: { lat, lon },
          total_spots_analyzed: 0,
          user_skill: userSkill,
          ...(hasDegradation(degradation) && { degradation }),
        },
      });
    }

    // 2) Pull forecast snapshot for given hour from marine_forecasts/tide_forecasts
    const perfStart = Date.now();
    const beachIds = beaches.map((b) => b.id);
    const windowStart = new Date(
      queryTime.getTime() - 6 * 60 * 60 * 1000
    ).toISOString();
    const windowEnd = new Date(
      queryTime.getTime() + 6 * 60 * 60 * 1000
    ).toISOString();

    const [marineResult, tideResult] = await Promise.all([
      supabase
        .from("marine_forecasts")
        .select(
          "beach_id,ts,created_at,source,wave_height_m,wave_period_s,wind_speed_ms,wind_direction_deg,wave_direction_deg"
        )
        .in("beach_id", beachIds)
        .gte("ts", windowStart)
        .lte("ts", windowEnd)
        .order("beach_id", { ascending: true })
        .order("ts", { ascending: true }),
      supabase
        .from("tide_forecasts")
        .select("beach_id,ts,created_at,source,tide_height_m,tide_phase")
        .in("beach_id", beachIds)
        .gte("ts", windowStart)
        .lte("ts", windowEnd)
        .order("beach_id", { ascending: true })
        .order("ts", { ascending: true }),
    ]);

    const queryDurationMs = Date.now() - perfStart;
    const marineRows = marineResult.data?.length || 0;
    const tideRows = tideResult.data?.length || 0;

    if (marineResult.error || tideResult.error) {
      console.warn("[DEGRADED] Forecast fetch errors:", {
        marine: marineResult.error?.message,
        tide: tideResult.error?.message,
      });
      degradation.forecast_query_errors = {
        marine: marineResult.error?.message,
        tide: tideResult.error?.message,
      };
    }

    if (marineRows === 0 || tideRows === 0) {
      degradation.missing_forecasts = { marine: marineRows, tide: tideRows };
    }

    if (DEBUG_RECOMMENDATIONS_PERF) {
      console.warn(
        `[PERF] Forecast queries: ${queryDurationMs}ms (marine: ${marineRows} rows, tide: ${tideRows} rows)`
      );
    }

    const marineByBeach: Record<string, MarineForecastPoint[]> = {};
    const tideByBeach: Record<string, TideForecastPoint[]> = {};

    for (const row of (marineResult.data || []) as MarineForecastPoint[]) {
      (marineByBeach[row.beach_id] ||= []).push(row);
    }
    for (const row of (tideResult.data || []) as TideForecastPoint[]) {
      (tideByBeach[row.beach_id] ||= []).push(row);
    }

    // Helper functions for unit conversions
    const msToKts = (ms: number | null | undefined) =>
      ms == null ? null : Math.round(ms * 1.94384);
    const mToFt = (m: number | null | undefined) =>
      m == null ? null : Math.round(m * 3.28084 * 10) / 10;

    const processingStart = Date.now();
    const scored: ScoredRecommendation[] = beaches.map((beach) => {
      const mrows = marineByBeach[beach.id] || [];
      const trows = tideByBeach[beach.id] || [];

      let bestMarine: MarineForecastPoint | null = null;
      let bestMarineDiff = Infinity;
      for (const r of mrows) {
        const diffMs = Math.abs(new Date(r.ts).getTime() - queryTime.getTime());
        if (diffMs < bestMarineDiff) {
          bestMarineDiff = diffMs;
          bestMarine = r;
        }
      }

      let bestTide: TideForecastPoint | null = null;
      let bestTideDiff = Infinity;
      for (const r of trows) {
        const diffMs = Math.abs(new Date(r.ts).getTime() - queryTime.getTime());
        if (diffMs < bestTideDiff) {
          bestTideDiff = diffMs;
          bestTide = r;
        }
      }

      const snap = {
        wave_direction_deg: bestMarine?.wave_direction_deg ?? null,
        wind_direction_deg: bestMarine?.wind_direction_deg ?? null,
        wind_speed_kts: msToKts(bestMarine?.wind_speed_ms),
        tide_ft: mToFt(bestTide?.tide_height_m ?? null),
        user_skill: userSkill,
      };

      const { score, reasons } = scoreRecommendation(beach, snap);

      return {
        spotId: beach.id,
        name: beach.name,
        distance_km: beach.distance_km ?? null,
        score,
        reasons,
        wave: {
          ht_ft: mToFt(bestMarine?.wave_height_m) ?? null,
          period_s: bestMarine?.wave_period_s ?? null,
        },
        wind: {
          dir_deg: snap.wind_direction_deg,
          kts: snap.wind_speed_kts,
        },
        tide: {
          height_ft: snap.tide_ft,
          status: null,
        },
        best_time_window: null,
        marine_created_at: bestMarine?.created_at ?? null,
        tide_created_at: bestTide?.created_at ?? null,
      };
    });

    scored.sort((a, b) => b.score - a.score);

    const recommendations: Recommendation[] = scored.map(
      ({ marine_created_at, tide_created_at, ...rec }) => rec
    );

    const topPicks: TopPick[] = scored.slice(0, 3).map((pick, index) => {
      const { marine_created_at, tide_created_at, ...base } = pick;

      const marineFreshness = calculateDataFreshness(marine_created_at, queryTime);
      const tideFreshness = calculateDataFreshness(tide_created_at, queryTime);
      const dataFreshness = combineFreshness(marineFreshness, tideFreshness);

      const marineAge = calculateForecastAgeHours(marine_created_at, queryTime);
      const tideAge = calculateForecastAgeHours(tide_created_at, queryTime);
      const forecastAgeHours =
        marineAge == null && tideAge == null
          ? null
          : Math.max(marineAge ?? 0, tideAge ?? 0);

      return {
        ...base,
        rank: index + 1,
        isTopPick: true,
        snapshot: {
          timestamp: timeIso,
          conditions: {
            wave: base.wave,
            wind: base.wind,
            tide: base.tide,
          },
          quality_indicators: {
            data_freshness: dataFreshness,
            forecast_age_hours: forecastAgeHours,
            confidence_level: calculateConfidenceLevel(base.score, dataFreshness),
          },
        },
      };
    });

    const processingTime = Date.now() - processingStart;
    const totalTime = Date.now() - apiStartTime;

    if (DEBUG_RECOMMENDATIONS_PERF) {
      console.warn(`[PERF] PostGIS nearby beaches: ${postGisTime}ms`);
      console.warn(`[PERF] Processing & scoring: ${processingTime}ms`);
      console.warn(`[PERF] Total API time: ${totalTime}ms`);
    }

    return createSuccessResponse<RecommendationsResponse>({
      recommendations,
      top_picks: topPicks,
      metadata: {
        query_time: timeIso,
        location: { lat, lon },
        total_spots_analyzed: recommendations.length,
        user_skill: userSkill,
        ...(hasDegradation(degradation) && { degradation }),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// Apply rate limiting to prevent N+1 query abuse
export const GET = withRateLimit(recommendationsHandler, "recommendations");
