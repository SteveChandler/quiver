import { NextResponse } from "next/server";
import { validateCronRequest } from "@/lib/middleware/api-wrappers";
import { runEmailLifecycle } from "@/lib/email/lifecycle-dispatcher";
import { lifecycleEnabled } from "@/lib/email/lifecycle";
import { startCronCheckIn, completeCronCheckIn } from "@/lib/monitoring/sentry-cron";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

export async function GET(request: Request): Promise<Response> {
  if (!validateCronRequest(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const mode = new URL(request.url).searchParams.get("mode");
  if (mode && mode !== "dry-run" && mode !== "live") return NextResponse.json({ error: "Invalid mode" }, { status: 400 });
  const dryRun = mode === "dry-run";
  if (!dryRun && !lifecycleEnabled()) return NextResponse.json({ status: "disabled" });
  const slug = "email-lifecycle";
  const checkIn = dryRun ? "" : startCronCheckIn({ slug, schedule: "*/15 * * * *", checkinMarginMinutes: 15, maxRuntimeMinutes: 3 });
  let status: "ok" | "error" = "error";
  try {
    const result = await runEmailLifecycle(dryRun);
    status = result.status === "attention" ? "error" : "ok";
    return NextResponse.json(result, { status: status === "error" ? 503 : 200 });
  } catch {
    return NextResponse.json({ error: "Lifecycle run failed; inspect run records" }, { status: 503 });
  } finally {
    if (checkIn) await completeCronCheckIn(checkIn, slug, status);
  }
}
