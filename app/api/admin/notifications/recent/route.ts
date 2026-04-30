/**
 * GET /api/admin/notifications/recent?user_id=<uuid>&limit=50
 *
 * Admin-only diagnostics endpoint. Returns the last N notification events for
 * a given user (or globally if user_id is omitted) joined with their per-channel
 * delivery attempts. Used to debug "did my push fire and if not, why?" without
 * needing Supabase Studio access.
 *
 * Plan: ~/.claude/plans/on-quiver-native-we-have-snug-tiger.md (Phase 2d).
 */

import { NextRequest, NextResponse } from "next/server";
import { withAdminAuth, createSuccessResponse } from "@/lib/middleware/api-wrappers";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import type {
  NotificationEventRow,
  NotificationDeliveryAttemptRow,
} from "@/lib/notifications/db-augment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface EventWithAttempts extends NotificationEventRow {
  delivery_attempts: NotificationDeliveryAttemptRow[];
}

export const GET = withAdminAuth(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const userIdParam = searchParams.get("user_id");
  const limitParam = searchParams.get("limit");

  if (userIdParam !== null && !UUID_RE.test(userIdParam)) {
    return NextResponse.json(
      {
        success: false,
        error: "user_id must be a valid uuid",
        timestamp: new Date().toISOString(),
      },
      { status: 400 }
    );
  }

  const limit = (() => {
    if (!limitParam) return DEFAULT_LIMIT;
    const n = Number.parseInt(limitParam, 10);
    if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT;
    return Math.min(n, MAX_LIMIT);
  })();

  const supabase = createSupabaseServiceRoleClient();

  // Narrow to the new tables which aren't in the generated Database type yet.
  const client = supabase as unknown as {
    from(t: "notification_events"): {
      select(s: string): {
        order(c: string, opts: { ascending: boolean }): {
          limit(n: number): {
            // eq() is only chained when user_id is provided; we conditionally
            // apply it below via Promise return shape.
            eq(c: string, v: string): Promise<{
              data: EventWithAttempts[] | null;
              error: { message: string } | null;
            }>;
          } & Promise<{
            data: EventWithAttempts[] | null;
            error: { message: string } | null;
          }>;
        };
      };
    };
  };

  const baseQuery = client
    .from("notification_events")
    .select(
      "id, recipient_user_id, actor_user_id, type, entity_type, entity_id, payload, dedupe_key, status, skip_reason, created_at, processed_at, delivery_attempts:notification_delivery_attempts(id, notification_event_id, channel, status, provider_response, error_message, created_at)"
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  const { data, error } = userIdParam
    ? await baseQuery.eq("recipient_user_id", userIdParam)
    : await baseQuery;

  if (error) {
    console.error("[admin/notifications/recent] query failed:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to load notification events",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }

  return createSuccessResponse({
    user_id: userIdParam,
    limit,
    events: data ?? [],
  });
});
