import {
  createErrorResponse,
  createSuccessResponse,
  handleApiError,
  validateCronRequest,
} from "@/lib/middleware/api-wrappers";
import { withCronOutcome } from "@/lib/cron/outcome";
import { NOAABuoySync } from "@/lib/services/noaa-sync";
import { withObservedCron } from "@/lib/cron/observability";

export const revalidate = 0;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120; // Allow up to 2 minutes for full sync

/**
 * GET /api/cron/sync-buoys
 *
 * Cron job: syncs NOAA buoy stations for all existing beaches.
 * Fetches the NOAA master station list and upserts buoys within
 * the specified distance of beaches.
 *
 * Runs weekly to catch new buoy deployments.
 *
 * Query params:
 * - maxDistanceKm: Maximum distance from beaches (default: 250km)
 *
 * Auth:
 * - Authorization: Bearer <CRON_SECRET>
 */
async function _GET(request: Request): Promise<Response> {
  try {
    if (!validateCronRequest(request)) {
      return createErrorResponse(
        "Unauthorized",
        "Invalid cron authentication",
        401
      );
    }

    // Parse query params
    const url = new URL(request.url);
    const maxDistanceKm = parseInt(url.searchParams.get("maxDistanceKm") || "250");

    console.log(`Starting NOAA buoy sync with maxDistanceKm=${maxDistanceKm}...`);

    const syncService = new NOAABuoySync();
    const result = await withCronOutcome(
      {
        job: "/api/cron/sync-buoys",
        unit: "buoys_synced",
        expectedMin: 1,
        getProduced: (value) => value.buoysAdded,
      },
      () => syncService.syncBuoysForExistingBeaches(maxDistanceKm),
    );

    if (result.success) {
      const summary = {
        buoysAdded: result.buoysAdded,
        stationsAdded: result.stationsAdded,
        maxDistanceKm,
      };

      console.log("NOAA buoy sync complete:", summary);

      return createSuccessResponse({
        summary,
        message: `Synced ${result.buoysAdded} buoys from NOAA`,
      });
    } else {
      console.error("NOAA buoy sync failed:", result.error);
      return createErrorResponse(
        "Sync failed",
        result.error || "Unknown error during sync",
        500
      );
    }
  } catch (error) {
    console.error("NOAA buoy sync cron error:", error);
    return handleApiError(error);
  }
}

export const GET = withObservedCron("/api/cron/sync-buoys", _GET);
