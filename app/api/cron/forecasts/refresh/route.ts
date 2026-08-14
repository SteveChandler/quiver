import {
  createErrorResponse,
  createSuccessResponse,
  handleApiError,
  validateCronRequest,
} from "@/lib/middleware/api-wrappers";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { CDIPService } from "@/lib/services/cdip";
import { NwsWindService } from "@/lib/services/nws-wind-service";
import {
  getNearestNDBCStation,
  fetchLatestNDBCObservation,
} from "@/lib/services/ndbc-service";
import {
  getNearestTideStation,
  fetchHourlyTidePredictions,
} from "@/lib/services/noaa-tide-service";
import { NOAACOOPSService } from "@/lib/services/noaa-coops";
import { fanOutTidePointsToBeaches } from "../../../../../lib/services/tide-forecast-batch-utils";
import SunCalc from "suncalc";
import { withObservedCron } from "@/lib/cron/observability";
import { withCronOutcome } from "@/lib/cron/outcome";

export const revalidate = 0;
// Vercel cron functions have a 5 minute hard limit
export const maxDuration = 300;

const MAX_DURATION_SECONDS = 300;
const DEFAULT_SAFETY_MARGIN_MS = 20_000;

function getCronDeadlineMs(): { deadlineMs: number; timeBudgetMs: number; safetyMarginMs: number } {
  const hardLimitMs = MAX_DURATION_SECONDS * 1000;
  const safetyMarginMs = Number(process.env.FORECAST_CRON_SAFETY_MARGIN_MS ?? DEFAULT_SAFETY_MARGIN_MS);
  const overrideBudgetMsRaw = process.env.FORECAST_CRON_TIME_BUDGET_MS;
  const overrideBudgetMs =
    overrideBudgetMsRaw != null && overrideBudgetMsRaw.trim() !== ""
      ? Number(overrideBudgetMsRaw)
      : null;

  const computedBudgetMs = hardLimitMs - safetyMarginMs;
  const requestedBudgetMs =
    overrideBudgetMs != null && Number.isFinite(overrideBudgetMs) ? overrideBudgetMs : computedBudgetMs;

  // Never exceed the hard limit; also never go negative.
  const timeBudgetMs = Math.max(0, Math.min(hardLimitMs, requestedBudgetMs));
  return { deadlineMs: Date.now() + timeBudgetMs, timeBudgetMs, safetyMarginMs };
}

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

async function _GET(request: Request): Promise<Response> {
  try {
    if (!validateCronRequest(request)) {
      return createErrorResponse("Unauthorized", "Invalid cron authentication", 401);
    }

    const { deadlineMs, timeBudgetMs, safetyMarginMs } = getCronDeadlineMs();
    const hasDeadline = typeof deadlineMs === "number" && Number.isFinite(deadlineMs);
    const msRemaining = () =>
      hasDeadline ? (deadlineMs as number) - Date.now() : Number.POSITIVE_INFINITY;
    const shouldStop = () => hasDeadline && msRemaining() <= 0;

    // Use service role to bypass RLS for scheduled upserts
    const supabase = createSupabaseServiceRoleClient();
    console.log("[Forecast Refresh] Starting", {
      timestamp: new Date().toISOString(),
      triggeredBy: request.headers.get("user-agent"),
      environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
      supabaseProjectRef: getSupabaseProjectRef(),
      timeBudgetMs,
      safetyMarginMs,
      deadlineMs,
    });
    type RefreshSource = "all" | "marine" | "tide" | "sun";
    const url = new URL(request.url);
    const onlyBeachId = url.searchParams.get("beachId");
    const tidesBackfillMissing = url.searchParams.get("tidesBackfillMissing") === "1";
    const sourceParam = (url.searchParams.get("source") ?? "all").toLowerCase();
    const maxBeachesParam = url.searchParams.get("maxBeaches");

    const source: RefreshSource =
      sourceParam === "marine" || sourceParam === "tide" || sourceParam === "sun" || sourceParam === "all"
        ? (sourceParam as RefreshSource)
        : "all";

    const parsedMaxBeaches =
      maxBeachesParam != null && maxBeachesParam.trim() !== ""
        ? Number.parseInt(maxBeachesParam, 10)
        : null;
    const maxBeaches =
      parsedMaxBeaches != null && Number.isFinite(parsedMaxBeaches) && parsedMaxBeaches > 0
        ? parsedMaxBeaches
        : Number(process.env.FORECAST_REFRESH_MAX_BEACHES ?? 0) || null;

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

    const runMarine = shouldRunNonTideIngest && (source === "all" || source === "marine");
    const runSun = shouldRunNonTideIngest && (source === "all" || source === "sun");
    const runTide = source === "all" || source === "tide" || tidesBackfillMissing;

    // Select stale beaches for each source to keep each cron run bounded and predictable.
    const nowMs = Date.now();
    const MARINE_FRESHNESS_WINDOW_HOURS = Number(process.env.FORECAST_MARINE_FRESHNESS_WINDOW_HOURS ?? 3);
    const TIDE_FRESHNESS_WINDOW_HOURS = Number(process.env.FORECAST_TIDE_FRESHNESS_WINDOW_HOURS ?? 24);
    // Sun times freshness: 48 hours ensures cron refreshes every 2 days
    // Since the cron populates 5 days at a time, this provides 3+ days of buffer
    // Previously 168 hours (7 days) caused stale sunset data bugs
    const SUN_FRESHNESS_WINDOW_HOURS = Number(process.env.FORECAST_SUN_FRESHNESS_WINDOW_HOURS ?? 48);

    const selectStaleBeaches = async (args: {
      view: "v_marine_forecast_latest" | "v_tide_forecast_latest" | "v_sun_times_latest";
      tsField: "created_at";
      windowHours: number;
      beaches: BeachRow[];
      maxBeaches: number;
    }): Promise<BeachRow[]> => {
      const staleThresholdMs = nowMs - args.windowHours * 60 * 60 * 1000;
      const latestByBeachMs = new Map<string, number>();

      const { data, error } = await supabase
        .from(args.view)
        .select(`beach_id, ${args.tsField}`);
      if (error) throw error;

      for (const row of (data ?? []) as any[]) {
        const beachId = row?.beach_id as string | undefined;
        const ts = row?.[args.tsField] as string | undefined;
        if (!beachId || !ts) continue;
        const ms = new Date(ts).getTime();
        if (!Number.isFinite(ms)) continue;
        latestByBeachMs.set(beachId, ms);
      }

      const missing = args.beaches.filter((b) => !latestByBeachMs.has(b.id));
      const stale = args.beaches
        .filter((b) => {
          const ms = latestByBeachMs.get(b.id);
          return Boolean(ms && ms < staleThresholdMs);
        })
        .sort((a, b) => (latestByBeachMs.get(a.id) ?? 0) - (latestByBeachMs.get(b.id) ?? 0));

      const selected = [...missing, ...stale].slice(0, args.maxBeaches);
      return selected;
    };

    const effectiveMaxBeaches =
      maxBeaches != null
        ? maxBeaches
        : source === "tide"
          ? 60
          : source === "marine"
            ? 60
            : source === "sun"
              ? 261
              : 60;

    const selectedMarineBeaches = runMarine
      ? await selectStaleBeaches({
          view: "v_marine_forecast_latest",
          tsField: "created_at",
          windowHours: MARINE_FRESHNESS_WINDOW_HOURS,
          beaches: allBeaches,
          maxBeaches: Math.min(effectiveMaxBeaches, allBeaches.length),
        })
      : [];

    const selectedSunBeaches = runSun
      ? await selectStaleBeaches({
          view: "v_sun_times_latest",
          tsField: "created_at",
          windowHours: SUN_FRESHNESS_WINDOW_HOURS,
          beaches: allBeaches,
          maxBeaches: Math.min(effectiveMaxBeaches, allBeaches.length),
        })
      : [];

    const selectedTideBeaches =
      runTide && !tidesBackfillMissing
        ? await selectStaleBeaches({
            view: "v_tide_forecast_latest",
            tsField: "created_at",
            windowHours: TIDE_FRESHNESS_WINDOW_HOURS,
            beaches: targetBeachesForTides,
            maxBeaches: Math.min(effectiveMaxBeaches, targetBeachesForTides.length),
          })
        : targetBeachesForTides;

    if (shouldRunNonTideIngest) {
      const BATCH_SIZE = Number(process.env.FORECAST_REFRESH_BATCH_SIZE ?? process.env.FORECAST_BATCH_SIZE ?? 3);
      const BATCH_DELAY_MS = Number(process.env.FORECAST_REFRESH_BATCH_DELAY_MS ?? process.env.FORECAST_BATCH_DELAY_MS ?? 1000);

      if (runMarine) {
        console.log("[Forecast Refresh] Marine selection", {
          selected: selectedMarineBeaches.length,
          windowHours: MARINE_FRESHNESS_WINDOW_HOURS,
          maxBeaches: Math.min(effectiveMaxBeaches, allBeaches.length),
        });
      }
      if (runSun) {
        console.log("[Forecast Refresh] Sun selection", {
          selected: selectedSunBeaches.length,
          windowHours: SUN_FRESHNESS_WINDOW_HOURS,
          maxBeaches: Math.min(effectiveMaxBeaches, allBeaches.length),
        });
      }

      const batches = chunkArray(
        // If both marine + sun are requested, run marine selection set (it’s likely superset during recovery).
        runMarine ? selectedMarineBeaches : selectedSunBeaches,
        BATCH_SIZE
      );

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        if (shouldStop()) {
          console.warn("[Forecast Refresh] Stopping early due to time budget", {
            batchIndex,
            totalBatches: batches.length,
            remainingMs: msRemaining(),
          });
          break;
        }

        const batch = batches[batchIndex] ?? [];
        const results = await Promise.allSettled(
          batch.map(async (b) => {
            let addedMarine = 0;
            let addedSun = 0;

            if (runMarine) {
              // Marine from NDBC/CDIP
              try {
                const marineRows: any[] = [];
                const ndbc = await getNearestNDBCStation(b.lat, b.lon);
                if (ndbc) {
                  const obs = await fetchLatestNDBCObservation(ndbc.id);
                  // Only use observations with valid wave height data
                  if (obs && obs.wave_height_m !== null) {
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
                  }
                }
                if (!marineRows.length) {
                  const station = await cdip.getNearestStation(b.lat, b.lon, 80);
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
                          wave_height_m: p.significantWaveHeight ? p.significantWaveHeight * 0.3048 : null,
                          wave_period_s: p.peakWavePeriod ?? null,
                          wave_direction_deg: p.peakWaveDirection ?? null,
                          wind_speed_ms: null,
                          wind_direction_deg: null,
                          source: "cdip",
                          is_observed: true,
                        });
                      }
                    }
                  }
                }
                if (marineRows.length) {
                  const { error } = await supabase
                    .from("marine_forecasts")
                    .upsert(marineRows, { onConflict: "beach_id,ts,source" });
                  if (!error) addedMarine += marineRows.length;
                }

                // Short-horizon persistence projection (no Open-Meteo). Carry forward latest observed
                try {
                  const latestObserved = await supabase
                    .from("marine_forecasts")
                    .select("ts,wave_height_m,wave_period_s,wave_direction_deg,source,is_observed")
                    .eq("beach_id", b.id)
                    .eq("is_observed", true)
                    .in("source", ["cdip", "ndbc"])
                    .order("ts", { ascending: false })
                    .limit(1)
                    .maybeSingle();

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
                      if (!pErr) addedMarine += projections.length;
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

                  if (!error) addedMarine += windRows.length;
                }
              } catch (e) {
                console.warn("nws wind ingest error", b.name, e);
              }
            }

            if (runSun) {
              // Sun times computed locally - populate 7 days for buffer
              try {
                const today = new Date();
                for (let i = 0; i < 7; i++) {
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
                  if (error) {
                    console.error("[Sun Times] Upsert error for beach", b.name, {
                      beachId: b.id,
                      date: row.date,
                      lat: b.lat,
                      lon: b.lon,
                      error: error.message,
                      code: error.code,
                      details: error.details,
                      hint: error.hint,
                    });
                  } else {
                    addedSun += 1;
                  }
                }
              } catch (e) {
                console.warn("sun ingest error", b.name, e);
              }
            }

            return { addedMarine, addedSun };
          })
        );

        for (const r of results) {
          if (r.status === "fulfilled") {
            totals.marine += r.value.addedMarine;
            totals.sun += r.value.addedSun;
          }
        }

        if (batchIndex < batches.length - 1) {
          if (hasDeadline && msRemaining() <= BATCH_DELAY_MS) {
            console.warn("[Forecast Refresh] Skipping batch delay and stopping early due to time budget", {
              batchIndex,
              remainingMs: msRemaining(),
            });
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
        }
      }
    }

    // Tides from NOAA T&C hourly (station-grouped; with CO-OPS hilo fallback -> interpolated hourly)
    // Tides are deterministic astronomical predictions - fetch 30 days and refresh twice weekly
    try {
      const tideStartIso = new Date().toISOString();
      const tideEndDate = new Date();
      // Fetch 30 days of tide predictions (deterministic data that doesn't change)
      const TIDE_FORECAST_DAYS = Number(process.env.TIDE_FORECAST_DAYS ?? 30);
      tideEndDate.setDate(tideEndDate.getDate() + TIDE_FORECAST_DAYS);
      const tideEndIso = tideEndDate.toISOString();

      const nearestStationCache = new Map<string, TideStationMeta | null>();
      const predictionsCache = new Map<string, TidePoint[]>();
      const stationGroups = new Map<string, { station: TideStationMeta; beaches: BeachRow[] }>();
      const coops = new NOAACOOPSService();

      if (runTide) {
        console.log("[Forecast Refresh] Tide selection", {
          tidesBackfillMissing,
          selected: selectedTideBeaches.length,
          windowHours: TIDE_FRESHNESS_WINDOW_HOURS,
          maxBeaches: Math.min(effectiveMaxBeaches, targetBeachesForTides.length),
        });
      }

      for (const b of selectedTideBeaches) {
        if (!runTide) break;
        if (shouldStop()) {
          console.warn("[Forecast Refresh] Stopping early due to time budget (before tide station grouping)", {
            remainingMs: msRemaining(),
          });
          break;
        }
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
        beachesConsidered: selectedTideBeaches.length,
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
            const coopsData = await coops.fetchCOOPSData(stationId, TIDE_FORECAST_DAYS);
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
        if (shouldStop()) {
          console.warn("[Forecast Refresh] Stopping early due to time budget (before tide station fetch)", {
            stationId,
            remainingMs: msRemaining(),
          });
          break;
        }
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
            stationId,
          });

          for (const chunk of chunkArray(rows, 1000)) {
            if (shouldStop()) {
              console.warn("[Forecast Refresh] Stopping early due to time budget (before tide upsert)", {
                stationId,
                remainingMs: msRemaining(),
              });
              break;
            }
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

    const unit =
      source === "marine"
        ? "marine_forecasts_written"
        : source === "tide"
          ? "tide_forecasts_written"
          : source === "sun"
            ? "sun_events_written"
            : "forecast_rows_written";
    return createSuccessResponse(await withCronOutcome(
      {
        job: `/api/cron/forecasts/refresh?source=${source}`,
        unit,
        expectedMin: 1,
        getProduced: (value) => {
          if (source === "marine") return value.totals.marine;
          if (source === "tide") return value.totals.tides;
          if (source === "sun") return value.totals.sun;
          return value.totals.marine + value.totals.tides + value.totals.sun;
        },
        legitimatelyZero: (value) =>
          value.totals.beaches === 0
            ? { reason: "No beaches with coordinates were targeted by this refresh" }
            : undefined,
      },
      async () => ({ totals }),
    ));
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withObservedCron("/api/cron/forecasts/refresh", _GET);
