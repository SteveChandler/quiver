import { NextRequest, NextResponse } from "next/server";
import { createPublicReadClient } from "@/lib/supabase/server";
import {
  fetchHourlyTidePredictions,
  getNearestTideStation,
} from "@/lib/services/noaa-tide-service";
import { COOPS_STATIONS } from "@/lib/services/noaa-coops/constants/station-mappings";

export const dynamic = "force-dynamic";

/**
 * GET /api/tools/tide-clock?beachSlug=la-jolla&beachId=uuid
 *
 * Returns 24h hourly tide predictions for the given beach.
 * Resolves station via hardcoded mappings first, then nearest-station fallback.
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

    // Resolve tide station
    const slug = beach.slug as string;
    let stationId: string | null = COOPS_STATIONS[slug] ?? null;

    if (!stationId) {
      const nearest = await getNearestTideStation(lat, lon);
      stationId = nearest?.id ?? null;
    }

    if (!stationId) {
      return NextResponse.json(
        { error: "No tide station available for this beach" },
        { status: 422 }
      );
    }

    // Fetch 24h of hourly predictions starting now
    const now = new Date();
    const end = new Date(now.getTime() + 25 * 60 * 60 * 1000); // 25h to ensure full 24h
    const predictions = await fetchHourlyTidePredictions(
      stationId,
      now.toISOString(),
      end.toISOString()
    );

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
