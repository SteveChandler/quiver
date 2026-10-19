import { z } from "zod";
import { createErrorResponse, createSuccessResponse } from "@/lib/api-utils";
import { validateOrError, withNoStore, withRateLimit } from "@/lib/middleware/api-wrappers";
import { runWithWaterQualityReadScope } from "@/lib/recommendations/major-event-hold/read-scope";
import { computeCanonicalSurfCall } from "@/lib/services/surf-call/canonical-surf-call";
import { haversineDistance } from "@/lib/utils/geo-utils";
import { retryAfterSeconds } from "@/lib/utils/retry-after";
import { loadWatchSpots, type WatchSpot } from "@/lib/watch/saved-spots";
import { withWatchAuth } from "@/lib/watch/with-watch-auth";

export const runtime = "nodejs";
export const maxDuration = 15;

const QuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90).optional(),
  lon: z.coerce.number().min(-180).max(180).optional(),
}).refine(query => (query.lat === undefined) === (query.lon === undefined), { message: "lat and lon go together" });

/** The saved beach nearest the watch, or the home beach (else the first favorite) without a position. */
function pickBeach(spots: WatchSpot[], lat?: number, lon?: number): WatchSpot | null {
  const beaches = spots.filter(spot => spot.kind === "beach");
  if (lat === undefined || lon === undefined) return beaches[0] ?? null;
  let nearest: WatchSpot | null = null;
  let nearestKm = Infinity;
  for (const beach of beaches) {
    const km = haversineDistance(lat, lon, beach.lat, beach.lon);
    if (km < nearestKm) { nearest = beach; nearestKm = km; }
  }
  return nearest;
}

/**
 * GET /api/v1/watch/glance?lat=<deg>&lon=<deg>
 *
 * The Garmin glance line for the user's nearest saved beach: the beach's surf
 * call (the producer native Home draws from), cut to what one watch line shows.
 * `glance: null` means the user has no saved beach to show.
 */
export const GET = withNoStore(withRateLimit(withWatchAuth(async (request, { userId, service }) => {
  const { searchParams } = new URL(request.url);
  const validation = validateOrError(QuerySchema, {
    lat: searchParams.get("lat") ?? undefined,
    lon: searchParams.get("lon") ?? undefined,
  });
  if ("error" in validation) return validation.error;

  const beach = pickBeach(await loadWatchSpots(service, userId), validation.data.lat, validation.data.lon);
  if (!beach) return createSuccessResponse({ glance: null });

  const outcome = await runWithWaterQualityReadScope(() => computeCanonicalSurfCall({
    supabase: service,
    userId,
    beachId: beach.id,
    boardClass: null,
  }));
  if (outcome.status === "not_found") return createErrorResponse("not_found", undefined, 404);
  if (outcome.status === "unavailable") {
    const response = createErrorResponse("unavailable", undefined, 503);
    response.headers.set("Retry-After", String(retryAfterSeconds()));
    return response;
  }

  const { report, conditionLabel, isTomorrow } = outcome.result;
  return createSuccessResponse({
    glance: {
      beachId: beach.id,
      name: beach.name,
      height: report.waveHeight,
      label: conditionLabel ?? null,
      tomorrow: isTomorrow,
      updatedAt: report.updatedAt,
    },
  });
}, { errorMessage: "Failed to load watch glance" }), "authenticated-default"));
