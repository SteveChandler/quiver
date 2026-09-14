import { z } from "zod";
import { readOfferSubscriber } from "@/lib/subscription/offer-provider";

const milliseconds = z.number().int().positive().max(8640000000000000);
export const webSubscriptionSchema = z.object({
  object: z.literal("subscription"), id: z.string().regex(/^sub[a-zA-Z0-9]+$/),
  customer_id: z.string(), original_customer_id: z.string(), product_id: z.string().regex(/^prod[a-zA-Z0-9]+$/),
  starts_at: milliseconds, current_period_starts_at: milliseconds, current_period_ends_at: milliseconds,
  environment: z.literal("production"), store: z.literal("rc_billing"), ownership: z.literal("purchased"),
  store_subscription_identifier: z.string().min(1), status: z.string(), gives_access: z.boolean(), pending_payment: z.boolean(),
  auto_renewal_status: z.string(), total_revenue_in_usd: z.object({ currency: z.literal("USD"), gross: z.number().finite() }),
  pending_changes: z.null().optional(), product_change: z.null().optional(),
});
type WebSubscription = z.infer<typeof webSubscriptionSchema>;

async function api(path: string, body?: unknown): Promise<unknown> {
  const project = z.string().regex(/^proj[a-zA-Z0-9]+$/).parse(process.env.REVENUECAT_PROJECT_ID);
  const secret = z.string().min(1).parse(process.env.REVENUECAT_V2_SECRET_API_KEY);
  let response: Response;
  try {
    response = await fetch(`https://api.revenuecat.com/v2/projects/${project}${path}`, {
      method: body === undefined ? "GET" : "POST", headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }), cache: "no-store", redirect: "error", signal: AbortSignal.timeout(5_000),
    });
  } catch { throw new Error("web_billing_request_unconfirmed"); }
  if (response.status !== 200) throw new Error(`web_billing_http_${response.status}`);
  try { return await response.json(); } catch { throw new Error("web_billing_response_invalid"); }
}

export async function readWebSubscription(userId: string, subscriptionId?: string): Promise<WebSubscription> {
  // Reuse the existing alias/identified-account guard; never create a customer for recovery.
  await readOfferSubscriber(userId, z.string().min(1).parse(process.env.REVENUECAT_SECRET_API_KEY), fetch);
  let value: unknown;
  if (subscriptionId) {
    z.string().regex(/^sub[a-zA-Z0-9]+$/).parse(subscriptionId);
    value = await api(`/subscriptions/${subscriptionId}`);
  } else {
    const list = z.object({ items: z.array(z.object({ gives_access: z.boolean() }).passthrough()).max(100), next_page: z.null() })
      .parse(await api(`/customers/${encodeURIComponent(userId)}/subscriptions?environment=production&limit=100`));
    const active = list.items.filter(item => item.gives_access);
    if (active.length !== 1) throw new Error("web_billing_subscription_ambiguous");
    value = active[0];
  }
  const result = webSubscriptionSchema.parse(value);
  if (result.customer_id !== userId || result.original_customer_id !== userId || (subscriptionId && result.id !== subscriptionId)) throw new Error("web_billing_account_mismatch");
  return result;
}

export async function verifyWebProduct(subscription: WebSubscription, storeProductId: string): Promise<void> {
  const product = z.object({ id: z.string(), store_identifier: z.string(), type: z.literal("subscription"), state: z.literal("active"),
    subscription: z.object({ trial_duration: z.enum(["P2W", "P14D"]) }) }).parse(await api(`/products/${subscription.product_id}`));
  if (product.id !== subscription.product_id || product.store_identifier !== storeProductId) throw new Error("web_billing_product_mismatch");
}

export function assertOriginalWebTrial(subscription: WebSubscription, originalStart: string, originalEnd: string): void {
  if (subscription.status !== "trialing" || !subscription.gives_access || subscription.pending_payment || subscription.auto_renewal_status !== "will_not_renew"
    || subscription.total_revenue_in_usd.gross !== 0 || subscription.starts_at !== Date.parse(originalStart)
    || subscription.current_period_starts_at !== Date.parse(originalStart) || subscription.current_period_ends_at !== Date.parse(originalEnd)
    || subscription.current_period_ends_at <= Date.now() + 300_000) throw new Error("web_billing_trial_changed");
}

export async function extendWebTrial(subscriptionId: string, until: string): Promise<void> {
  z.string().regex(/^sub[a-zA-Z0-9]+$/).parse(subscriptionId);
  await api(`/subscriptions/${subscriptionId}/actions/extend`, { extend_until_ms: milliseconds.parse(Date.parse(until)) });
}

export async function webManagementUrl(subscriptionId: string): Promise<string> {
  z.string().regex(/^sub[a-zA-Z0-9]+$/).parse(subscriptionId);
  const result = z.object({ object: z.literal("authenticated_management_url"), management_url: z.string() })
    .parse(await api(`/subscriptions/${subscriptionId}/authenticated_management_url`));
  const url = new URL(result.management_url);
  if (url.origin !== "https://billing.revenuecat.com" || url.username || url.password || url.hash || !url.pathname.endsWith(`/${subscriptionId}`)
    || !/^\/app[a-zA-Z0-9]+\/sub[a-zA-Z0-9]+$/.test(url.pathname) || !url.searchParams.get("token")) throw new Error("web_billing_portal_invalid");
  return url.toString();
}
