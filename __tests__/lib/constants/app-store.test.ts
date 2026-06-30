import {
  ANDROID_BETA_CONTACT_EMAIL,
  ANDROID_BETA_CONTACT_MAILTO,
  ANDROID_BETA_GROUP_URL,
  ANDROID_BETA_LANDING_PATH,
  ANDROID_BETA_LANDING_URL,
  ANDROID_BETA_PLAY_URL,
  IOS_APP_STORE_APP_ID,
  IOS_APP_STORE_CTA,
  IOS_APP_STORE_DESTINATION_STATUS,
  IOS_APP_STORE_SMART_BANNER_ARGUMENT,
  IOS_APP_STORE_URL,
  iosAppStoreUrlWithCampaign,
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
    expect(IOS_APP_STORE_SMART_BANNER_ARGUMENT).toBe(
      "https://www.quiversurf.app",
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
    delete process.env.IOS_APP_STORE_PROVIDER_TOKEN;

    const url = iosAppStoreUrlWithCampaign("app_first_v1");
    const parsed = new URL(url);

    expect(parsed.origin + parsed.pathname).toBe(IOS_APP_STORE_URL);
    expect(parsed.searchParams.get("ct")).toBe("app_first_v1");
    expect(parsed.searchParams.get("mt")).toBe("8");
  });

  it("preserves the optional App Store provider token", () => {
    process.env.IOS_APP_STORE_PROVIDER_TOKEN = "123456";

    const url = iosAppStoreUrlWithCampaign("app_first_v1");
    const parsed = new URL(url);

    expect(parsed.searchParams.get("pt")).toBe("123456");
    expect(parsed.searchParams.get("ct")).toBe("app_first_v1");
    expect(parsed.searchParams.get("mt")).toBe("8");
  });
});
