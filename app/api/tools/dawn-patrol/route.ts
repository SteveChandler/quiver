import { NextRequest, NextResponse } from "next/server";
import { createPublicReadClient } from "@/lib/supabase/server";
import {
  fetchCachedHourlyTidePredictions,
  fetchHourlyTidePredictions,
  getNearestTideStation,
  hasSufficientCachedTideCoverage,
  type CachedTidePredictionsResult,
  type TidePrediction,
} from "@/lib/services/noaa-tide-service";
import { COOPS_STATIONS } from "@/lib/services/noaa-coops/constants/station-mappings";
import { withRateLimit } from "@/lib/middleware/api-wrappers";
import SunCalc from "suncalc";

export const dynamic = "force-dynamic";

type TideToolDataSource = "cache" | "noaa_live" | null;

/**
 * Compute civil twilight, sunrise, golden hour, and sunset for a location and date.
 * Falls back to sun_times table for sunrise/sunset, uses SunCalc for civil twilight.
 */
function computeSunTimes(
  lat: number,
  lon: number,
  date: Date
): {
  civilTwilight: string | null;
  sunrise: string | null;
  sunset: string | null;
  goldenHour: string | null;
} {
  const times = SunCalc.getTimes(date, lat, lon);

  const toISO = (d: Date | undefined): string | null => {
    if (!d || isNaN(d.getTime())) return null;
    return d.toISOString();
  };

  // dawn = civil twilight start (nauticalDawn is too dark; use "dawn" from SunCalc)
  return {
    civilTwilight: toISO(times.dawn),
    sunrise: toISO(times.sunrise),
    sunset: toISO(times.sunset),
    goldenHour: toISO(times.goldenHour),
  };
}

async function resolveStationId(params: {
  slug: string;
  lat: number;
  lon: number;
}): Promise<string | null> {
  const mappedStationId = COOPS_STATIONS[params.slug];
  if (mappedStationId) return mappedStationId;

  try {
    const nearest = await getNearestTideStation(params.lat, params.lon);
    return nearest?.id ?? null;
  } catch (error) {
    console.warn("[dawn-patrol] Failed to resolve nearest tide station", {
      beachSlug: params.slug,
      error,
    });
    return null;
  }
}

/**
 * GET /api/tools/dawn-patrol?beachSlug=la-jolla&beachId=uuid
 *
 * Returns 7-day dawn patrol data:
 * - Civil twilight, sunrise, golden hour, sunset per day
 * - Tide state at civil twilight for each day
 * - Wind direction at dawn (not yet — requires open-meteo integration)
 */
async function dawnPatrolHandler(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const beachSlug = searchParams.get("beachSlug");
  const beachId = searchParams.get("beachId");

  if (!beachSlug && !beachId) {
    return NextResponse.json(
      { error: "beachSlug or beachId required" },
      { status: 400 }
    );
  }

  try {
    const supabase = createPublicReadClient();

    let beachQuery = supabase
      .from("beaches")
      .select("id, name, slug, lat, lon, city, state, timezone");

    if (beachId) {
      beachQuery = beachQuery.eq("id", beachId);
    } else {
      beachQuery = beachQuery.eq("slug", beachSlug!);
    }

    const { data: beach, error: beachError } = await beachQuery
      .or("is_private.is.null,is_private.eq.false")
      .maybeSingle();

    if (beachError || !beach) {
      return NextResponse.json({ error: "Beach not found" }, { status: 404 });
    }

    const lat = beach.lat;
    const lon = beach.lon;

    if (!lat || !lon) {
      return NextResponse.json(
        { error: "Beach coordinates unavailable" },
        { status: 422 }
      );
    }

    // Build 7-day array
    const now = new Date();
    const days: Array<{
      date: string;
      civilTwilight: string | null;
      sunrise: string | null;
      sunset: string | null;
      goldenHour: string | null;
    }> = [];

    for (let i = 0; i < 7; i++) {
      const day = new Date(now);
      day.setDate(now.getDate() + i);
      day.setHours(12, 0, 0, 0); // noon for SunCalc accuracy

      const sun = computeSunTimes(lat, lon, day);
      days.push({
        date: day.toISOString().slice(0, 10),
        ...sun,
      });
    }

    const endDate = new Date(now);
    endDate.setDate(now.getDate() + 7);
    const startIso = now.toISOString();
    const endIso = endDate.toISOString();

    let cachedTides: CachedTidePredictionsResult = {
      predictions: [],
      latestCreatedAt: null,
    };
    try {
      cachedTides = await fetchCachedHourlyTidePredictions(
        supabase,
        beach.id,
        startIso,
        endIso
      );
    } catch (cacheError) {
      console.warn("[dawn-patrol] Cached tide lookup failed; using NOAA fallback", {
        beachId: beach.id,
        cacheError,
      });
    }

    const cacheHasCoverage = hasSufficientCachedTideCoverage(
      cachedTides.predictions,
      startIso,
      endIso
    );
    let tidePredictions: TidePrediction[] = cachedTides.predictions;
    let dataSource: TideToolDataSource = cacheHasCoverage ? "cache" : null;
    let predictionsUpdatedAt: string | null = cacheHasCoverage
      ? cachedTides.latestCreatedAt
      : null;

    const slug = beach.slug as string;
    const mappedStationId = COOPS_STATIONS[slug] ?? null;
    let stationId: string | null = mappedStationId;
    if (!cacheHasCoverage && !stationId) {
      stationId = await resolveStationId({ slug, lat, lon });
    }

    if (!cacheHasCoverage && stationId) {
      try {
        tidePredictions = await fetchHourlyTidePredictions(stationId, startIso, endIso);
        dataSource = "noaa_live";
        predictionsUpdatedAt = null;
      } catch {
        // Tide data is optional — continue without it
        tidePredictions = [];
        dataSource = null;
        predictionsUpdatedAt = null;
      }
    }

    return NextResponse.json({
      beach: {
        id: beach.id,
        name: beach.name,
        slug: beach.slug,
        city: beach.city,
        state: beach.state,
        timezone: beach.timezone ?? null,
      },
      stationId,
      days,
      tidePredictions,
      dataSource,
      predictionsUpdatedAt,
    });
  } catch (err) {
    console.error("[dawn-patrol] Error:", err);
    return NextResponse.json(
      { error: "Failed to fetch dawn patrol data" },
      { status: 500 }
    );
  }
}

export const GET = withRateLimit(dawnPatrolHandler, "public-default");
