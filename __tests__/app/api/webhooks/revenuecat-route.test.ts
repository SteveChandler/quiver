/** @jest-environment node */

const ledgerInsert = jest.fn();
const ledgerExisting = jest.fn();
const ledgerUpdate = jest.fn();
const ledgerMarkProcessed = jest.fn();
const entitlementRead = jest.fn();
const entitlementUpsert = jest.fn();
const dlqInsert = jest.fn();
const createServiceClient = jest.fn();

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: (...args: unknown[]) => createServiceClient(...args),
}));
jest.mock("@/lib/alerts/auto-enable-similarity", () => ({
  ensureSimilarityRuleForUser: jest.fn().mockResolvedValue({ created: false, reason: "test" }),
}));
jest.mock("@sentry/nextjs", () => ({ captureException: jest.fn() }));

import { POST } from "@/app/api/webhooks/revenuecat/route";
import { expectConsoleErrors } from "@/__tests__/setup/test-utils";

function selectChain(result: jest.Mock): Record<string, jest.Mock> {
  const chain: Record<string, jest.Mock> = {};
  for (const method of ["eq", "order", "limit"]) {
    chain[method] = jest.fn(() => chain);
  }
  chain.maybeSingle = result;
  return chain;
}

function request(event: Record<string, unknown>): Request {
  return new Request("https://quiver.test/api/webhooks/revenuecat", {
    method: "POST",
    headers: { authorization: "Bearer test-secret", "content-type": "application/json" },
    body: JSON.stringify({ event }),
  });
}

describe("RevenueCat webhook provider ledger", () => {
  beforeEach(() => {
    process.env.REVENUECAT_WEBHOOK_SECRET = "test-secret";
    ledgerInsert.mockReset().mockResolvedValue({ error: null });
    ledgerExisting.mockReset().mockResolvedValue({ data: null, error: null });
    ledgerUpdate.mockReset().mockImplementation(() => ({ eq: ledgerMarkProcessed }));
    ledgerMarkProcessed.mockReset().mockResolvedValue({ error: null });
    entitlementRead.mockReset().mockResolvedValue({ data: null, error: null });
    entitlementUpsert.mockReset().mockResolvedValue({ error: null });
    dlqInsert.mockReset().mockResolvedValue({ error: null });
    createServiceClient.mockReset().mockResolvedValue({
      from: (table: string) => {
        if (table === "revenuecat_provider_events") {
          return {
            insert: ledgerInsert,
            select: () => selectChain(ledgerExisting),
            update: ledgerUpdate,
          };
        }
        if (table === "user_entitlements") {
          return { select: () => selectChain(entitlementRead), upsert: entitlementUpsert };
        }
        if (table === "user_entitlements_failed_webhooks") return { insert: dlqInsert };
        throw new Error(`Unexpected table: ${table}`);
      },
    });
  });

  it("skips a duplicate whose entitlement processing already completed", async () => {
    ledgerInsert.mockResolvedValue({ error: { code: "23505", message: "duplicate key" } });
    ledgerExisting.mockResolvedValue({
      data: { processed_at: "2026-08-28T00:01:00.000Z" },
      error: null,
    });
    const response = await POST(request({
      id: "event-1",
      type: "INITIAL_PURCHASE",
      app_user_id: "20000000-0000-4000-8000-000000000001",
      event_timestamp_ms: Date.parse("2026-08-28T00:00:00.000Z"),
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, duplicate: true });
    expect(entitlementRead).not.toHaveBeenCalled();
    expect(entitlementUpsert).not.toHaveBeenCalled();
    expect(ledgerMarkProcessed).not.toHaveBeenCalled();
  });

  it("reprocesses a duplicate whose prior entitlement attempt did not complete", async () => {
    ledgerInsert.mockResolvedValue({ error: { code: "23505", message: "duplicate key" } });
    ledgerExisting.mockResolvedValue({ data: { processed_at: null }, error: null });
    const response = await POST(request({
      id: "event-unfinished",
      type: "INITIAL_PURCHASE",
      app_user_id: "20000000-0000-4000-8000-000000000006",
      product_id: "app.quiversurf.surf.pro.annual",
    }));

    expect(response.status).toBe(200);
    expect(entitlementUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "20000000-0000-4000-8000-000000000006",
        is_pro: true,
      }),
      { onConflict: "user_id" },
    );
    expect(ledgerMarkProcessed).toHaveBeenCalledWith(
      "provider_event_id",
      "event-unfinished",
    );
    expect(ledgerUpdate).toHaveBeenCalledWith({
      processed_at: expect.any(String),
    });
  });

  it("records ledger failure with a user id while preserving a successful entitlement update", async () => {
    ledgerInsert.mockResolvedValue({ error: { code: "500", message: "ledger unavailable" } });
    const response = await POST(request({
      id: "event-2",
      type: "INITIAL_PURCHASE",
      app_user_id: "20000000-0000-4000-8000-000000000002",
      event_timestamp_ms: Date.parse("2026-08-28T00:00:00.000Z"),
      product_id: "app.quiversurf.surf.pro.annual",
    }));
    expectConsoleErrors([/Provider event ledger insert failed/]);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, event_type: "INITIAL_PURCHASE" });
    expect(dlqInsert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: "20000000-0000-4000-8000-000000000002",
      error_message: "provider_event_ledger: ledger unavailable",
    }));
    expect(entitlementUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "20000000-0000-4000-8000-000000000002", is_pro: true }),
      { onConflict: "user_id" },
    );
  });

  it("records thrown ledger writes without blocking entitlement processing", async () => {
    ledgerInsert.mockRejectedValue(new Error("ledger request threw"));
    const response = await POST(request({
      id: "event-thrown",
      type: "INITIAL_PURCHASE",
      app_user_id: "20000000-0000-4000-8000-000000000004",
    }));
    expectConsoleErrors([/Provider event ledger insert threw/]);

    expect(response.status).toBe(200);
    expect(dlqInsert).toHaveBeenCalledWith(expect.objectContaining({
      error_message: "provider_event_ledger: ledger request threw",
    }));
    expect(entitlementUpsert).toHaveBeenCalled();
  });

  it("records missing provider event ids without blocking entitlement processing", async () => {
    const response = await POST(request({
      type: "INITIAL_PURCHASE",
      app_user_id: "20000000-0000-4000-8000-000000000005",
    }));
    expectConsoleErrors([/Provider event missing immutable id/]);

    expect(response.status).toBe(200);
    expect(ledgerInsert).not.toHaveBeenCalled();
    expect(dlqInsert).toHaveBeenCalledWith(expect.objectContaining({
      error_message: "provider_event_ledger: missing immutable provider event id",
    }));
    expect(entitlementUpsert).toHaveBeenCalled();
  });

  it("always applies a delayed old event; ordering repair belongs to ledger replay", async () => {
    const response = await POST(request({
      id: "old-purchase",
      type: "INITIAL_PURCHASE",
      app_user_id: "20000000-0000-4000-8000-000000000003",
      event_timestamp_ms: Date.parse("2026-08-28T01:00:00.000Z"),
      expiration_at_ms: Date.parse("2026-09-28T01:00:00.000Z"),
    }));

    expect(response.status).toBe(200);
    expect(entitlementUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "20000000-0000-4000-8000-000000000003",
        is_pro: true,
        expires_at: "2026-09-28T01:00:00.000Z",
      }),
      { onConflict: "user_id" },
    );
    expect(ledgerMarkProcessed).toHaveBeenCalledWith(
      "provider_event_id",
      "old-purchase",
    );
  });

  it("returns 500 when ledger and DLQ writes fail, then completes on RevenueCat retry", async () => {
    ledgerInsert
      .mockResolvedValueOnce({ error: { code: "500", message: "ledger unavailable" } })
      .mockResolvedValueOnce({ error: null });
    dlqInsert.mockResolvedValueOnce({ error: { message: "DLQ unavailable" } });
    const event = {
      id: "event-retry",
      type: "INITIAL_PURCHASE",
      app_user_id: "20000000-0000-4000-8000-000000000007",
      product_id: "app.quiversurf.surf.pro.annual",
    };

    const failedResponse = await POST(request(event));
    expectConsoleErrors([
      /Provider event ledger insert failed/,
      /Provider event ledger DLQ write failed/,
    ]);
    expect(failedResponse.status).toBe(500);
    expect(entitlementUpsert).toHaveBeenCalledTimes(1);
    expect(ledgerMarkProcessed).not.toHaveBeenCalled();

    const retryResponse = await POST(request(event));

    expect(retryResponse.status).toBe(200);
    expect(entitlementUpsert).toHaveBeenCalledTimes(2);
    expect(ledgerMarkProcessed).toHaveBeenCalledWith(
      "provider_event_id",
      "event-retry",
    );
  });
});
