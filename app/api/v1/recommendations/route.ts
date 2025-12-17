import { NextRequest } from "next/server";
import { createAPIServerClient } from "@/lib/supabase/api-server-client";
import { createSuccessResponse, handleApiError } from "@/lib/api-utils";
import { scoreRecommendation } from "@/lib/utils/recommendation-scorer";
import { withRateLimit } from "@/lib/middleware/rate-limiter";

export const dynamic = 'force-dynamic';

async function recommendationsHandler(request: NextRequest) {
  try {
    const apiStartTime = Date.now();
    const supabase = createAPIServerClient();
    const url = new URL(request.url);
    const latParam = url.searchParams.get("lat");
    const lonParam = url.searchParams.get("lon");
    const timeIso = url.searchParams.get("time") || new Date().toISOString();
    const userSkill = url.searchParams.get("skill") || null;

    if (!latParam || !lonParam) {
      return createSuccessResponse({ recommendations: [] });
    }

    const lat = Number(latParam);
    const lon = Number(lonParam);

    if (!isFinite(lat) || !isFinite(lon)) {
      return createSuccessResponse({ recommendations: [] });
    }

    // 1) Nearby beaches via PostGIS helper
    const postGisStart = Date.now();
    let beaches: any[] = [];
    const nearby = await supabase.rpc("get_nearby_beaches", {
      input_lat: lat,
      input_lng: lon,
      max_distance_meters: 25000,
      limit_count: 25,
    });
    if (!nearby.error) {
      beaches = nearby.data || [];
    } else {
      // Fallback to raw beaches table when rpc is missing
      const raw = await supabase.from("beaches").select("id,name,lat,lon").limit(25);
      beaches = raw.data || [];
    }
    const postGisTime = Date.now() - postGisStart;

    // 2) Pull forecast snapshot for given hour from marine_forecasts (new schema)
    const hourIso = new Date(timeIso);
    const dateStr = hourIso.toISOString().split("T")[0];
    const hour = hourIso.getUTCHours().toString().padStart(2, "0");

    // PERFORMANCE FIX: Batch fetch all forecasts with .in() to avoid N+1 queries
    // Before: 50 queries for 25 beaches (25 marine + 25 tide)
    // After: 2 queries total (1 marine + 1 tide)
    // OPTIMIZATION: Fetch only ±6 hours instead of full 24 hours (50% less data)
    const perfStart = Date.now();
    const beachIds = beaches.map(b => b.id);
    const windowStart = new Date(hourIso.getTime() - 6 * 60 * 60 * 1000).toISOString();
    const windowEnd = new Date(hourIso.getTime() + 6 * 60 * 60 * 1000).toISOString();

    // Fetch all marine and tide forecasts in parallel with a single query each
    const [marineResult, tideResult] = await Promise.all([
      supabase
        .from("marine_forecasts")
        .select("beach_id,ts,wave_height_m,wave_period_s,wind_speed_ms,wind_direction_deg,wave_direction_deg")
        .in("beach_id", beachIds)
        .gte("ts", windowStart)
        .lte("ts", windowEnd)
        .order("beach_id", { ascending: true })
        .order("ts", { ascending: true }),
      supabase
        .from("tide_forecasts")
        .select("beach_id,ts,tide_height_m")
        .in("beach_id", beachIds)
        .gte("ts", windowStart)
        .lte("ts", windowEnd)
        .order("beach_id", { ascending: true })
        .order("ts", { ascending: true })
    ]);

    const queryTime = Date.now() - perfStart;
    const marineRows = marineResult.data?.length || 0;
    const tideRows = tideResult.data?.length || 0;
    console.log(`[PERF] Forecast queries: ${queryTime}ms (marine: ${marineRows} rows, tide: ${tideRows} rows)`);

    // Group forecasts by beach_id for fast lookup
    const marineByBeach: Record<string, any[]> = {};
    const tideByBeach: Record<string, any[]> = {};

    (marineResult.data || []).forEach(row => {
      if (!marineByBeach[row.beach_id]) {
        marineByBeach[row.beach_id] = [];
      }
      marineByBeach[row.beach_id].push(row);
    });

    (tideResult.data || []).forEach(row => {
      if (!tideByBeach[row.beach_id]) {
        tideByBeach[row.beach_id] = [];
      }
      tideByBeach[row.beach_id].push(row);
    });

    // Helper functions for unit conversions
    const msToKts = (ms: number | null | undefined) =>
      ms == null ? null : Math.round(ms * 1.94384);
    const mToFt = (m: number | null | undefined) =>
      m == null ? null : Math.round(m * 3.28084 * 10) / 10;

    // Process each beach with pre-fetched data (no more queries!)
    const processingStart = Date.now();
    const rows = beaches.map((beach: any) => {
      const mrows = marineByBeach[beach.id] || [];
      const trows = tideByBeach[beach.id] || [];

      // Pick closest marine forecast point by timestamp
      let best: any = null;
      let minDiff = Infinity;
      for (const r of mrows) {
        const h = new Date(r.ts).getUTCHours();
        const d = Math.abs(h - Number(hour));
        if (d < minDiff) {
          minDiff = d;
          best = r;
        }
      }

      // Pick closest tide forecast point by timestamp
      let tidePoint: any = null;
      for (const r of trows) {
        const h = new Date(r.ts).getUTCHours();
        const d = Math.abs(h - Number(hour));
        if (!tidePoint || d < Math.abs(new Date(tidePoint.ts).getUTCHours() - Number(hour))) {
          tidePoint = r;
        }
      }

      // Map marine/tide snapshot to scorer inputs
      const snap = {
        wave_direction_deg: best?.wave_direction_deg ?? null,
        wind_direction_deg: best?.wind_direction_deg ?? null,
        wind_speed_kts: msToKts(best?.wind_speed_ms),
        tide_ft: mToFt(tidePoint?.tide_height_m ?? null),
        user_skill: userSkill,
      };

      const { score, reasons } = scoreRecommendation(beach, snap);

      const payload = {
        spotId: beach.id,
        name: beach.name,
        distance_km: beach.distance_km ?? null,
        score,
        reasons,
        wave: {
          ht_ft: mToFt(best?.wave_height_m) ?? null,
          period_s: best?.wave_period_s ?? null,
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
      };
      return payload;
    });

    rows.sort((a, b) => b.score - a.score);

    // Enrich response with top 3 picks and detailed snapshots
    const topPicks = rows.slice(0, 3);
    const allRecommendations = rows;

    // Add detailed snapshot information for top picks
    const enrichedTopPicks = topPicks.map((pick, index) => ({
      ...pick,
      rank: index + 1,
      isTopPick: true,
      snapshot: {
        timestamp: timeIso,
        conditions: {
          wave: pick.wave,
          wind: pick.wind,
          tide: pick.tide,
        },
        quality_indicators: {
          data_freshness: "current", // TODO: Calculate actual freshness
          confidence_level: pick.score >= 75 ? "high" : pick.score >= 50 ? "medium" : "low",
        },
      },
    }));

    const processingTime = Date.now() - processingStart;
    const totalTime = Date.now() - apiStartTime;

    // Performance breakdown logging
    console.log(`[PERF] PostGIS nearby beaches: ${postGisTime}ms`);
    console.log(`[PERF] Processing & scoring: ${processingTime}ms`);
    console.log(`[PERF] Total API time: ${totalTime}ms`);

    return createSuccessResponse({ 
      recommendations: allRecommendations,
      top_picks: enrichedTopPicks,
      metadata: {
        query_time: timeIso,
        location: { lat, lon },
        total_spots_analyzed: rows.length,
        user_skill: userSkill,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// Apply rate limiting to prevent N+1 query abuse
export const GET = withRateLimit(recommendationsHandler, "recommendations");

