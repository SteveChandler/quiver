import {
  APP_HANDOFF_PATH,
  buildAppHandoffPath,
  buildAppHandoffUrl,
  type HandoffParams,
  iosAppStoreUrlWithCampaign,
} from "@/lib/constants/app-handoff";
import { IOS_APP_STORE_URL } from "@/lib/constants/app-store";

describe("app-handoff constants", () => {
  const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  afterEach(() => {
    if (originalSiteUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SITE_URL;
    } else {
      process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
    }
  });

  it("exposes the /app handoff path", () => {
    expect(APP_HANDOFF_PATH).toBe("/app");
  });

  it("builds a handoff path carrying only safe attribution params", () => {
    const unsafeParams: HandoffParams & { email: string } = {
      source: "landing_hero",
      placement: "hero_primary",
      utm_source: "qr",
      utm_medium: "desktop_handoff",
      utm_campaign: "app_first_v1",
      // unsafe / unknown keys are dropped
      email: "nope@example.com",
    };
    const path = buildAppHandoffPath(unsafeParams);
    expect(path.startsWith("/app?")).toBe(true);
    expect(path).toContain("source=landing_hero");
    expect(path).toContain("placement=hero_primary");
    expect(path).toContain("utm_source=qr");
    expect(path).not.toContain("nope%40example.com");
  });

  it("builds an absolute handoff URL from the configured public site origin", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://dev.quiversurf.app/";

    expect(buildAppHandoffUrl({ source: "landing_hero" })).toBe(
      "https://dev.quiversurf.app/app?source=landing_hero",
    );
  });

  it("appends Apple campaign tokens to the App Store URL", () => {
    const url = iosAppStoreUrlWithCampaign("app_first_v1");
    expect(url.startsWith(IOS_APP_STORE_URL)).toBe(true);
    expect(url).toContain("ct=app_first_v1");
    expect(url).not.toContain("mt=8");
  });
});
