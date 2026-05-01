import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAdminAuth, createSuccessResponse } from "@/lib/middleware/api-wrappers";
import { enqueueNotification } from "@/lib/notifications/enqueue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const payloadSchema = z
  .object({
    title: z.string().min(1).max(80).optional(),
    body: z.string().min(1).max(240).optional(),
  })
  .strict()
  .optional();

/**
 * POST /api/admin/test-push
 *
 * Phase 5i: enqueues an `admin_test` notification through the centralized
 * pipeline instead of calling FCM directly. The worker handles preferences
 * (honors master notif_push_enabled), device-token fanout, retry/backoff,
 * and writes to notification_delivery_attempts so admins can verify the
 * full round-trip from the admin diagnostics endpoint.
 *
 * Each call uses a unique dedupeKey (timestamp-based) so admins can fire
 * the test push as many times as they want.
 */
export const POST = withAdminAuth(async (request: NextRequest, { user }) => {
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

  const nowIso = new Date().toISOString();
  const result = await enqueueNotification({
    type: "admin_test",
    recipientUserId: user.id,
    payload: parsed.data ?? {},
    dedupeKey: `admin_test:${user.id}:${nowIso}`,
  });

  if (!result.enqueued) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to enqueue test push",
        reason: result.reason,
        message: result.message,
        timestamp: nowIso,
      },
      { status: 500 }
    );
  }

  return createSuccessResponse({
    toUserId: user.id,
    eventId: result.eventId,
    enqueuedAt: nowIso,
  });
});

/**
 * GET /api/admin/test-push
 *
 * Admin-only info endpoint.
 */
export const GET = withAdminAuth(async () => {
  return NextResponse.json({
    endpoint: "/api/admin/test-push",
    method: "POST",
    description:
      "Enqueue a test push to the current admin user via the notifications pipeline",
    body: {
      title: "string (optional, max 80)",
      body: "string (optional, max 240)",
    },
    timestamp: new Date().toISOString(),
  });
});
