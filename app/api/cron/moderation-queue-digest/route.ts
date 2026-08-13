import {
  createErrorResponse,
  createSuccessResponse,
  validateCronRequest,
} from "@/lib/middleware/api-wrappers";
import { withObservedCron } from "@/lib/cron/observability";
import { sendEmail, MAIL_FROM, MAIL_REPLY_TO, getBaseUrl } from "@/lib/mailer/client";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const ROUTE = "/api/cron/moderation-queue-digest";
const SCHEDULE = "0 16 * * *";
const DEFAULT_START_DATE = "2026-08-17";

type MediaType = "photo" | "video";

interface QueueRow {
  id: string;
  media_type: MediaType;
}

interface QueueQueryResult {
  data: QueueRow[] | null;
  error: { message: string } | null;
}

interface PhotoQueueQueryResult {
  data: Array<{ id: string }> | null;
  error: { message: string } | null;
}

interface QueueSummary {
  pendingPhotos: number;
  pendingVideos: number;
  total: number;
}

function getStartDate(env: NodeJS.ProcessEnv = process.env): string {
  return env.MODERATION_QUEUE_DIGEST_START_DATE?.trim() || DEFAULT_START_DATE;
}

function getStartTimestamp(startDate: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return null;
  const timestamp = Date.parse(`${startDate}T00:00:00.000Z`);
  return Number.isNaN(timestamp) ? null : timestamp;
}

function summarizeQueue(
  columnPending: QueueRow[],
  legacyPhotoPending: QueueRow[],
  unapprovedBeachPhotos: Array<{ id: string }>,
): QueueSummary {
  const photoIds = new Set<string>();
  const videoIds = new Set<string>();

  for (const row of columnPending) {
    if (row.media_type === "photo") photoIds.add(row.id);
    if (row.media_type === "video") videoIds.add(row.id);
  }

  for (const row of legacyPhotoPending) {
    if (row.media_type === "photo") photoIds.add(row.id);
  }

  for (const row of unapprovedBeachPhotos) {
    photoIds.add(row.id);
  }

  return {
    pendingPhotos: photoIds.size,
    pendingVideos: videoIds.size,
    total: photoIds.size + videoIds.size,
  };
}

function buildDigestText(summary: QueueSummary): string {
  const baseUrl = getBaseUrl();
  return [
    `Quiver has ${summary.total} media item${summary.total === 1 ? "" : "s"} awaiting moderation.`,
    "",
    `Photos: ${summary.pendingPhotos}`,
    `Videos: ${summary.pendingVideos}`,
    "",
    `Review photos: ${baseUrl}/admin/photos`,
    `Review videos: ${baseUrl}/admin/session-videos`,
  ].join("\n");
}

async function _GET(request: Request): Promise<Response> {
  if (!validateCronRequest(request)) {
    return createErrorResponse("Unauthorized", "Invalid cron authentication", 401);
  }

  const startDate = getStartDate();
  const startTimestamp = getStartTimestamp(startDate);
  if (startTimestamp === null) {
    console.error(`${ROUTE} invalid start date: ${startDate}`);
    return createErrorResponse("Invalid configuration", "Invalid moderation digest start date", 500);
  }

  if (Date.now() < startTimestamp) {
    return createSuccessResponse({
      skipped: "not_started",
      startDate,
      summary: { pendingPhotos: 0, pendingVideos: 0, total: 0 },
    });
  }

  try {
    const supabase = await createSupabaseServiceRoleClient();
    const buildQuery = () =>
      (supabase.from("session_media") as any)
        .select("id, media_type")
        .is("deleted_at", null)
        .in("media_type", ["photo", "video"]);
    const buildBeachPhotoQuery = () =>
      (supabase.from("beach_photos") as any)
        .select("id")
        .is("deleted_at", null)
        .eq("approved", false);

    const [columnResult, legacyPhotoResult, unapprovedBeachPhotoResult] = (await Promise.all([
      buildQuery().eq("moderation_status", "pending"),
      buildQuery().eq("media_type", "photo").contains("metadata", {
        moderation_status: "pending",
      }),
      buildBeachPhotoQuery(),
    ])) as [QueueQueryResult, QueueQueryResult, PhotoQueueQueryResult];

    if (columnResult.error || legacyPhotoResult.error || unapprovedBeachPhotoResult.error) {
      const error =
        columnResult.error || legacyPhotoResult.error || unapprovedBeachPhotoResult.error;
      throw new Error(error?.message || "Failed to query moderation queue");
    }

    const summary = summarizeQueue(
      columnResult.data ?? [],
      legacyPhotoResult.data ?? [],
      unapprovedBeachPhotoResult.data ?? [],
    );

    if (summary.total === 0) {
      return createSuccessResponse({
        skipped: "empty_queue",
        startDate,
        summary,
      });
    }

    const recipient =
      process.env.MODERATION_QUEUE_NOTIFY_TO?.trim() || process.env.MOD_NOTIFY_TO?.trim();
    if (!recipient) {
      console.error(`${ROUTE} recipient is not configured`);
      return createErrorResponse(
        "Misconfigured notification",
        "Moderation notification recipient is not configured",
        500,
      );
    }

    const subject = `[Quiver Mod] ${summary.total} item${summary.total === 1 ? "" : "s"} awaiting review`;
    let sendResult;
    try {
      sendResult = await sendEmail({
        from: MAIL_FROM,
        replyTo: MAIL_REPLY_TO,
        to: recipient,
        subject,
        text: buildDigestText(summary),
      });
    } catch (error) {
      console.error(`${ROUTE} email send threw`, error);
      return createErrorResponse("Failed to send moderation digest", "Email provider error", 502);
    }

    if (sendResult.error) {
      console.error(`${ROUTE} email send failed`, sendResult.error);
      return createErrorResponse("Failed to send moderation digest", "Email provider rejected the message", 502);
    }

    return createSuccessResponse({
      notified: true,
      startDate,
      summary,
      messageId: sendResult.data?.id ?? null,
    });
  } catch (error) {
    console.error(`${ROUTE} failed`, error);
    return createErrorResponse("Failed to load moderation queue", "Moderation queue query failed", 500);
  }
}

export const GET = withObservedCron(ROUTE, _GET, {
  slug: "moderation-queue-digest",
  schedule: SCHEDULE,
});
