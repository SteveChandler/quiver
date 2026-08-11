import {
  APP_HANDOFF_PATH,
  buildAppHandoffPath,
  buildAppHandoffUrl,
  buildSmartQrHandoffUrl,
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

  it("exposes the dedicated native handoff path", () => {
    expect(APP_HANDOFF_PATH).toBe("/app/handoff");
  });

  it("builds a handoff path carrying only safe attribution params", () => {
    const unsafeParams: HandoffParams & { email: string } = {
      source: "landing_hero",
      surface: "landing-page",
      placement: "hero_primary",
      handoff_id: "33333333-3333-4333-8333-333333333333",
      qr_id: "hero_qr",
      target: "download",
      utm_source: "qr",
      utm_medium: "desktop_handoff",
      utm_campaign: "app_first_v1",
      utm_content: "zine_panel",
      // unsafe / unknown keys are dropped
      email: "nope@example.com",
    };
    const path = buildAppHandoffPath(unsafeParams);
    expect(path.startsWith("/app/handoff?")).toBe(true);
    expect(path).toContain("source=landing_hero");
    expect(path).toContain("surface=landing-page");
    expect(path).toContain("placement=hero_primary");
    expect(path).toContain("handoff_id=33333333-3333-4333-8333-333333333333");
    expect(path).toContain("qr_id=hero_qr");
    expect(path).toContain("target=download");
    expect(path).toContain("utm_source=qr");
    expect(path).toContain("utm_content=zine_panel");
    expect(path).not.toContain("nope%40example.com");
  });

  it("builds an absolute handoff URL from the configured public site origin", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://dev.quiversurf.app/";

    expect(buildAppHandoffUrl({ source: "landing_hero" })).toBe(
      "https://dev.quiversurf.app/app/handoff?source=landing_hero",
    );
  });

  it("builds smart QR URLs with default QR campaign attribution", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://www.quiversurf.app";

    const url = buildSmartQrHandoffUrl({
      source: "map_literacy_panel",
      surface: "map",
      placement: "field_guide_qr",
      handoff_id: "33333333-3333-4333-8333-333333333333",
      qr_id: "map_literacy_field_guide",
      target: "download",
    });
    const parsed = new URL(url);

    expect(parsed.pathname).toBe("/app/handoff");
    expect(parsed.searchParams.get("utm_source")).toBe("qr");
    expect(parsed.searchParams.get("utm_medium")).toBe("smart_qr");
    expect(parsed.searchParams.get("utm_campaign")).toBe("app_first_v1");
    expect(parsed.searchParams.get("qr_id")).toBe("map_literacy_field_guide");
    expect(parsed.searchParams.get("handoff_id")).toBe(
      "33333333-3333-4333-8333-333333333333",
    );
  });

  it("appends Apple campaign tokens to the App Store URL", () => {
    const url = iosAppStoreUrlWithCampaign("web");
    expect(url.startsWith(IOS_APP_STORE_URL)).toBe(true);
    expect(url).toContain("ct=web");
    expect(url).toContain("mt=8");
  });
});
