import {
  getUserEntitlement,
  canCreateRule,
  entitlementFromRow,
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

describe("getUserEntitlement", () => {
  const origPreview = process.env.ALERT_PREVIEW_MODE;
  const origBeta = process.env.ALERT_BETA_USER_IDS;
  afterEach(() => {
    process.env.ALERT_PREVIEW_MODE = origPreview;
    process.env.ALERT_BETA_USER_IDS = origBeta;
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
        expires_at: new Date(Date.now() - 86_400_000).toISOString(),
      },
    });
    expect(await getUserEntitlement("stale-user", supabase)).toBe("free");
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

  it("rejects free user using similarity_alert", () => {
    const result = canCreateRule({ tier: "free", homeBeachId: "beach-1", targetBeachId: "beach-1", existingRuleCount: 0, existingBeachCount: 1, isExistingBeach: true, presetType: "similarity_alert" });
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("premium");
  });

  it("allows premium user creating similarity_alert on their home beach", () => {
    const result = canCreateRule({ tier: "premium", homeBeachId: "beach-1", targetBeachId: "beach-1", existingRuleCount: 0, existingBeachCount: 1, isExistingBeach: true, presetType: "similarity_alert" });
    expect(result.allowed).toBe(true);
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

// Sanity: CAPS has the expected shape and no regressions.
describe("CAPS", () => {
  it("free tier is narrower than premium", () => {
    expect(CAPS.free.totalRules).toBeLessThan(CAPS.premium.totalRules);
    expect(CAPS.free.beaches).toBeLessThan(CAPS.premium.beaches);
  });
});
