/**
 * /api/cron/notifications-deliver — runs every minute.
 *
 * Pulls pending events from `notification_events`, dispatches push (FCM) and
 * in-app rows, writes per-channel outcomes to `notification_delivery_attempts`.
 * Pure orchestration — the work lives in `lib/notifications/worker.ts`.
 *
 * Until Phase 3 starts migrating producers, this cron observes 0 pending
 * events per tick. `cron_runs` rows confirm the worker is healthy and ready.
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
