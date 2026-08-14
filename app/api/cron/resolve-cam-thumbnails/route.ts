import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import {
  validateCronRequest,
  createErrorResponse,
  createSuccessResponse,
} from "@/lib/middleware/api-wrappers";
import { getCamThumbnailUrl } from "@/lib/media/cam-thumbnail";
import { withObservedCron } from "@/lib/cron/observability";
import { withCronOutcome } from "@/lib/cron/outcome";

export const revalidate = 0;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const HDONTAP_THUMBNAIL_RE =
  /https:\/\/storage\.hdontap\.com\/wowza_stream_thumbnails\/snapshot_[^"'\s]+\.jpg/;

/** Fetch an HDOnTap page and extract the snapshot thumbnail URL from HTML. */
async function resolveHdontapThumbnail(
  pageUrl: string
): Promise<string | null> {
  try {
    const res = await fetch(pageUrl, {
      signal: AbortSignal.timeout(10_000),
      headers: { "User-Agent": "QuiverBot/1.0" },
    });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) return null;
    const html = await res.text();
    const match = html.match(HDONTAP_THUMBNAIL_RE);
    return match ? match[0] : null;
  } catch {
    return null;
  }
}

/** For portal.hdontap.com embed URLs, the stream name is in the query string. */
function resolvePortalThumbnail(portalUrl: string): string | null {
  try {
    const url = new URL(portalUrl);
    const stream = url.searchParams.get("stream");
    if (!stream) return null;
    return `https://storage.hdontap.com/wowza_stream_thumbnails/snapshot_${stream}.stream.jpg`;
  } catch {
    return null;
  }
}

function isHdontapPage(url: string): boolean {
  return (
    url.includes("hdontap.com") ||
    url.includes("obhotel.com") ||
    url.includes("portofbrookingsharbor.com")
  );
}

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
          expectedMin: 1,
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

    for (const row of rows) {
      const cameraUrl = row.camera_url!;
      let thumbnailUrl: string | null = null;

      // YouTube — derive from video ID
      thumbnailUrl = getYouTubeHqThumbnail(cameraUrl);

      // HDOnTap portal — construct from stream param
      if (!thumbnailUrl && cameraUrl.includes("portal.hdontap.com")) {
        thumbnailUrl = resolvePortalThumbnail(cameraUrl);
      }

      // HDOnTap/partner pages — scrape for thumbnail
      if (!thumbnailUrl && isHdontapPage(cameraUrl)) {
        thumbnailUrl = await resolveHdontapThumbnail(cameraUrl);
        if (!thumbnailUrl) {
          console.warn(
            `[resolve-cam-thumbnails] HDOnTap scrape failed: ${cameraUrl}`
          );
        }
        // Polite delay between scrapes
        await new Promise((r) => setTimeout(r, 500));
      }

      if (!thumbnailUrl) {
        skipped++;
        continue;
      }

      const { error: updateError } = await supabase
        .from("beach_sources")
        .update({ thumbnail_url: thumbnailUrl })
        .eq("beach_id", row.beach_id);

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
        expectedMin: 1,
        getProduced: (value) => value.updated,
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

export const GET = withObservedCron("/api/cron/resolve-cam-thumbnails", _GET);

async function _POST(request: Request): Promise<Response> {
  return _GET(request);
}

export const POST = withObservedCron("/api/cron/resolve-cam-thumbnails", _POST);
