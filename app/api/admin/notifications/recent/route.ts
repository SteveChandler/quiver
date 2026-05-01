/**
 * GET /api/admin/notifications/recent
 *
 * Admin-only diagnostics endpoint. Returns the last N notification events
 * (joined with their per-channel delivery attempts) filtered by:
 *   - user_id?     UUID — only this recipient's events
 *   - type?        registry type string — only events of this type
 *   - status?      pending|processing|processed|failed|cancelled
 *   - stale=true   events in 'processing' for >5 minutes (likely lease was
 *                  taken by a worker that crashed before writing terminal
 *                  status; SQL claim function reclaims them but stale rows
 *                  visible in the query indicate worker pressure)
 *   - retry_heavy=true   events with attempt_count >= 2
 *   - limit=N      cap on rows (default 50, max 200)
 *
 * Used to debug "did my push fire and if not, why?" without needing
 * Supabase Studio access.
 *
 * Plan: ~/.claude/plans/on-quiver-native-we-have-snug-tiger.md (Phase 5m).
 */

import { NextRequest, NextResponse } from "next/server";
import { withAdminAuth, createSuccessResponse } from "@/lib/middleware/api-wrappers";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const STALE_LEASE_MS = 5 * 60 * 1000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_STATUSES = new Set([
  "pending",
  "processing",
  "processed",
  "failed",
  "cancelled",
]);

export const GET = withAdminAuth(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const userIdParam = searchParams.get("user_id");
  const typeParam = searchParams.get("type");
  const statusParam = searchParams.get("status");
  const staleParam = searchParams.get("stale");
  const retryHeavyParam = searchParams.get("retry_heavy");
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
  if (statusParam !== null && !ALLOWED_STATUSES.has(statusParam)) {
    return NextResponse.json(
      {
        success: false,
        error: `status must be one of: ${[...ALLOWED_STATUSES].join(", ")}`,
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

  // Build the query incrementally. The generated `Database` type doesn't yet
  // know about notification_events, so we cast through `unknown`.
  let query = (supabase as unknown as {
    from(t: "notification_events"): {
      select(s: string): {
        order(c: string, opts: { ascending: boolean }): unknown;
      };
    };
  })
    .from("notification_events")
    .select(
      "id, recipient_user_id, actor_user_id, type, entity_type, entity_id, payload, dedupe_key, status, skip_reason, created_at, processed_at, claimed_at, attempt_count, next_attempt_at, last_attempt_at, claim_token, cancel_reason, last_error, delivery_attempts:notification_delivery_attempts(id, notification_event_id, channel, status, attempt_number, provider_response, error_message, created_at)"
    )
    .order("created_at", { ascending: false }) as unknown as {
    eq(c: string, v: string): typeof query;
    gte(c: string, v: string | number): typeof query;
    lt(c: string, v: string): typeof query;
    limit(n: number): typeof query;
  } & Promise<{
    data: Record<string, unknown>[] | null;
    error: { message: string } | null;
  }>;

  if (userIdParam) query = query.eq("recipient_user_id", userIdParam);
  if (typeParam) query = query.eq("type", typeParam);
  if (statusParam) query = query.eq("status", statusParam);
  if (retryHeavyParam === "true") query = query.gte("attempt_count", 2);
  if (staleParam === "true") {
    // A row is considered stale if status='processing' and claimed_at is older
    // than the worker's lease (5 min). Combine with explicit status filter so
    // the index on (status, claimed_at) gets hit.
    const cutoffIso = new Date(Date.now() - STALE_LEASE_MS).toISOString();
    query = query.eq("status", "processing").lt("claimed_at", cutoffIso);
  }
  query = query.limit(limit);

  const { data, error } = await query;

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
    filters: {
      user_id: userIdParam,
      type: typeParam,
      status: statusParam,
      stale: staleParam === "true",
      retry_heavy: retryHeavyParam === "true",
    },
    limit,
    events: data ?? [],
  });
});
