import { createSuccessResponse, handleApiError } from "@/lib/api-utils";
import { validateCronRequest } from "@/lib/api-response-utils";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { CDIPService } from "@/lib/services/cdip-service";
import { NwsWindService } from "@/lib/services/nws-wind-service";
import {
  getNearestNDBCStation,
  fetchLatestNDBCObservation,
} from "@/lib/services/ndbc-service";
import {
  getNearestTideStation,
  fetchHourlyTidePredictions,
} from "@/lib/services/noaa-tide-service";
import { NOAACOOPSService } from "@/lib/services/noaa-coops-service";
import { fanOutTidePointsToBeaches } from "../../../../../lib/services/tide-forecast-batch-utils";
import SunCalc from "suncalc";

export const revalidate = 0;

type BeachRow = { id: string; name: string; lat: number; lon: number };
type TideStationMeta = { id: string; name: string; lat: number; lon: number };
type TidePoint = {
  ts: string;
  tide_height_m: number;
  tide_phase: string | null;
  source: string;
};

function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  if (chunkSize <= 0) return [items];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    out.push(items.slice(i, i + chunkSize));
  }
  return out;
}

function getSupabaseProjectRef(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  try {
    const hostname = new URL(url).hostname;
    return hostname.split(".")[0] ?? null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  try {
    if (!validateCronRequest(request)) {
      return new Response("Unauthorized", { status: 401 });
    }

    // Use service role to bypass RLS for scheduled upserts
    const supabase = createSupabaseServiceRoleClient();
    console.log("[Forecast Refresh] Starting", {
      timestamp: new Date().toISOString(),
      triggeredBy: request.headers.get("user-agent"),
      environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
      supabaseProjectRef: getSupabaseProjectRef(),
    });
    const url = new URL(request.url);
    const onlyBeachId = url.searchParams.get("beachId");
    const tidesBackfillMissing = url.searchParams.get("tidesBackfillMissing") === "1";

    let query = supabase.from("beaches").select(
      tidesBackfillMissing
        ? // Backfill mode: fetch a single nested tide row so we can detect "no tide rows" without N+1 queries.
          // Note: we only need any tide row, not the full set.
          "id, name, lat, lon, tide_forecasts(ts)"
        : "id, name, lat, lon"
    );

    query = query.not("lat", "is", null).not("lon", "is", null);

    if (onlyBeachId) {
      query = query.eq("id", onlyBeachId);
    }

    if (tidesBackfillMissing) {
      // Limit the nested tide_forecasts payload (latest row only).
      // This allows us to filter beaches that have never had tides written.
      query = query
        .order("ts", { foreignTable: "tide_forecasts", ascending: false })
        .limit(1, { foreignTable: "tide_forecasts" });
    }

    const { data: beaches, error: beachError } = await query;

    if (beachError) throw beachError;

    let totals = { marine: 0, tides: 0, sun: 0, beaches: beaches?.length || 0 };
    const cdip = new CDIPService();
    const nwsWind = new NwsWindService();
    const refreshedAt = new Date().toISOString();

    const allBeaches: BeachRow[] = (beaches || []).map((b: any) => ({
      id: b.id,
      name: b.name,
      lat: b.lat,
      lon: b.lon,
    }));

    const targetBeachesForTides: BeachRow[] = tidesBackfillMissing
      ? // In backfill mode, only target beaches with zero tide_forecasts rows.
        (beaches || [])
          .filter((b: any) => !b?.tide_forecasts || b.tide_forecasts.length === 0)
          .map((b: any) => ({
            id: b.id,
            name: b.name,
            lat: b.lat,
            lon: b.lon,
          }))
      : allBeaches;

    // If we're doing a one-time tide backfill, skip other ingest work (marine/wind/sun)
    // to keep the operation fast and focused.
    const shouldRunNonTideIngest = !tidesBackfillMissing;

    if (shouldRunNonTideIngest) {
      for (const b of allBeaches) {
      // Marine from NDBC/CDIP
      try {
        const marineRows: any[] = [];
        const ndbc = await getNearestNDBCStation(b.lat, b.lon);
        if (ndbc) {
          console.log("NDBC nearest station", {
            beach: b.name,
            beachId: b.id,
            stationId: ndbc.id,
            stationLat: ndbc.lat,
            stationLon: ndbc.lon,
          });
          const obs = await fetchLatestNDBCObservation(ndbc.id);
          if (obs) {
            marineRows.push({
              beach_id: b.id,
              ts: obs.ts,
              created_at: refreshedAt,
              wave_height_m: obs.wave_height_m,
              wave_period_s: obs.wave_period_s,
              wave_direction_deg: obs.wave_direction_deg,
              wind_speed_ms: obs.wind_speed_ms,
              wind_direction_deg: obs.wind_direction_deg,
              source: "ndbc",
              is_observed: true,
            });
          } else {
            console.info("NDBC latest observation not available", {
              beach: b.name,
              beachId: b.id,
              stationId: ndbc.id,
            });
          }
        }
        if (!marineRows.length) {
          const station = await cdip.getNearestStation(
            b.lat,
            b.lon,
            80
          );
          if (station) {
            const buoy = await cdip.fetchBuoyData(station);
            const points = buoy?.data || [];
            if (points.length > 0) {
              // Upsert up to last 24 hours of observations to increase coverage
              const cutoffMs = Date.now() - 24 * 60 * 60 * 1000;
              for (const p of points) {
                const ts = new Date(p.timestamp).toISOString();
                if (new Date(ts).getTime() < cutoffMs) continue;
                marineRows.push({
                  beach_id: b.id,
                  ts,
                  created_at: refreshedAt,
                  wave_height_m: p.significantWaveHeight
                    ? p.significantWaveHeight * 0.3048
                    : null,
                  wave_period_s: p.peakWavePeriod ?? null,
                  wave_direction_deg: p.peakWaveDirection ?? null,
                  wind_speed_ms: null,
                  wind_direction_deg: null,
                  source: "cdip",
                  is_observed: true,
                });
              }
            } else {
              console.warn("CDIP returned no recent data", {
                beach: b.name,
                beachId: b.id,
                station,
              });
            }
          }
        }
        if (marineRows.length) {
          const { error } = await supabase
            .from("marine_forecasts")
            .upsert(marineRows, { onConflict: "beach_id,ts,source" });
          if (!error) totals.marine += marineRows.length;
        }

        // Short-horizon persistence projection (no Open-Meteo). Carry forward latest observed
        try {
          const latestObserved = await supabase
            .from("marine_forecasts")
            .select(
              "ts,wave_height_m,wave_period_s,wave_direction_deg,source,is_observed"
            )
            .eq("beach_id", b.id)
            .eq("is_observed", true)
            .in("source", ["cdip", "ndbc"])
            .order("ts", { ascending: false })
            .limit(1)
            .single();

          const base = latestObserved.data as any | null;
          if (base && base.ts && (base.wave_height_m || base.wave_period_s || base.wave_direction_deg)) {
            const horizonHours = 12;
            const start = new Date();
            const roundedStart = new Date(Math.ceil(start.getTime() / 3600000) * 3600000);
            const projections: any[] = [];
            for (let h = 0; h <= horizonHours; h++) {
              const t = new Date(roundedStart.getTime() + h * 3600000);
              projections.push({
                beach_id: b.id,
                ts: t.toISOString(),
                created_at: refreshedAt,
                wave_height_m: base.wave_height_m ?? null,
                wave_period_s: base.wave_period_s ?? null,
                wave_direction_deg: base.wave_direction_deg ?? null,
                wind_speed_ms: null,
                wind_direction_deg: null,
                source: base.source === "ndbc" ? "ndbc_persistence" : "cdip_persistence",
                is_observed: false,
              });
            }

            if (projections.length) {
              const { error: pErr } = await supabase
                .from("marine_forecasts")
                .upsert(projections, { onConflict: "beach_id,ts,source" });
              if (!pErr) totals.marine += projections.length;
            }
          }
        } catch (projErr) {
          console.warn("marine persistence projection failed", b.name, projErr);
        }
      } catch (e) {
        console.warn("marine ingest error", b.name, e);
      }

      // Wind-only hourly rows from NOAA/NWS (fill missing wind for scoring; do not overwrite wave rows)
      try {
        const windowStart = new Date(Date.now() - 6 * 60 * 60 * 1000);
        const windowEnd = new Date(Date.now() + 36 * 60 * 60 * 1000);
        const windPoints = await nwsWind.fetchHourlyWindPoints({
          lat: b.lat,
          lon: b.lon,
          start: windowStart,
          end: windowEnd,
        });

        if (windPoints.length) {
          const windRows = windPoints.map((p) => ({
            beach_id: b.id,
            ts: p.ts,
            created_at: refreshedAt,
            wind_speed_ms: p.wind_speed_ms,
            wind_direction_deg: p.wind_direction_deg,
            wave_height_m: null,
            wave_period_s: null,
            wave_direction_deg: null,
            source: "nws_wind",
            is_observed: false,
          }));

          const { error } = await supabase
            .from("marine_forecasts")
            .upsert(windRows, { onConflict: "beach_id,ts,source" });

          if (!error) totals.marine += windRows.length;
        }
      } catch (e) {
        console.warn("nws wind ingest error", b.name, e);
      }

      // Sun times computed locally
      try {
        const today = new Date();
        for (let i = 0; i < 5; i++) {
          const d = new Date(today);
          d.setDate(today.getDate() + i);
          const times = SunCalc.getTimes(d, b.lat, b.lon);
          const row = {
            beach_id: b.id,
            date: d.toISOString().split("T")[0],
            sunrise_utc: times.sunrise?.toISOString() ?? null,
            sunset_utc: times.sunset?.toISOString() ?? null,
            source: "computed",
            created_at: refreshedAt,
          } as any;
          const { error } = await supabase
            .from("sun_times")
            .upsert([row], { onConflict: "beach_id,date,source" });
          if (!error) totals.sun += 1;
        }
      } catch (e) {
        console.warn("sun ingest error", b.name, e);
      }
    }
    }

    // Tides from NOAA T&C hourly (station-grouped; with CO-OPS hilo fallback -> interpolated hourly)
    try {
      const tideStartIso = new Date().toISOString();
      const tideEndDate = new Date();
      tideEndDate.setDate(tideEndDate.getDate() + 5);
      const tideEndIso = tideEndDate.toISOString();

      const nearestStationCache = new Map<string, TideStationMeta | null>();
      const predictionsCache = new Map<string, TidePoint[]>();
      const stationGroups = new Map<string, { station: TideStationMeta; beaches: BeachRow[] }>();
      const coops = new NOAACOOPSService();

      for (const b of targetBeachesForTides) {
        const key = `${b.lat},${b.lon}`;
        let st = nearestStationCache.get(key) ?? null;
        if (!nearestStationCache.has(key)) {
          st = (await getNearestTideStation(b.lat, b.lon)) as TideStationMeta | null;
          nearestStationCache.set(key, st);
        }
        if (!st) continue;
        const group = stationGroups.get(st.id);
        if (group) {
          group.beaches.push(b);
        } else {
          stationGroups.set(st.id, { station: st, beaches: [b] });
        }
      }

      const stationCounts = [...stationGroups.values()].map((g) => g.beaches.length);
      const maxBeachesPerStation =
        stationCounts.length ? Math.max(...stationCounts) : 0;
      console.log("[Forecast Refresh] Tide station grouping", {
        tidesBackfillMissing,
        beachesConsidered: targetBeachesForTides.length,
        stations: stationGroups.size,
        maxBeachesPerStation,
      });

      const fetchStationTidePoints = async (stationId: string): Promise<TidePoint[]> => {
        const cacheKey = `${stationId}|${tideStartIso.slice(0, 10)}|${tideEndIso.slice(0, 10)}`;
        const cached = predictionsCache.get(cacheKey);
        if (cached) return cached;

        // Primary: CO-OPS hourly predictions
        let points: TidePoint[] = [];
        try {
          const preds = await fetchHourlyTidePredictions(
            stationId,
            tideStartIso,
            tideEndIso
          );
          points = preds
            .filter(
              (p) =>
                p?.ts &&
                typeof p.tide_height_m === "number" &&
                isFinite(p.tide_height_m)
            )
            .map((p) => ({
              ts: p.ts,
              tide_height_m: p.tide_height_m,
              tide_phase: p.tide_phase ?? null,
              source: "noaa",
            }));
        } catch (err) {
          console.warn("NOAA hourly tide fetch failed", { stationId, err });
        }

        // Fallback: if hourly predictions are empty, fetch CO-OPS hilo extremes and interpolate hourly
        if (!points.length) {
          try {
            const coopsData = await coops.fetchCOOPSData(stationId, 5);
            const tides = (coopsData?.tides || [])
              .filter((t: any) => typeof t?.time === "number" && typeof t?.height === "number")
              .sort((a: any, b: any) => a.time - b.time);

            if (tides.length >= 2) {
              const startMs = new Date(tideStartIso).getTime();
              const endMs = new Date(tideEndIso).getTime();
              const hourMs = 60 * 60 * 1000;

              let nextIdx = 0;
              const toM = (ft: number) => ft * 0.3048;
              const interpolated: TidePoint[] = [];

              for (let tMs = startMs; tMs <= endMs; tMs += hourMs) {
                const tsSec = tMs / 1000;
                while (nextIdx < tides.length && tides[nextIdx].time < tsSec) {
                  nextIdx++;
                }
                const prev = tides[nextIdx - 1];
                const next = tides[nextIdx];
                if (!prev || !next) continue;

                const alpha = (tsSec - prev.time) / (next.time - prev.time);
                const hFt =
                  prev.height +
                  (next.height - prev.height) *
                    Math.max(0, Math.min(1, alpha));
                const hM = toM(hFt);
                if (!isFinite(hM)) continue;

                interpolated.push({
                  ts: new Date(tMs).toISOString(),
                  tide_height_m: Math.round(hM * 1000) / 1000,
                  tide_phase: null,
                  source: "noaa_hilo_interpolated",
                });
              }

              points = interpolated;
            }
          } catch (fallbackErr) {
            console.warn("CO-OPS fallback interpolation failed", {
              stationId,
              fallbackErr,
            });
          }
        }

        predictionsCache.set(cacheKey, points);
        return points;
      };

      for (const [stationId, group] of stationGroups.entries()) {
        try {
          const points = await fetchStationTidePoints(stationId);
          if (!points.length) {
            console.warn("NOAA tides empty for station", {
              stationId,
              beaches: group.beaches.length,
              tideStartIso,
              tideEndIso,
            });
            continue;
          }

          const beachIds = group.beaches.map((b) => b.id);
          const rows = fanOutTidePointsToBeaches({
            beachIds,
            points,
            createdAt: refreshedAt,
          });

          for (const chunk of chunkArray(rows, 1000)) {
            const { error } = await supabase
              .from("tide_forecasts")
              .upsert(chunk as any[], { onConflict: "beach_id,ts,source" });
            if (!error) totals.tides += chunk.length;
          }
        } catch (stationErr) {
          console.warn("Station tide ingest failed", {
            stationId,
            beaches: group.beaches.length,
            stationErr,
          });
        }
      }

      if (tidesBackfillMissing) {
        console.log("[Forecast Refresh] Tide backfill complete", {
          targetedBeaches: targetBeachesForTides.length,
          totalsTides: totals.tides,
        });
      }
    } catch (e) {
      console.warn("tide station-grouped ingest error", e);
    }

    return createSuccessResponse({ totals });
  } catch (error) {
    return handleApiError(error);
  }
}
