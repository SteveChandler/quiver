import { z } from "zod";

export class OfferCustomerMissingError extends Error {}

const subscriberSchema = z.object({ subscriber: z.object({
  original_app_user_id: z.string(),
  entitlements: z.record(z.string(), z.object({ expires_date: z.string().nullable(), grace_period_expires_date: z.string().nullable().optional(), product_identifier: z.string() })),
  subscriptions: z.record(z.string(), z.object({ store: z.string(), period_type: z.string().optional(), is_sandbox: z.boolean(), expires_date: z.string().nullable() })),
}) });
export type OfferSubscriber = z.infer<typeof subscriberSchema>["subscriber"];

export async function readOfferSubscriber(userId: string, secret: string, fetchImpl: typeof fetch): Promise<OfferSubscriber> {
  const project = z.string().regex(/^proj[a-zA-Z0-9]+$/).parse(process.env.REVENUECAT_PROJECT_ID);
  const v2Secret = z.string().min(1).parse(process.env.REVENUECAT_V2_SECRET_API_KEY);
  const path = `/v2/projects/${project}/customers/${encodeURIComponent(userId)}`;
  async function read(pathname: string): Promise<unknown> {
    const response = await fetchImpl(`https://api.revenuecat.com${pathname}`, {
      headers: { Authorization: `Bearer ${v2Secret}` }, signal: AbortSignal.timeout(5_000), cache: "no-store",
    });
    if (response.status === 404 && pathname === path) throw new OfferCustomerMissingError("offer_customer_unavailable");
    if (response.status !== 200) throw new Error("offer_customer_unavailable");
    return response.json();
  }
  // v2 is read-only: a missing customer never reaches v1's get-or-create endpoint.
  const customer = z.object({ id: z.string(), project_id: z.string() }).parse(await read(path));
  if (customer.project_id !== project) throw new Error("offer_identity_requires_review");
  const aliases = new Set([customer.id]);
  let next: string | null = `${path}/aliases?limit=100`;
  for (let page = 0; next && page < 3; page++) {
    const result = z.object({ items: z.array(z.object({ id: z.string() })).max(100), next_page: z.string().nullable() }).parse(await read(next));
    result.items.forEach(alias => aliases.add(alias.id));
    next = result.next_page;
    if (next && !next.startsWith(`${path}/aliases?`)) throw new Error("offer_alias_pagination_invalid");
  }
  if (next || !aliases.has(userId) || [...aliases].some(id => id !== userId && !/^\$RCAnonymousID:[a-zA-Z0-9]+$/.test(id))) {
    throw new Error("offer_identity_requires_review");
  }
  const response = await fetchImpl(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`, {
    headers: { Authorization: `Bearer ${secret}` }, signal: AbortSignal.timeout(5_000), cache: "no-store",
  });
  if (response.status !== 200) throw new Error("offer_subscriber_unavailable_or_created");
  const subscriber = subscriberSchema.parse(await response.json()).subscriber;
  if (!aliases.has(subscriber.original_app_user_id)) throw new Error("offer_identity_requires_review");
  return subscriber;
}

export function hasActiveOfferAccess(subscriber: OfferSubscriber): boolean {
  return Object.values(subscriber.entitlements).some(e => {
    if (e.expires_date === null) return true;
    const expiry = Math.max(Date.parse(e.expires_date), e.grace_period_expires_date ? Date.parse(e.grace_period_expires_date) : 0);
    if (!Number.isFinite(expiry)) throw new Error("offer_expiry_unverifiable");
    return expiry > Date.now();
  });
}

export async function createOfferCustomer(userId: string, fetchImpl: typeof fetch): Promise<void> {
  const project = z.string().regex(/^proj[a-zA-Z0-9]+$/).parse(process.env.REVENUECAT_PROJECT_ID);
  const secret = z.string().min(1).parse(process.env.REVENUECAT_V2_SECRET_API_KEY);
  const response = await fetchImpl(`https://api.revenuecat.com/v2/projects/${project}/customers`, {
    method: "POST", headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
    body: JSON.stringify({ id: userId }), signal: AbortSignal.timeout(5_000),
  });
  // A lost create response is safe to recover by reading this same account next run.
  if (response.status !== 201 && response.status !== 409) throw new Error("offer_customer_creation_unavailable");
}
