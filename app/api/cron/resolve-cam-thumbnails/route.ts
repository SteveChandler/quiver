import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import {
  validateCronRequest,
  createErrorResponse,
  createSuccessResponse,
} from "@/lib/middleware/api-wrappers";
import { getCamThumbnailUrl } from "@/lib/media/cam-thumbnail";
import { withObservedCron } from "@/lib/cron/observability";
import { withCronOutcome } from "@/lib/cron/outcome";
import { withErrorNoStore } from "@/lib/middleware/api-wrappers/error-cache-wrapper";

export const revalidate = 0;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Upgrade YouTube thumbnails to higher quality (hqdefault = 480x360). */
function getYouTubeHqThumbnail(
  cameraUrl: string | null | undefined
): string | null {
  const mq = getCamThumbnailUrl(cameraUrl);
  if (!mq) return null;
  return mq.replace("mqdefault.jpg", "hqdefault.jpg");
}

async function _GET(request: Request): Promise<Response> {
  const startTime = Date.now();

  try {
    if (!validateCronRequest(request)) {
      return createErrorResponse(
        "Unauthorized",
        "Invalid cron authentication",
        401
      );
    }

    const force = new URL(request.url).searchParams.get("force") === "true";
    const supabase = createSupabaseServiceRoleClient();

    let query = supabase
      .from("beach_sources")
      .select("beach_id, camera_url, thumbnail_url")
      .not("camera_url", "is", null)
      .neq("camera_url", "");

    if (!force) {
      query = query.is("thumbnail_url", null);
    }

    const { data: rows, error } = await query;

    if (error) {
      return createErrorResponse("Database error", error.message, 500);
    }

    if (!rows || rows.length === 0) {
      return createSuccessResponse(await withCronOutcome(
        {
          job: "/api/cron/resolve-cam-thumbnails",
          unit: "thumbnails_updated",
          expectedMin: 0,
          getProduced: (value) => value.updated ?? 0,
          legitimatelyZero: () => ({ reason: "No camera sources were missing thumbnails" }),
        },
        async () => ({
          message: "No cams to process",
          updated: 0,
          duration: `${Date.now() - startTime}ms`,
        }),
      ));
    }

    let updated = 0;
    let skipped = 0;
    let failed = 0;
    let eligible = 0;

    for (const row of rows) {
      const cameraUrl = row.camera_url;
      const thumbnailUrl = getYouTubeHqThumbnail(cameraUrl);
      if (thumbnailUrl) eligible++;

      if (!thumbnailUrl) {
        skipped++;
        continue;
      }

      const { error: updateError } = await supabase
        .from("beach_sources")
        .update({ thumbnail_url: thumbnailUrl })
        .eq("beach_id", row.beach_id)
        .eq("camera_url", cameraUrl!);

      if (updateError) {
        console.error(
          `[resolve-cam-thumbnails] Update failed for ${row.beach_id}: ${updateError.message}`
        );
        failed++;
      } else {
        updated++;
      }
    }

    return createSuccessResponse(await withCronOutcome(
      {
        job: "/api/cron/resolve-cam-thumbnails",
        unit: "thumbnails_updated",
        // Zero updates is normal once every cam has a thumbnail; store errors still fail below.
        expectedMin: 0,
        getProduced: (value) => value.updated,
        failureReason: (value) =>
          value.updated === 0 && value.failed > 0
            ? `${value.failed} thumbnail store(s) failed and none updated`
            : null,
        legitimatelyZero: () => {
          if (eligible === 0) {
            return { reason: "No camera sources had supported thumbnail providers" };
          }
          return undefined;
        },
      },
      async () => ({
        total: rows.length,
        updated,
        skipped,
        failed,
        duration: `${Date.now() - startTime}ms`,
      }),
    ));
  } catch (error) {
    console.error("[resolve-cam-thumbnails] Unexpected error:", error);
    return createErrorResponse("Cron failed", { error: String(error) }, 500);
  }
}

const handleGet = withObservedCron("/api/cron/resolve-cam-thumbnails", _GET);

async function _POST(request: Request): Promise<Response> {
  return _GET(request);
}

export const POST = withObservedCron("/api/cron/resolve-cam-thumbnails", _POST);

export const GET = withErrorNoStore(handleGet, "/api/cron/resolve-cam-thumbnails");
