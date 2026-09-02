import type { NextRequest, NextResponse } from "next/server";
import { createAPIServerClient } from "@/lib/supabase/api-server-client";
import {
  createSuccessResponse,
  createValidationError,
  handleApiError,
  withRateLimit,
  withNoStore,
} from "@/lib/middleware/api-wrappers";
import { getVerifiedProfileExperience } from "@/lib/profile/skill-level";
import { rankBeaches } from "@/lib/recommendations/selection";
import {
  sanitizeLegacyV1RecommendationsForMajorEventHold,
  type SanitizedLegacyV1RecommendationsResponse,
} from "@/lib/recommendations/major-event-hold/adapters/legacy";
import { evaluateMajorEventHoldCandidates } from "@/lib/recommendations/major-event-hold/service";
import type { MajorEventHoldCandidate } from "@/lib/recommendations/major-event-hold/types";
import { scoreRecommendation } from "@/lib/utils/recommendation-scorer";
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
import { normalizeCoordinates } from "@/lib/types/coordinates";
import { msToKts, mToFt } from "@/lib/utils/unit-conversions";

export const dynamic = "force-dynamic";


type ScoredRecommendation = Recommendation & {
  marine_created_at: string | null;
  tide_created_at: string | null;
};

const RECOMMENDATION_BEACH_SELECT = `
  id,
  name,
  is_private,
  recommendation_eligible,
  skill_level,
  preferred_tide_ft_min,
  preferred_tide_ft_max,
  swell_window_min_deg,
  swell_window_max_deg,
  wind_offshore_deg,
  wind_offshore_tol_deg,
  wind_cross_shore_ok_kt,
  wind_onshore_bad_kt
`;
const RECOMMENDATION_CANDIDATE_LIMIT = 25;
const WATER_QUALITY_HOLD_OVERFETCH = 5;

function hasDegradation(degradation: DegradationInfo): boolean {
  return Object.keys(degradation).length > 0;
}

type ApiSupabaseClient = Awaited<ReturnType<typeof createAPIServerClient>>;
type RecommendationBeach = Beach & { recommendation_eligible?: boolean };


function buildLegacyV1Candidates(
  response: RecommendationsResponse,
): MajorEventHoldCandidate[] {
  const startsAt = response.metadata.query_time;
  const startsAtMs = Date.parse(startsAt);
  const endsAt = new Date(startsAtMs + 1).toISOString();
  return response.recommendations.map(({ spotId }) => ({
    candidateId: `legacy-v1:${spotId}:${startsAt}`,
    beachId: spotId,
    startsAt,
    endsAt,
  }));
}

async function sanitizeRecommendations(
  response: RecommendationsResponse,
  supabase: ApiSupabaseClient,
): Promise<SanitizedLegacyV1RecommendationsResponse> {
  const candidates = buildLegacyV1Candidates(response);
  const { profileExperience } = await getVerifiedProfileExperience(supabase);
  const decisions = await evaluateMajorEventHoldCandidates({
    candidates,
    profileExperience,
    applyWaterQualityHolds: true,
  });
  return sanitizeLegacyV1RecommendationsForMajorEventHold(
    response,
    candidates,
    decisions,
  );
}


async function recommendationsHandler(
  request: NextRequest,
): Promise<NextResponse> {
  try {
    const DEBUG_RECOMMENDATIONS_PERF =
      process.env.DEBUG_RECOMMENDATIONS_PERF === "true" ||
      process.env.NEXT_PUBLIC_DEBUG_PERF === "true";

    const apiStartTime = Date.now();
    const supabase = await createAPIServerClient();
    const url = new URL(request.url);

    const rawLat =
      url.searchParams.get("lat") ?? url.searchParams.get("latitude");
    const rawLon =
      url.searchParams.get("lon") ?? url.searchParams.get("longitude");
    const rawLng = url.searchParams.get("lng");

    const coords = normalizeCoordinates(
      {
        lat: rawLat,
        lon: rawLon,
        lng: rawLng,
        latitude: url.searchParams.get("latitude"),
        longitude: url.searchParams.get("longitude"),
      },
      { context: "GET /api/v1/recommendations" },
    );
    const timeParam = url.searchParams.get("time");
    const userSkill = url.searchParams.get("skill") || null;

    if (!coords) {
      const hasAnyCoordinateParams =
        rawLat != null ||
        rawLon != null ||
        rawLng != null ||
        url.searchParams.get("latitude") != null ||
        url.searchParams.get("longitude") != null;

      if (!hasAnyCoordinateParams) {
        return createValidationError("Missing required parameters", {
          required: ["lat", "lon"],
          received: { lat: rawLat, lon: rawLon, lng: rawLng },
        });
      }

      return createValidationError("Invalid coordinate format", {
        lat: rawLat,
        lon: rawLon,
        lng: rawLng,
        reason: "Coordinates must be finite numbers",
      });
    }

    const lat = coords.lat;
    const lon = coords.lon;

    if (!isFinite(lat) || !isFinite(lon)) {
      return createValidationError("Invalid coordinate format", {
        lat: String(lat),
        lon: String(lon),
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

    const queryTime = timeParam ? new Date(timeParam) : new Date();
    const timeIso = queryTime.toISOString();

    // 1) Nearby beaches via PostGIS helper
    const postGisStart = Date.now();
    const degradation: DegradationInfo = {};
    let beaches: BeachWithDistance[] = [];

    const nearby = await supabase.rpc("get_nearby_beaches", {
      input_lat: lat,
      input_lng: lon,
      max_distance_meters: 25000,
      limit_count:
        RECOMMENDATION_CANDIDATE_LIMIT + WATER_QUALITY_HOLD_OVERFETCH,
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
          .select(RECOMMENDATION_BEACH_SELECT)
          .in("id", orderedIds)
          .eq("is_private", false)
          .limit(
            RECOMMENDATION_CANDIDATE_LIMIT + WATER_QUALITY_HOLD_OVERFETCH,
          );

        const beachRows = (beachResult.data || []) as RecommendationBeach[];
        const beachById = new Map(beachRows.map((b) => [b.id, b]));

        beaches = orderedIds
          .map((id): BeachWithDistance | null => {
            const b = beachById.get(id);
            if (!b || b.recommendation_eligible === false) return null;

            const distance_meters = distanceById.get(id);
            const distance_km =
              typeof distance_meters === "number"
                ? distance_meters / 1000
                : null;

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
        nearby.error,
      );
      degradation.postgis_unavailable = true;
      degradation.fallback_to_simple_query = true;

      const raw = await supabase
        .from("beaches")
        .select(RECOMMENDATION_BEACH_SELECT)
        .eq("is_private", false)
        .limit(
          RECOMMENDATION_CANDIDATE_LIMIT + WATER_QUALITY_HOLD_OVERFETCH,
        );

      beaches = ((raw.data || []) as RecommendationBeach[])
        .filter((b) => b.recommendation_eligible !== false)
        .map((b) => ({
          ...b,
          distance_km: null,
        }));
    }

    const postGisTime = Date.now() - postGisStart;

    if (beaches.length === 0) {
      const response: RecommendationsResponse = {
        recommendations: [],
        top_picks: [],
        metadata: {
          query_time: timeIso,
          location: { lat, lon },
          total_spots_analyzed: 0,
          user_skill: userSkill,
          ...(hasDegradation(degradation) && { degradation }),
        },
      };
      return createSuccessResponse(
        await sanitizeRecommendations(response, supabase),
      );
    }

    // 2) Pull forecast snapshot for given hour from marine_forecasts/tide_forecasts
    const perfStart = Date.now();
    const beachIds = beaches.map((b) => b.id);
    const windowStart = new Date(
      queryTime.getTime() - 6 * 60 * 60 * 1000,
    ).toISOString();
    const windowEnd = new Date(
      queryTime.getTime() + 6 * 60 * 60 * 1000,
    ).toISOString();

    const [marineResult, tideResult] = await Promise.all([
      supabase
        .from("marine_forecasts")
        .select(
          "beach_id,ts,created_at,source,wave_height_m,wave_period_s,wind_speed_ms,wind_direction_deg,wave_direction_deg",
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
        `[PERF] Forecast queries: ${queryDurationMs}ms (marine: ${marineRows} rows, tide: ${tideRows} rows)`,
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

    const rankedScored = await rankBeaches(
      scored.map((recommendation) => ({
        id: recommendation.spotId,
        recommendation,
      })),
      {
        asOf: queryTime,
        compare: (a, b) => b.recommendation.score - a.recommendation.score,
      },
    );
    const orderedScored = rankedScored
      .map(({ recommendation }) => recommendation)
      .slice(0, RECOMMENDATION_CANDIDATE_LIMIT);

    const recommendations: Recommendation[] = orderedScored.map(
      ({ marine_created_at, tide_created_at, ...rec }) => rec,
    );

    const topPickPool: TopPick[] = orderedScored.map((pick, index) => {
      const { marine_created_at, tide_created_at, ...base } = pick;

      const marineFreshness = calculateDataFreshness(
        marine_created_at,
        queryTime,
      );
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
            confidence_level: calculateConfidenceLevel(
              base.score,
              dataFreshness,
            ),
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

    const response: RecommendationsResponse = {
      recommendations,
      top_picks: topPickPool,
      metadata: {
        query_time: timeIso,
        location: { lat, lon },
        total_spots_analyzed: recommendations.length,
        user_skill: userSkill,
        ...(hasDegradation(degradation) && { degradation }),
      },
    };
    return createSuccessResponse(
      await sanitizeRecommendations(response, supabase),
    );
  } catch (error) {
    return handleApiError(error);
  }
}

// Apply rate limiting to prevent N+1 query abuse
export const GET = withNoStore(
  withRateLimit(recommendationsHandler, "recommendations"),
);
