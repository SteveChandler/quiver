import { refreshLifecycleEligibility, refreshLifecycleUserEligibility } from "@/lib/subscription/offer-automation";
import { checkGmailRepliesBeforeSend, gmailFailureCode } from "@/lib/email/gmail-replies";
import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { lifecycleDecisionSchema, lifecycleEnabled, lifecycleRpc, LIFECYCLE_CAMPAIGN, LIFECYCLE_VERSION, type LifecycleDecision } from "@/lib/email/lifecycle";
import { LIFECYCLE_CONTENT_HASH, renderLifecycleEmail } from "@/lib/mailer/lifecycle-email";
import { getBaseUrl, MAIL_FROM, sendReservedLifecycleEmail } from "@/lib/mailer/client";
import { createResendRateLimiter } from "@/lib/utils/email-rate-limiter";
import { generateEmailUnsubscribeToken } from "@/lib/alerts/email-token";

export function lifecycleMaxAcceptedPerRun(): number {
  const value = Number.parseInt(process.env.EMAIL_LIFECYCLE_MAX_PER_RUN ?? "", 10);
  return Number.isInteger(value) && value >= 1 && value <= 200 ? value : 5;
}

type ReplyCheckSummary = { status: "skipped" | "ok" | "failed"; checked?: number; recorded?: number; reason?: string };

async function dispatchLifecycleUser(userId: string, candidate: LifecycleDecision): Promise<string> {
  if (!lifecycleEnabled()) return "disabled";
  if (candidate.status !== "due") return candidate.reason;
  const replyTo = z.email().parse(process.env.EMAIL_REPLY_MAILBOX);
  if (candidate.job === "trial_feedback" && process.env.TRIAL_FEEDBACK_ENABLED !== "true") return "trial_feedback_disabled";
  if (candidate.job === "trial_feedback" || (candidate.source?.audience === "free" && candidate.source.offer_id &&
    (candidate.job === "offer_ready" || candidate.job === "activation" || candidate.job === "progress"))) {
    // A cached free snapshot must not sell an offer to a newly paid customer.
    await refreshLifecycleUserEligibility(userId);
  }
  const claim = z.object({ allowed: z.boolean(), reason: z.string().optional(), attempt_id: z.uuid().optional(), decision: lifecycleDecisionSchema.optional() }).parse(
    await lifecycleRpc("claim_email_lifecycle", { p_user_id: userId, p_version: LIFECYCLE_VERSION, p_content_hash: LIFECYCLE_CONTENT_HASH }));
  if (!claim.allowed) return claim.reason ?? "held";
  if (!claim.attempt_id || !claim.decision?.source) throw new Error("Invalid lifecycle reservation");
  const attemptId = claim.attempt_id;
  const origin = getBaseUrl();
  if (new URL(origin).protocol !== "https:") throw new Error("Lifecycle links require HTTPS");
  const unsubscribeUrl = `${origin}/api/email/lifecycle/unsubscribe?user_id=${userId}&token=${generateEmailUnsubscribeToken(userId)}`;
  const content = await renderLifecycleEmail(claim.decision, attemptId, origin, replyTo, unsubscribeUrl);
  return sendReservedLifecycleEmail(attemptId, {
    from: MAIL_FROM, replyTo, to: claim.decision.source.email, ...content,
    headers: { "List-Unsubscribe": `<${unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
    tags: [{ name: "campaign_id", value: LIFECYCLE_CAMPAIGN }, { name: "message_instance_id", value: attemptId }],
  });
}

export async function runEmailLifecycle(dryRun: boolean): Promise<Record<string, unknown>> {
  if (!dryRun && !lifecycleEnabled()) return { status: "disabled", accepted: 0 };
  let users: string[] = [];
  const counts: Record<string, number> = {};
  // No database mutation, provider call, or check-in in dry-run mode.
  if (dryRun) {
    users = z.array(z.uuid()).max(50).parse(await lifecycleRpc("email_lifecycle_cohort"));
    for (const userId of users) {
      const d = lifecycleDecisionSchema.parse(await lifecycleRpc("evaluate_email_lifecycle", { p_user_id: userId }));
      counts[d.reason] = (counts[d.reason] ?? 0) + 1;
    }
    return { mode: "dry_run", candidates: users.length, reasons: counts, accepted: 0 };
  }
  const db = await createSupabaseServiceRoleClient();
  const { data: run, error } = await db.from("cron_runs").insert({ route: "/api/cron/email-lifecycle", job: "email-lifecycle", status: "started", summary: { campaign: LIFECYCLE_CAMPAIGN, version: LIFECYCLE_VERSION } }).select("id").single();
  if (error || !run) throw new Error("Cannot persist lifecycle run");
  const errors: string[] = [];
  let health: { due_unsent: number; enrollment_pending: number; approval_unavailable: number } | undefined;
  let replyCheck: ReplyCheckSummary = { status: "skipped" };
  try {
    users = z.array(z.uuid()).max(50).parse(await lifecycleRpc("email_lifecycle_cohort"));
    const reconciliation = z.object({ unknown_handoffs: z.number(), expired_reservations: z.number() }).parse(await lifecycleRpc("reconcile_email_lifecycle"));
    if (reconciliation.unknown_handoffs > 0) {
      errors.push(`Email lifecycle has ${reconciliation.unknown_handoffs} unresolved handoff(s)`);
      Sentry.captureMessage("Email lifecycle has unresolved handoffs", { level: "error", tags: { component: "email-lifecycle" }, fingerprint: ["email-lifecycle-unknown"] });
      return { status: "attention", error_message: errors.join("; "), candidates: users.length, accepted: 0, reasons: counts, reconciliation };
    }
    const eligibility = await refreshLifecycleEligibility();
    if (eligibility.failed > 0) errors.push(`Lifecycle eligibility refresh failed for ${eligibility.failed} user(s)`);
    if (process.env.PRO_OFFERS_ENABLED === "true") await lifecycleRpc("enroll_automatic_pro_offers");
    const dueCandidates = await Promise.all(users.map(async userId => lifecycleDecisionSchema.parse(
      await lifecycleRpc("evaluate_email_lifecycle", { p_user_id: userId }),
    )));
    if (dueCandidates.some(candidate => candidate.status === "due")) {
      try {
        replyCheck = { status: "ok", ...(await checkGmailRepliesBeforeSend()) };
      } catch (error) {
        const reason = gmailFailureCode(error);
        errors.push(`Email reply check failed: ${reason}`);
        replyCheck = { status: "failed", reason };
        Sentry.captureMessage("Email reply check failed", {
          level: "warning", tags: { component: "email-lifecycle" }, extra: { reason }, fingerprint: ["email-reply-check-failed"],
        });
        return { status: "attention", error_message: errors.join("; "), candidates: users.length, accepted: 0, reasons: counts, reconciliation, reply_check: replyCheck };
      }
    }
    const rateLimiter = createResendRateLimiter();
    for (const [index, userId] of users.entries()) {
      await lifecycleRpc("record_email_lifecycle_decision", { p_user_id: userId });
      // Retain decisions for every enrolled user even when the burst guard is reached.
      if ((counts.accepted ?? 0) >= lifecycleMaxAcceptedPerRun()) continue;
      await rateLimiter.throttle();
      const reason = await dispatchLifecycleUser(userId, dueCandidates[index]);
      counts[reason] = (counts[reason] ?? 0) + 1;
      if (reason === "unknown") { errors.push("Email provider acceptance unknown; handoff requires reconciliation"); break; }
    }
    health = z.object({ due_unsent: z.number().int().nonnegative(), enrollment_pending: z.number().int().nonnegative(), approval_unavailable: z.number().int().nonnegative().default(0) }).parse(await lifecycleRpc("email_automation_health"));
    if (health.due_unsent + health.enrollment_pending + health.approval_unavailable > 0) {
      // Backlog and approval holds do not indicate a failed execution.
      Sentry.captureMessage("Email automation needs attention", { level: "warning", tags: { component: "email-lifecycle" }, extra: health, fingerprint: ["email-automation-backlog"] });
    }
    return { status: errors.length ? "attention" : "ok", ...(errors.length ? { error_message: errors.join("; ") } : {}), candidates: users.length, accepted: counts.accepted ?? 0, reasons: counts, reconciliation, reply_check: replyCheck, health };
  } catch (error) {
    errors.push((error instanceof Error ? error.message : String(error)) || "Lifecycle run failed without an error message");
    Sentry.captureException(error, { tags: { component: "email-lifecycle" } });
    throw error;
  } finally {
    const { error: finishError } = await db.from("cron_runs").update({ status: errors.length ? "error" : "ok", error_message: errors.length ? errors.join("; ") : null, finished_at: new Date().toISOString(), produced: counts.accepted ?? 0, summary: { candidates: users.length, reasons: counts, reply_check: replyCheck, ...(health ? { health } : {}) } }).eq("id", run.id);
    if (finishError) throw new Error("Cannot finish lifecycle run");
  }
}
