import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAdminAuth, createSuccessResponse } from "@/lib/middleware/api-wrappers";
import { broadcastToActiveUsers } from "@/lib/services/broadcast-push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const payloadSchema = z
  .object({
    title: z.string().min(1).max(80),
    body: z.string().min(1).max(240),
    data: z.record(z.string(), z.string()).optional(),
    maxUsers: z.number().int().nonnegative().optional(),
  })
  .strict();

/**
 * POST /api/admin/broadcast-push
 *
 * Admin-only endpoint to broadcast a push notification to every active user
 * (every distinct user_id in user_devices). Intended for marketer use on
 * launch day. High blast radius — admin auth enforced via withAdminAuth.
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

  const result = await broadcastToActiveUsers(supabase, parsed.data);

  return createSuccessResponse({
    title: parsed.data.title,
    body: parsed.data.body,
    result,
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
    description: "Broadcast a push notification to every active user",
    body: {
      title: "string (required, max 80)",
      body: "string (required, max 240)",
      data: "Record<string, string> (optional)",
      maxUsers: "number (optional, non-negative cap)",
    },
    timestamp: new Date().toISOString(),
  });
});
