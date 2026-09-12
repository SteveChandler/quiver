import { refreshLifecycleEligibility, refreshLifecycleUserEligibility } from "@/lib/subscription/offer-automation";
import { ensureGmailRepliesFresh } from "@/lib/email/gmail-replies";
import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { lifecycleDecisionSchema, lifecycleEnabled, lifecycleRpc, LIFECYCLE_CAMPAIGN, LIFECYCLE_VERSION } from "@/lib/email/lifecycle";
import { LIFECYCLE_CONTENT_HASH, renderLifecycleEmail } from "@/lib/mailer/lifecycle-email";
import { getBaseUrl, MAIL_FROM, sendReservedLifecycleEmail } from "@/lib/mailer/client";
import { createResendRateLimiter } from "@/lib/utils/email-rate-limiter";
import { generateEmailUnsubscribeToken } from "@/lib/alerts/email-token";

async function dispatchLifecycleUser(userId: string): Promise<string> {
  if (!lifecycleEnabled()) return "disabled";
  const replyTo = z.email().parse(process.env.EMAIL_REPLY_MAILBOX);
  if (process.env.EMAIL_REPLY_INGESTION_VERIFIED !== "true") throw new Error("Reply ingestion is not verified");
  const candidate = lifecycleDecisionSchema.parse(await lifecycleRpc("evaluate_email_lifecycle", { p_user_id: userId }));
  if (candidate.status !== "due") return candidate.reason;
  if (candidate.source?.audience === "free" && candidate.source.offer_id &&
    (candidate.job === "offer_ready" || candidate.job === "activation" || candidate.job === "progress")) {
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
  const users = z.array(z.uuid()).max(50).parse(await lifecycleRpc("email_lifecycle_cohort"));
  const counts: Record<string, number> = {};
  // No database mutation, provider call, or check-in in dry-run mode.
  if (dryRun) {
    for (const userId of users) {
      const d = lifecycleDecisionSchema.parse(await lifecycleRpc("evaluate_email_lifecycle", { p_user_id: userId }));
      counts[d.reason] = (counts[d.reason] ?? 0) + 1;
    }
    return { mode: "dry_run", candidates: users.length, reasons: counts, accepted: 0 };
  }
  const db = await createSupabaseServiceRoleClient();
  const { data: run, error } = await db.from("cron_runs").insert({ route: "/api/cron/email-lifecycle", job: "email-lifecycle", status: "started", summary: { campaign: LIFECYCLE_CAMPAIGN, version: LIFECYCLE_VERSION } }).select("id").single();
  if (error || !run) throw new Error("Cannot persist lifecycle run");
  let failed = false;
  try {
    const reconciliation = z.object({ unknown_handoffs: z.number(), expired_reservations: z.number() }).parse(await lifecycleRpc("reconcile_email_lifecycle"));
    if (reconciliation.unknown_handoffs > 0) {
      failed = true;
      Sentry.captureMessage("Email lifecycle has unresolved handoffs", { level: "error", tags: { component: "email-lifecycle" }, fingerprint: ["email-lifecycle-unknown"] });
      return { status: "attention", candidates: users.length, accepted: 0, reconciliation };
    }
    const eligibility = await refreshLifecycleEligibility();
    if (eligibility.failed > 0) failed = true;
    if (process.env.PRO_OFFERS_ENABLED === "true") await lifecycleRpc("enroll_automatic_pro_offers");
    await ensureGmailRepliesFresh();
    const rateLimiter = createResendRateLimiter();
    for (const userId of users) {
      await lifecycleRpc("record_email_lifecycle_decision", { p_user_id: userId });
      // Burst <=5; retain decisions for every enrolled user even when capacity is used.
      if ((counts.accepted ?? 0) >= 5) continue;
      await rateLimiter.throttle();
      const reason = await dispatchLifecycleUser(userId);
      counts[reason] = (counts[reason] ?? 0) + 1;
      if (reason === "unknown") { failed = true; break; }
    }
    const health = z.object({ due_unsent: z.number().int().nonnegative(), enrollment_pending: z.number().int().nonnegative(), approval_unavailable: z.number().int().nonnegative().default(0) }).parse(await lifecycleRpc("email_automation_health"));
    if (health.due_unsent + health.enrollment_pending + health.approval_unavailable > 0) {
      failed = true;
      Sentry.captureMessage("Email automation needs attention", { level: "warning", tags: { component: "email-lifecycle" }, extra: health, fingerprint: ["email-automation-backlog"] });
    }
    return { status: failed ? "attention" : "ok", candidates: users.length, accepted: counts.accepted ?? 0, reasons: counts, reconciliation };
  } catch (error) {
    failed = true;
    Sentry.captureException(error, { tags: { component: "email-lifecycle" } });
    throw error;
  } finally {
    const { error: finishError } = await db.from("cron_runs").update({ status: failed ? "error" : "ok", finished_at: new Date().toISOString(), produced: counts.accepted ?? 0, summary: { candidates: users.length, reasons: counts } }).eq("id", run.id);
    if (finishError) throw new Error("Cannot finish lifecycle run");
  }
}
