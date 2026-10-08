/** @jest-environment node */

var mockCapturePostHogEvent = jest.fn<Promise<void>, [unknown]>(() =>
  Promise.resolve(),
);

jest.mock("@/lib/posthog-server", () => ({
  capturePostHogEvent: (arg: unknown) => mockCapturePostHogEvent(arg),
}));

import {
  captureRevenueCatFunnelEvent,
  mapRevenueCatEventToFunnelEvent,
} from "@/lib/analytics/revenuecat-funnel-events";

const USER_ID = "20000000-0000-4000-8000-000000000001";
const EVENT_ID = "30000000-0000-4000-8000-000000000001";

function consentClient(
  result: { data: unknown; error: unknown } = {
    data: { allow_implicit_tracking: true },
    error: null,
  },
) {
  const maybeSingle = jest.fn().mockResolvedValue(result);
  const eq = jest.fn(() => ({ maybeSingle }));
  const select = jest.fn(() => ({ eq }));
  const from = jest.fn(() => ({ select }));
  return { client: { from } as never, from, select, eq };
}

describe("mapRevenueCatEventToFunnelEvent", () => {
  it.each([
    [{ type: "INITIAL_PURCHASE", period_type: "TRIAL" }, "trial_started"],
    [{ type: "INITIAL_PURCHASE", period_type: "NORMAL" }, "subscription_started"],
    [{ type: "INITIAL_PURCHASE", period_type: "INTRO" }, "subscription_started"],
    [{ type: "RENEWAL", is_trial_conversion: true }, "trial_converted"],
    [{ type: "RENEWAL", is_trial_conversion: false }, "subscription_renewed"],
    [{ type: "RENEWAL" }, "subscription_renewed"],
    [
      { type: "NON_RENEWING_PURCHASE", product_id: "app.quiversurf.surf.pro.lifetime" },
      "lifetime_purchased",
    ],
    [{ type: "CANCELLATION" }, "subscription_cancelled"],
    [{ type: "UNCANCELLATION" }, "subscription_uncancelled"],
    [{ type: "EXPIRATION" }, "subscription_expired"],
    [{ type: "BILLING_ISSUE" }, "billing_issue"],
    [{ type: "PRODUCT_CHANGE" }, "subscription_product_changed"],
  ])("maps %j to %s", (event, expected) => {
    expect(mapRevenueCatEventToFunnelEvent(event)).toBe(expected);
  });

  it.each([
    [{ type: "TRANSFER" }],
    [{ type: "SUBSCRIPTION_PAUSED" }],
    [{ type: "INITIAL_PURCHASE", store: "PROMOTIONAL" }],
    [{ type: "INITIAL_PURCHASE", period_type: "PROMOTIONAL" }],
    [{ type: "NON_RENEWING_PURCHASE", product_id: "rc_promo_Quiver Pro_lifetime" }],
  ])("does not map %j", (event) => {
    expect(mapRevenueCatEventToFunnelEvent(event)).toBeNull();
  });
});

describe("captureRevenueCatFunnelEvent", () => {
  beforeEach(() => jest.clearAllMocks());

  it("captures a trial start with dedupe keys and purchase properties", async () => {
    const { client, from, select, eq } = consentClient();

    await captureRevenueCatFunnelEvent({
      supabase: client,
      userId: USER_ID,
      event: {
        id: EVENT_ID,
        type: "INITIAL_PURCHASE",
        period_type: "TRIAL",
        product_id: "app.quiversurf.surf.pro.annual",
        store: "APP_STORE",
        environment: "PRODUCTION",
        event_timestamp_ms: Date.parse("2026-10-08T12:00:00.000Z"),
        price: 0,
        price_in_purchased_currency: 0,
        currency: "USD",
      },
    });

    expect(from).toHaveBeenCalledWith("profiles");
    expect(select).toHaveBeenCalledWith("allow_implicit_tracking");
    expect(eq).toHaveBeenCalledWith("id", USER_ID);
    expect(mockCapturePostHogEvent).toHaveBeenCalledWith({
      distinctId: USER_ID,
      event: "trial_started",
      timestamp: new Date("2026-10-08T12:00:00.000Z"),
      uuid: EVENT_ID,
      properties: {
        $insert_id: `revenuecat:${EVENT_ID}`,
        rc_event_id: EVENT_ID,
        rc_event_type: "INITIAL_PURCHASE",
        rc_environment: "PRODUCTION",
        is_sandbox: false,
        product_id: "app.quiversurf.surf.pro.annual",
        store: "APP_STORE",
        period_type: "TRIAL",
        price: 0,
        price_in_purchased_currency: 0,
        currency: "USD",
      },
    });
  });

  it("derives a stable uuid when the RevenueCat event id is not a uuid", async () => {
    const send = () =>
      captureRevenueCatFunnelEvent({
        supabase: consentClient().client,
        userId: USER_ID,
        event: { id: "rc-event-123", type: "RENEWAL" },
      });

    await send();
    await send();

    const uuids = mockCapturePostHogEvent.mock.calls.map(
      ([call]) => (call as { uuid: string }).uuid,
    );
    expect(uuids[0]).toBe(uuids[1]);
    expect(uuids[0]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("never overrides the standard environment property", async () => {
    await captureRevenueCatFunnelEvent({
      supabase: consentClient().client,
      userId: USER_ID,
      event: { id: EVENT_ID, type: "RENEWAL", environment: "SANDBOX" },
    });

    const properties = (
      mockCapturePostHogEvent.mock.calls[0][0] as {
        properties: Record<string, unknown>;
      }
    ).properties;
    expect(properties).not.toHaveProperty("environment");
    expect(properties).toMatchObject({
      rc_environment: "SANDBOX",
      is_sandbox: true,
    });
  });

  it("records the cancellation reason on cancellations", async () => {
    await captureRevenueCatFunnelEvent({
      supabase: consentClient().client,
      userId: USER_ID,
      event: { id: EVENT_ID, type: "CANCELLATION", cancel_reason: "UNSUBSCRIBE" },
    });

    expect(mockCapturePostHogEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "subscription_cancelled",
        properties: expect.objectContaining({ cancel_reason: "UNSUBSCRIBE" }),
      }),
    );
  });

  it("flags whether a one-time purchase is the paid lifetime product", async () => {
    await captureRevenueCatFunnelEvent({
      supabase: consentClient().client,
      userId: USER_ID,
      event: {
        id: EVENT_ID,
        type: "NON_RENEWING_PURCHASE",
        product_id: "app.quiversurf.surf.pro.lifetime",
      },
    });

    expect(mockCapturePostHogEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "lifetime_purchased",
        properties: expect.objectContaining({ is_paid_lifetime_product: true }),
      }),
    );
  });

  it.each([
    ["an anonymous RevenueCat id", "$RCAnonymousID:abc123"],
    ["a non-uuid id", "not-a-user"],
    ["a missing id", null],
  ])("skips %s", async (_label, userId) => {
    const { client, from } = consentClient();

    await captureRevenueCatFunnelEvent({
      supabase: client,
      userId,
      event: { id: EVENT_ID, type: "INITIAL_PURCHASE" },
    });

    expect(from).not.toHaveBeenCalled();
    expect(mockCapturePostHogEvent).not.toHaveBeenCalled();
  });

  it("skips events without a RevenueCat event id", async () => {
    await captureRevenueCatFunnelEvent({
      supabase: consentClient().client,
      userId: USER_ID,
      event: { type: "INITIAL_PURCHASE" },
    });

    expect(mockCapturePostHogEvent).not.toHaveBeenCalled();
  });

  it("skips unmapped and promotional events before reading consent", async () => {
    const { client, from } = consentClient();

    await captureRevenueCatFunnelEvent({
      supabase: client,
      userId: USER_ID,
      event: { id: EVENT_ID, type: "TRANSFER" },
    });
    await captureRevenueCatFunnelEvent({
      supabase: client,
      userId: USER_ID,
      event: { id: EVENT_ID, type: "INITIAL_PURCHASE", store: "PROMOTIONAL" },
    });

    expect(from).not.toHaveBeenCalled();
    expect(mockCapturePostHogEvent).not.toHaveBeenCalled();
  });

  it.each([
    ["opted out", { data: { allow_implicit_tracking: false }, error: null }],
    ["has no profile row", { data: null, error: null }],
    ["cannot be read", { data: null, error: { message: "boom" } }],
  ])("sends nothing when the user %s", async (_label, result) => {
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    await captureRevenueCatFunnelEvent({
      supabase: consentClient(result).client,
      userId: USER_ID,
      event: { id: EVENT_ID, type: "INITIAL_PURCHASE" },
    });

    expect(mockCapturePostHogEvent).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("never throws when PostHog capture fails", async () => {
    mockCapturePostHogEvent.mockRejectedValueOnce(new Error("posthog down"));
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    await expect(
      captureRevenueCatFunnelEvent({
        supabase: consentClient().client,
        userId: USER_ID,
        event: { id: EVENT_ID, type: "INITIAL_PURCHASE" },
      }),
    ).resolves.toBeUndefined();
    consoleError.mockRestore();
  });
});
