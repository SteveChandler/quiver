/**
 * /api/cron/notifications-deliver — runs hourly (`0 * * * *`).
 *
 * Pulls pending events from `notification_events`, dispatches push (FCM) and
 * in-app rows, writes per-channel outcomes to `notification_delivery_attempts`.
 * Pure orchestration — the work lives in `lib/notifications/worker.ts`.
 *
 * Cadence: was minutely until 2026-05-02. Audit showed 2 deliveries across
 * 1,440 daily runs (99.86% no-op). Producers (likes, follows) write events
 * but social-notification latency up to 60 min is acceptable. Re-tighten
 * once volume justifies it.
 *
 * Plan: ~/.claude/plans/on-quiver-native-we-have-snug-tiger.md (Phase 2b).
 */

import { NextResponse } from "next/server";
import { validateCronRequest } from "@/lib/api-utils";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { withCronObservability } from "@/lib/cron/observability";
import { processPendingEvents } from "@/lib/notifications/worker";

export const revalidate = 0;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request): Promise<NextResponse> {
  if (!validateCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseServiceRoleClient();

  try {
    const summary = await withCronObservability(
      "/api/cron/notifications-deliver",
      async () => processPendingEvents(supabase)
    );
    return NextResponse.json(summary);
  } catch (err) {
    console.error("[notifications-deliver] fatal:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
