import {
  trackSignupCtaView,
  trackSignupCtaClick,
  trackSigninCtaClick,
} from "@/lib/analytics/signup-conversion-tracking";
import { track } from "@/lib/analytics";
import { getVisitorId } from "@/lib/utils/visitor-id";

jest.mock("@/lib/analytics", () => ({
  track: jest.fn(),
}));

jest.mock("@/lib/utils/visitor-id", () => ({
  getVisitorId: jest.fn(() => "test-visitor-id"),
}));

const mockFetch = jest.fn(() =>
  Promise.resolve({ ok: true } as Response)
);

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = mockFetch;
  Object.defineProperty(window, "innerWidth", { value: 375, writable: true });
});

// ---------------------------------------------------------------------------
// trackSignupCtaView — uses module-level deduplication (firedCtaViews Set).
// Each test that checks deduplication behavior loads a fresh module instance
// via jest.isolateModules() so the Set starts empty and mocks remain active.
// ---------------------------------------------------------------------------

describe("trackSignupCtaView", () => {
  it("fires GA4 track and POST /api/events on first call", () => {
    let freshTrackView!: typeof trackSignupCtaView;

    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      freshTrackView = require("@/lib/analytics/signup-conversion-tracking").trackSignupCtaView;
    });

    const params = { source: "test-page", cta_title: "Sign Up" };
    freshTrackView(params);

    expect(track).toHaveBeenCalledWith("signup_cta_view", params);
    expect(mockFetch).toHaveBeenCalledWith("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventType: "signup_cta_view",
        metadata: params,
        sessionId: "test-visitor-id",
        viewportWidth: 375,
      }),
      keepalive: true,
    });
  });

  it("deduplicates — second and third calls with same source do not re-fire", () => {
    let freshTrackView!: typeof trackSignupCtaView;

    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      freshTrackView = require("@/lib/analytics/signup-conversion-tracking").trackSignupCtaView;
    });

    const params = { source: "cam-hero", cta_title: "Watch the Live Cam" };
    freshTrackView(params);
    freshTrackView(params); // second call — should be suppressed
    freshTrackView(params); // third call — should be suppressed

    expect(track).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("fires independently for different sources", () => {
    let freshTrackView!: typeof trackSignupCtaView;

    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      freshTrackView = require("@/lib/analytics/signup-conversion-tracking").trackSignupCtaView;
    });

    freshTrackView({ source: "cam-hero" });
    freshTrackView({ source: "inline-cta" });
    freshTrackView({ source: "sticky-bar" });

    expect(track).toHaveBeenCalledTimes(3);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });
});

describe("trackSignupCtaClick", () => {
  it("fires GA4 track and POST /api/events", () => {
    const params = { source: "sticky-bar", cta_type: "sticky_bar" };
    trackSignupCtaClick(params);

    expect(track).toHaveBeenCalledWith("signup_cta_click", params);
    expect(mockFetch).toHaveBeenCalledWith("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventType: "signup_cta_click",
        metadata: params,
        sessionId: "test-visitor-id",
        viewportWidth: 375,
      }),
      keepalive: true,
    });
  });
});

describe("trackSigninCtaClick", () => {
  it("fires GA4 track and POST /api/events", () => {
    const params = { source: "content-gate", cta_title: "Log in" };
    trackSigninCtaClick(params);

    expect(track).toHaveBeenCalledWith("signin_cta_click", params);
    expect(mockFetch).toHaveBeenCalledWith("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventType: "signin_cta_click",
        metadata: params,
        sessionId: "test-visitor-id",
        viewportWidth: 375,
      }),
      keepalive: true,
    });
  });
});

describe("sessionId", () => {
  it("includes getVisitorId() in payload", () => {
    (getVisitorId as jest.Mock).mockReturnValue("custom-visitor-abc");
    trackSignupCtaClick({ source: "test" });

    const callArgs = mockFetch.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(callArgs[1].body as string);
    expect(body.sessionId).toBe("custom-visitor-abc");
  });
});

describe("error handling", () => {
  it("swallows fetch errors silently", () => {
    mockFetch.mockImplementationOnce(() => Promise.reject(new Error("network")));
    expect(() => trackSignupCtaClick({ source: "test" })).not.toThrow();
  });

  it("swallows synchronous errors", () => {
    mockFetch.mockImplementationOnce(() => {
      throw new Error("sync error");
    });
    expect(() => trackSignupCtaClick({ source: "test" })).not.toThrow();
  });
});

describe("SSR safety", () => {
  it("does not call fetch when window is undefined", () => {
    const origWindow = global.window;
    // @ts-expect-error -- simulating SSR
    delete global.window;

    trackSignupCtaClick({ source: "ssr" });

    // track() is still called (it has its own SSR guard)
    expect(track).toHaveBeenCalled();
    // but fetch should not be called
    expect(mockFetch).not.toHaveBeenCalled();

    global.window = origWindow;
  });
});
