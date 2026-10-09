import {
  ANDROID_BETA_CONTACT_EMAIL,
  ANDROID_BETA_CONTACT_MAILTO,
  ANDROID_BETA_GROUP_URL,
  ANDROID_BETA_LANDING_PATH,
  ANDROID_BETA_LANDING_URL,
  ANDROID_BETA_PLAY_URL,
  IOS_APP_STORE_APP_ID,
  IOS_APP_STORE_CAMPAIGNS,
  IOS_APP_STORE_CTA,
  IOS_APP_STORE_DESTINATION_STATUS,
  IOS_APP_STORE_WEB_REDIRECT_PATH,
  IOS_APP_STORE_SMART_BANNER_ARGUMENT,
  IOS_APP_STORE_URL,
  buildIosAppStoreRedirectPath,
  buildIosSmartAppBannerContent,
  iosAppStoreUrlWithCampaign,
  resolveIosAppStoreCampaign,
} from "@/lib/constants/app-store";

describe("app-store constants", () => {
  const originalProviderToken = process.env.IOS_APP_STORE_PROVIDER_TOKEN;

  afterEach(() => {
    if (originalProviderToken === undefined) {
      delete process.env.IOS_APP_STORE_PROVIDER_TOKEN;
    } else {
      process.env.IOS_APP_STORE_PROVIDER_TOKEN = originalProviderToken;
    }
  });

  it("keeps iOS App Store destination copy in one live source of truth", () => {
    expect(IOS_APP_STORE_APP_ID).toBe("6759300320");
    expect(IOS_APP_STORE_URL).toBe(
      "https://apps.apple.com/us/app/surf-forecast-quiver/id6759300320",
    );
    expect(IOS_APP_STORE_CTA).toBe("Open App Store");
    expect(IOS_APP_STORE_DESTINATION_STATUS).toBe("app_store_live");
    expect(IOS_APP_STORE_CTA).not.toMatch(/download|pre[- ]?order/i);
  });

  it("keeps smart banner and Android beta destinations separate", () => {
    const smartBannerArgument = new URL(IOS_APP_STORE_SMART_BANNER_ARGUMENT);

    expect(smartBannerArgument.origin + smartBannerArgument.pathname).toBe(
      "https://go.quiversurf.app/app/handoff",
    );
    expect(smartBannerArgument.searchParams.get("source")).toBe(
      "ios_smart_app_banner",
    );
    expect(smartBannerArgument.searchParams.get("surface")).toBe("smart_banner");
    expect(smartBannerArgument.searchParams.get("placement")).toBe(
      "apple_smart_banner",
    );
    expect(smartBannerArgument.searchParams.get("utm_source")).toBe(
      "ios_safari",
    );
    expect(smartBannerArgument.searchParams.get("utm_medium")).toBe(
      "smart_banner",
    );
    expect(smartBannerArgument.searchParams.get("utm_campaign")).toBe(
      "app_first_v1",
    );
    expect(ANDROID_BETA_LANDING_PATH).toBe("/android-beta");
    expect(ANDROID_BETA_LANDING_URL).toBe(
      "https://www.quiversurf.app/android-beta",
    );
    expect(ANDROID_BETA_GROUP_URL).toBe(
      "https://groups.google.com/g/quiver-android-testers",
    );
    expect(ANDROID_BETA_CONTACT_EMAIL).toBe("steven@quiversurf.app");
    expect(ANDROID_BETA_CONTACT_MAILTO).toBe("mailto:steven@quiversurf.app");
    expect(ANDROID_BETA_PLAY_URL).toBe(
      "https://play.google.com/apps/testing/app.quiversurf.surf",
    );
  });

  it("builds campaign URLs with App Store app-link attribution", () => {
    const url = iosAppStoreUrlWithCampaign(IOS_APP_STORE_CAMPAIGNS.WEB);
    const parsed = new URL(url);

    expect(parsed.origin + parsed.pathname).toBe(IOS_APP_STORE_URL);
    expect(parsed.searchParams.get("ct")).toBe("web");
    expect(parsed.searchParams.get("mt")).toBe("8");
  });

  it("preserves the optional App Store provider token", () => {
    const url = iosAppStoreUrlWithCampaign(
      IOS_APP_STORE_CAMPAIGNS.EMAIL,
      "123456",
    );
    const parsed = new URL(url);

    expect(parsed.searchParams.get("pt")).toBe("123456");
    expect(parsed.searchParams.get("ct")).toBe("email");
    expect(parsed.searchParams.get("mt")).toBe("8");
  });

  it("tags share links with the share campaign and keeps the provider token", () => {
    const url = new URL(
      iosAppStoreUrlWithCampaign(IOS_APP_STORE_CAMPAIGNS.SHARE, "128222562"),
    );

    expect(url.searchParams.get("pt")).toBe("128222562");
    expect(url.searchParams.get("ct")).toBe("share");
    expect(url.searchParams.get("mt")).toBe("8");
  });

  it("omits malformed provider tokens", () => {
    const url = new URL(
      iosAppStoreUrlWithCampaign(IOS_APP_STORE_CAMPAIGNS.WEB, "not-a-token"),
    );

    expect(url.searchParams.has("pt")).toBe(false);
  });

  it("builds server redirect paths without exposing the provider token", () => {
    expect(IOS_APP_STORE_WEB_REDIRECT_PATH).toBe("/app-store?ct=web");
    expect(buildIosAppStoreRedirectPath(IOS_APP_STORE_CAMPAIGNS.EMAIL)).toBe(
      "/app-store?ct=email",
    );
  });

  it("adds Apple campaign attribution to Smart App Banner metadata", () => {
    const content = buildIosSmartAppBannerContent("123456");

    expect(content).toContain("app-id=6759300320");
    expect(content).toContain("affiliate-data=pt=123456&ct=web_banner,");
    expect(content).toContain(
      `app-argument=${IOS_APP_STORE_SMART_BANNER_ARGUMENT}`,
    );
  });

  it("normalizes Apple attribution to a small set of reportable campaigns", () => {
    expect(resolveIosAppStoreCampaign({ campaign: "email" })).toBe("email");
    expect(resolveIosAppStoreCampaign({ campaign: "share" })).toBe("share");
    expect(
      resolveIosAppStoreCampaign({
        campaign: "partner_sandys",
        surface: "partner_landing",
      }),
    ).toBe("partner_qr");
    expect(resolveIosAppStoreCampaign({ campaign: "one-off-experiment" })).toBe(
      "web",
    );
  });

  it.each([
    [
      "Smart App Banner argument",
      {
        source: "ios_smart_app_banner",
        surface: "smart_banner",
        placement: "apple_smart_banner",
        medium: "smart_banner",
        campaign: "app_first_v1",
      },
      "web_banner",
    ],
    [
      "banner argument whose query string arrived JSON-escaped",
      {
        source:
          "ios_smart_app_banner\\u0026surface=web\\u0026placement=apple_smart_banner",
      },
      "web_banner",
    ],
    [
      "legacy iPhone app banner",
      { source: "iphone-app-banner", surface: "web", placement: "iphone_app_banner" },
      "web_banner",
    ],
    [
      "App Links metadata",
      { source: "app_links", surface: "metadata", placement: "ios_app_link" },
      "web_app_links",
    ],
    [
      "App Links URL truncated by the opening app",
      { source: "app_links\\u0026surfa" },
      "web_app_links",
    ],
    [
      "beach page CTA",
      {
        source: "content-beach-detail-tourmaline",
        surface: "beach_detail",
        placement: "after_public_hourly_forecast",
      },
      "web_page",
    ],
    [
      "comparison page CTA that already says web",
      { campaign: "web", surface: "comparison", placement: "source_link" },
      "web_page",
    ],
    [
      "legacy /app-store alias with no page",
      {
        campaign: "web",
        surface: "app_store",
        placement: "legacy_app_store_redirect",
      },
      "web",
    ],
    ["source too truncated to classify", { source: "app" }, "web"],
    ["no signals", {}, "web"],
  ])("routes %s to its Apple campaign", (_label, signals, expected) => {
    expect(resolveIosAppStoreCampaign(signals)).toBe(expected);
  });

  it("keeps explicit email, share and partner campaigns ahead of page signals", () => {
    expect(
      resolveIosAppStoreCampaign({ campaign: "email", surface: "beach_detail" }),
    ).toBe("email");
    expect(
      resolveIosAppStoreCampaign({
        campaign: "share",
        source: "ios_smart_app_banner",
      }),
    ).toBe("share");
  });

  it.each(["web_banner", "web_app_links", "web_page"])(
    "passes the explicit %s campaign through",
    (campaign) => {
      expect(resolveIosAppStoreCampaign({ campaign })).toBe(campaign);
    },
  );
});
