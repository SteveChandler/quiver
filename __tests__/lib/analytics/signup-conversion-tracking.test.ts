import {
  trackSignupCtaView,
  trackSignupCtaClick,
  trackSigninCtaClick,
  deriveSurfaceFromPath,
  _resetViewedSourcesForTesting,
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

function setPathname(pathname: string) {
  Object.defineProperty(window, "location", {
    value: { ...window.location, pathname },
    configurable: true,
    writable: true,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  global.fetch = mockFetch;
  Object.defineProperty(window, "innerWidth", { value: 375, writable: true });
  Object.defineProperty(document, "visibilityState", {
    value: "visible",
    configurable: true,
    writable: true,
  });
  setPathname("/");
  // Reset module-level deduplication Set so tests are isolated
  _resetViewedSourcesForTesting();
});

afterEach(() => {
  jest.useRealTimers();
});

// ---------------------------------------------------------------------------
// trackSignupCtaView — uses module-level deduplication (firedCtaViews Set).
// Each test that checks deduplication behavior loads a fresh module instance
// via jest.isolateModules() so the Set starts empty and mocks remain active.
// ---------------------------------------------------------------------------

describe("trackSignupCtaView", () => {
  it("fires GA4 track and POST /api/events after dwell delay", () => {
    let freshTrackView!: typeof trackSignupCtaView;

    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      freshTrackView = require("@/lib/analytics/signup-conversion-tracking").trackSignupCtaView;
    });

    const params = { source: "test-page", cta_title: "Sign Up" };
    freshTrackView(params);

    // Fire is delayed — nothing should happen yet
    expect(track).not.toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();

    jest.runOnlyPendingTimers();

    expect(track).toHaveBeenCalledWith(
      "signup_cta_view",
      expect.objectContaining({ source: "test-page", cta_title: "Sign Up", surface: "landing-page" })
    );
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const callArgs = mockFetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(callArgs[0]).toBe("/api/events");
    const body = JSON.parse(callArgs[1].body as string);
    expect(body.eventType).toBe("signup_cta_view");
    expect(body.metadata).toMatchObject({ source: "test-page", cta_title: "Sign Up", surface: "landing-page" });
    expect(body.sessionId).toBe("test-visitor-id");
    expect(body.viewportWidth).toBe(375);
  });

  it("does not fire when tab is hidden when dwell timer elapses", () => {
    const params = { source: "bg-tab", cta_title: "Sign Up" };

    trackSignupCtaView(params);

    Object.defineProperty(document, "visibilityState", {
      value: "hidden",
      configurable: true,
      writable: true,
    });

    jest.runOnlyPendingTimers();

    expect(track).not.toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("deduplicates: only fires once per source per page load", () => {
    const params = { source: "cam-hero", cta_title: "Watch Live Cam" };

    trackSignupCtaView(params);
    trackSignupCtaView(params);
    trackSignupCtaView(params);

    jest.runOnlyPendingTimers();

    // Despite being called 3 times, only one GA4 + one fetch event should fire
    expect(track).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("fires independently for different sources", () => {
    trackSignupCtaView({ source: "cam-hero", cta_title: "Watch Cam" });
    trackSignupCtaView({ source: "inline-cta", cta_title: "Get Forecast" });

    jest.runOnlyPendingTimers();

    expect(track).toHaveBeenCalledTimes(2);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("treats missing source as 'unknown' for dedup key", () => {
    trackSignupCtaView({ cta_title: "Sign Up" });
    trackSignupCtaView({ cta_title: "Sign Up Again" });

    jest.runOnlyPendingTimers();

    // Both have source=undefined → same dedup key "unknown" → only fires once
    expect(track).toHaveBeenCalledTimes(1);
  });
});

describe("trackSignupCtaClick", () => {
  it("fires GA4 track and POST /api/events", () => {
    const params = { source: "sticky-bar", cta_type: "sticky_bar" };
    trackSignupCtaClick(params);

    expect(track).toHaveBeenCalledWith(
      "signup_cta_click",
      expect.objectContaining({ source: "sticky-bar", cta_type: "sticky_bar", surface: "landing-page" })
    );
    const callArgs = mockFetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(callArgs[0]).toBe("/api/events");
    const body = JSON.parse(callArgs[1].body as string);
    expect(body.eventType).toBe("signup_cta_click");
    expect(body.metadata).toMatchObject({ source: "sticky-bar", surface: "landing-page" });
  });

  it("is NOT deduplicated — fires every time (clicks are discrete actions)", () => {
    const params = { source: "sticky-bar", cta_type: "sticky_bar" };
    trackSignupCtaClick(params);
    trackSignupCtaClick(params);

    expect(track).toHaveBeenCalledTimes(2);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});

describe("trackSigninCtaClick", () => {
  it("fires GA4 track and POST /api/events", () => {
    const params = { source: "content-gate", cta_title: "Log in" };
    trackSigninCtaClick(params);

    expect(track).toHaveBeenCalledWith(
      "signin_cta_click",
      expect.objectContaining({ source: "content-gate", cta_title: "Log in", surface: "landing-page" })
    );
    const callArgs = mockFetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(callArgs[0]).toBe("/api/events");
    const body = JSON.parse(callArgs[1].body as string);
    expect(body.eventType).toBe("signin_cta_click");
    expect(body.metadata).toMatchObject({ source: "content-gate", surface: "landing-page" });
  });
});

describe("deriveSurfaceFromPath (pure)", () => {
  const cases: Array<[string, string]> = [
    ["/", "landing-page"],
    ["/about", "about-page"],
    ["/features", "features-page"],
    ["/features/live-cams", "features-page"],
    ["/map", "map"],
    ["/map/san-diego", "map"],
    ["/tools", "tools-page"],
    ["/tools/tide-chart", "tools-page"],
    ["/guides/surfing-san-diego", "guides-page"],
    ["/ca", "state-hub"],
    ["/or", "state-hub"],
    ["/fl", "state-hub"],
    ["/hi", "state-hub"],
    ["/pr", "state-hub"],
    ["/ca/oceanside", "city-hub"],
    ["/ca/oceanside/the-rock-oceanside", "beach-detail"],
    ["/hi/north-shore/pipeline", "beach-detail"],
    ["/ca/oceanside/the-rock-oceanside/forecast", "beach-detail"],
    ["/profile", "auth-gated"],
    ["/profile/abc", "auth-gated"],
    ["/settings", "auth-gated"],
    ["/settings/alerts", "auth-gated"],
    ["/account", "auth-gated"],
    ["/nope", "other"],
    ["/garbage/path/here", "other"],
  ];

  it.each(cases)("maps %s to %s", (path, expected) => {
    expect(deriveSurfaceFromPath(path)).toBe(expected);
  });

  describe("edge cases", () => {
    it("normalizes trailing slash (/about/ == /about)", () => {
      expect(deriveSurfaceFromPath("/about/")).toBe("about-page");
      expect(deriveSurfaceFromPath("/ca/")).toBe("state-hub");
      expect(deriveSurfaceFromPath("/ca/oceanside/")).toBe("city-hub");
      expect(deriveSurfaceFromPath("/ca/oceanside/the-rock/")).toBe("beach-detail");
    });

    it("handles multiple trailing slashes", () => {
      expect(deriveSurfaceFromPath("/about///")).toBe("about-page");
    });

    it("rejects locale prefixes and non-state 2-letter segments", () => {
      // /en/ca/... must NOT misclassify as state-hub; /en is not a state slug.
      expect(deriveSurfaceFromPath("/en")).toBe("other");
      expect(deriveSurfaceFromPath("/en/ca/oceanside")).toBe("other");
      expect(deriveSurfaceFromPath("/js")).toBe("other");
      expect(deriveSurfaceFromPath("/ts/page")).toBe("other");
      // AK isn't in our coverage list — must be "other", not "state-hub"
      expect(deriveSurfaceFromPath("/ak")).toBe("other");
    });

    it("returns 'server' when no path is available (SSR)", () => {
      // Called from SSR context with explicit null simulates the no-window path
      const origWindow = global.window;
      // @ts-expect-error -- simulating SSR
      delete global.window;
      try {
        expect(deriveSurfaceFromPath()).toBe("server");
      } finally {
        global.window = origWindow;
      }
    });

    it("empty pathname falls back to landing-page after normalization", () => {
      // "/" after trailing-slash strip → still "/" → landing-page
      expect(deriveSurfaceFromPath("/")).toBe("landing-page");
    });
  });
});

describe("surface auto-injection in tracker", () => {
  it("injects derived surface when caller omits it", () => {
    setPathname("/features");
    trackSignupCtaClick({ source: "sticky-features" });
    expect(track).toHaveBeenCalledWith(
      "signup_cta_click",
      expect.objectContaining({ surface: "features-page" })
    );
  });

  it("respects caller-provided surface (never overwrites)", () => {
    setPathname("/");
    trackSignupCtaClick({ source: "override", surface: "explicit-custom" });
    expect(track).toHaveBeenCalledWith(
      "signup_cta_click",
      expect.objectContaining({ surface: "explicit-custom" })
    );
  });

  it("ignores empty-string caller-provided surface and derives", () => {
    setPathname("/features");
    trackSignupCtaClick({ source: "empty", surface: "" });
    expect(track).toHaveBeenCalledWith(
      "signup_cta_click",
      expect.objectContaining({ surface: "features-page" })
    );
  });

  it("ignores query strings and hash fragments (pathname only)", () => {
    // pathname-only is already a Location API guarantee — this is a regression guard.
    setPathname("/ca/oceanside/the-rock-oceanside");
    trackSignupCtaClick({ source: "with-query" });
    expect(track).toHaveBeenCalledWith(
      "signup_cta_click",
      expect.objectContaining({ surface: "beach-detail" })
    );
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

// /api/events route handler reads body.beachId only and ignores metadata.beach_id
// (app/api/events/route.ts:399,448,500). Caused 1,512 + 6 historical orphan rows
// where the column was NULL despite metadata carrying a valid beach UUID.
describe("beachId lift from params.beach_id", () => {
  it("trackSignupCtaClick lifts beach_id to top-level beachId field", () => {
    trackSignupCtaClick({
      source: "personalized-forecast-teaser",
      beach_id: "30e68b00-c27d-4d22-ba57-2d92156964c6",
    });

    const callArgs = mockFetch.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(callArgs[1].body as string);
    expect(body.beachId).toBe("30e68b00-c27d-4d22-ba57-2d92156964c6");
    // Preserve original payload — downstream consumers may already read metadata.beach_id
    expect(body.metadata.beach_id).toBe("30e68b00-c27d-4d22-ba57-2d92156964c6");
  });

  it("trackSignupCtaView lifts beach_id to top-level beachId field", () => {
    let freshTrackView!: typeof trackSignupCtaView;
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      freshTrackView = require("@/lib/analytics/signup-conversion-tracking").trackSignupCtaView;
    });

    freshTrackView({
      source: "beach-hero-compact",
      beach_id: "d291411d-d331-4bf1-ad1a-302da3c69de0",
    });
    jest.runOnlyPendingTimers();

    const callArgs = mockFetch.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(callArgs[1].body as string);
    expect(body.beachId).toBe("d291411d-d331-4bf1-ad1a-302da3c69de0");
  });

  it("omits beachId when params has no beach_id (landing page CTA)", () => {
    trackSignupCtaClick({ source: "sticky-bar" });

    const callArgs = mockFetch.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(callArgs[1].body as string);
    expect(body.beachId).toBeUndefined();
  });

  it("omits beachId for empty-string beach_id (defensive against bad callers)", () => {
    trackSignupCtaClick({ source: "test", beach_id: "" });

    const callArgs = mockFetch.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(callArgs[1].body as string);
    expect(body.beachId).toBeUndefined();
  });

  it("omits beachId for non-string beach_id (defensive against bad callers)", () => {
    // params is typed as Record<string, any>, so a number passes type-check.
    // We still want runtime defense — the route handler expects a UUID string.
    trackSignupCtaClick({ source: "test", beach_id: 12345 });

    const callArgs = mockFetch.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(callArgs[1].body as string);
    expect(body.beachId).toBeUndefined();
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
