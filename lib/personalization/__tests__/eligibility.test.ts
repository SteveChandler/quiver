import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ALERT_DELIVERY_PAUSED,
  BETA_ACCESS_NOT_ENABLED,
  BILLING_ISSUE_LOCKED,
  ENTITLEMENT_SYNCING,
  PERSONALIZATION_DISABLED,
  PERSONALIZATION_LOCKED,
  PERSONALIZATION_UNLOCKED,
  getPersonalizationEligibility,
  resolvePersonalizationEligibility,
} from "@/lib/personalization/eligibility";

function makeSupabaseStub(rowByUserId: Record<string, unknown>): SupabaseClient {
  return {
    from: () => ({
      select: () => ({
        eq: (_col: string, userId: string) => ({
          maybeSingle: async () => ({
            data: rowByUserId[userId] ?? null,
            error: null,
          }),
        }),
      }),
    }),
  } as unknown as SupabaseClient;
}

describe("resolvePersonalizationEligibility", () => {
  const originalPreview = process.env.ALERT_PREVIEW_MODE;
  const originalPersonalizationBeta = process.env.PERSONALIZATION_BETA_USER_IDS;

  afterEach(() => {
    process.env.ALERT_PREVIEW_MODE = originalPreview;
    process.env.PERSONALIZATION_BETA_USER_IDS = originalPersonalizationBeta;
  });

  it("unlocks for Pro entitlement rows", () => {
    expect(
      resolvePersonalizationEligibility({
        userId: "user-pro",
        entitlementRow: { is_pro: true, is_trialing: false },
      }),
    ).toMatchObject({
      code: PERSONALIZATION_UNLOCKED,
      canUsePersonalMatch: true,
      canCreatePersonalAlert: true,
      source: "entitlement",
    });
  });

  it("unlocks for trialing entitlement rows", () => {
    expect(
      resolvePersonalizationEligibility({
        userId: "user-trial",
        entitlementRow: { is_pro: false, is_trialing: true },
      }).code,
    ).toBe(PERSONALIZATION_UNLOCKED);
  });

  it("unlocks explicit TestFlight allowlist without ALERT_PREVIEW_MODE=true", () => {
    process.env.ALERT_PREVIEW_MODE = "false";
    process.env.PERSONALIZATION_BETA_USER_IDS = "user-a, user-beta";

    expect(
      resolvePersonalizationEligibility({
        userId: "user-beta",
        entitlementRow: null,
      }),
    ).toMatchObject({
      code: PERSONALIZATION_UNLOCKED,
      canUsePersonalMatch: true,
      canCreatePersonalAlert: true,
      source: "testflight_bypass",
    });
  });

  it("does not use ALERT_PREVIEW_MODE as a personalization bypass", () => {
    process.env.ALERT_PREVIEW_MODE = "true";
    delete process.env.PERSONALIZATION_BETA_USER_IDS;

    expect(
      resolvePersonalizationEligibility({
        userId: "user-free",
        entitlementRow: null,
      }).code,
    ).toBe(PERSONALIZATION_LOCKED);
  });

  it("returns beta-not-enabled for non-allowlisted TestFlight-only access", () => {
    process.env.PERSONALIZATION_BETA_USER_IDS = "other-user";

    expect(
      resolvePersonalizationEligibility({
        userId: "user-free",
        entitlementRow: null,
        betaAccessRequired: true,
      }).code,
    ).toBe(BETA_ACCESS_NOT_ENABLED);
  });

  it("falls back to the public paid gate when beta access is not enabled", () => {
    process.env.PERSONALIZATION_BETA_USER_IDS = "other-user";

    expect(
      resolvePersonalizationEligibility({
        userId: "paid-user",
        entitlementRow: { is_pro: true, is_trialing: false },
        betaAccessRequired: true,
      }).code,
    ).toBe(PERSONALIZATION_UNLOCKED);
  });

  it("locks billing_issue rows for personalization", () => {
    expect(
      resolvePersonalizationEligibility({
        userId: "billing-user",
        entitlementRow: {
          is_pro: true,
          is_trialing: false,
          billing_issue: true,
          expires_at: new Date(Date.now() + 86_400_000).toISOString(),
        },
      }),
    ).toMatchObject({
      code: BILLING_ISSUE_LOCKED,
      canUsePersonalMatch: false,
      canCreatePersonalAlert: false,
    });
  });

  it("returns entitlement-syncing for stale active mirror rows", () => {
    expect(
      resolvePersonalizationEligibility({
        userId: "stale-user",
        entitlementRow: {
          is_pro: true,
          billing_issue: false,
          expires_at: new Date(Date.now() - 60_000).toISOString(),
        },
      }).code,
    ).toBe(ENTITLEMENT_SYNCING);
  });

  it("disabled blocks personalization", () => {
    expect(
      resolvePersonalizationEligibility({
        userId: "user-pro",
        entitlementRow: { is_pro: true },
        personalizationDisabled: true,
      }),
    ).toMatchObject({
      code: PERSONALIZATION_DISABLED,
      canUsePersonalMatch: false,
      canCreatePersonalAlert: false,
    });
  });

  it("alert delivery pause does not hide personalization UI or rule editing eligibility", () => {
    expect(
      resolvePersonalizationEligibility({
        userId: "user-pro",
        entitlementRow: { is_pro: true },
        alertDeliveryPaused: true,
      }),
    ).toMatchObject({
      code: ALERT_DELIVERY_PAUSED,
      canUsePersonalMatch: true,
      canCreatePersonalAlert: true,
      canDeliverPersonalAlert: false,
    });
  });

  it("keeps backend result codes aligned with the native Phase 1 state matrix", () => {
    expect([
      PERSONALIZATION_UNLOCKED,
      PERSONALIZATION_LOCKED,
      BILLING_ISSUE_LOCKED,
      ENTITLEMENT_SYNCING,
      BETA_ACCESS_NOT_ENABLED,
      PERSONALIZATION_DISABLED,
      ALERT_DELIVERY_PAUSED,
    ]).toEqual([
      "PERSONALIZATION_UNLOCKED",
      "PERSONALIZATION_LOCKED",
      "BILLING_ISSUE_LOCKED",
      "ENTITLEMENT_SYNCING",
      "BETA_ACCESS_NOT_ENABLED",
      "PERSONALIZATION_DISABLED",
      "ALERT_DELIVERY_PAUSED",
    ]);
  });
});

describe("getPersonalizationEligibility", () => {
  it("reads user_entitlements and applies the shared resolver", async () => {
    const supabase = makeSupabaseStub({
      "user-pro": { is_pro: true, is_trialing: false },
    });

    await expect(
      getPersonalizationEligibility("user-pro", supabase),
    ).resolves.toMatchObject({
      code: PERSONALIZATION_UNLOCKED,
      canUsePersonalMatch: true,
    });
  });
});
