import {
  classifyIphoneBrowser,
  getIphoneAppBannerDecision,
  isDismissedWithinWindow,
  isIphoneAppBannerExcludedPath,
  isIphoneUserAgent,
} from "@/lib/app-store/iphone-app-banner";

const IPHONE_SAFARI_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const IPHONE_CHROME_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.0.0 Mobile/15E148 Safari/604.1";
const IPAD_SAFARI_UA =
  "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const ANDROID_CHROME_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
const DESKTOP_SAFARI_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";

describe("iPhone app banner eligibility", () => {
  it("detects iPhone and excludes iPad, Android, and desktop", () => {
    expect(isIphoneUserAgent(IPHONE_SAFARI_UA)).toBe(true);
    expect(isIphoneUserAgent(IPHONE_CHROME_UA)).toBe(true);
    expect(isIphoneUserAgent(IPAD_SAFARI_UA)).toBe(false);
    expect(isIphoneUserAgent(ANDROID_CHROME_UA)).toBe(false);
    expect(isIphoneUserAgent(DESKTOP_SAFARI_UA)).toBe(false);
  });

  it("classifies iPhone Safari and Chrome", () => {
    expect(classifyIphoneBrowser(IPHONE_SAFARI_UA)).toBe("safari");
    expect(classifyIphoneBrowser(IPHONE_CHROME_UA)).toBe("chrome_ios");
  });

  it("excludes high-friction app and auth routes", () => {
    expect(isIphoneAppBannerExcludedPath("/")).toBe(true);
    expect(isIphoneAppBannerExcludedPath("/auth/login")).toBe(true);
    expect(isIphoneAppBannerExcludedPath("/embed/forecast")).toBe(true);
    expect(isIphoneAppBannerExcludedPath("/welcome")).toBe(true);
    expect(isIphoneAppBannerExcludedPath("/admin")).toBe(true);
    expect(isIphoneAppBannerExcludedPath("/map")).toBe(false);
  });

  it("uses a 14-day dismissal window", () => {
    const now = new Date("2026-05-18T12:00:00.000Z");

    expect(
      isDismissedWithinWindow("2026-05-10T12:00:00.000Z", now)
    ).toBe(true);
    expect(
      isDismissedWithinWindow("2026-05-01T12:00:00.000Z", now)
    ).toBe(false);
    expect(isDismissedWithinWindow("not-a-date", now)).toBe(false);
  });

  it("shows the custom banner for eligible iPhone Chrome pages", () => {
    expect(
      getIphoneAppBannerDecision({
        userAgent: IPHONE_CHROME_UA,
        pathname: "/map",
        isStandalone: false,
        dismissedAt: null,
        now: new Date("2026-05-18T12:00:00.000Z"),
      })
    ).toEqual({
      browser: "chrome_ios",
      isIphone: true,
      isEligible: true,
      shouldShow: true,
    });
  });

  it("suppresses custom UI for Safari because native Smart App Banner handles it", () => {
    expect(
      getIphoneAppBannerDecision({
        userAgent: IPHONE_SAFARI_UA,
        pathname: "/map",
        isStandalone: false,
        dismissedAt: null,
      })
    ).toMatchObject({
      browser: "safari",
      isIphone: true,
      isEligible: true,
      shouldShow: false,
      suppressionReason: "safari_native_banner",
    });
  });

  it("suppresses custom UI for standalone and dismissed sessions", () => {
    expect(
      getIphoneAppBannerDecision({
        userAgent: IPHONE_CHROME_UA,
        pathname: "/map",
        isStandalone: true,
        dismissedAt: null,
      }).suppressionReason
    ).toBe("standalone");

    expect(
      getIphoneAppBannerDecision({
        userAgent: IPHONE_CHROME_UA,
        pathname: "/map",
        isStandalone: false,
        dismissedAt: "2026-05-18T12:00:00.000Z",
        now: new Date("2026-05-19T12:00:00.000Z"),
      }).suppressionReason
    ).toBe("dismissed");
  });
});
