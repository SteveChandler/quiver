import { NextRequest, NextResponse } from "next/server";
import { createPublicReadClient } from "@/lib/supabase/server";
import {
  fetchCachedHourlyTidePredictions,
  fetchHighLowTidePredictions,
  fetchHourlyTidePredictions,
  getNearestTideStation,
  hasSufficientCachedTideCoverage,
  type CachedTidePredictionsResult,
  type HighLowTidePrediction,
  type TidePrediction,
} from "@/lib/services/noaa-tide-service";
import { COOPS_STATIONS } from "@/lib/services/noaa-coops/constants/station-mappings";
import { withRateLimit } from "@/lib/middleware/api-wrappers";

export const dynamic = "force-dynamic";

type TideToolDataSource = "cache" | "noaa_live" | null;

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
    console.warn("[tide-clock] Failed to resolve nearest tide station", {
      beachSlug: params.slug,
      error,
    });
    return null;
  }
}

/**
 * GET /api/tools/tide-clock?beachSlug=la-jolla&beachId=uuid
 *
 * Returns 24h hourly tide predictions for the given beach.
 * Prefers cached tide_forecasts rows and falls back to NOAA when cache coverage is missing.
 */
async function tideClockHandler(request: NextRequest) {
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

    // Fetch beach coords and name
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

    const slug = beach.slug as string;

    const now = new Date();
    const end = new Date(now.getTime() + 25 * 60 * 60 * 1000); // 25h to ensure full 24h
    const startIso = now.toISOString();
    const endIso = end.toISOString();

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
      console.warn("[tide-clock] Cached tide lookup failed; using NOAA fallback", {
        beachId: beach.id,
        cacheError,
      });
    }

    const stationId = await resolveStationId({ slug, lat, lon });
    const cacheHasCoverage = hasSufficientCachedTideCoverage(
      cachedTides.predictions,
      startIso,
      endIso
    );

    let predictions: TidePrediction[] = cachedTides.predictions;
    let dataSource: TideToolDataSource = cacheHasCoverage ? "cache" : null;
    let predictionsUpdatedAt: string | null = cacheHasCoverage
      ? cachedTides.latestCreatedAt
      : null;

    if (!cacheHasCoverage) {
      if (!stationId) {
        return NextResponse.json(
          { error: "No tide station available for this beach" },
          { status: 422 }
        );
      }

      try {
        predictions = await fetchHourlyTidePredictions(stationId, startIso, endIso);
      } catch (fallbackError) {
        console.warn("[tide-clock] Live NOAA tide fallback failed", {
          stationId,
          fallbackError,
        });
        return NextResponse.json(
          {
            error: "Tide data unavailable",
            dataSource: null,
            predictionsUpdatedAt: null,
            predictions: [],
          },
          { status: 503 }
        );
      }
      dataSource = "noaa_live";
      predictionsUpdatedAt = null;
    }

    let extremes: HighLowTidePrediction[] = [];
    if (stationId) {
      try {
        extremes = await fetchHighLowTidePredictions(stationId, startIso, endIso);
      } catch (extremesError) {
        console.warn("[tide-clock] High/low tide lookup failed", {
          stationId,
          extremesError,
        });
      }
    }

    // Fetch today's sun times
    const todayDate = now.toISOString().slice(0, 10);
    const { data: sunTimes } = await supabase
      .from("sun_times")
      .select("sunrise_utc, sunset_utc, date")
      .eq("beach_id", beach.id)
      .eq("date", todayDate)
      .maybeSingle();

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
      predictions,
      dataSource,
      predictionsUpdatedAt,
      extremes,
      sunTimes: sunTimes ?? null,
    });
  } catch (err) {
    console.error("[tide-clock] Error:", err);
    return NextResponse.json(
      { error: "Failed to fetch tide data" },
      { status: 500 }
    );
  }
}

export const GET = withRateLimit(tideClockHandler, "public-default");
