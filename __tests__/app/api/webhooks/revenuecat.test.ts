/**
 * @jest-environment node
 */

import {
  buildRevenueCatProviderEventInsert,
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

const PAID_LIFETIME_ROW: ExistingEntitlementRow = {
  is_pro: true,
  is_trialing: false,
  expires_at: null,
  product_id: "app.quiversurf.surf.pro.lifetime",
};

function updateFor(event: RCEvent): EntitlementUpdate {
  const update = buildEntitlementUpdate(event);
  if (!update) {
    throw new Error(`Expected update for ${event.type}`);
  }
  return update;
}

describe("RevenueCat entitlement webhook updates", () => {
  it("builds the same immutable ledger row for duplicate provider deliveries", () => {
    const event: RCEvent = {
      id: "event-duplicate",
      type: "INITIAL_PURCHASE",
      app_user_id: "20000000-0000-4000-8000-000000000001",
      event_timestamp_ms: Date.parse("2026-08-28T00:00:00.000Z"),
      product_id: "app.quiversurf.surf.pro.annual",
      period_type: "TRIAL",
      environment: "PRODUCTION",
    };

    expect(buildRevenueCatProviderEventInsert(event)).toEqual(
      buildRevenueCatProviderEventInsert(event),
    );
    expect(buildRevenueCatProviderEventInsert(event)).toMatchObject({
      provider_event_id: "event-duplicate",
      app_user_id_status: "uuid",
      period_type: "TRIAL",
    });
  });

  it("allowlists malformed and anonymous app user ids without storing them", () => {
    expect(buildRevenueCatProviderEventInsert({
      id: "event-anonymous",
      type: "INITIAL_PURCHASE",
      app_user_id: "$RCAnonymousID:abc",
    })).toMatchObject({ app_user_id: null, app_user_id_status: "anonymous" });
    expect(buildRevenueCatProviderEventInsert({
      id: "event-malformed",
      type: "INITIAL_PURCHASE",
      app_user_id: "not-a-uuid",
    })).toMatchObject({ app_user_id: null, app_user_id_status: "invalid" });
    expect(buildRevenueCatProviderEventInsert({
      type: "INITIAL_PURCHASE",
      app_user_id: "20000000-0000-4000-8000-000000000001",
    })).toBeNull();
  });

  it("projects trial purchase then paid renewal", () => {
    expect(updateFor({
      type: "INITIAL_PURCHASE",
      period_type: "TRIAL",
      expiration_at_ms: Date.parse("2026-09-04T00:00:00.000Z"),
    })).toMatchObject({ is_pro: true, is_trialing: true });
    expect(updateFor({
      type: "RENEWAL",
      period_type: "NORMAL",
      expiration_at_ms: Date.parse("2026-10-04T00:00:00.000Z"),
    })).toMatchObject({ is_pro: true, is_trialing: false });
  });

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

  describe("paid lifetime non-consumable", () => {
    it("sets non-expiring Pro for a paid lifetime purchase", () => {
      const update = updateFor({
        type: "NON_RENEWING_PURCHASE",
        app_user_id: "user-lifetime",
        store: "APP_STORE",
        product_id: "app.quiversurf.surf.pro.lifetime",
        entitlement_ids: ["Quiver Pro"],
        environment: "PRODUCTION",
      });

      expect(update).toEqual({
        is_pro: true,
        is_trialing: false,
        trial_ends_at: null,
        expires_at: null,
        product_id: "app.quiversurf.surf.pro.lifetime",
        will_renew: false,
        billing_issue: false,
        lapsed_at: null,
      });
    });

    it("does not let a later subscription expiration downgrade paid lifetime Pro", () => {
      const update = updateFor({
        type: "EXPIRATION",
        app_user_id: "user-lifetime",
        product_id: "app.quiversurf.surf.pro.annual",
        event_timestamp_ms: Date.parse("2026-06-20T00:00:00.000Z"),
        environment: "PRODUCTION",
      });

      expect(
        mergeEntitlementUpdate({ currentRow: PAID_LIFETIME_ROW, update }),
      ).toBeNull();
    });

    it("does not let a subscription cancellation touch paid lifetime Pro", () => {
      const update = updateFor({
        type: "CANCELLATION",
        app_user_id: "user-lifetime",
        product_id: "app.quiversurf.surf.pro.annual",
        environment: "PRODUCTION",
      });

      expect(
        mergeEntitlementUpdate({ currentRow: PAID_LIFETIME_ROW, update }),
      ).toBeNull();
    });

    it("revokes paid lifetime Pro when the lifetime purchase is refunded (CANCELLATION)", () => {
      const update = updateFor({
        type: "CANCELLATION",
        app_user_id: "user-lifetime",
        product_id: "app.quiversurf.surf.pro.lifetime",
        event_timestamp_ms: Date.parse("2026-06-21T00:00:00.000Z"),
        environment: "PRODUCTION",
      });

      expect(update).toEqual({
        is_pro: false,
        is_trialing: false,
        will_renew: false,
        billing_issue: false,
        lapsed_at: "2026-06-21T00:00:00.000Z",
        previous_product_id: "app.quiversurf.surf.pro.lifetime",
      });
      expect(
        mergeEntitlementUpdate({ currentRow: PAID_LIFETIME_ROW, update }),
      ).toEqual(update);
    });

    it("revokes paid lifetime Pro when the lifetime purchase is refunded (EXPIRATION)", () => {
      const update = updateFor({
        type: "EXPIRATION",
        app_user_id: "user-lifetime",
        product_id: "app.quiversurf.surf.pro.lifetime",
        event_timestamp_ms: Date.parse("2026-06-22T00:00:00.000Z"),
        environment: "PRODUCTION",
      });

      expect(
        mergeEntitlementUpdate({ currentRow: PAID_LIFETIME_ROW, update }),
      ).toEqual(update);
    });
  });
});
