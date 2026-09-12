import { NextResponse } from "next/server";
import { validateCronRequest } from "@/lib/middleware/api-wrappers";
import { syncGmailReplies } from "@/lib/email/gmail-replies";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { startCronCheckIn, completeCronCheckIn } from "@/lib/monitoring/sentry-cron";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(request: Request): Promise<Response> {
  if (!validateCronRequest(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (process.env.EMAIL_GMAIL_REPLY_SYNC_ENABLED !== "true") return NextResponse.json({ status: "disabled" });
  const db = await createSupabaseServiceRoleClient();
  const { data: run, error } = await db.from("cron_runs").insert({ route: "/api/cron/email-replies", job: "email-replies", status: "started" }).select("id").single();
  if (error || !run) return NextResponse.json({ error: "Run ledger unavailable" }, { status: 503 });
  const slug = "email-replies";
  const checkIn = startCronCheckIn({ slug, schedule: "* * * * *", checkinMarginMinutes: 2, maxRuntimeMinutes: 1 });
  let ok = false;
  try {
    const result = await syncGmailReplies(); ok = true;
    return NextResponse.json(result);
  } catch { return NextResponse.json({ error: "Reply ingestion failed; outbound eligibility stays closed until a healthy checkpoint" }, { status: 503 }); }
  finally {
    const { error: finishError } = await db.from("cron_runs").update({ status: ok ? "ok" : "error", finished_at: new Date().toISOString() }).eq("id", run.id);
    await completeCronCheckIn(checkIn, slug, ok && !finishError ? "ok" : "error");
    if (finishError) return NextResponse.json({ error: "Cannot finish reply run" }, { status: 503 });
  }
}
