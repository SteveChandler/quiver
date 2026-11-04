jest.mock("server-only", () => ({}));

const mockIsFoundingAccessEnabled = jest.fn<Promise<boolean>, []>();
jest.mock("@/lib/flags/founding-access", () => ({
  isFoundingAccessEnabled: () => mockIsFoundingAccessEnabled(),
}));

import {
  getUserEntitlement,
  canCreateRule,
  entitlementFromRow,
  resolveEntitlement,
  CAPS,
} from "@/lib/alerts/entitlements";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Minimal Supabase client stub that exposes only the chain the real impl
 * uses (`from().select().eq().maybeSingle()`) and returns a caller-provided
 * row. Lets each test control the user_entitlements lookup without a real
 * network roundtrip.
 */
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

beforeEach(() => {
  mockIsFoundingAccessEnabled.mockReset();
  mockIsFoundingAccessEnabled.mockResolvedValue(false);
});

describe("getUserEntitlement", () => {
  const origPreview = process.env.ALERT_PREVIEW_MODE;
  const origBeta = process.env.ALERT_BETA_USER_IDS;
  afterEach(() => {
    process.env.ALERT_PREVIEW_MODE = origPreview;
    process.env.ALERT_BETA_USER_IDS = origBeta;
  });

  describe("founding access switch", () => {
    beforeEach(() => {
      delete process.env.ALERT_PREVIEW_MODE;
      delete process.env.ALERT_BETA_USER_IDS;
    });

    it("ON: a free user resolves premium", async () => {
      mockIsFoundingAccessEnabled.mockResolvedValue(true);
      expect(await getUserEntitlement("user-free", makeSupabaseStub({}))).toBe("premium");
      expect(
        await getUserEntitlement(
          "user-lapsed",
          makeSupabaseStub({ "user-lapsed": { is_pro: false, is_trialing: false } }),
        ),
      ).toBe("premium");
    });

    it("OFF: a free user stays free", async () => {
      mockIsFoundingAccessEnabled.mockResolvedValue(false);
      expect(await getUserEntitlement("user-free", makeSupabaseStub({}))).toBe("free");
      expect(mockIsFoundingAccessEnabled).toHaveBeenCalledTimes(1);
    });

    it("ON: a billing-issue row without Pro stays free and never reads the switch", async () => {
      mockIsFoundingAccessEnabled.mockResolvedValue(true);
      const supabase = makeSupabaseStub({
        "user-billing": { is_pro: false, is_trialing: false, billing_issue: true },
      });
      expect(await getUserEntitlement("user-billing", supabase)).toBe("free");
      expect(mockIsFoundingAccessEnabled).not.toHaveBeenCalled();
    });

    it("Pro never reads the switch", async () => {
      mockIsFoundingAccessEnabled.mockResolvedValue(true);
      const supabase = makeSupabaseStub({ "user-pro": { is_pro: true } });
      expect(await getUserEntitlement("user-pro", supabase)).toBe("premium");
      expect(mockIsFoundingAccessEnabled).not.toHaveBeenCalled();
    });

    it("ON: premium tier lets a free user create rules beyond the free gates", async () => {
      mockIsFoundingAccessEnabled.mockResolvedValue(true);
      const tier = await getUserEntitlement("user-free", makeSupabaseStub({}));
      expect(canCreateRule({
        tier, homeBeachId: "home", targetBeachId: "other",
        existingRuleCount: 3, existingBeachCount: 1, isExistingBeach: false,
        presetType: "big_day",
      })).toEqual({ allowed: true });
    });

    it("OFF: the same request hits the free home-beach gate", async () => {
      const tier = await getUserEntitlement("user-free", makeSupabaseStub({}));
      expect(canCreateRule({
        tier, homeBeachId: "home", targetBeachId: "other",
        existingRuleCount: 3, existingBeachCount: 1, isExistingBeach: false,
        presetType: "big_day",
      })).toMatchObject({ allowed: false, code: "PERSONALIZATION_LOCKED" });
    });
  });

  it("returns premium when ALERT_PREVIEW_MODE=true (no DB read)", async () => {
    process.env.ALERT_PREVIEW_MODE = "true";
    delete process.env.ALERT_BETA_USER_IDS;
    const supabase = makeSupabaseStub({});
    expect(await getUserEntitlement("any-user", supabase)).toBe("premium");
  });

  it("returns premium for a user in ALERT_BETA_USER_IDS", async () => {
    delete process.env.ALERT_PREVIEW_MODE;
    process.env.ALERT_BETA_USER_IDS = "user-a, user-b ,user-c";
    const supabase = makeSupabaseStub({});
    expect(await getUserEntitlement("user-b", supabase)).toBe("premium");
  });

  it("does not match substrings in ALERT_BETA_USER_IDS", async () => {
    process.env.ALERT_BETA_USER_IDS = "user-a,user-b";
    const supabase = makeSupabaseStub({});
    expect(await getUserEntitlement("user-apricot", supabase)).toBe("free");
  });

  it("returns free when mirror row is missing", async () => {
    delete process.env.ALERT_PREVIEW_MODE;
    delete process.env.ALERT_BETA_USER_IDS;
    const supabase = makeSupabaseStub({});
    expect(await getUserEntitlement("unknown", supabase)).toBe("free");
  });

  it("returns premium when mirror row has is_pro=true and future expires_at", async () => {
    const supabase = makeSupabaseStub({
      "active-user": {
        is_pro: true,
        is_trialing: false,
        expires_at: new Date(Date.now() + 86_400_000).toISOString(),
      },
    });
    expect(await getUserEntitlement("active-user", supabase)).toBe("premium");
  });

  it("returns premium when mirror row has is_trialing=true", async () => {
    const supabase = makeSupabaseStub({
      "trialing-user": {
        is_pro: true,
        is_trialing: true,
        expires_at: new Date(Date.now() + 7 * 86_400_000).toISOString(),
      },
    });
    expect(await getUserEntitlement("trialing-user", supabase)).toBe("premium");
  });

  it("returns free when is_pro=true but expires_at is in the past (stale mirror)", async () => {
    // RC EXPIRATION webhook hasn't landed yet — treat as free rather than
    // extend paid access past expiry.
    const supabase = makeSupabaseStub({
      "stale-user": {
        is_pro: true,
        is_trialing: false,
        billing_issue: false,
        expires_at: new Date(Date.now() - 86_400_000).toISOString(),
      },
    });
    expect(await getUserEntitlement("stale-user", supabase)).toBe("free");
  });

  it("preserves premium during billing grace window (is_pro=true, billing_issue=true, expires_at past)", async () => {
    // Apple up to 60d / Google up to 30d retry window. During that grace,
    // expires_at is in the past but we don't want to downgrade — the whole
    // point of the grace state is keeping access while payment retries.
    const supabase = makeSupabaseStub({
      "grace-user": {
        is_pro: true,
        is_trialing: false,
        billing_issue: true,
        expires_at: new Date(Date.now() - 86_400_000).toISOString(),
      },
    });
    expect(await getUserEntitlement("grace-user", supabase)).toBe("premium");
  });

  it("returns free when is_pro=false and is_trialing=false", async () => {
    const supabase = makeSupabaseStub({
      "lapsed-user": {
        is_pro: false,
        is_trialing: false,
        expires_at: new Date(Date.now() + 86_400_000).toISOString(),
      },
    });
    expect(await getUserEntitlement("lapsed-user", supabase)).toBe("free");
  });
});

describe("entitlementFromRow (pure)", () => {
  it("returns free for null/undefined", () => {
    expect(entitlementFromRow(null)).toBe("free");
    expect(entitlementFromRow(undefined)).toBe("free");
  });

  it("returns free when neither flag is set", () => {
    expect(entitlementFromRow({ is_pro: false, is_trialing: false })).toBe("free");
  });

  it("returns premium when is_pro=true without expires_at", () => {
    // expires_at missing means no staleness check applies.
    expect(entitlementFromRow({ is_pro: true })).toBe("premium");
  });

  it("returns premium when is_trialing=true", () => {
    expect(entitlementFromRow({ is_trialing: true })).toBe("premium");
  });

  it("returns free when is_pro=true but expires_at is past", () => {
    expect(
      entitlementFromRow({
        is_pro: true,
        expires_at: new Date(Date.now() - 60_000).toISOString(),
      }),
    ).toBe("free");
  });

  it("preserves premium when billing_issue=true even if expires_at is past", () => {
    // Carve-out for Apple/Google billing retry grace window — see
    // staleness-guard comment in entitlementFromRow.
    expect(
      entitlementFromRow({
        is_pro: true,
        billing_issue: true,
        expires_at: new Date(Date.now() - 86_400_000).toISOString(),
      }),
    ).toBe("premium");
  });

  it("staleness guard applies when billing_issue=false explicitly", () => {
    expect(
      entitlementFromRow({
        is_pro: true,
        billing_issue: false,
        expires_at: new Date(Date.now() - 60_000).toISOString(),
      }),
    ).toBe("free");
  });
});

describe("canCreateRule", () => {
  it("allows free user on home beach within cap", () => {
    const result = canCreateRule({ tier: "free", homeBeachId: "beach-1", targetBeachId: "beach-1", existingRuleCount: 2, existingBeachCount: 1, isExistingBeach: true, presetType: "mellow_session" });
    expect(result.allowed).toBe(true);
  });

  it("rejects free user on non-home beach", () => {
    const result = canCreateRule({ tier: "free", homeBeachId: "beach-1", targetBeachId: "beach-2", existingRuleCount: 0, existingBeachCount: 1, isExistingBeach: false, presetType: null });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("home beach");
  });

  it("rejects free user exceeding rule cap", () => {
    const result = canCreateRule({ tier: "free", homeBeachId: "beach-1", targetBeachId: "beach-1", existingRuleCount: 3, existingBeachCount: 1, isExistingBeach: true, presetType: null });
    expect(result.allowed).toBe(false);
  });

  it("rejects free user using premium preset", () => {
    const result = canCreateRule({ tier: "free", homeBeachId: "beach-1", targetBeachId: "beach-1", existingRuleCount: 0, existingBeachCount: 1, isExistingBeach: true, presetType: "glass_off" });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("premium");
  });

  it("allows premium user on any beach within caps", () => {
    const result = canCreateRule({ tier: "premium", homeBeachId: "beach-1", targetBeachId: "beach-5", existingRuleCount: 10, existingBeachCount: 5, isExistingBeach: false, presetType: "epic_conditions" });
    expect(result.allowed).toBe(true);
  });

  it("rejects premium user exceeding beach cap with new beach", () => {
    const result = canCreateRule({ tier: "premium", homeBeachId: "beach-1", targetBeachId: "new-beach", existingRuleCount: 0, existingBeachCount: 10, isExistingBeach: false, presetType: null });
    expect(result.allowed).toBe(false);
  });

  it("allows premium user at beach cap on existing beach", () => {
    const result = canCreateRule({ tier: "premium", homeBeachId: "beach-1", targetBeachId: "beach-5", existingRuleCount: 10, existingBeachCount: 10, isExistingBeach: true, presetType: null });
    expect(result.allowed).toBe(true);
  });
});

describe("resolveEntitlement (sync cron-friendly wrapper)", () => {
  const origPreview = process.env.ALERT_PREVIEW_MODE;
  const origBeta = process.env.ALERT_BETA_USER_IDS;
  afterEach(() => {
    process.env.ALERT_PREVIEW_MODE = origPreview;
    process.env.ALERT_BETA_USER_IDS = origBeta;
  });

  it("honors ALERT_PREVIEW_MODE bypass over a null row", () => {
    delete process.env.ALERT_BETA_USER_IDS;
    process.env.ALERT_PREVIEW_MODE = "true";
    expect(resolveEntitlement("user-x", null)).toBe("premium");
  });

  it("honors ALERT_BETA_USER_IDS bypass over a free row", () => {
    delete process.env.ALERT_PREVIEW_MODE;
    process.env.ALERT_BETA_USER_IDS = "user-x";
    expect(
      resolveEntitlement("user-x", { is_pro: false, is_trialing: false }),
    ).toBe("premium");
  });

  it("falls through to entitlementFromRow when no env bypass applies", () => {
    delete process.env.ALERT_PREVIEW_MODE;
    delete process.env.ALERT_BETA_USER_IDS;
    expect(
      resolveEntitlement("user-x", {
        is_pro: true,
        expires_at: new Date(Date.now() + 86_400_000).toISOString(),
      }),
    ).toBe("premium");
    expect(resolveEntitlement("user-x", null)).toBe("free");
  });

  it("founding access ON promotes a free row to premium", () => {
    delete process.env.ALERT_PREVIEW_MODE;
    delete process.env.ALERT_BETA_USER_IDS;
    expect(resolveEntitlement("user-x", null, true)).toBe("premium");
    expect(resolveEntitlement("user-x", { is_pro: false, is_trialing: false }, true)).toBe("premium");
  });

  it("founding access ON keeps a billing-issue row without Pro on the free tier", () => {
    delete process.env.ALERT_PREVIEW_MODE;
    delete process.env.ALERT_BETA_USER_IDS;
    const row = { is_pro: false, is_trialing: false, billing_issue: true };
    expect(resolveEntitlement("user-x", row, true)).toBe("free");
    expect(resolveEntitlement("user-x", row, false)).toBe("free");
  });

  it("founding access OFF (the default) keeps a free row free", () => {
    delete process.env.ALERT_PREVIEW_MODE;
    delete process.env.ALERT_BETA_USER_IDS;
    expect(resolveEntitlement("user-x", null, false)).toBe("free");
    expect(resolveEntitlement("user-x", null)).toBe("free");
  });

  it("preserves billing-grace premium via the pure helper path", () => {
    delete process.env.ALERT_PREVIEW_MODE;
    delete process.env.ALERT_BETA_USER_IDS;
    expect(
      resolveEntitlement("user-x", {
        is_pro: true,
        billing_issue: true,
        expires_at: new Date(Date.now() - 86_400_000).toISOString(),
      }),
    ).toBe("premium");
  });
});

// Sanity: CAPS has the expected shape and no regressions.
describe("CAPS", () => {
  it("free tier is narrower than premium", () => {
    expect(CAPS.free.totalRules).toBeLessThan(CAPS.premium.totalRules);
    expect(CAPS.free.beaches).toBeLessThan(CAPS.premium.beaches);
  });
});
