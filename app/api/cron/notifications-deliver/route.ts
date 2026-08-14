/**
 * /api/cron/notifications-deliver — runs every minute (`* * * * *`).
 *
 * Pulls pending events from `notification_events`, dispatches push (FCM) and
 * in-app rows, writes per-channel outcomes to `notification_delivery_attempts`.
 * Pure orchestration — the work lives in `lib/notifications/worker.ts`.
 *
 * Cadence: current Vercel schedule is minutely so queued push work drains
 * quickly; the worker cheaply no-ops when the queue is empty.
 *
 * Plan: ~/.claude/plans/on-quiver-native-we-have-snug-tiger.md (Phase 2b).
 */

import { NextResponse } from "next/server";
import { validateCronRequest } from "@/lib/middleware/api-wrappers";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { withObservedCron } from "@/lib/cron/observability";
import { processPendingEvents } from "@/lib/notifications/worker";
import { withCronOutcome } from "@/lib/cron/outcome";

export const revalidate = 0;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SENTRY_MONITOR = {
  slug: "notifications-deliver",
  schedule: "* * * * *",
  maxRuntimeMinutes: 3,
};

async function _GET(request: Request): Promise<NextResponse> {
  if (!validateCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseServiceRoleClient();

  try {
    const summary = await withCronOutcome(
      {
        job: "/api/cron/notifications-deliver",
        unit: "notifications_sent",
        expectedMin: 1,
        getProduced: (value) => value.by_status?.sent ?? 0,
        legitimatelyZero: (value) =>
          (value.fetched ?? value.processed ?? 0) === 0
            ? { reason: "Notification queue had no pending events" }
            : undefined,
      },
      () => processPendingEvents(supabase),
    );
    return NextResponse.json(summary);
  } catch (err) {
    console.error("[notifications-deliver] fatal:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export const GET = withObservedCron("/api/cron/notifications-deliver", _GET, SENTRY_MONITOR);
