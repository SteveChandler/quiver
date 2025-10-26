import { createSuccessResponse, handleApiError } from "@/lib/api-utils";
import { createAPIServerClient } from "@/lib/supabase/api-server-client";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import {
  getNearestTideStation,
  fetchHourlyTidePredictions,
} from "@/lib/services/noaa-tide-service";
import SunCalc from "suncalc";

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const beachId = url.searchParams.get("beachId");
    const startIso = url.searchParams.get("start");
    const endIso = url.searchParams.get("end");

    if (!beachId || !startIso || !endIso) {
      return handleApiError(
        new Error("Missing beachId/start/end"),
        "Missing parameters"
      );
    }

    const supabase = createAPIServerClient();
    const service = createSupabaseServiceRoleClient();

    // Fetch beach lat/lon for on-demand generation
    const { data: beachRow } = await supabase
      .from("beaches")
      .select("id, lat, lon")
      .eq("id", beachId)
      .single();

    let [marine, tides, sun] = await Promise.all([
      supabase
        .from("marine_forecasts")
        .select(
          "ts,wave_height_m,wave_period_s,wave_direction_deg,wind_speed_ms,wind_direction_deg,source,is_observed"
        )
        .eq("beach_id", beachId)
        .gte("ts", startIso)
        .lte("ts", endIso)
        .order("ts", { ascending: true }),
      supabase
        .from("tide_forecasts")
        .select("ts,tide_height_m,tide_phase,source")
        .eq("beach_id", beachId)
        .gte("ts", startIso)
        .lte("ts", endIso)
        .order("ts", { ascending: true }),
      supabase
        .from("sun_times")
        .select("date,sunrise_utc,sunset_utc,source")
        .eq("beach_id", beachId)
        .gte("date", startIso.split("T")[0])
        .lte("date", endIso.split("T")[0])
        .order("date", { ascending: true }),
    ]);

    // On-demand tide generation if missing
    if (beachRow && (!tides.data || tides.data.length === 0)) {
      const station = await getNearestTideStation(
        beachRow.latitude,
        beachRow.longitude
      );
      if (station) {
        try {
          const preds = await fetchHourlyTidePredictions(
            station.id,
            startIso,
            endIso
          );
          if (preds.length) {
            const rows = preds.map((p) => ({
              beach_id: beachId,
              ts: p.ts,
              tide_height_m: p.tide_height_m,
              tide_phase: p.tide_phase,
              source: "noaa",
            }));
            await service
              .from("tide_forecasts")
              .upsert(rows, { onConflict: "beach_id,ts,source" });
            tides = await supabase
              .from("tide_forecasts")
              .select("ts,tide_height_m,tide_phase,source")
              .eq("beach_id", beachId)
              .gte("ts", startIso)
              .lte("ts", endIso)
              .order("ts", { ascending: true });
          }
        } catch (e) {
          console.warn("Tide backfill failed", e);
        }
      }
    }

    // On-demand sun times generation if missing dates
    const startDate = startIso.split("T")[0];
    const endDate = endIso.split("T")[0];
    const neededDates = new Set<string>();
    if (beachRow) {
      // Collect all dates in range
      const d0 = new Date(startDate);
      const d1 = new Date(endDate);
      for (let d = new Date(d0); d <= d1; d.setDate(d.getDate() + 1)) {
        neededDates.add(d.toISOString().split("T")[0]);
      }
      const haveDates = new Set((sun.data || []).map((r: any) => r.date));
      const missing = Array.from(neededDates).filter((d) => !haveDates.has(d));
      if (missing.length) {
        try {
          const rows = missing.map((date) => {
            const y = Number(date.slice(0, 4));
            const m = Number(date.slice(5, 7)) - 1;
            const d = Number(date.slice(8, 10));
            const times = SunCalc.getTimes(
              new Date(Date.UTC(y, m, d)),
              beachRow.latitude,
              beachRow.longitude
            );
            return {
              beach_id: beachId,
              date,
              sunrise_utc: times.sunrise?.toISOString() ?? null,
              sunset_utc: times.sunset?.toISOString() ?? null,
              source: "computed",
            } as any;
          });
          await service.from("sun_times").upsert(rows, {
            onConflict: "beach_id,date,source",
          });
          sun = await supabase
            .from("sun_times")
            .select("date,sunrise_utc,sunset_utc,source")
            .eq("beach_id", beachId)
            .gte("date", startDate)
            .lte("date", endDate)
            .order("date", { ascending: true });
        } catch (e) {
          console.warn("Sun times backfill failed", e);
        }
      }
    }

    // Add convenience local-time fields (America/Los_Angeles for now)
    const tz = "America/Los_Angeles";
    const withLocalSun = (sun.data || []).map((r: any) => {
      const sunriseLocal = r.sunrise_utc
        ? new Date(r.sunrise_utc).toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            timeZone: tz,
          })
        : null;
      const sunsetLocal = r.sunset_utc
        ? new Date(r.sunset_utc).toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            timeZone: tz,
          })
        : null;
      return { ...r, sunrise_local: sunriseLocal, sunset_local: sunsetLocal };
    });

    const data = {
      marine: marine.data || [],
      tides: tides.data || [],
      sun: withLocalSun,
    };

    return createSuccessResponse(data);
  } catch (error) {
    return handleApiError(error);
  }
}
