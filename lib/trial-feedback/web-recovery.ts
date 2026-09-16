import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { lifecycleRpc } from "@/lib/email/lifecycle";
import { refreshLifecycleUserEligibility } from "@/lib/subscription/offer-automation";
import { webFeedbackContextSchema, type WebFeedbackContext } from "./web-contract";
import { assertOriginalWebTrial, extendWebTrial, readWebSubscription, verifyWebProduct, webManagementUrl, webSubscriptionSchema } from "./web-provider";

const date = z.iso.datetime({ offset: true });
const stateSchema = z.object({
  offer: z.object({ store: z.literal("RC_BILLING"), product_id: z.string(), terms_version: z.string(), original_starts_at: date, trial_ends_at: date, free_ends_at: date }).nullable(),
  recovery: z.object({ user_id: z.uuid(), subscription_id: z.string(), baseline: webSubscriptionSchema, state: webFeedbackContextSchema.shape.status,
    terms_version: z.string(), original_starts_at: date, original_ends_at: date, expected_ends_at: date,
    extension_verified_at: date.nullable() }).nullable(),
});
async function state(userId: string): Promise<z.infer<typeof stateSchema>> {
  const result = stateSchema.parse(await lifecycleRpc("trial_feedback_web_context", { p_user_id: userId }));
  if (result.recovery && result.recovery.user_id !== userId) throw new Error("web_recovery_account_mismatch");
  return result;
}
function accepting(): boolean {
  return process.env.TRIAL_FEEDBACK_ENABLED === "true" && process.env.TRIAL_FEEDBACK_REDEMPTION_ENABLED === "true"
    && process.env.TRIAL_FEEDBACK_WORKER_ENABLED === "true" && process.env.TRIAL_FEEDBACK_WEB_ENABLED === "true";
}
export async function getWebRecovery(userId: string): Promise<WebFeedbackContext> {
  const result = await state(userId);
  const recovery = result.recovery;
  const offer = accepting() ? result.offer : null;
  return { user_id: userId, status: recovery?.state ?? (offer ? "available" : "unavailable"),
    terms_version: recovery?.terms_version ?? offer?.terms_version ?? null,
    trial_ends_at: recovery?.original_ends_at ?? offer?.trial_ends_at ?? null,
    free_ends_at: recovery?.expected_ends_at ?? offer?.free_ends_at ?? null };
}

export async function acceptWebRecovery(userId: string, requestId: string, termsVersion: string): Promise<WebFeedbackContext> {
  if (!accepting()) throw new Error("web_recovery_disabled");
  await refreshLifecycleUserEligibility(userId);
  const existing = await state(userId);
  if (existing.recovery) return getWebRecovery(userId);
  if (!existing.offer || existing.offer.terms_version !== termsVersion) throw new Error("web_recovery_offer_unavailable");
  const subscription = await readWebSubscription(userId);
  await verifyWebProduct(subscription, existing.offer.product_id);
  assertOriginalWebTrial(subscription, existing.offer.original_starts_at, existing.offer.trial_ends_at);
  await lifecycleRpc("reserve_trial_feedback_web", { p_user_id: userId, p_request_id: requestId, p_terms_version: termsVersion, p_snapshot: subscription });
  await reconcileWebRecovery(userId);
  return getWebRecovery(userId);
}

export async function reconcileWebRecovery(userId: string): Promise<void> {
  const { recovery } = await state(userId);
  if (!recovery || recovery.state === "closed") return;
  try {
    if (recovery.state === "reserved") {
      if (!accepting()) return;
      await refreshLifecycleUserEligibility(userId);
      const current = await readWebSubscription(userId, recovery.subscription_id);
      assertOriginalWebTrial(current, recovery.original_starts_at, recovery.original_ends_at);
      if (current.product_id !== recovery.baseline.product_id || current.store_subscription_identifier !== recovery.baseline.store_subscription_identifier) throw new Error("web_recovery_subscription_changed");
      const started = z.boolean().parse(await lifecycleRpc("begin_trial_feedback_web", { p_user_id: userId }));
      if (!started) return;
      // Persisted single handoff: a timeout or HTTP error never triggers another extension request.
      await extendWebTrial(recovery.subscription_id, recovery.expected_ends_at);
    }
    const observed = await readWebSubscription(userId, recovery.subscription_id);
    await lifecycleRpc("record_trial_feedback_web", { p_user_id: userId, p_snapshot: observed, p_attention: null });
  } catch {
    Sentry.captureException(new Error("Web feedback recovery needs reconciliation"), { tags: { component: "trial-feedback-web" } });
    await lifecycleRpc("record_trial_feedback_web", { p_user_id: userId, p_snapshot: null, p_attention: "provider_readback_unconfirmed" });
  }
}

export async function getWebRecoveryPortal(userId: string): Promise<string> {
  // A returned portal URL is not renewal consent. Provider readback owns renewal confirmation.
  await reconcileWebRecovery(userId);
  const { recovery } = await state(userId);
  if (!recovery || !["extended", "renewing"].includes(recovery.state) || Date.parse(recovery.expected_ends_at) <= Date.now()) throw new Error("web_recovery_portal_unavailable");
  return webManagementUrl(recovery.subscription_id);
}

export async function runWebRecoveryQueue(): Promise<{ checked: number; attention: number }> {
  const users = z.array(z.uuid()).max(5).parse(await lifecycleRpc("claim_trial_feedback_web_queue"));
  for (const userId of users) await reconcileWebRecovery(userId);
  return { checked: users.length, attention: z.number().int().nonnegative().parse(await lifecycleRpc("trial_feedback_web_attention_count")) };
}
