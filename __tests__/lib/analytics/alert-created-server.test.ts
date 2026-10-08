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

const afterCallbacks: Array<() => Promise<void>> = [];
jest.mock("next/server", () => ({
  ...jest.requireActual("next/server"),
  after: (callback: () => Promise<void>) => {
    afterCallbacks.push(callback);
  },
}));

import {
  captureAlertCreatedEvents,
  resolveRequestPlatform,
  scheduleAlertCreatedEvents,
  scheduleSeededAlertCreated,
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
    afterCallbacks.length = 0;
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
      uuid: "f413417f-7c1d-594d-87e6-8e37ccb66192",
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

    const call = mockCapturePostHogEvent.mock.calls[0][0] as {
      uuid: string;
      properties: Record<string, unknown>;
    };
    expect(call.uuid).toBe("760ed442-0b28-5f89-a1f7-5f865b2774a3");
    expect(call.properties.$insert_id).toBe("alert_created:capture:capture-9");
    expect(call.properties).not.toHaveProperty("rule_id");
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

  it("gives the same rule the same uuid on every capture", async () => {
    await captureAlertCreatedEvents({ supabase, userId: "user-1", events: [event()] });
    await captureAlertCreatedEvents({ supabase, userId: "user-1", events: [event()] });

    const uuids = mockCapturePostHogEvent.mock.calls.map(
      ([call]) => (call as { uuid: string }).uuid,
    );
    expect(uuids[0]).toBe(uuids[1]);
    expect(uuids[0]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
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

describe("scheduleAlertCreatedEvents", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    afterCallbacks.length = 0;
    mockGetOwnAnalyticsTrackingAllowed.mockResolvedValue(true);
  });

  it("defers consent and capture until after the response", async () => {
    scheduleAlertCreatedEvents({ supabase, userId: "user-1", events: [event()] });

    expect(afterCallbacks).toHaveLength(1);
    expect(mockGetOwnAnalyticsTrackingAllowed).not.toHaveBeenCalled();
    expect(mockCapturePostHogEvent).not.toHaveBeenCalled();

    await afterCallbacks[0]();

    expect(mockCapturePostHogEvent).toHaveBeenCalledTimes(1);
  });
});

describe("scheduleSeededAlertCreated", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    afterCallbacks.length = 0;
    mockGetOwnAnalyticsTrackingAllowed.mockResolvedValue(true);
  });

  const seeded = {
    supabase,
    userId: "user-1",
    beachId: "beach-1",
    rules: [
      { ruleId: "rule-1", presetType: "mellow_session" },
      { ruleId: "rule-2", presetType: "weekend_warrior" },
    ],
    platform: "native" as const,
    notifyEmail: true,
    notifyPush: false,
  };

  it("captures one onboarding_seed event per rule and flags only the first", async () => {
    scheduleSeededAlertCreated(seeded);
    expect(mockCapturePostHogEvent).not.toHaveBeenCalled();

    await afterCallbacks[0]();

    expect(mockCapturePostHogEvent).toHaveBeenCalledTimes(2);
    expect(mockCapturePostHogEvent).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        distinctId: "user-1",
        event: "alert_created",
        properties: expect.objectContaining({
          $insert_id: "alert_created:rule-1",
          alert_type: "mellow_session",
          beach_id: "beach-1",
          source: "onboarding_seed",
          platform: "native",
          is_first_alert: true,
          notify_email: true,
          notify_push: false,
        }),
      }),
    );
    expect(mockCapturePostHogEvent).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        properties: expect.objectContaining({
          alert_type: "weekend_warrior",
          is_first_alert: false,
        }),
      }),
    );
  });

  it("schedules nothing when no rules were seeded", () => {
    scheduleSeededAlertCreated({ ...seeded, rules: [] });

    expect(afterCallbacks).toHaveLength(0);
  });
});
