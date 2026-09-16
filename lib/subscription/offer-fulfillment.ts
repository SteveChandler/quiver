import { createHash } from "node:crypto";
import { z } from "zod";
import * as Sentry from "@sentry/nextjs";
import { readOfferSubscriber, hasActiveOfferAccess, createOfferCustomer, OfferCustomerMissingError, type OfferSubscriber } from "./offer-provider";
import { offerResultSchema, type OfferResult } from "./offer-contract";
import { lifecycleRpc } from "@/lib/email/lifecycle";

const reservationSchema = z.object({
  award_id: z.uuid(), reservation_id: z.uuid(), user_id: z.uuid(),
  expires_at: z.string().datetime({ offset: true }), entitlement_id: z.string().min(1),
});
type Reservation = z.infer<typeof reservationSchema>;
function providerConfig(): { secret: string; entitlement: string } {
  return z.object({ secret: z.string().min(1), entitlement: z.string().min(1) }).parse({
    secret: process.env.REVENUECAT_SECRET_API_KEY, entitlement: process.env.EARN_PRO_ENTITLEMENT_ID ?? "Quiver Pro",
  });
}
function receipt(r: Reservation, subscriber: OfferSubscriber): Record<string, string> {
  const entitlement = subscriber.entitlements[r.entitlement_id];
  const subscription = entitlement && subscriber.subscriptions[entitlement.product_identifier];
  if (!entitlement || !subscription || subscription.store !== "promotional" || subscription.is_sandbox
    || !entitlement.product_identifier.startsWith("rc_promo_") || !entitlement.expires_date || !subscription.expires_date
    || Date.parse(entitlement.expires_date) !== Date.parse(r.expires_at) || Date.parse(subscription.expires_date) !== Date.parse(r.expires_at)) {
    throw new Error("offer_receipt_unverified");
  }
  return { user_id: r.user_id, entitlement_id: r.entitlement_id, expires_at: r.expires_at,
    store: subscription.store, product_id: entitlement.product_identifier, observed_at: new Date().toISOString() };
}

export async function fulfillProOffer(userId: string, code: string, fetchImpl: typeof fetch = fetch, preview = false): Promise<OfferResult> {
  if (process.env.PRO_OFFERS_ENABLED !== "true") return { status: "disabled" };
  z.uuid().parse(userId); z.union([z.uuid(), z.string().regex(/^[A-Za-z0-9_-]{43}$/)]).parse(code);
  const codeHash = z.uuid().safeParse(code).success
    ? z.string().regex(/^[a-f0-9]{64}$/).nullable().parse(await lifecycleRpc("owned_pro_offer_key", { p_user_id: userId, p_award_id: code }))
    : createHash("sha256").update(code).digest("hex");
  if (!codeHash) return { status: "not_found" };
  if (preview) return offerResultSchema.parse(await lifecycleRpc("preview_pro_offer", { p_user_id: userId, p_code_hash: codeHash }));
  await lifecycleRpc("request_pro_offer_claim", { p_user_id: userId, p_code_hash: codeHash });
  const config = providerConfig();
  const result = z.object({ status: z.string() }).passthrough().parse(await lifecycleRpc("reserve_pro_offer", {
    p_user_id: userId, p_code_hash: codeHash, p_entitlement_id: config.entitlement,
  }));
  if (result.status !== "reserved") return offerResultSchema.parse(result);
  const r = reservationSchema.parse(result);
  const args = { p_award_id: r.award_id, p_reservation_id: r.reservation_id };
  try {
    let subscriber: OfferSubscriber;
    try { subscriber = await readOfferSubscriber(r.user_id, config.secret, fetchImpl); }
    catch (error) {
      if (!(error instanceof OfferCustomerMissingError)) throw error;
      await createOfferCustomer(r.user_id, fetchImpl);
      subscriber = await readOfferSubscriber(r.user_id, config.secret, fetchImpl);
    }
    const active = hasActiveOfferAccess(subscriber);
    if (active) {
      await lifecycleRpc("hold_pro_offer", { ...args, p_reason: "active_provider_access" });
      return { status: "held_active_access" };
    }
  } catch (error) {
    await lifecycleRpc("hold_pro_offer", { ...args, p_reason: "provider_preflight_failed" });
    throw error;
  }
  if (await lifecycleRpc("begin_pro_offer", args) !== true) return { status: "paused" };
  try {
    const response = await fetchImpl(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(r.user_id)}/entitlements/${encodeURIComponent(r.entitlement_id)}/promotional`, {
      method: "POST", headers: { Authorization: `Bearer ${config.secret}`, "Content-Type": "application/json" },
      body: JSON.stringify({ end_time_ms: Date.parse(r.expires_at) }), signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) throw new Error("offer_provider_handoff_failed");
    // Verify through an independent read, not an HTTP acceptance or a claimed idempotency header.
    const evidence = receipt(r, await readOfferSubscriber(r.user_id, config.secret, fetchImpl));
    await lifecycleRpc("verify_pro_offer", { ...args, p_receipt: evidence });
    await lifecycleRpc("apply_verified_pro_offer_mirror", { p_award_id: r.award_id, p_receipt: evidence });
    await lifecycleRpc("reconcile_pro_offer_mirrors");
    return z.object({ status: z.literal("verified"), expires_at: z.string(), mirror_verified: z.boolean() }).parse(
      await lifecycleRpc("reserve_pro_offer", { p_user_id: userId, p_code_hash: codeHash, p_entitlement_id: config.entitlement }));
  } catch (error) {
    Sentry.captureException(error, { tags: { component: "pro-offer-fulfillment" }, extra: { awardId: r.award_id } });
    await lifecycleRpc("unknown_pro_offer", args);
    return { status: "reconciliation_required" };
  }
}

export async function reconcileProOffers(fetchImpl: typeof fetch = fetch): Promise<{ checked: number; unresolved: number }> {
  if (process.env.PRO_OFFERS_ENABLED !== "true") return { checked: 0, unresolved: 0 };
  const config = providerConfig();
  const rows = z.array(reservationSchema).max(10).parse(await lifecycleRpc("pro_offer_reconciliation_queue"));
  let unresolved = 0;
  for (const r of rows) {
    try {
      const evidence = receipt(r, await readOfferSubscriber(r.user_id, config.secret, fetchImpl));
      await lifecycleRpc("verify_pro_offer", { p_award_id: r.award_id, p_reservation_id: r.reservation_id, p_receipt: evidence });
      await lifecycleRpc("apply_verified_pro_offer_mirror", { p_award_id: r.award_id, p_receipt: evidence });
    } catch (error) {
      unresolved++;
      Sentry.captureException(error, { tags: { component: "pro-offer-reconciliation" }, extra: { awardId: r.award_id } });
    } finally {
      await lifecycleRpc("record_pro_offer_reconciliation", { p_award_id: r.award_id });
    }
  }
  const mirrors = z.object({ matched: z.number().int().nonnegative(), overdue_mirrors: z.number().int().nonnegative() }).parse(await lifecycleRpc("reconcile_pro_offer_mirrors"));
  unresolved += mirrors.overdue_mirrors;
  return { checked: rows.length, unresolved };
}
