/**
 * @jest-environment node
 */

import {
  buildEntitlementReconciliationReport,
  buildReadPageRange,
  chunkReadIds,
  classifyEntitlement,
  readAllRows,
} from "@/lib/subscription/reconciliation-report";

const NOW = new Date("2026-08-15T12:00:00.000Z");

describe("RevenueCat entitlement reconciliation report", () => {
  it.each([
    [
      "production paid",
      {
        user_id: "paid",
        is_pro: true,
        product_id: "app.quiversurf.surf.pro:annual",
        rc_raw: { environment: "PRODUCTION", type: "RENEWAL" },
      },
      "production-paid",
    ],
    [
      "promotional lifetime",
      {
        user_id: "promo",
        is_pro: true,
        product_id: "rc_promo_Quiver Pro_lifetime",
        rc_raw: { environment: "PRODUCTION", type: "NON_RENEWING_PURCHASE" },
      },
      "promo-lifetime",
    ],
    [
      "paid lifetime",
      {
        user_id: "paid-lifetime",
        is_pro: true,
        product_id: "app.quiversurf.surf.pro.lifetime",
        rc_raw: { environment: "PRODUCTION", type: "NON_RENEWING_PURCHASE" },
      },
      "production-paid",
    ],
    [
      "trial",
      {
        user_id: "trial",
        is_pro: true,
        is_trialing: true,
        product_id: "app.quiversurf.surf.pro:annual",
        rc_raw: { environment: "PRODUCTION", period_type: "TRIAL" },
      },
      "trial",
    ],
    [
      "active billing issue",
      {
        user_id: "billing-active",
        is_pro: true,
        billing_issue: true,
        expires_at: "2026-08-20T00:00:00.000Z",
        product_id: "app.quiversurf.surf.pro:annual",
        rc_raw: { environment: "PRODUCTION", type: "BILLING_ISSUE" },
      },
      "billing-issue",
    ],
    [
      "past-expiry billing issue",
      {
        user_id: "billing-past-expiry",
        is_pro: true,
        billing_issue: true,
        expires_at: "2026-08-01T00:00:00.000Z",
        product_id: "app.quiversurf.surf.pro:annual",
        rc_raw: { environment: "PRODUCTION", type: "BILLING_ISSUE" },
      },
      "billing-issue",
    ],
    [
      "lapsed",
      {
        user_id: "lapsed",
        is_pro: false,
        lapsed_at: "2026-08-01T00:00:00.000Z",
        product_id: "app.quiversurf.surf.pro:annual",
        rc_raw: { environment: "PRODUCTION", type: "EXPIRATION" },
      },
      "lapsed",
    ],
    [
      "sandbox",
      {
        user_id: "sandbox",
        is_pro: true,
        product_id: "app.quiversurf.surf.pro:annual",
        rc_raw: { environment: "SANDBOX", type: "RENEWAL" },
      },
      "sandbox",
    ],
    [
      "mock profile",
      {
        user_id: "mock",
        is_pro: true,
        product_id: "app.quiversurf.surf.pro:annual",
        is_mock: true,
        rc_raw: { environment: "PRODUCTION", type: "RENEWAL" },
      },
      "mock-test",
    ],
    [
      "orphan entitlement",
      {
        user_id: "orphan",
        is_pro: true,
        profile_found: false,
        product_id: "app.quiversurf.surf.pro:annual",
        rc_raw: { environment: "PRODUCTION", type: "RENEWAL" },
      },
      "unknown",
    ],
  ])("separates %s rows", (_label, row, segment) => {
    expect(classifyEntitlement(row, NOW)).toBe(segment);
  });

  it("keeps the failed webhook queue separate and reports retries by event", () => {
    const report = buildEntitlementReconciliationReport(
      [
        {
          user_id: "paid",
          is_pro: true,
          product_id: "app.quiversurf.surf.pro:annual",
          rc_raw: { environment: "PRODUCTION", type: "RENEWAL" },
        },
      ],
      [
        {
          id: "failed-1",
          event_type: "EXPIRATION",
          retry_count: 2,
        },
        {
          id: "failed-2",
          event_type: "EXPIRATION",
          retry_count: 1,
        },
        {
          id: "failed-3",
          event_type: null,
          retry_count: 0,
        },
      ],
      NOW,
    );

    expect(report.read_only).toBe(true);
    expect(report.entitlements.total).toBe(1);
    expect(report.entitlements.by_segment["production-paid"]).toBe(1);
    expect(report.failed_webhook_queue).toEqual({
      pending_count: 3,
      retry_count: 3,
      by_event_type: { EXPIRATION: 2, unknown: 1 },
    });
  });

  it("builds deterministic page ranges and profile chunks at the row cap", () => {
    expect(buildReadPageRange(0)).toEqual({ from: 0, to: 999 });
    expect(buildReadPageRange(2, 3)).toEqual({ from: 6, to: 8 });
    expect(chunkReadIds(["a", "b", "c", "d", "e"], 2)).toEqual([
      ["a", "b"],
      ["c", "d"],
      ["e"],
    ]);
  });

  it("aggregates a full page and a final partial page without skipping rows", async () => {
    const readPage = jest.fn(async ({ from, to }: { from: number; to: number }) => {
      if (from === 0 && to === 999) {
        return { data: Array.from({ length: 1000 }, (_, index) => index), error: null };
      }
      if (from === 1000 && to === 1999) {
        return { data: [1000, 1001], error: null };
      }
      throw new Error(`unexpected range ${from}-${to}`);
    });

    const rows = await readAllRows(readPage);

    expect(rows).toHaveLength(1002);
    expect(rows[0]).toBe(0);
    expect(rows.at(-1)).toBe(1001);
    expect(readPage).toHaveBeenCalledTimes(2);
  });

  it("propagates a page read error and stops pagination", async () => {
    const readPage = jest.fn(async () => ({
      data: null,
      error: { message: "queue unavailable" },
    }));

    await expect(readAllRows(readPage)).rejects.toThrow("queue unavailable");
    expect(readPage).toHaveBeenCalledTimes(1);
  });
});
