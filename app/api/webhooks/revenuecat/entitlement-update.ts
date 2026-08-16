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
