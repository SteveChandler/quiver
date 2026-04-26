// app/api/cron/cleanup-pending-alert-captures/route.ts
//
// Daily cleanup cron — removes expired, unconsumed pending_alert_captures rows.
// Scheduled at 03:30 UTC. See vercel.json.

import { NextResponse } from "next/server";
import { validateCronRequest } from "@/lib/api-utils";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export const revalidate = 0;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONTEXT_TAG = "[cleanup-pending-alert-captures]";

export async function GET(request: Request): Promise<NextResponse> {
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
  console.log(`${CONTEXT_TAG} deleted ${count ?? 0} expired captures`);
  return NextResponse.json({ ok: true, deleted: count ?? 0 });
}
