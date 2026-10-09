import { runTrialFeedbackReconciliation } from "@/lib/trial-feedback/reconciliation";
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
  const slug = "email-lifecycle";
  const checkIn = dryRun ? "" : startCronCheckIn({ slug, schedule: "25 * * * *", checkinMarginMinutes: 15, maxRuntimeMinutes: 3 });
  let status: "ok" | "error" = "error";
  try {
    const feedback = dryRun ? undefined : await runTrialFeedbackReconciliation();
    const result = !dryRun && !lifecycleEnabled() ? { status: "disabled" } : await runEmailLifecycle(dryRun);
    status = result.status === "attention" || (feedback?.attention ?? 0) > 0 ? "error" : "ok";
    const errors = ["error_message" in result ? result.error_message : null, feedback && feedback.attention > 0 ? `Trial feedback reconciliation requires attention: ${feedback.attention}` : null].filter(Boolean);
    return NextResponse.json({ ...result, ...(feedback ? { trial_feedback: feedback } : {}), ...(errors.length ? { error_message: errors.join("; ") } : {}) }, { status: status === "error" ? 503 : 200 });
  } catch (error) {
    const errorMessage = (error instanceof Error ? error.message : String(error)) || "Lifecycle run failed without an error message";
    return NextResponse.json({ error: "Lifecycle run failed; inspect run records", error_message: errorMessage }, { status: 503 });
  } finally {
    if (checkIn) await completeCronCheckIn(checkIn, slug, status);
  }
}
