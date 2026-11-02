import { NextRequest, NextResponse } from "next/server";
import { extractIPLocation } from "@/lib/location/ip-location";
import { getClosestRegion } from "@/lib/utils/forecast-hub-utils";
import { calculateDistanceInMiles } from "@/lib/utils/distance-utils";
import {
  handleApiError,
  withNoStore,
  withRateLimit,
} from "@/lib/middleware/api-wrappers";

export const dynamic = "force-dynamic";

/** Past this, a region's beaches are not "near" the guest; no list beats the wrong list. */
const MAX_REGION_DISTANCE_MILES = 200;

interface GeoRegionGuess {
  slug: string;
  name: string;
  centerLat: number;
  centerLon: number;
}

function guessRegion(
  lat: number | null,
  lon: number | null,
): GeoRegionGuess | null {
  if (lat === null || lon === null) return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;

  const closest = getClosestRegion({ lat, lon });
  if (!closest) return null;

  const distance = calculateDistanceInMiles(
    { lat, lon },
    { lat: closest.centerLat, lon: closest.centerLon },
  );
  if (!(distance <= MAX_REGION_DISTANCE_MILES)) return null;

  return {
    slug: closest.slug,
    name: closest.name,
    centerLat: closest.centerLat,
    centerLon: closest.centerLon,
  };
}

// Vercel sets x-vercel-ip-* per caller, so the answer is never shareable.
// Never fall back to a default region: the app shows no list rather than
// another region's beaches.
async function geoRegionHandler(request: NextRequest): Promise<NextResponse> {
  try {
    const { latitude, longitude } = extractIPLocation(request.headers);
    return NextResponse.json({ region: guessRegion(latitude, longitude) });
  } catch (error) {
    console.error("[geo-region] Failed to resolve IP region:", error);
    return handleApiError(error, "Failed to resolve IP region");
  }
}

export const GET = withRateLimit(withNoStore(geoRegionHandler), "public-default");
