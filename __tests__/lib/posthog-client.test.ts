jest.mock("posthog-js", () => ({
  init: jest.fn(),
  capture: jest.fn(),
  identify: jest.fn(),
  opt_in_capturing: jest.fn(),
  opt_out_capturing: jest.fn(),
  reset: jest.fn(),
  __quiverInitialized: false,
}));

import posthog from "posthog-js";
import {
  _resetPostHogClientForTesting,
  applyClientPostHogTrackingStorageEvent,
  captureClientPostHogEvent,
  captureClientPostHogEventAfterConsent,
  captureQueuedClientPostHogSignup,
  flushQueuedClientPostHogEvents,
  identifyPostHogUser,
  initPostHog,
  queueClientPostHogSignup,
  setClientPostHogTrackingAllowed,
} from "@/lib/posthog-client";

describe("posthog-client", () => {
  const originalToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;

  beforeEach(() => {
    jest.clearAllMocks();
    _resetPostHogClientForTesting();
    process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN = "phc_test";
    window.sessionStorage.removeItem("posthog_signup_pending_new-user");
    window.sessionStorage.removeItem("posthog_signup_captured_new-user");
  });

  afterAll(() => {
    if (originalToken === undefined) {
      delete process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
    } else {
      process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN = originalToken;
    }
  });

  it("fails closed before analytics consent is known", () => {
    expect(initPostHog()).toBe(false);

    captureClientPostHogEvent("beach_view");
    identifyPostHogUser("user-123");

    expect(posthog.init).not.toHaveBeenCalled();
    expect(posthog.capture).not.toHaveBeenCalled();
    expect(posthog.identify).not.toHaveBeenCalled();
  });

  it("keeps capture and identity disabled after an explicit opt-out", () => {
    setClientPostHogTrackingAllowed(false);

    captureClientPostHogEvent("beach_view");
    identifyPostHogUser("user-123");

    expect(posthog.init).not.toHaveBeenCalled();
    expect(posthog.capture).not.toHaveBeenCalled();
    expect(posthog.identify).not.toHaveBeenCalled();
  });

  it("queues operational events until authenticated consent is allowed", () => {
    expect(
      captureClientPostHogEventAfterConsent("home_discovery_request", {
        request_number: 1,
      }),
    ).toBe(true);
    expect(posthog.capture).not.toHaveBeenCalled();

    setClientPostHogTrackingAllowed(true);
    expect(posthog.capture).not.toHaveBeenCalled();
    expect(flushQueuedClientPostHogEvents()).toBe(1);
    expect(posthog.capture).toHaveBeenCalledWith(
      "home_discovery_request",
      expect.objectContaining({ request_number: 1 }),
    );
  });

  it("discards queued operational events when consent is denied", () => {
    captureClientPostHogEventAfterConsent("home_discovery_request", {
      request_number: 1,
    });

    setClientPostHogTrackingAllowed(false);
    setClientPostHogTrackingAllowed(true);

    expect(flushQueuedClientPostHogEvents()).toBe(0);
    expect(posthog.capture).not.toHaveBeenCalled();
  });

  it("enables capture only after explicit consent and disables autocapture", () => {
    setClientPostHogTrackingAllowed(true);
    expect(initPostHog()).toBe(true);
    captureClientPostHogEvent("beach_view", { beach_id: "beach-1" });
    identifyPostHogUser("user-123", { provider: "email" });

    expect(posthog.init).toHaveBeenCalledWith(
      "phc_test",
      expect.objectContaining({
        capture_pageview: false,
        autocapture: false,
      }),
    );
    expect(posthog.opt_in_capturing).toHaveBeenCalled();
    expect(posthog.opt_in_capturing).toHaveBeenCalledTimes(1);
    expect(posthog.opt_in_capturing).toHaveBeenCalledWith({
      captureEventName: false,
    });
    expect(posthog.capture).toHaveBeenCalledWith(
      "beach_view",
      expect.objectContaining({ beach_id: "beach-1" }),
    );
    expect(posthog.identify).toHaveBeenCalledWith(
      "user-123",
      expect.objectContaining({ provider: "email" }),
    );
  });

  it("actively opts out while authenticated consent is unresolved", () => {
    setClientPostHogTrackingAllowed(true);
    jest.clearAllMocks();

    setClientPostHogTrackingAllowed(null);
    captureClientPostHogEvent("beach_view");

    expect(posthog.opt_out_capturing).toHaveBeenCalledTimes(1);
    expect(posthog.capture).not.toHaveBeenCalled();
  });

  it("keeps the in-memory gate denied when the PostHog opt-out throws", () => {
    setClientPostHogTrackingAllowed(true);
    jest.clearAllMocks();
    (posthog.opt_out_capturing as jest.Mock).mockImplementationOnce(() => {
      throw new Error("SDK unavailable");
    });

    expect(() => setClientPostHogTrackingAllowed(false)).not.toThrow();
    captureClientPostHogEvent("beach_view");

    expect(posthog.capture).not.toHaveBeenCalled();
  });

  it("opts in once when initialization succeeds on a later retry", () => {
    (posthog.init as jest.Mock).mockImplementationOnce(() => {
      throw new Error("SDK unavailable");
    });

    expect(() => setClientPostHogTrackingAllowed(true)).not.toThrow();
    expect(posthog.opt_in_capturing).not.toHaveBeenCalled();

    captureClientPostHogEvent("beach_view");

    expect(posthog.opt_in_capturing).toHaveBeenCalledTimes(1);
    expect(posthog.capture).toHaveBeenCalledTimes(1);
  });

  it("applies an opt-out saved in another browser tab", () => {
    setClientPostHogTrackingAllowed(true);
    identifyPostHogUser("user-123");
    jest.clearAllMocks();

    applyClientPostHogTrackingStorageEvent({
      key: "quiver_posthog_tracking_denied_v1",
      newValue: "true",
    } as StorageEvent);
    captureClientPostHogEvent("beach_view");

    expect(posthog.reset).toHaveBeenCalledTimes(1);
    expect(posthog.opt_out_capturing).toHaveBeenCalled();
    expect(posthog.capture).not.toHaveBeenCalled();
  });

  it("delays and deduplicates the signup conversion until consent is allowed", () => {
    queueClientPostHogSignup("new-user", "google");

    captureQueuedClientPostHogSignup("new-user");
    expect(posthog.capture).not.toHaveBeenCalled();
    expect(
      window.sessionStorage.getItem("posthog_signup_captured_new-user"),
    ).toBeNull();

    setClientPostHogTrackingAllowed(true);
    captureQueuedClientPostHogSignup("new-user");
    captureQueuedClientPostHogSignup("new-user");

    expect(posthog.capture).toHaveBeenCalledTimes(1);
    expect(posthog.capture).toHaveBeenCalledWith(
      "user_signed_up",
      expect.objectContaining({ provider: "google" }),
    );
    expect(
      window.sessionStorage.getItem("posthog_signup_captured_new-user"),
    ).toBe("true");
    expect(
      window.sessionStorage.getItem("posthog_signup_pending_new-user"),
    ).toBeNull();
  });
});
