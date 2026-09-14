import { runWebRecoveryQueue } from "./web-recovery";
import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { lifecycleRpc } from "@/lib/email/lifecycle";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export async function runTrialFeedbackReconciliation(): Promise<{ checked: number; attention: number } | undefined> {
  if (process.env.TRIAL_FEEDBACK_WORKER_ENABLED !== "true") return undefined;
  const db = await createSupabaseServiceRoleClient();
  const { data: run, error } = await db.from("cron_runs").insert({ route: "/api/cron/email-lifecycle", job: "trial-feedback-reconciliation", status: "started" }).select("id").single();
  if (error || !run) throw new Error("Cannot persist feedback reconciliation run");
  let result: { checked: number; attention: number } | undefined;
  try {
    const checked = z.number().int().nonnegative().parse(await lifecycleRpc("reconcile_trial_feedback_queue"));
    const attention = z.number().int().nonnegative().parse(await lifecycleRpc("trial_feedback_attention_count"));
    const web = await runWebRecoveryQueue();
    result = { checked: checked + web.checked, attention: attention + web.attention };
    if (result.attention) Sentry.captureMessage("Trial feedback offers need attention", { level: "warning", tags: { component: "trial-feedback" }, extra: result, fingerprint: ["trial-feedback-backlog"] });
    return result;
  } catch (error) {
    Sentry.captureException(error, { tags: { component: "trial-feedback" } });
    throw error;
  } finally {
    const { error: finishError } = await db.from("cron_runs").update({ status: result && !result.attention ? "ok" : "error", finished_at: new Date().toISOString(), summary: result ?? { status: "failed" } }).eq("id", run.id);
    if (finishError) throw new Error("Cannot finish feedback reconciliation run");
  }
}
