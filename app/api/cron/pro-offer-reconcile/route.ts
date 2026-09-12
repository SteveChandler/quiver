import { lifecycleRpc } from "@/lib/email/lifecycle";
import { NextResponse } from "next/server";
import { validateCronRequest } from "@/lib/middleware/api-wrappers";
import { runProOfferAutomation } from "@/lib/subscription/offer-automation";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { startCronCheckIn, completeCronCheckIn } from "@/lib/monitoring/sentry-cron";

export const dynamic = "force-dynamic";
export const maxDuration = 180;
export async function GET(request: Request): Promise<Response> {
  if (!validateCronRequest(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const mode = new URL(request.url).searchParams.get("mode") ?? "live";
  if (mode !== "live" && mode !== "dry-run") return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
  if (mode === "dry-run") return NextResponse.json({ mode, due: await lifecycleRpc("pro_offer_fulfillment_queue"), unresolved: await lifecycleRpc("pro_offer_reconciliation_queue"), granted: 0 }, { headers: { "Cache-Control": "no-store" } });
  if (process.env.PRO_OFFERS_ENABLED !== "true") return NextResponse.json({ status: "disabled" });
  const db = await createSupabaseServiceRoleClient();
  const { data: run, error } = await db.from("cron_runs").insert({ route: "/api/cron/pro-offer-reconcile", job: "pro-offer-reconcile", status: "started" }).select("id").single();
  if (error || !run) return NextResponse.json({ error: "Run ledger unavailable" }, { status: 503 });
  const slug = "pro-offer-reconcile";
  const checkIn = startCronCheckIn({ slug, schedule: "*/15 * * * *", checkinMarginMinutes: 15, maxRuntimeMinutes: 3 });
  let ok = false;
  try {
    const result = await runProOfferAutomation();
    ok = result.unresolved === 0;
    return NextResponse.json(result, { status: ok ? 200 : 503 });
  } catch {
    return NextResponse.json({ error: "Offer reconciliation failed" }, { status: 503 });
  } finally {
    const { error: finishError } = await db.from("cron_runs").update({ status: ok ? "ok" : "error", finished_at: new Date().toISOString() }).eq("id", run.id);
    await completeCronCheckIn(checkIn, slug, ok && !finishError ? "ok" : "error");
    if (finishError) return NextResponse.json({ error: "Cannot finish offer reconciliation run" }, { status: 503 });
  }
}
