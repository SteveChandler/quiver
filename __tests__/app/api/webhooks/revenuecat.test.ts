/**
 * @jest-environment node
 */

import {
  buildEntitlementUpdate,
  mergeEntitlementUpdate,
  type EntitlementUpdate,
  type ExistingEntitlementRow,
  type RCEvent,
} from "@/app/api/webhooks/revenuecat/entitlement-update";

const LIFETIME_PROMO_ROW: ExistingEntitlementRow = {
  is_pro: true,
  is_trialing: false,
  expires_at: null,
  product_id: "rc_promo_Quiver Pro_lifetime",
};

function updateFor(event: RCEvent): EntitlementUpdate {
  const update = buildEntitlementUpdate(event);
  if (!update) {
    throw new Error(`Expected update for ${event.type}`);
  }
  return update;
}

describe("RevenueCat entitlement webhook updates", () => {
  it("sets Pro for a non-expiring promotional entitlement grant", () => {
    const update = updateFor({
      type: "NON_RENEWING_PURCHASE",
      app_user_id: "user-pro",
      store: "PROMOTIONAL",
      product_id: "rc_promo_Quiver Pro_lifetime",
      entitlement_ids: ["Quiver Pro"],
      environment: "PRODUCTION",
    });

    expect(update).toEqual({
      is_pro: true,
      is_trialing: false,
      trial_ends_at: null,
      expires_at: null,
      product_id: "rc_promo_Quiver Pro_lifetime",
      will_renew: false,
      billing_issue: false,
      lapsed_at: null,
    });
  });

  it("does not let a sandbox expiration downgrade lifetime promotional Pro", () => {
    const update = updateFor({
      type: "EXPIRATION",
      app_user_id: "user-pro",
      product_id: "app.quiversurf.surf.pro:annual",
      event_timestamp_ms: Date.parse("2026-05-08T21:54:14.785Z"),
      environment: "SANDBOX",
    });

    expect(
      mergeEntitlementUpdate({
        currentRow: LIFETIME_PROMO_ROW,
        update,
      }),
    ).toBeNull();
  });

  it("still lapses a normal annual entitlement on expiration", () => {
    const annualRow: ExistingEntitlementRow = {
      is_pro: true,
      is_trialing: false,
      expires_at: "2026-05-08T21:51:05.544Z",
      product_id: "app.quiversurf.surf.pro:annual",
    };
    const update = updateFor({
      type: "EXPIRATION",
      app_user_id: "user-annual",
      product_id: "app.quiversurf.surf.pro:annual",
      event_timestamp_ms: Date.parse("2026-05-08T21:54:14.785Z"),
      environment: "SANDBOX",
    });

    expect(
      mergeEntitlementUpdate({
        currentRow: annualRow,
        update,
      }),
    ).toEqual(update);
  });

  it("does not let a sandbox renewal replace lifetime promotional product or expiry", () => {
    const update = updateFor({
      type: "RENEWAL",
      app_user_id: "user-pro",
      product_id: "app.quiversurf.surf.pro:annual",
      expiration_at_ms: Date.parse("2026-05-08T21:51:05.544Z"),
      environment: "SANDBOX",
    });

    expect(
      mergeEntitlementUpdate({
        currentRow: LIFETIME_PROMO_ROW,
        update,
      }),
    ).toBeNull();
  });

  it("does not let product changes overwrite lifetime promotional Pro", () => {
    const update = updateFor({
      type: "PRODUCT_CHANGE",
      app_user_id: "user-pro",
      product_id: "app.quiversurf.surf.pro:monthly",
      expiration_at_ms: Date.parse("2026-05-08T21:51:05.544Z"),
      environment: "SANDBOX",
    });

    expect(
      mergeEntitlementUpdate({
        currentRow: LIFETIME_PROMO_ROW,
        update,
      }),
    ).toBeNull();
  });
});
