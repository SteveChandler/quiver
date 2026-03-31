import { NextRequest, NextResponse } from "next/server";
import { createPublicReadClient } from "@/lib/supabase/server";
import {
  fetchHourlyTidePredictions,
  getNearestTideStation,
} from "@/lib/services/noaa-tide-service";
import { COOPS_STATIONS } from "@/lib/services/noaa-coops/constants/station-mappings";
import SunCalc from "suncalc";

export const dynamic = "force-dynamic";

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

/**
 * GET /api/tools/dawn-patrol?beachSlug=la-jolla&beachId=uuid
 *
 * Returns 7-day dawn patrol data:
 * - Civil twilight, sunrise, golden hour, sunset per day
 * - Tide state at civil twilight for each day
 * - Wind direction at dawn (not yet — requires open-meteo integration)
 */
export async function GET(request: NextRequest) {
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

    // Resolve tide station
    const slug = beach.slug as string;
    let stationId: string | null = COOPS_STATIONS[slug] ?? null;
    if (!stationId) {
      const nearest = await getNearestTideStation(lat, lon);
      stationId = nearest?.id ?? null;
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

    // Fetch 7 days of hourly tide predictions if station is known
    let tidePredictions: Array<{ ts: string; tide_height_m: number; tide_phase: string | null }> = [];
    if (stationId) {
      const endDate = new Date(now);
      endDate.setDate(now.getDate() + 7);
      try {
        tidePredictions = await fetchHourlyTidePredictions(
          stationId,
          now.toISOString(),
          endDate.toISOString()
        );
      } catch {
        // Tide data is optional — continue without it
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
    });
  } catch (err) {
    console.error("[dawn-patrol] Error:", err);
    return NextResponse.json(
      { error: "Failed to fetch dawn patrol data" },
      { status: 500 }
    );
  }
}
