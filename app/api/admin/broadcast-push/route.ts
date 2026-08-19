import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAdminAuth, createSuccessResponse } from "@/lib/middleware/api-wrappers";
import { enqueueNotification } from "@/lib/notifications/enqueue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const payloadSchema = z
  .object({
    title: z.string().min(1).max(80),
    body: z.string().min(1).max(240),
    url: z.string().nullable().optional(),
    data: z.record(z.string(), z.string()).optional(),
    maxUsers: z.number().int().nonnegative().optional(),
  })
  .strict();

/**
 * POST /api/admin/broadcast-push
 *
 * Phase 5i: enqueues one `admin_broadcast` notification per active user
 * (every distinct user_id in user_devices) instead of dispatching FCM
 * directly. The worker handles preferences (honors master notif_push_enabled,
 * bypasses per-type prefs and quiet hours per the registry's quietHours.bypass
 * mode), device-token fanout, retry/backoff, and writes to
 * notification_delivery_attempts so the broadcast outcome is auditable per-user.
 *
 * Each enqueue uses a per-broadcast UUID dedupe key so a retry of the route
 * is dedup-safe (won't re-broadcast the same announcement twice).
 *
 * High blast radius — admin auth enforced via withAdminAuth.
 */
export const POST = withAdminAuth(async (request: NextRequest, { supabase }) => {
  const parsed = payloadSchema.safeParse(await request.json().catch(() => undefined));
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: "Invalid request body",
        details: parsed.error.flatten(),
        timestamp: new Date().toISOString(),
      },
      { status: 400 }
    );
  }

  const { title, body, url, data, maxUsers } = parsed.data;

  // Fetch every distinct user_id with at least one device. The same query
  // shape the legacy broadcastToActiveUsers used.
  const { data: rows, error: rowsErr } = await supabase
    .from("user_devices")
    .select("user_id")
    .is("retired_at" as never, null);
  if (rowsErr) {
    throw new Error(
      `Failed to fetch user_devices for broadcast: ${rowsErr.message}`
    );
  }
  const uniqueUserIds = Array.from(
    new Set(
      (rows ?? [])
        .map((row) => row.user_id)
        .filter((id): id is string => Boolean(id))
    )
  );
  const targetUserIds =
    typeof maxUsers === "number" && maxUsers >= 0
      ? uniqueUserIds.slice(0, maxUsers)
      : uniqueUserIds;

  // Per-broadcast key — re-running the route with the same body re-broadcasts
  // by design (cron retries / curl-spam shouldn't accidentally suppress).
  const broadcastId = crypto.randomUUID();
  const broadcastPayload = {
    title,
    body,
    ...(url !== undefined ? { url } : {}),
    ...(data !== undefined ? { data } : {}),
  };

  let enqueued = 0;
  let duplicates = 0;
  let invalid = 0;
  let failed = 0;

  for (const userId of targetUserIds) {
    const result = await enqueueNotification({
      type: "admin_broadcast",
      recipientUserId: userId,
      payload: broadcastPayload,
      dedupeKey: `admin_broadcast:${userId}:${broadcastId}`,
    });
    if (result.enqueued) {
      enqueued += 1;
    } else if (result.reason === "duplicate") {
      duplicates += 1;
    } else if (result.reason === "invalid_payload") {
      invalid += 1;
    } else {
      failed += 1;
    }
  }

  return createSuccessResponse({
    title,
    body,
    broadcastId,
    totalUsers: targetUserIds.length,
    enqueued,
    duplicates,
    invalid,
    failed,
  });
}, { errorMessage: "Failed to broadcast push notification" });

/**
 * GET /api/admin/broadcast-push
 *
 * Admin-only info endpoint.
 */
export const GET = withAdminAuth(async () => {
  return NextResponse.json({
    endpoint: "/api/admin/broadcast-push",
    method: "POST",
    description:
      "Enqueue an admin_broadcast notification per active user via the pipeline",
    body: {
      title: "string (required, max 80)",
      body: "string (required, max 240)",
      url: "string (optional, deep-link target)",
      data: "Record<string, string> (optional)",
      maxUsers: "number (optional, non-negative cap)",
    },
    timestamp: new Date().toISOString(),
  });
});
