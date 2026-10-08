import { capturePostHogEvent } from "@/lib/posthog-server";
import {
  isPaidLifetimeProductId,
  isPromotionalProductId,
} from "@/lib/subscription/revenuecat-products";

interface RevenueCatFunnelSource {
  id?: string;
  type: string;
  product_id?: string;
  period_type?: string;
  environment?: string;
  store?: string;
  event_timestamp_ms?: number;
  purchased_at_ms?: number;
  [key: string]: unknown;
}

interface ConsentReader {
  from(table: "profiles"): {
    select(columns: "allow_implicit_tracking"): {
      eq(
        column: "id",
        value: string,
      ): {
        maybeSingle(): PromiseLike<{
          data: { allow_implicit_tracking?: boolean | null } | null;
          error: unknown;
        }>;
      };
    };
  };
}

type RevenueCatFunnelEventName =
  | "trial_started"
  | "subscription_started"
  | "trial_converted"
  | "subscription_renewed"
  | "lifetime_purchased"
  | "subscription_cancelled"
  | "subscription_uncancelled"
  | "subscription_expired"
  | "billing_issue"
  | "subscription_product_changed";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Promotional grants (support comps, rewards) are not paid conversion. */
function isPromotionalEvent(event: RevenueCatFunnelSource): boolean {
  return (
    event.store === "PROMOTIONAL" ||
    event.period_type === "PROMOTIONAL" ||
    isPromotionalProductId(event.product_id)
  );
}

export function mapRevenueCatEventToFunnelEvent(
  event: RevenueCatFunnelSource,
): RevenueCatFunnelEventName | null {
  if (isPromotionalEvent(event)) return null;

  switch (event.type) {
    case "INITIAL_PURCHASE":
      return event.period_type === "TRIAL"
        ? "trial_started"
        : "subscription_started";
    case "RENEWAL":
      return event.is_trial_conversion === true
        ? "trial_converted"
        : "subscription_renewed";
    case "NON_RENEWING_PURCHASE":
      return "lifetime_purchased";
    case "CANCELLATION":
      return "subscription_cancelled";
    case "UNCANCELLATION":
      return "subscription_uncancelled";
    case "EXPIRATION":
      return "subscription_expired";
    case "BILLING_ISSUE":
      return "billing_issue";
    case "PRODUCT_CHANGE":
      return "subscription_product_changed";
    default:
      return null;
  }
}

async function isTrackingAllowed(
  supabase: ConsentReader,
  userId: string,
): Promise<boolean> {
  // Service role has no auth.uid(), so the owner-scoped consent RPC does not
  // apply here; read the column directly like the notification worker does.
  const { data, error } = await supabase
    .from("profiles")
    .select("allow_implicit_tracking")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data?.allow_implicit_tracking === true;
}

function optionalString(value: unknown, key: string) {
  return typeof value === "string" && value ? { [key]: value } : {};
}

function optionalNumber(value: unknown, key: string) {
  return typeof value === "number" && Number.isFinite(value)
    ? { [key]: value }
    : {};
}

/**
 * Mirrors a RevenueCat webhook event into PostHog so trial and paid conversion
 * can be measured next to the product funnel. Call only after the provider
 * ledger row is stored (redeliveries of processed events return earlier). The
 * RC event id doubles as `$insert_id` and uuid, and the RC timestamp is used,
 * so a retry of an unfinished event lands on the same PostHog row.
 *
 * `userId` must be a verified Supabase user UUID: anonymous RevenueCat ids are
 * never sent. SANDBOX events are sent but tagged `is_sandbox: true`.
 * Never throws: analytics must not fail the webhook.
 */
export async function captureRevenueCatFunnelEvent({
  supabase,
  event,
  userId,
}: {
  supabase: ConsentReader;
  event: RevenueCatFunnelSource;
  userId: string | null;
}): Promise<void> {
  try {
    if (!userId || !UUID_PATTERN.test(userId) || !event.id) return;

    const name = mapRevenueCatEventToFunnelEvent(event);
    if (!name) return;

    if (!(await isTrackingAllowed(supabase, userId))) return;

    const occurredAtMs = event.event_timestamp_ms ?? event.purchased_at_ms;
    const environment = event.environment ?? "PRODUCTION";

    await capturePostHogEvent({
      distinctId: userId,
      event: name,
      timestamp:
        typeof occurredAtMs === "number" && Number.isFinite(occurredAtMs)
          ? new Date(occurredAtMs)
          : undefined,
      uuid: UUID_PATTERN.test(event.id) ? event.id : undefined,
      properties: {
        $insert_id: `revenuecat:${event.id}`,
        rc_event_id: event.id,
        rc_event_type: event.type,
        // `environment` is already the Vercel deployment environment.
        rc_environment: environment,
        is_sandbox: environment === "SANDBOX",
        ...optionalString(event.product_id, "product_id"),
        ...optionalString(event.store, "store"),
        ...optionalString(event.period_type, "period_type"),
        ...optionalNumber(event.price, "price"),
        ...optionalNumber(
          event.price_in_purchased_currency,
          "price_in_purchased_currency",
        ),
        ...optionalString(event.currency, "currency"),
        ...optionalString(event.cancel_reason, "cancel_reason"),
        ...(name === "lifetime_purchased"
          ? { is_paid_lifetime_product: isPaidLifetimeProductId(event.product_id) }
          : {}),
      },
    });
  } catch (error) {
    console.error("[analytics] RevenueCat funnel capture failed:", error);
  }
}
