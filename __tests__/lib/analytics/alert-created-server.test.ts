/** @jest-environment node */

var mockCapturePostHogEvent = jest.fn<Promise<void>, [unknown]>(() =>
  Promise.resolve(),
);
var mockGetOwnAnalyticsTrackingAllowed = jest.fn<Promise<boolean>, unknown[]>();

jest.mock("@/lib/posthog-server", () => ({
  capturePostHogEvent: (arg: unknown) => mockCapturePostHogEvent(arg),
}));
jest.mock("@/lib/analytics/consent", () => ({
  getOwnAnalyticsTrackingAllowed: (...args: unknown[]) =>
    mockGetOwnAnalyticsTrackingAllowed(...args),
}));

import {
  captureAlertCreatedEvents,
  resolveRequestPlatform,
  type AlertCreatedEvent,
} from "@/lib/analytics/alert-created-server";

const supabase = { rpc: jest.fn() } as never;

function event(overrides: Partial<AlertCreatedEvent> = {}): AlertCreatedEvent {
  return {
    ruleId: "rule-1",
    beachId: "beach-1",
    presetType: "mellow_session",
    source: "rules_api",
    platform: "web",
    isFirstAlert: true,
    ...overrides,
  };
}

describe("captureAlertCreatedEvents", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetOwnAnalyticsTrackingAllowed.mockResolvedValue(true);
  });

  it("captures alert_created for the user with the funnel properties", async () => {
    await captureAlertCreatedEvents({
      supabase,
      userId: "user-1",
      events: [event({ notifyEmail: true, notifyPush: false })],
    });

    expect(mockGetOwnAnalyticsTrackingAllowed).toHaveBeenCalledWith(
      supabase,
      "user-1",
    );
    expect(mockCapturePostHogEvent).toHaveBeenCalledTimes(1);
    expect(mockCapturePostHogEvent).toHaveBeenCalledWith({
      distinctId: "user-1",
      event: "alert_created",
      properties: {
        $insert_id: "alert_created:rule-1",
        alert_type: "mellow_session",
        beach_id: "beach-1",
        source: "rules_api",
        platform: "web",
        is_first_alert: true,
        rule_id: "rule-1",
        notify_email: true,
        notify_push: false,
      },
    });
  });

  it("labels a rule without a preset as a custom alert", async () => {
    await captureAlertCreatedEvents({
      supabase,
      userId: "user-1",
      events: [event({ presetType: null })],
    });

    expect(mockCapturePostHogEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        properties: expect.objectContaining({ alert_type: "custom" }),
      }),
    );
  });

  it("keys anon-capture events on the capture id", async () => {
    await captureAlertCreatedEvents({
      supabase,
      userId: "user-1",
      events: [
        event({
          ruleId: null,
          captureId: "capture-9",
          source: "anon_capture",
        }),
      ],
    });

    const properties = (
      mockCapturePostHogEvent.mock.calls[0][0] as {
        properties: Record<string, unknown>;
      }
    ).properties;
    expect(properties.$insert_id).toBe("alert_created:capture:capture-9");
    expect(properties).not.toHaveProperty("rule_id");
  });

  it("captures one event per rule in a batch", async () => {
    await captureAlertCreatedEvents({
      supabase,
      userId: "user-1",
      events: [
        event({ ruleId: "rule-1", isFirstAlert: true }),
        event({ ruleId: "rule-2", isFirstAlert: false }),
      ],
    });

    expect(mockGetOwnAnalyticsTrackingAllowed).toHaveBeenCalledTimes(1);
    expect(mockCapturePostHogEvent).toHaveBeenCalledTimes(2);
  });

  it("sends nothing when the user has not allowed tracking", async () => {
    mockGetOwnAnalyticsTrackingAllowed.mockResolvedValue(false);

    await captureAlertCreatedEvents({
      supabase,
      userId: "user-1",
      events: [event()],
    });

    expect(mockCapturePostHogEvent).not.toHaveBeenCalled();
  });

  it("fails closed when the consent lookup errors", async () => {
    mockGetOwnAnalyticsTrackingAllowed.mockRejectedValue(new Error("rpc down"));

    await expect(
      captureAlertCreatedEvents({
        supabase,
        userId: "user-1",
        events: [event()],
      }),
    ).resolves.toBeUndefined();
    expect(mockCapturePostHogEvent).not.toHaveBeenCalled();
  });

  it("never throws when PostHog capture fails", async () => {
    mockCapturePostHogEvent.mockRejectedValueOnce(new Error("posthog down"));
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    await expect(
      captureAlertCreatedEvents({
        supabase,
        userId: "user-1",
        events: [event()],
      }),
    ).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("does nothing for an empty batch", async () => {
    await captureAlertCreatedEvents({ supabase, userId: "user-1", events: [] });

    expect(mockGetOwnAnalyticsTrackingAllowed).not.toHaveBeenCalled();
    expect(mockCapturePostHogEvent).not.toHaveBeenCalled();
  });
});

describe("resolveRequestPlatform", () => {
  function request(headers: Record<string, string>) {
    return {
      headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
    };
  }

  it("treats a Bearer token as the native app", () => {
    expect(
      resolveRequestPlatform(request({ authorization: "Bearer abc.def" })),
    ).toBe("native");
  });

  it("treats a cookie-only request as web", () => {
    expect(resolveRequestPlatform(request({ cookie: "sb-x-auth-token=1" }))).toBe(
      "web",
    );
  });

  it("honours an explicit x-quiver-platform header", () => {
    expect(resolveRequestPlatform(request({ "x-quiver-platform": "iOS" }))).toBe(
      "native",
    );
    expect(
      resolveRequestPlatform(
        request({ "x-quiver-platform": "web", authorization: "Bearer abc" }),
      ),
    ).toBe("web");
  });

  it("tolerates request stubs without headers", () => {
    expect(resolveRequestPlatform({})).toBe("web");
  });
});
