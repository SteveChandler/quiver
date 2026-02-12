import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAdminAuth, createSuccessResponse } from "@/lib/middleware/api-wrappers";
import { sendPushNotification } from "@/lib/services/push-notifications";

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
 * Admin-only endpoint to send a test push notification to the currently
 * authenticated admin user.
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
  const title = parsed.data?.title ?? "Quiver Test Push";
  const body =
    parsed.data?.body ??
    `Test push sent at ${nowIso}. If you see this, FCM is working.`;

  const result = await sendPushNotification({
    userIds: [user.id],
    title,
    body,
    data: {
      type: "test_push",
      url: "/profile",
      sent_at: nowIso,
    },
  });

  return createSuccessResponse({
    toUserId: user.id,
    title,
    body,
    result,
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
    description: "Send a push notification to the current admin user",
    body: {
      title: "string (optional, max 80)",
      body: "string (optional, max 240)",
    },
    timestamp: new Date().toISOString(),
  });
});
