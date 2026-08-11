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
      "https://www.quiversurf.app/app",
    );
    expect(smartBannerArgument.searchParams.get("source")).toBe(
      "ios_smart_app_banner",
    );
    expect(smartBannerArgument.searchParams.get("surface")).toBe("web");
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
    expect(content).toContain("affiliate-data=pt=123456&ct=web");
    expect(content).toContain(
      `app-argument=${IOS_APP_STORE_SMART_BANNER_ARGUMENT}`,
    );
  });

  it("normalizes Apple attribution to three low-volume campaigns", () => {
    expect(resolveIosAppStoreCampaign({ campaign: "email" })).toBe("email");
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
});
