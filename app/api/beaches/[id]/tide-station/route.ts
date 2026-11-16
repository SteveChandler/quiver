import { NextRequest, NextResponse } from "next/server";

import { getTideMetaData } from "@/lib/seo/tide-meta-data";
import { toBeachStationTidePayload } from "@/lib/tides/beach-station-tide";
import { loadStationTideView } from "@/lib/tides/city-tide-view";
import {
  createErrorResponse,
  createSuccessResponse,
  handleApiError,
  isValidUuid,
  withBotBlockingAndRateLimit,
} from "@/lib/middleware/api-wrappers";
import { withErrorNoStore } from "@/lib/middleware/api-wrappers/error-cache-wrapper";

/**
 * GET /api/beaches/[id]/tide-station
 *
 * Public, read-only. The NOAA station table behind the beach's tide rows, as
 * `/tides/station/...` and the web beach tide page show it, so the app prints
 * the same highs and lows to the minute. `data: null` when the beach has no
 * station table (model tides, no registry row) or NOAA cannot answer: the app
 * then keeps its stored rows.
 *
 * next.config's blanket /api rule overrides Cache-Control, so the shared CDN
 * cache is set with Vercel-CDN-Cache-Control. A null answer is cached briefly,
 * so a NOAA outage does not hide the table for long.
 */
export const dynamic = "force-dynamic";

const CDN_CACHE = "max-age=1800, stale-while-revalidate=3600";
const CDN_CACHE_NULL = "max-age=60";

function cdnCached(response: NextResponse, value: string): NextResponse {
  response.headers.set("Vercel-CDN-Cache-Control", value);
  return response;
}

async function beachTideStationHandler(
  _request: NextRequest,
  context?: { params: Record<string, string> | Promise<Record<string, string>> },
): Promise<NextResponse> {
  const params = await context?.params;
  const beachId = params?.id?.trim() ?? "";
  if (!isValidUuid(beachId)) return createErrorResponse("Invalid beach id", undefined, 400);

  try {
    const rows = await getTideMetaData(beachId);
    // The stored-row read failed: no answer is better than a cached "no station".
    if (rows.availability) return createErrorResponse("Tide data unavailable", undefined, 503);
    const view = rows.stationId ? await loadStationTideView(rows.stationId, Date.now()) : null;
    const payload = view ? toBeachStationTidePayload(view) : null;
    return cdnCached(createSuccessResponse(payload), payload ? CDN_CACHE : CDN_CACHE_NULL);
  } catch (error) {
    return handleApiError(error, "Failed to load tide station");
  }
}

const handleGet = withBotBlockingAndRateLimit(beachTideStationHandler, "public-default");

export const GET = withErrorNoStore(handleGet, "/api/beaches/[id]/tide-station");
