import {
  IOS_APP_CTA_CLICK_EVENT,
  IOS_APP_CTA_VIEW_EVENT,
  trackIosAppCtaClick,
  trackIosAppCtaView,
} from "@/lib/analytics/ios-app-cta-tracking";
import { track } from "@/lib/analytics";
import {
  IOS_APP_STORE_CTA,
  IOS_APP_STORE_DESTINATION_STATUS,
  IOS_APP_STORE_WEB_REDIRECT_PATH,
} from "@/lib/constants/app-store";

jest.mock("@/lib/analytics", () => ({
  track: jest.fn(),
}));

jest.mock("@/lib/utils/visitor-id", () => ({
  getVisitorId: jest.fn(() => "test-visitor-id"),
}));

const mockFetch = jest.fn(() => Promise.resolve({ ok: true } as Response));
const mockTrack = track as jest.Mock;
const IOS_APP_STORE_CAMPAIGN_URL = IOS_APP_STORE_WEB_REDIRECT_PATH;

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = mockFetch;
  Object.defineProperty(window, "innerWidth", { value: 390, writable: true });
  window.history.pushState({}, "", "/");
});

describe("ios-app-cta-tracking", () => {
  it("tracks App Store CTA views to product analytics and internal CTA impressions", () => {
    trackIosAppCtaView({
      source: "hero-video-download-button",
      surface: "landing-page",
      placement: "hero_video_overlay",
    });

    const expectedMetadata = {
      cta_family: "ios_app",
      platform: "ios",
      destination_type: "app_store",
      destination_status: IOS_APP_STORE_DESTINATION_STATUS,
      destination_url: IOS_APP_STORE_CAMPAIGN_URL,
      cta_text: IOS_APP_STORE_CTA,
      page_type: "other",
      query_intent: "other",
      seo_landing_page: false,
      source: "hero-video-download-button",
      surface: "landing-page",
      placement: "hero_video_overlay",
    };

    expect(mockTrack).toHaveBeenCalledWith(
      IOS_APP_CTA_VIEW_EVENT,
      expectedMetadata,
    );
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/events",
      expect.objectContaining({
        method: "POST",
        keepalive: true,
      }),
    );

    const callArgs = mockFetch.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    const body = JSON.parse(callArgs[1].body as string);
    expect(body).toMatchObject({
      eventType: "cta_impression",
      metadata: expectedMetadata,
      sessionId: "test-visitor-id",
      viewportWidth: 390,
    });
  });

  it("tracks App Store CTA clicks to product analytics and internal CTA clicks", () => {
    trackIosAppCtaClick({
      source: "forecast-section",
      surface: "landing-page",
      placement: "forecast_section",
      video_loaded: false,
    });

    const expectedMetadata = {
      cta_family: "ios_app",
      platform: "ios",
      destination_type: "app_store",
      destination_status: IOS_APP_STORE_DESTINATION_STATUS,
      destination_url: IOS_APP_STORE_CAMPAIGN_URL,
      cta_text: IOS_APP_STORE_CTA,
      page_type: "other",
      query_intent: "other",
      seo_landing_page: false,
      source: "forecast-section",
      surface: "landing-page",
      placement: "forecast_section",
      video_loaded: false,
    };

    expect(mockTrack).toHaveBeenCalledWith(
      IOS_APP_CTA_CLICK_EVENT,
      expectedMetadata,
    );

    const callArgs = mockFetch.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    const body = JSON.parse(callArgs[1].body as string);
    expect(body).toMatchObject({
      eventType: "cta_click",
      metadata: expectedMetadata,
      sessionId: "test-visitor-id",
      viewportWidth: 390,
    });
  });

  it("enriches SEO landing page CTA metadata from the current path", () => {
    window.history.pushState({}, "", "/water-temp/huntington-beach");

    trackIosAppCtaClick({
      source: "seo-water-temp-inline",
      surface: "water-temp",
      placement: "utility_handoff",
    });

    expect(mockTrack).toHaveBeenCalledWith(
      IOS_APP_CTA_CLICK_EVENT,
      expect.objectContaining({
        source: "seo-water-temp-inline",
        page_type: "city_water_temp",
        query_intent: "water_temp",
        seo_landing_page: true,
      }),
    );
  });

  it("cannot throw into CTA actions when product analytics fails", () => {
    mockTrack.mockImplementationOnce(() => {
      throw new Error("analytics unavailable");
    });

    expect(() =>
      trackIosAppCtaClick({ source: "exact-call", placement: "handoff" })
    ).not.toThrow();
  });
});
