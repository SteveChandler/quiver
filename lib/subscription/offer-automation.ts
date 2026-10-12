import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { lifecycleRpc } from "@/lib/email/lifecycle";
import { fulfillProOffer, reconcileProOffers } from "./offer-fulfillment";
import { readOfferSubscriber, hasActiveOfferAccess, OfferCustomerMissingError } from "./offer-provider";

export async function refreshLifecycleUserEligibility(userId: string, fetchImpl: typeof fetch = fetch): Promise<void> {
  const secret = z.string().min(1).parse(process.env.REVENUECAT_SECRET_API_KEY);
  await lifecycleRpc("record_lifecycle_entitlement_attempt", { p_user_id: userId });
  let active = false;
  let trial: { product_id: string; expires_at: string; will_renew: boolean | null; store: string; billing_issue: boolean | null } | null = null;
  try {
    const subscriber = await readOfferSubscriber(userId, secret, fetchImpl);
    active = hasActiveOfferAccess(subscriber);
    const entitlement = subscriber.entitlements[process.env.EARN_PRO_ENTITLEMENT_ID ?? "Quiver Pro"];
    const subscription = entitlement && subscriber.subscriptions[entitlement.product_identifier];
    if (entitlement?.expires_date && Date.parse(entitlement.expires_date) > Date.now() && subscription?.is_sandbox === false && subscription.period_type === "trial") {
      trial = { store: subscription.store, billing_issue: subscription.billing_issues_detected_at === undefined ? null : subscription.billing_issues_detected_at !== null, product_id: entitlement.product_identifier, expires_at: entitlement.expires_date, will_renew: subscription.unsubscribe_detected_at === undefined ? null : subscription.unsubscribe_detected_at === null };
    }
  }
  catch (error) { if (!(error instanceof OfferCustomerMissingError)) throw error; }
  await lifecycleRpc("record_lifecycle_provider_snapshot", { p_user_id: userId, p_active: active, p_trial: trial });
}

export async function refreshLifecycleEligibility(fetchImpl: typeof fetch = fetch): Promise<{ checked: number; failed: number }> {
  await lifecycleRpc("refresh_lifecycle_enrollment");
  let checked = 0, failed = 0;
  // ponytail: one 24-user batch per hourly run covered ~144 users inside the 6h
  // validity window, so most of a larger audience was always held as stale. Drain
  // up to 8 batches (~1,150 users per 6h); raise the cap or the validity if enrollment outgrows it.
  for (let batch = 0; batch < 8; batch++) {
    const users = z.array(z.uuid()).max(24).parse(await lifecycleRpc("lifecycle_entitlement_queue"));
    for (let offset = 0; offset < users.length; offset += 3) {
      const results = await Promise.allSettled(users.slice(offset, offset + 3).map(async userId => {
        await refreshLifecycleUserEligibility(userId, fetchImpl);
      }));
      for (const result of results) if (result.status === "rejected") {
        failed++;
        Sentry.captureException(result.reason, { tags: { component: "email-entitlement-refresh" } });
      } else checked++;
    }
    if (users.length < 24) break;
  }
  return { checked, failed };
}

export async function runProOfferAutomation(fetchImpl: typeof fetch = fetch): Promise<{ checked: number; unresolved: number; attempted: number; enrolled: number }> {
  if (process.env.PRO_OFFERS_ENABLED !== "true") return { checked: 0, unresolved: 0, attempted: 0, enrolled: 0 };
  const health = z.object({ approval_unavailable: z.number().int().nonnegative().default(0) }).parse(await lifecycleRpc("email_automation_health"));
  const enrolled = z.number().int().nonnegative().parse(await lifecycleRpc("enroll_automatic_pro_offers"));
  const reconciliation = await reconcileProOffers(fetchImpl);
  const queue = z.array(z.object({ user_id: z.uuid(), award_id: z.uuid() })).max(2).parse(await lifecycleRpc("pro_offer_fulfillment_queue"));
  let unresolved = reconciliation.unresolved + health.approval_unavailable;
  for (const award of queue) {
    try {
      const result = await fulfillProOffer(award.user_id, award.award_id, fetchImpl);
      if (result.status === "reconciliation_required") unresolved++;
    } catch (error) {
      unresolved++;
      Sentry.captureException(error, { tags: { component: "pro-offer-worker" }, extra: { awardId: award.award_id } });
    } finally {
      await lifecycleRpc("defer_pro_offer_retry", { p_award_id: award.award_id });
    }
  }
  return { ...reconciliation, unresolved, attempted: queue.length, enrolled };
}
