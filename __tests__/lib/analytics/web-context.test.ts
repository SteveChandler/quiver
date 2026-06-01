import {
  deriveSourceGroup,
  deriveSurfaceFromPath,
  getCamFamily,
  getFirstTouchPlatform,
  getPageName,
  getWebAnalyticsContext,
} from "@/lib/analytics/web-context";

jest.mock("@/lib/utils/browser-session-id", () => ({
  getBrowserSessionId: jest.fn(() => "browser-session-123"),
}));

jest.mock("@/lib/attribution", () => ({
  getAttributionFromCookies: jest.fn(() => ({
    utm_source: "google",
    utm_medium: "organic",
    utm_campaign: "cams",
    utm_content: "blue-link",
    utm_term: "san diego surf cams",
    referrer: "https://www.google.com/search",
    first_touch_ts: "2026-06-01T12:00:00.000Z",
    landing_page: "/surf-cams/san-diego",
  })),
}));

describe("web analytics context", () => {
  it.each([
    ["/", "landing-page", "landing"],
    ["/map", "map", "map"],
    ["/beaches/usa/ca", "state-hub", "state_hub"],
    ["/ca/san-diego/blacks", "beach-detail", "beach_detail"],
    ["/cams", "cams-directory", "cams"],
    ["/cams/pacific-northwest", "cams-directory", "cams"],
    ["/surf-cams/san-diego", "surf-cams-seo", "surf_cams"],
    ["/water-temp/huntington-beach", "water-temp", "water_temp"],
  ])("maps %s to surface %s and page %s", (pathname, surface, page) => {
    expect(deriveSurfaceFromPath(pathname)).toBe(surface);
    expect(getPageName(pathname)).toBe(page);
  });

  it.each([
    ["cams-hub-inline", "/map", "cams-directory"],
    ["seo-funnel-surf-cams-san-diego", "/", "surf-cams-seo"],
    ["state-hub-ca", "/", "state-hub"],
    ["landing-final", "/map", "landing"],
    ["beach-alert-cta", "/", "beach-detail"],
    ["unknown", "/surf-cams/san-diego", "surf-cams-seo"],
  ])("derives source group for %s on %s", (source, pathname, expected) => {
    expect(deriveSourceGroup(source, pathname)).toBe(expected);
  });

  it("detects cam route families", () => {
    expect(getCamFamily("/cams")).toBe("cams-directory");
    expect(getCamFamily("/cams/east-coast")).toBe("cams-directory");
    expect(getCamFamily("/surf-cams/orange-county")).toBe("surf-cams-seo");
    expect(getCamFamily("/map")).toBeUndefined();
  });

  it("detects first-touch platform from user agent", () => {
    expect(getFirstTouchPlatform("Mozilla/5.0 (iPhone)")).toBe("ios");
    expect(getFirstTouchPlatform("Mozilla/5.0 (Linux; Android 14)")).toBe("android");
    expect(getFirstTouchPlatform("Mozilla/5.0 (Macintosh)")).toBe("desktop");
  });

  it("builds canonical context with attribution and signup channel", () => {
    expect(
      getWebAnalyticsContext({
        pathname: "/surf-cams/san-diego",
        source: "seo-funnel-surf-cams-san-diego",
        includeSignupChannel: true,
      })
    ).toMatchObject({
      pathname: "/surf-cams/san-diego",
      page: "surf_cams",
      surface: "surf-cams-seo",
      source_group: "surf-cams-seo",
      browser_session_id: "browser-session-123",
      platform: "web",
      first_touch_platform: "desktop",
      first_touch_landing_page: "/surf-cams/san-diego",
      first_touch_referrer: "https://www.google.com/search",
      utm_source: "google",
      utm_medium: "organic",
      utm_campaign: "cams",
      utm_content: "blue-link",
      utm_term: "san diego surf cams",
      cam_family: "surf-cams-seo",
      signup_channel: "web_app",
      signup_channel_source: "web_auth",
    });
  });
});
