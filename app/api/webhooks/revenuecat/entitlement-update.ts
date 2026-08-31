import {
  isPaidLifetimeProductId,
  isPromotionalProductId,
  PROMOTIONAL_PRODUCT_PREFIX,
} from "@/lib/subscription/revenuecat-products";
export {
  isPaidLifetimeProductId,
  isPromotionalProductId,
} from "@/lib/subscription/revenuecat-products";

export const PRO_ENTITLEMENT_ID = "Quiver Pro";

export interface RCEvent {
  id?: string;
  type: string;
  app_user_id?: string;
  original_app_user_id?: string;
  product_id?: string;
  period_type?: "NORMAL" | "TRIAL" | "INTRO";
  purchased_at_ms?: number;
  expiration_at_ms?: number;
  event_timestamp_ms?: number;
  environment?: "SANDBOX" | "PRODUCTION";
  store?: string;
  entitlement_ids?: string[];
  [k: string]: unknown;
}

export interface RevenueCatProviderEventInsert {
  provider_event_id: string;
  app_user_id: string | null;
  app_user_id_status: "uuid" | "missing" | "anonymous" | "invalid";
  original_app_user_id: string | null;
  event_type: string;
  event_timestamp: string;
  purchased_at: string | null;
  expiration_at: string | null;
  product_id: string | null;
  period_type: string | null;
  environment: "PRODUCTION" | "SANDBOX";
  store: string | null;
  entitlement_ids: string[];
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function appUserIdStatus(
  value?: string,
): RevenueCatProviderEventInsert["app_user_id_status"] {
  if (!value) return "missing";
  if (UUID_PATTERN.test(value)) return "uuid";
  if (value.startsWith("$RCAnonymousID:")) return "anonymous";
  return "invalid";
}

function timestampFromMs(value: number | undefined, fallback: Date): string {
  return typeof value === "number" && Number.isFinite(value)
    ? new Date(value).toISOString()
    : fallback.toISOString();
}

export function buildRevenueCatProviderEventInsert(
  event: RCEvent,
  receivedAt: Date = new Date(),
): RevenueCatProviderEventInsert | null {
  if (!event.id || !event.type) return null;
  const rawAppUserId = event.app_user_id ?? event.original_app_user_id;
  const status = appUserIdStatus(rawAppUserId);
  return {
    provider_event_id: event.id,
    app_user_id: status === "uuid" ? rawAppUserId ?? null : null,
    app_user_id_status: status,
    original_app_user_id: UUID_PATTERN.test(event.original_app_user_id ?? "")
      ? event.original_app_user_id ?? null
      : null,
    event_type: event.type,
    event_timestamp: timestampFromMs(
      event.event_timestamp_ms ?? event.purchased_at_ms,
      receivedAt,
    ),
    purchased_at: event.purchased_at_ms
      ? timestampFromMs(event.purchased_at_ms, receivedAt)
      : null,
    expiration_at: event.expiration_at_ms
      ? timestampFromMs(event.expiration_at_ms, receivedAt)
      : null,
    product_id: event.product_id ?? null,
    period_type: event.period_type ?? null,
    environment: event.environment ?? "PRODUCTION",
    store: event.store ?? null,
    entitlement_ids: Array.isArray(event.entitlement_ids)
      ? event.entitlement_ids.filter((value): value is string => typeof value === "string")
      : [],
  };
}

export interface EntitlementUpdate {
  is_pro?: boolean;
  is_trialing?: boolean;
  trial_ends_at?: string | null;
  expires_at?: string | null;
  product_id?: string | null;
  will_renew?: boolean;
  billing_issue?: boolean;
  lapsed_at?: string | null;
  previous_product_id?: string | null;
}

export interface ExistingEntitlementRow {
  is_pro?: boolean | null;
  is_trialing?: boolean | null;
  expires_at?: string | null;
  product_id?: string | null;
}

function isLifetimeProductId(productId?: string | null): boolean {
  return isPromotionalProductId(productId) || isPaidLifetimeProductId(productId);
}

export function isLifetimePromotionalRow(
  row?: ExistingEntitlementRow | null,
): boolean {
  return (
    row?.is_pro === true &&
    row.expires_at == null &&
    isPromotionalProductId(row.product_id)
  );
}

function fallbackPromotionalProductId(expiresAt: string | null): string {
  return `${PROMOTIONAL_PRODUCT_PREFIX}${PRO_ENTITLEMENT_ID}_${expiresAt ? "temporary" : "lifetime"}`;
}

function nonRenewingProductId(event: RCEvent, expiresAt: string | null): string {
  return event.product_id ?? fallbackPromotionalProductId(expiresAt);
}

function isLifetimeRow(row?: ExistingEntitlementRow | null): boolean {
  return (
    row?.is_pro === true &&
    row.expires_at == null &&
    isLifetimeProductId(row.product_id)
  );
}

function isLifetimeUpdate(update: EntitlementUpdate): boolean {
  return (
    update.is_pro === true &&
    update.expires_at == null &&
    isLifetimeProductId(update.product_id)
  );
}

function revokesLifetimePurchase(update: EntitlementUpdate): boolean {
  return (
    update.is_pro === false &&
    isPaidLifetimeProductId(update.previous_product_id)
  );
}

export function mergeEntitlementUpdate({
  currentRow,
  update,
}: {
  currentRow?: ExistingEntitlementRow | null;
  update: EntitlementUpdate;
}): EntitlementUpdate | null {
  if (isLifetimeRow(currentRow) && !isLifetimeUpdate(update)) {
    if (revokesLifetimePurchase(update)) {
      return update;
    }
    return null;
  }

  return update;
}

// Maps an RC event to the column set to upsert. Returns null for events we
// deliberately ignore (TRANSFER is handled by a separate admin path; we don't
// mirror it automatically because it requires re-identifying app_user_id).
export function buildEntitlementUpdate(event: RCEvent): EntitlementUpdate | null {
  const expiresAt = event.expiration_at_ms
    ? new Date(event.expiration_at_ms).toISOString()
    : null;
  const isTrial = event.period_type === "TRIAL";

  switch (event.type) {
    case "INITIAL_PURCHASE":
    case "RENEWAL":
    case "UNCANCELLATION":
      return {
        is_pro: true,
        is_trialing: isTrial,
        trial_ends_at: isTrial ? expiresAt : null,
        expires_at: expiresAt,
        product_id: event.product_id ?? null,
        will_renew: true,
        billing_issue: false,
        lapsed_at: null,
      };

    case "NON_RENEWING_PURCHASE":
      return {
        is_pro: true,
        is_trialing: false,
        trial_ends_at: null,
        expires_at: expiresAt,
        product_id: nonRenewingProductId(event, expiresAt),
        will_renew: false,
        billing_issue: false,
        lapsed_at: null,
      };

    case "CANCELLATION":
      if (isPaidLifetimeProductId(event.product_id)) {
        return {
          is_pro: false,
          is_trialing: false,
          will_renew: false,
          billing_issue: false,
          lapsed_at: new Date(
            event.event_timestamp_ms ?? Date.now(),
          ).toISOString(),
          previous_product_id: event.product_id ?? null,
        };
      }
      return {
        will_renew: false,
      };

    case "EXPIRATION":
      return {
        is_pro: false,
        is_trialing: false,
        will_renew: false,
        billing_issue: false,
        lapsed_at: new Date(
          event.event_timestamp_ms ?? Date.now(),
        ).toISOString(),
        previous_product_id: event.product_id ?? null,
      };

    case "BILLING_ISSUE":
      return {
        billing_issue: true,
      };

    case "PRODUCT_CHANGE":
      return {
        product_id: event.product_id ?? null,
        expires_at: expiresAt,
      };

    default:
      return null;
  }
}
