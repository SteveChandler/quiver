import { NextRequest, NextResponse } from "next/server";
import { loadBeachBuoy } from "@/lib/buoy-pages/beach-buoy";
import { getBuoyPageSource, isMissingCatalogueError } from "@/lib/buoy-pages/source";
import {
  createErrorResponse,
  createSuccessResponse,
  handleApiError,
  isValidUuid,
  withBotBlockingAndRateLimit,
} from "@/lib/middleware/api-wrappers";

/**
 * GET /api/beaches/[id]/buoy
 *
 * Public, read-only. The buoy Quiver's forecast reads for this beach, else the
 * nearest wave buoy within 150 km, with one "now" reading, the six-hour trend
 * and 48 h of hourly history. 404 when the beach is private, deleted or
 * unknown, when no buoy is close enough, or while the wave-station catalogue
 * migration is not applied.
 *
 * next.config's blanket /api rule overrides Cache-Control (private, 60 s), so
 * the shared CDN cache is set with Vercel-CDN-Cache-Control, and only on 200
 * and 404: a 403, 429 or 500 for one caller must never be served to others.
 */
export const dynamic = "force-dynamic";

const CDN_CACHE = "max-age=300, stale-while-revalidate=600";

function cdnCached(response: NextResponse): NextResponse {
  response.headers.set("Vercel-CDN-Cache-Control", CDN_CACHE);
  return response;
}

async function beachBuoyHandler(
  _request: NextRequest,
  context?: { params: Record<string, string> | Promise<Record<string, string>> },
): Promise<NextResponse> {
  const params = await context?.params;
  const beachId = params?.id?.trim() ?? "";
  if (!isValidUuid(beachId)) return createErrorResponse("Invalid beach id", undefined, 400);

  try {
    const source = await getBuoyPageSource();
    const result = await loadBeachBuoy(source, beachId, new Date());
    if (result.kind === "beach-not-found") return cdnCached(createErrorResponse("Beach not found", undefined, 404));
    if (result.kind === "no-station") return cdnCached(createErrorResponse("No buoy near this beach", undefined, 404));
    return cdnCached(createSuccessResponse(result.payload));
  } catch (error) {
    if (isMissingCatalogueError(error)) {
      return cdnCached(createErrorResponse("No buoy near this beach", undefined, 404));
    }
    return handleApiError(error, "Failed to load buoy");
  }
}

export const GET = withBotBlockingAndRateLimit(beachBuoyHandler, "public-default");
