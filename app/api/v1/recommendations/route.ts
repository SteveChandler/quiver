import { NextRequest } from "next/server";
import { createAPIServerClient } from "@/lib/supabase/api-server-client";
import { createSuccessResponse, handleApiError } from "@/lib/api-utils";
import { scoreRecommendation } from "@/lib/utils/recommendation-scorer";

export async function GET(request: NextRequest) {
  try {
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
    let beaches: any[] = [];
    const nearby = await supabase.rpc("get_nearby_beaches", {
      lat,
      lng: lon,
      max_distance_meters: 25000,
      limit_count: 25,
    });
    if (!nearby.error) {
      beaches = nearby.data || [];
    } else {
      // Fallback to raw beaches table when rpc is missing
      const raw = await supabase.from("beaches").select("id,name,latitude,longitude").limit(25);
      beaches = raw.data || [];
    }

    // 2) Pull forecast snapshot for given hour from marine_forecasts (new schema)
    const hourIso = new Date(timeIso);
    const dateStr = hourIso.toISOString().split("T")[0];
    const hour = hourIso.getUTCHours().toString().padStart(2, "0");

    // Batch fetch per beach in parallel (limit concurrency implicitly by list size)
    const rows = await Promise.all(
      beaches.map(async (beach: any) => {
        // Get marine forecasts for the day and select closest hour
        const dayStart = new Date(dateStr + "T00:00:00Z").toISOString();
        const dayEnd = new Date(dateStr + "T23:59:59Z").toISOString();
        const mf = await supabase
          .from("marine_forecasts")
          .select("ts,wave_height_m,wave_period_s,wind_speed_ms,wind_direction_deg,wave_direction_deg")
          .eq("beach_id", beach.id)
          .gte("ts", dayStart)
          .lte("ts", dayEnd)
          .order("ts", { ascending: true });
        const mrows = mf.data || [];

        // Pick closest point by timestamp
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

        // Optional tide snapshot for the same day
        let tidePoint: any = null;
        const tf = await supabase
          .from("tide_forecasts")
          .select("ts,tide_height_m")
          .eq("beach_id", beach.id)
          .gte("ts", dayStart)
          .lte("ts", dayEnd)
          .order("ts", { ascending: true });
        const trows = tf.data || [];
        for (const r of trows) {
          const h = new Date(r.ts).getUTCHours();
          const d = Math.abs(h - Number(hour));
          if (!tidePoint || d < Math.abs(new Date(tidePoint.ts).getUTCHours() - Number(hour))) {
            tidePoint = r;
          }
        }

        // Map to snapshot inputs; wave direction not stored as degrees in table yet
        // Map marine/tide snapshot to scorer inputs
        const msToKts = (ms: number | null | undefined) =>
          ms == null ? null : Math.round(ms * 1.94384);
        const mToFt = (m: number | null | undefined) =>
          m == null ? null : Math.round(m * 3.28084 * 10) / 10;

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
      })
    );

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


