/**
 * @jest-environment node
 */

import {
  grantPromotionalEntitlement,
  isEarnProEligible,
} from "@/lib/subscription/grant-promotional-entitlement";

interface QueryResponse {
  activeGrant?: { expires_at: string } | null;
  activeGrantError?: { message: string } | null;
  insertError?: { message: string } | null;
}

function createSupabaseMock(response: QueryResponse = {}) {
  const query: Record<string, jest.Mock> = {
    select: jest.fn(() => query),
    eq: jest.fn(() => query),
    is: jest.fn(() => query),
    gt: jest.fn(() => query),
    order: jest.fn(() => query),
    limit: jest.fn(() => query),
    maybeSingle: jest.fn(async () => ({
      data: response.activeGrant ?? null,
      error: response.activeGrantError ?? null,
    })),
    insert: jest.fn(async () => ({ error: response.insertError ?? null })),
  };
  return {
    from: jest.fn(() => query),
    query,
  };
}

const originalRevenueCatSecret = process.env.REVENUECAT_SECRET_API_KEY;
const originalEntitlementId = process.env.EARN_PRO_ENTITLEMENT_ID;

beforeEach(() => {
  process.env.REVENUECAT_SECRET_API_KEY = "rc_secret_test";
  delete process.env.EARN_PRO_ENTITLEMENT_ID;
});

afterEach(() => {
  if (originalRevenueCatSecret === undefined) {
    delete process.env.REVENUECAT_SECRET_API_KEY;
  } else {
    process.env.REVENUECAT_SECRET_API_KEY = originalRevenueCatSecret;
  }
  if (originalEntitlementId === undefined) {
    delete process.env.EARN_PRO_ENTITLEMENT_ID;
  } else {
    process.env.EARN_PRO_ENTITLEMENT_ID = originalEntitlementId;
  }
});

describe("earned Pro eligibility", () => {
  it("requires the weekly session streak as the primary gate", () => {
    expect(
      isEarnProEligible({
        weeklySessionStreakCurrent: 2,
        dailyCallStreakCurrent: 1,
      }),
    ).toBe(true);
    expect(
      isEarnProEligible({
        weeklySessionStreakCurrent: 1,
        dailyCallStreakCurrent: 12,
      }),
    ).toBe(false);
  });
});

describe("grantPromotionalEntitlement", () => {
  it("skips users with an active future earned grant", async () => {
    const supabase = createSupabaseMock({
      activeGrant: { expires_at: "2026-06-30T00:00:00.000Z" },
    });
    const fetchImpl = jest.fn();

    await expect(
      grantPromotionalEntitlement({
        supabase,
        userId: "user-123",
        streakSnapshot: {
          weeklySessionStreakCurrent: 2,
          dailyCallStreakCurrent: 1,
        },
        now: new Date("2026-06-22T00:00:00.000Z"),
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).resolves.toEqual({
      status: "skipped_active",
      expiresAt: "2026-06-30T00:00:00.000Z",
    });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(supabase.query.insert).not.toHaveBeenCalled();
  });

  it("posts a weekly promotional grant and audits the earned grant", async () => {
    const supabase = createSupabaseMock();
    const fetchImpl = jest.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => "",
    }));

    await expect(
      grantPromotionalEntitlement({
        supabase,
        userId: "user 123",
        streakSnapshot: {
          weeklySessionStreakCurrent: 2,
          weeklySessionStreakBest: 4,
          dailyCallStreakCurrent: 1,
          dailyCallStreakBest: 3,
        },
        now: new Date("2026-06-22T00:00:00.000Z"),
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).resolves.toEqual({
      status: "granted",
      expiresAt: "2026-06-29T00:00:00.000Z",
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.revenuecat.com/v1/subscribers/user%20123/entitlements/Quiver%20Pro/promotional",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer rc_secret_test",
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({ end_time_ms: 1782691200000 }),
      }),
    );
    expect(supabase.query.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user 123",
        entitlement_id: "Quiver Pro",
        reason: "weekly_session_streak",
        expires_at: "2026-06-29T00:00:00.000Z",
        streak_snapshot: expect.objectContaining({
          weeklySessionStreakCurrent: 2,
          dailyCallStreakCurrent: 1,
        }),
      }),
    );
  });

  it("fails closed when the RevenueCat secret is missing", async () => {
    delete process.env.REVENUECAT_SECRET_API_KEY;
    const supabase = createSupabaseMock();
    const fetchImpl = jest.fn();

    await expect(
      grantPromotionalEntitlement({
        supabase,
        userId: "user-123",
        streakSnapshot: {
          weeklySessionStreakCurrent: 2,
          dailyCallStreakCurrent: 1,
        },
        fetchImpl: fetchImpl as unknown as typeof fetch,
      }),
    ).resolves.toEqual({
      status: "failed",
      error: "REVENUECAT_SECRET_API_KEY is not configured",
    });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(supabase.query.insert).not.toHaveBeenCalled();
  });
});
