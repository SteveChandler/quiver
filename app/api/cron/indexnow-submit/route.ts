import {
  createErrorResponse,
  createSuccessResponse,
  handleApiError,
  validateCronRequest,
} from "@/lib/middleware/api-wrappers";
import { submitUrlsInBatches } from "@/lib/services/indexnow-service";
import {
  collectIndexNowUrlGroups,
  flattenIndexNowUrlGroups,
} from "@/lib/seo/indexnow-url-collectors";
import { withCronOutcome } from "@/lib/cron/outcome";
import { withObservedCron } from "@/lib/cron/observability";

export const revalidate = 0;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/cron/indexnow-submit
 *
 * Weekly cron that submits intent pages, city hub pages, and other
 * programmatic URLs to IndexNow for accelerated search engine discovery.
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

    if (!process.env.INDEXNOW_KEY) {
      return createErrorResponse(
        "Missing configuration",
        "INDEXNOW_KEY environment variable is not set",
        500
      );
    }

    const startMs = Date.now();
    const urlGroups = await collectIndexNowUrlGroups();
    const uniqueUrls = flattenIndexNowUrlGroups(urlGroups);

    const result = await withCronOutcome(
      {
        job: "/api/cron/indexnow-submit",
        unit: "urls_submitted",
        expectedMin: 1,
        getProduced: (value) => value.totalSubmitted,
      },
      () => submitUrlsInBatches(uniqueUrls),
    );

    return createSuccessResponse({
      submitted: result.totalSubmitted,
      // 202 means IndexNow deferred key validation — the URLs are NOT confirmed
      // delivered. A pending count equal to totalUrls is the signature of an
      // INDEXNOW_KEY that no longer matches public/indexnow-key.txt.
      pending: result.totalPending,
      totalUrls: uniqueUrls.length,
      statusCodes: result.batches.map((batch) => batch.statusCode),
      warnings: result.warnings,
      breakdown: {
        intent: urlGroups.intentUrls.length,
        location: urlGroups.locationUrls.length,
        staticSeo: urlGroups.staticSeoUrls.length,
        beachDetail: urlGroups.beachDetailUrls.length,
        bestTimeCity: urlGroups.bestTimeCityUrls.length,
      },
      batches: result.batches.length,
      errors: result.errors,
      durationMs: Date.now() - startMs,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withObservedCron("/api/cron/indexnow-submit", _GET);
