import { NextRequest, NextResponse } from "next/server";

import { compareToBigSwells, modelTracksBuoy, nearestBigSwellBuoy, type BigSwellBuoy } from "@/lib/big-swells";
import dataset from "@/lib/data/big-swells.json";
import { handleApiError, withRateLimit } from "@/lib/middleware/api-wrappers";
import type { RouteContext } from "@/lib/middleware/api-wrappers/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
// ECMWF WAM is the Open-Meteo wave model that returns PEAK period, the same measure as buoy DPD.
const FORECAST_MODEL = "ecmwf_wam025";
const BUOYS = dataset.stations as BigSwellBuoy[];

interface ForecastPeak {
  at: string;
  hsM: number;
  periodS: number | null;
  dirDeg: number | null;
}

async function fetchForecastPeak(buoy: BigSwellBuoy): Promise<ForecastPeak | null> {
  const url = new URL("https://marine-api.open-meteo.com/v1/marine");
  url.search = new URLSearchParams({
    latitude: String(buoy.lat),
    longitude: String(buoy.lon),
    hourly: "wave_height,wave_peak_period,wave_direction",
    models: FORECAST_MODEL,
    forecast_days: "7",
    timezone: "UTC",
  }).toString();

  try {
    // Model runs land every 6-12 h; one fetch per buoy per half hour serves every beach near it.
    const response = await fetch(url, { signal: AbortSignal.timeout(8_000), next: { revalidate: 1800 } });
    if (!response.ok) {
      console.warn("[big-swells] Open-Meteo HTTP failure", { status: response.status, buoy: buoy.id });
      return null;
    }
    const hourly = (await response.json())?.hourly;
    const from = Date.now() - 3_600_000;
    let peak: ForecastPeak | null = null;
    for (const [index, time] of (hourly?.time ?? []).entries()) {
      const hsM = hourly.wave_height?.[index];
      const at = new Date(`${time}Z`);
      if (typeof hsM !== "number" || at.getTime() < from) continue;
      if (peak && hsM <= peak.hsM) continue;
      peak = {
        at: at.toISOString(),
        hsM,
        periodS: hourly.wave_peak_period?.[index] ?? null,
        dirDeg: hourly.wave_direction?.[index] ?? null,
      };
    }
    return peak;
  } catch (error) {
    console.warn("[big-swells] Open-Meteo fetch failed", { buoy: buoy.id, error: String(error) });
    return null;
  }
}

// GET /api/beaches/[id]/big-swells - the biggest seas measured at the beach's nearest NDBC buoy,
// and where this week's forecast at that same buoy sits among them. buoy is null when no buoy
// with history is within 100 km.
async function bigSwellsHandler(_request: NextRequest, context?: RouteContext): Promise<NextResponse> {
  const { id } = (await context?.params) ?? {};
  if (!UUID_PATTERN.test(id ?? "")) {
    return NextResponse.json({ success: false, error: "Invalid beach id" }, { status: 400 });
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data: beach, error } = await supabase
      .from("beaches")
      .select("lat, lon")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) return handleApiError(error, "Failed to fetch beach");
    if (!beach || beach.lat === null || beach.lon === null) {
      return NextResponse.json({ success: false, error: "Beach not found" }, { status: 404 });
    }

    const match = nearestBigSwellBuoy(BUOYS, { lat: beach.lat, lon: beach.lon });
    // A sheltered buoy reads far below the open-water model cell, so its history can't be compared with the model.
    const peak = match && modelTracksBuoy(match.buoy) ? await fetchForecastPeak(match.buoy) : null;
    const data = match
      ? {
          buoy: {
            id: match.buoy.id,
            // NDBC names carry a location suffix ("New York Harbor Entrance - 15 NM SE of Breezy Point , NY").
            name: match.buoy.name.split(" - ")[0].trim(),
            distanceKm: Math.round(match.distanceKm),
            since: match.buoy.since,
            through: match.buoy.through,
          },
          bigHsM: match.buoy.bigHsM,
          biggest: match.buoy.biggest,
          recent: match.buoy.recent,
          forecast: peak ? { model: FORECAST_MODEL, ...peak, ...compareToBigSwells(peak.hsM, match.buoy) } : null,
        }
      : { buoy: null, bigHsM: null, biggest: [], recent: [], forecast: null };

    return NextResponse.json({ success: true, data });
  } catch (error) {
    return handleApiError(error, "Failed to load big swells");
  }
}

export const GET = withRateLimit(bigSwellsHandler, { key: "public-default" });
