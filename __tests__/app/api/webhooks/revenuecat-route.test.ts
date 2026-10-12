/** @jest-environment node */

const ledgerInsert = jest.fn();
const ledgerExisting = jest.fn();
const ledgerUpdate = jest.fn();
const ledgerMarkProcessed = jest.fn();
const entitlementRead = jest.fn();
const entitlementUpsert = jest.fn();
const dlqInsert = jest.fn();
const createServiceClient = jest.fn();
const profileConsent = jest.fn();
const capturePostHogEvent = jest.fn();

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: (...args: unknown[]) => createServiceClient(...args),
}));
jest.mock("@sentry/nextjs", () => ({ captureException: jest.fn() }));
// after() only runs inside a Next request scope; collect the callbacks so tests
// decide when the post-response work runs.
const afterCallbacks: Array<() => Promise<void>> = [];
jest.mock("next/server", () => ({
  ...jest.requireActual("next/server"),
  after: (callback: () => Promise<void>) => {
    afterCallbacks.push(callback);
  },
}));
async function runAfterCallbacks(): Promise<void> {
  for (const callback of afterCallbacks.splice(0)) await callback();
}

jest.mock("@/lib/posthog-server", () => ({
  capturePostHogEvent: (...args: unknown[]) => capturePostHogEvent(...args),
}));

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
    profileConsent
      .mockReset()
      .mockResolvedValue({ data: { allow_implicit_tracking: true }, error: null });
    capturePostHogEvent.mockReset().mockResolvedValue(undefined);
    afterCallbacks.length = 0;
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
        if (table === "profiles") return { select: () => selectChain(profileConsent) };
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

describe("RevenueCat webhook PostHog funnel events", () => {
  const USER_ID = "20000000-0000-4000-8000-0000000000a1";
  const EVENT_ID = "30000000-0000-4000-8000-0000000000a1";

  beforeEach(() => {
    process.env.REVENUECAT_WEBHOOK_SECRET = "test-secret";
    ledgerInsert.mockReset().mockResolvedValue({ error: null });
    ledgerExisting.mockReset().mockResolvedValue({ data: null, error: null });
    ledgerUpdate.mockReset().mockImplementation(() => ({ eq: ledgerMarkProcessed }));
    ledgerMarkProcessed.mockReset().mockResolvedValue({ error: null });
    entitlementRead.mockReset().mockResolvedValue({ data: null, error: null });
    entitlementUpsert.mockReset().mockResolvedValue({ error: null });
    dlqInsert.mockReset().mockResolvedValue({ error: null });
    profileConsent
      .mockReset()
      .mockResolvedValue({ data: { allow_implicit_tracking: true }, error: null });
    capturePostHogEvent.mockReset().mockResolvedValue(undefined);
    afterCallbacks.length = 0;
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
        if (table === "profiles") return { select: () => selectChain(profileConsent) };
        throw new Error(`Unexpected table: ${table}`);
      },
    });
  });

  it("captures trial_started after the entitlement is applied", async () => {
    const response = await POST(request({
      id: EVENT_ID,
      type: "INITIAL_PURCHASE",
      app_user_id: USER_ID,
      period_type: "TRIAL",
      product_id: "app.quiversurf.surf.pro.annual",
      store: "APP_STORE",
      environment: "PRODUCTION",
      event_timestamp_ms: Date.parse("2026-10-08T12:00:00.000Z"),
    }));

    expect(response.status).toBe(200);
    // The entitlement is granted and the response is built before PostHog runs.
    expect(entitlementUpsert).toHaveBeenCalled();
    expect(capturePostHogEvent).not.toHaveBeenCalled();
    await runAfterCallbacks();
    expect(capturePostHogEvent).toHaveBeenCalledTimes(1);
    expect(capturePostHogEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        distinctId: USER_ID,
        event: "trial_started",
        uuid: EVENT_ID,
        timestamp: new Date("2026-10-08T12:00:00.000Z"),
        properties: expect.objectContaining({
          $insert_id: `revenuecat:${EVENT_ID}`,
          rc_event_id: EVENT_ID,
          product_id: "app.quiversurf.surf.pro.annual",
          store: "APP_STORE",
          period_type: "TRIAL",
          rc_environment: "PRODUCTION",
        }),
      }),
    );
  });

  it("distinguishes a trial conversion from a plain renewal", async () => {
    await POST(request({
      id: EVENT_ID,
      type: "RENEWAL",
      app_user_id: USER_ID,
      is_trial_conversion: true,
    }));
    await runAfterCallbacks();

    expect(capturePostHogEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event: "trial_converted" }),
    );
  });

  it("does not capture when a processed event is redelivered", async () => {
    ledgerInsert.mockResolvedValue({ error: { code: "23505", message: "duplicate key" } });
    ledgerExisting.mockResolvedValue({
      data: { processed_at: "2026-10-08T12:01:00.000Z" },
      error: null,
    });

    const response = await POST(request({
      id: EVENT_ID,
      type: "INITIAL_PURCHASE",
      app_user_id: USER_ID,
    }));

    expect(await response.json()).toMatchObject({ duplicate: true });
    await runAfterCallbacks();
    expect(capturePostHogEvent).not.toHaveBeenCalled();
  });

  it("captures an unfinished redelivery on the same PostHog row", async () => {
    ledgerInsert.mockResolvedValue({ error: { code: "23505", message: "duplicate key" } });
    ledgerExisting.mockResolvedValue({ data: { processed_at: null }, error: null });

    await POST(request({
      id: EVENT_ID,
      type: "INITIAL_PURCHASE",
      app_user_id: USER_ID,
    }));
    await runAfterCallbacks();

    expect(capturePostHogEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        uuid: EVENT_ID,
        properties: expect.objectContaining({ $insert_id: `revenuecat:${EVENT_ID}` }),
      }),
    );
  });

  it("does not capture when the ledger row could not be stored", async () => {
    ledgerInsert.mockResolvedValue({ error: { code: "500", message: "ledger unavailable" } });

    await POST(request({
      id: EVENT_ID,
      type: "INITIAL_PURCHASE",
      app_user_id: USER_ID,
    }));
    expectConsoleErrors([/Provider event ledger insert failed/]);
    await runAfterCallbacks();

    expect(capturePostHogEvent).not.toHaveBeenCalled();
  });

  it("does not capture when the entitlement write fails and goes to the DLQ", async () => {
    entitlementUpsert.mockResolvedValue({ error: { message: "upsert failed" } });

    const response = await POST(request({
      id: EVENT_ID,
      type: "INITIAL_PURCHASE",
      app_user_id: USER_ID,
      period_type: "TRIAL",
    }));
    expectConsoleErrors([/Upsert failed/]);
    await runAfterCallbacks();

    expect(await response.json()).toMatchObject({ queued_for_reconciliation: true });
    expect(dlqInsert).toHaveBeenCalled();
    expect(capturePostHogEvent).not.toHaveBeenCalled();
  });

  it("does not capture when the entitlement read fails", async () => {
    entitlementRead.mockResolvedValue({ data: null, error: { message: "read failed" } });

    await POST(request({
      id: EVENT_ID,
      type: "INITIAL_PURCHASE",
      app_user_id: USER_ID,
    }));
    expectConsoleErrors([/Read failed/]);
    await runAfterCallbacks();

    expect(capturePostHogEvent).not.toHaveBeenCalled();
  });

  it("does not capture when a lifetime promo preserves the entitlement", async () => {
    entitlementRead.mockResolvedValue({
      data: {
        is_pro: true,
        is_trialing: false,
        expires_at: null,
        product_id: "rc_promo_Quiver Pro_lifetime",
      },
      error: null,
    });

    const response = await POST(request({
      id: EVENT_ID,
      type: "RENEWAL",
      app_user_id: USER_ID,
      product_id: "app.quiversurf.surf.pro.annual",
    }));
    await runAfterCallbacks();

    expect(await response.json()).toMatchObject({ preserved: "lifetime_promotional_pro" });
    expect(capturePostHogEvent).not.toHaveBeenCalled();
  });

  it("never sends anonymous RevenueCat ids", async () => {
    await POST(request({
      id: EVENT_ID,
      type: "INITIAL_PURCHASE",
      app_user_id: "$RCAnonymousID:abc123",
    }));
    await runAfterCallbacks();

    expect(capturePostHogEvent).not.toHaveBeenCalled();
    expect(profileConsent).not.toHaveBeenCalled();
  });

  it("respects analytics opt-out", async () => {
    profileConsent.mockResolvedValue({
      data: { allow_implicit_tracking: false },
      error: null,
    });

    const response = await POST(request({
      id: EVENT_ID,
      type: "INITIAL_PURCHASE",
      app_user_id: USER_ID,
    }));

    await runAfterCallbacks();

    expect(response.status).toBe(200);
    expect(capturePostHogEvent).not.toHaveBeenCalled();
    expect(entitlementUpsert).toHaveBeenCalled();
  });

  it("tags sandbox purchases instead of mixing them into production", async () => {
    await POST(request({
      id: EVENT_ID,
      type: "INITIAL_PURCHASE",
      app_user_id: USER_ID,
      environment: "SANDBOX",
    }));
    await runAfterCallbacks();

    expect(capturePostHogEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        properties: expect.objectContaining({
          rc_environment: "SANDBOX",
          is_sandbox: true,
        }),
      }),
    );
  });

  it("keeps processing the entitlement when PostHog capture throws", async () => {
    capturePostHogEvent.mockRejectedValue(new Error("posthog down"));

    const response = await POST(request({
      id: EVENT_ID,
      type: "INITIAL_PURCHASE",
      app_user_id: USER_ID,
    }));
    await runAfterCallbacks();
    expectConsoleErrors([/RevenueCat funnel capture failed/]);

    expect(response.status).toBe(200);
    expect(entitlementUpsert).toHaveBeenCalled();
    expect(ledgerMarkProcessed).toHaveBeenCalled();
  });

  it("does not capture event types outside the funnel", async () => {
    await POST(request({
      id: EVENT_ID,
      type: "SUBSCRIPTION_PAUSED",
      app_user_id: USER_ID,
    }));
    await runAfterCallbacks();

    expect(capturePostHogEvent).not.toHaveBeenCalled();
  });
});
