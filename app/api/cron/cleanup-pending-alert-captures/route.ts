// app/api/cron/cleanup-pending-alert-captures/route.ts
//
// Daily cleanup cron — removes expired, unconsumed pending_alert_captures rows.
// Scheduled at 03:30 UTC. See vercel.json.

import { NextResponse } from "next/server";
import { validateCronRequest } from "@/lib/middleware/api-wrappers";
import { withCronOutcome } from "@/lib/cron/outcome";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { withObservedCron } from "@/lib/cron/observability";

export const revalidate = 0;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONTEXT_TAG = "[cleanup-pending-alert-captures]";

async function _GET(request: Request): Promise<Response> {
  if (!validateCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createSupabaseServiceRoleClient();
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { count, error } = await supabase
    .from("pending_alert_captures")
    .delete({ count: "exact" })
    .lt("expires_at", cutoff)
    .is("consumed_at", null);

  if (error) {
    console.error(`${CONTEXT_TAG} delete failed:`, error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const outcome = await withCronOutcome(
    {
      job: "/api/cron/cleanup-pending-alert-captures",
      unit: "captures_deleted",
      expectedMin: 1,
      getProduced: (value) => value.deleted,
      legitimatelyZero: (value) =>
        value.deleted === 0
          ? { reason: "No expired, unconsumed alert captures were present" }
          : undefined,
    },
    async () => ({ deleted: count ?? 0 }),
  );

  console.log(`${CONTEXT_TAG} deleted ${outcome.deleted} expired captures`);
  return NextResponse.json({ ok: true, ...outcome });
}

export const GET = withObservedCron("/api/cron/cleanup-pending-alert-captures", _GET);
