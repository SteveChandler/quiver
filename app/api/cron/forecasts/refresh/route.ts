import { createSuccessResponse, handleApiError } from "@/lib/api-utils";
import { validateCronRequest } from "@/lib/api-response-utils";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { CDIPService } from "@/lib/services/cdip-service";
import {
  getNearestNDBCStation,
  fetchLatestNDBCObservation,
} from "@/lib/services/ndbc-service";
import {
  getNearestTideStation,
  fetchHourlyTidePredictions,
} from "@/lib/services/noaa-tide-service";
import { NOAACOOPSService } from "@/lib/services/noaa-coops-service";
import SunCalc from "suncalc";

export const revalidate = 0;

export async function GET(request: Request) {
  try {
    if (!validateCronRequest(request)) {
      return new Response("Unauthorized", { status: 401 });
    }

    // Use service role to bypass RLS for scheduled upserts
    const supabase = createSupabaseServiceRoleClient();
    const url = new URL(request.url);
    const onlyBeachId = url.searchParams.get("beachId");

    let query = supabase
      .from("beaches")
      .select("id, name, latitude, longitude")
      .not("latitude", "is", null)
      .not("longitude", "is", null);

    if (onlyBeachId) {
      query = query.eq("id", onlyBeachId);
    }

    const { data: beaches, error: beachError } = await query;

    if (beachError) throw beachError;

    let totals = { marine: 0, tides: 0, sun: 0, beaches: beaches?.length || 0 };
    const cdip = new CDIPService();

    for (const b of beaches || []) {
      // Marine from NDBC/CDIP
      try {
        const marineRows: any[] = [];
        const ndbc = await getNearestNDBCStation(b.latitude, b.longitude);
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
            b.latitude,
            b.longitude,
            80
          );
          if (station) {
            const buoy = await cdip.fetchBuoyData(station);
            const latest = buoy?.data?.[0];
            if (latest) {
              marineRows.push({
                beach_id: b.id,
                ts: latest.timestamp,
                wave_height_m: latest.significantWaveHeight
                  ? latest.significantWaveHeight * 0.3048
                  : null,
                wave_period_s: latest.peakWavePeriod ?? null,
                wave_direction_deg: latest.peakWaveDirection ?? null,
                wind_speed_ms: null,
                wind_direction_deg: null,
                source: "cdip",
                is_observed: true,
              });
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
      } catch (e) {
        console.warn("marine ingest error", b.name, e);
      }

      // Tides from NOAA T&C hourly (with CO-OPS hilo fallback -> interpolated hourly)
      try {
        const start = new Date().toISOString();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + 5);
        const end = endDate.toISOString();
        const st = await getNearestTideStation(b.latitude, b.longitude);
        if (st) {
          console.log("NOAA tide nearest station", {
            beach: b.name,
            beachId: b.id,
            stationId: st.id,
          });
          let preds = await fetchHourlyTidePredictions(st.id, start, end);
          let rows = preds.map((p) => ({
            beach_id: b.id,
            ts: p.ts,
            tide_height_m: p.tide_height_m,
            tide_phase: p.tide_phase,
            source: "noaa",
          }));

          // Fallback: if hourly predictions are empty, fetch CO-OPS hilo extremes and interpolate hourly
          if (!rows.length) {
            try {
              const coops = new NOAACOOPSService();
              const coopsStation = st.id; // use the same station id if numeric, else fallback mapping inside service
              const coopsData = await coops.fetchCOOPSData(coopsStation, 5);
              const tides = coopsData?.tides || [];
              if (tides.length >= 2) {
                // Build hourly timestamps from start..end and interpolate heights (ft -> m)
                const startDt = new Date(start);
                const endDt = new Date(end);
                const hours: Date[] = [];
                for (let t = new Date(startDt); t <= endDt; t.setHours(t.getHours() + 1)) {
                  hours.push(new Date(t));
                }
                const toM = (ft: number) => (ft == null ? null : ft * 0.3048);
                const interpHeightAt = (d: Date): number | null => {
                  // find surrounding extremes
                  const ts = d.getTime() / 1000;
                  const sorted = [...tides].sort((a, b) => a.time - b.time);
                  let prev = null as any;
                  let next = null as any;
                  for (const ti of sorted) {
                    if (ti.time <= ts) prev = ti; else { next = ti; break; }
                  }
                  if (!prev || !next) return null;
                  const alpha = (ts - prev.time) / (next.time - prev.time);
                  const h = prev.height + (next.height - prev.height) * Math.max(0, Math.min(1, alpha));
                  return Math.round((toM(h) ?? 0) * 1000) / 1000;
                };
                const interpRows = hours
                  .map((d) => ({
                    beach_id: b.id,
                    ts: d.toISOString(),
                    tide_height_m: interpHeightAt(d),
                    tide_phase: null,
                    source: "noaa_hilo_interpolated",
                  }))
                  .filter((r) => r.tide_height_m != null);
                rows = interpRows;
              }
            } catch (fallbackErr) {
              console.warn("CO-OPS fallback failed", { beach: b.name, beachId: b.id, stationId: st.id, fallbackErr });
            }
          }

          if (rows.length) {
            const { error } = await supabase
              .from("tide_forecasts")
              .upsert(rows, { onConflict: "beach_id,ts,source" });
            if (!error) totals.tides += rows.length;
          } else {
            console.warn("NOAA tide predictions returned empty", {
              beach: b.name,
              beachId: b.id,
              stationId: st.id,
              start,
              end,
            });
          }
        }
      } catch (e) {
        console.warn("tide ingest error", b.name, e);
      }

      // Sun times computed locally
      try {
        const today = new Date();
        for (let i = 0; i < 5; i++) {
          const d = new Date(today);
          d.setDate(today.getDate() + i);
          const times = SunCalc.getTimes(d, b.latitude, b.longitude);
          const row = {
            beach_id: b.id,
            date: d.toISOString().split("T")[0],
            sunrise_utc: times.sunrise?.toISOString() ?? null,
            sunset_utc: times.sunset?.toISOString() ?? null,
            source: "computed",
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

    return createSuccessResponse({ totals });
  } catch (error) {
    return handleApiError(error);
  }
}
