import { shouldShowBeachSubPageInstallCta } from "@/lib/app-store/beach-subpage-install-cta";
import { getIphoneAppBannerDecision } from "@/lib/app-store/iphone-app-banner";

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
const IPHONE_INSTAGRAM_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 310.0.0.0.105";

const PATHNAME = "/ca/huntington-beach/goldenwest/tides";
const originalFlag = process.env.BEACH_SUBPAGE_INSTALL_CTA_ENABLED;

function setFlag(value: string | undefined): void {
  if (value === undefined) {
    delete process.env.BEACH_SUBPAGE_INSTALL_CTA_ENABLED;
    return;
  }

  process.env.BEACH_SUBPAGE_INSTALL_CTA_ENABLED = value;
}

describe("beach sub-page install CTA", () => {
  afterEach(() => {
    setFlag(originalFlag);
  });

  it.each([undefined, "false", "TRUE"])(
    "fails closed for every audience when the flag is %s",
    (flagValue) => {
      setFlag(flagValue);

      for (const userAgent of [
        IPHONE_SAFARI_UA,
        IPHONE_CHROME_UA,
        IPAD_SAFARI_UA,
        IPHONE_INSTAGRAM_UA,
        ANDROID_CHROME_UA,
        DESKTOP_SAFARI_UA,
      ]) {
        expect(
          shouldShowBeachSubPageInstallCta({ userAgent, pathname: PATHNAME })
        ).toBe(false);
      }
    }
  );

  it("shows only for Safari iOS when the flag is on", () => {
    setFlag("true");

    expect(
      shouldShowBeachSubPageInstallCta({
        userAgent: IPHONE_SAFARI_UA,
        pathname: PATHNAME,
      })
    ).toBe(true);
    expect(
      shouldShowBeachSubPageInstallCta({
        userAgent: IPAD_SAFARI_UA,
        pathname: PATHNAME,
      })
    ).toBe(true);
    expect(
      shouldShowBeachSubPageInstallCta({
        userAgent: IPHONE_CHROME_UA,
        pathname: PATHNAME,
      })
    ).toBe(false);
    expect(
      shouldShowBeachSubPageInstallCta({
        userAgent: ANDROID_CHROME_UA,
        pathname: PATHNAME,
      })
    ).toBe(false);
    expect(
      shouldShowBeachSubPageInstallCta({
        userAgent: DESKTOP_SAFARI_UA,
        pathname: PATHNAME,
      })
    ).toBe(false);
  });

  it("keeps the beach CTA and iPhone banner mutually exclusive", () => {
    setFlag("true");

    for (const { name, userAgent } of [
      { name: "iPhone Safari", userAgent: IPHONE_SAFARI_UA },
      { name: "iPhone CriOS", userAgent: IPHONE_CHROME_UA },
    ]) {
      const beachSubPageCta = shouldShowBeachSubPageInstallCta({
        userAgent,
        pathname: PATHNAME,
      });
      const iphoneAppBanner = getIphoneAppBannerDecision({
        userAgent,
        pathname: PATHNAME,
        isStandalone: false,
        dismissedAt: null,
      }).shouldShow;

      expect({ userAgent: name, bothTrue: beachSubPageCta && iphoneAppBanner })
        .toEqual({ userAgent: name, bothTrue: false });
      expect({ userAgent: name, bothFalse: !beachSubPageCta && !iphoneAppBanner })
        .toEqual({ userAgent: name, bothFalse: false });
    }
  });

  it("defers to IphoneAppBanner for an iOS in-app browser", () => {
    setFlag("true");

    expect(
      shouldShowBeachSubPageInstallCta({
        userAgent: IPHONE_INSTAGRAM_UA,
        pathname: PATHNAME,
      })
    ).toBe(false);
  });
});
