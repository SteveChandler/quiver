import {
  buildInstallBarCopy,
  getInstallBarOwnedSurface,
  getInstallBarSurface,
  INSTALL_ASK_SELECTORS,
  installBarOwnsInstallAsk,
  iphoneInstallAskOwnedElsewhere,
  isInstallAskInView,
} from "@/lib/app-store/install-bar";
import { iphoneBannerOwnsInstallAsk } from "@/lib/app-store/beach-subpage-install-cta";

const BEACH = "/ca/san-diego/blacks";
const UAS = {
  iphoneSafari:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  iphoneChrome:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.0.0 Mobile/15E148 Safari/604.1",
  iphoneInstagram:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 300.0.0.0",
  ipad: "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  android:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
  desktop:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
} as const;

describe("getInstallBarSurface", () => {
  it.each([
    [BEACH, "beach_detail"],
    ["/hi/honolulu/waikiki/", "beach_detail"],
    ["/water-temp/san-diego", "water_temp"],
    ["/beaches/usa/ca/san-diego", "city_hub"],
    ["/surf-cams/san-diego", "surf_cams"],
    ["/surf-cams/southern-california/", "surf_cams"],
    ["/surf-cams", null],
    ["/surf-cams/san-diego/blacks", null],
    ["/cams/southern-california", null],
    ["/ca/san-diego", null],
    ["/ca/san-diego/blacks/water-temp", null],
    ["/ca/san-diego/blacks/tides", null],
    ["/", null],
    ["/forecast", null],
    ["/learn/rip-currents", null],
    ["/beaches/usa/ca", null],
  ])("classifies %s as %s", (pathname, surface) => {
    expect(getInstallBarSurface(pathname)).toBe(surface);
  });
});

describe("getInstallBarOwnedSurface", () => {
  const base = { pathname: BEACH };

  it.each([
    ["Safari", UAS.iphoneSafari],
    ["Chrome on iPhone", UAS.iphoneChrome],
    ["an in-app browser", UAS.iphoneInstagram],
  ])("owns the page for iPhone %s", (_name, userAgent) => {
    expect(getInstallBarOwnedSurface({ ...base, userAgent })).toBe("beach_detail");
  });

  it.each([
    ["iPad", UAS.ipad],
    ["Android", UAS.android],
    ["desktop", UAS.desktop],
  ])("never owns the page for %s", (_name, userAgent) => {
    expect(getInstallBarOwnedSurface({ ...base, userAgent })).toBeNull();
  });

  it("is off in standalone mode, on excluded routes and on other pages", () => {
    const userAgent = UAS.iphoneSafari;

    expect(getInstallBarOwnedSurface({ ...base, userAgent, isStandalone: true })).toBeNull();
    expect(getInstallBarOwnedSurface({ ...base, userAgent, pathname: "/welcome" })).toBeNull();
    expect(getInstallBarOwnedSurface({ ...base, userAgent, pathname: "/forecast" })).toBeNull();
  });

  it("resolves each bar surface", () => {
    const userAgent = UAS.iphoneChrome;

    expect(getInstallBarOwnedSurface({ userAgent, pathname: "/water-temp/san-diego" })).toBe("water_temp");
    expect(getInstallBarOwnedSurface({ userAgent, pathname: "/beaches/usa/ca/san-diego" })).toBe("city_hub");
    expect(getInstallBarOwnedSurface({ userAgent, pathname: "/surf-cams/san-diego" })).toBe("surf_cams");
  });
});

describe("one install ask at a time", () => {
  it("suppresses the iPhone banner's ask wherever the bar owns the page, so the two never coexist", () => {
    // Every visitor the banner would target on a bar page is also owned by the bar.
    const bannerVisitors = Object.values(UAS).filter((userAgent) =>
      iphoneBannerOwnsInstallAsk({ userAgent, pathname: BEACH }),
    );
    expect(bannerVisitors.length).toBeGreaterThan(0);
    for (const userAgent of bannerVisitors) {
      expect(installBarOwnsInstallAsk({ userAgent, pathname: BEACH })).toBe(true);
    }
  });

  it("suppresses the in-page install section for every bar visitor and nobody else", () => {
    const on = { pathname: BEACH };

    expect(iphoneInstallAskOwnedElsewhere({ ...on, userAgent: UAS.iphoneSafari })).toBe(true);
    expect(iphoneInstallAskOwnedElsewhere({ ...on, userAgent: UAS.iphoneChrome })).toBe(true);
    expect(iphoneInstallAskOwnedElsewhere({ ...on, userAgent: UAS.android })).toBe(false);
    expect(iphoneInstallAskOwnedElsewhere({ ...on, userAgent: UAS.desktop })).toBe(false);
  });
});

describe("buildInstallBarCopy", () => {
  it("names the place and the figure the page already shows", () => {
    expect(
      buildInstallBarCopy({ surface: "beach_detail", placeName: "Blacks", valueLabel: "2-3 ft" }),
    ).toEqual({
      headline: "Now at Blacks: 2-3 ft",
      subline: "Hourly forecast and alerts in the app",
      cta: "Get the app",
    });
    expect(
      buildInstallBarCopy({ surface: "beach_detail", placeName: "Blacks", valueLabel: "2-3 ft", isTomorrow: true })
        .headline,
    ).toBe("Tomorrow at Blacks: 2-3 ft");
    expect(
      buildInstallBarCopy({ surface: "water_temp", placeName: "San Diego", valueLabel: "64°F" }).headline,
    ).toBe("San Diego water: 64°F");
  });

  it("falls back to a figure-free line when there is no value", () => {
    expect(
      buildInstallBarCopy({ surface: "city_hub", placeName: "San Diego", valueLabel: null }),
    ).toEqual({
      headline: "Forecast and alerts for San Diego",
      subline: "Free in the app",
      cta: "Get the app",
    });
  });

  it.each([
    ["beach_detail", "2-3 ft"],
    ["water_temp", "64°F"],
    ["city_hub", null],
  ] as const)("never uses call, AI or ML wording on %s", (surface, valueLabel) => {
    const copy = Object.values(
      buildInstallBarCopy({ surface, placeName: "Blacks", valueLabel }),
    ).join(" ");

    expect(copy).not.toMatch(/\bcalls?\b/i);
    expect(copy).not.toMatch(/\b(AI|ML|machine learning|artificial intelligence)\b/i);
  });
});

describe("isInstallAskInView", () => {
  function mountAsk(html: string, rect: { top: number; bottom: number }): void {
    document.body.innerHTML = html;
    const el = document.body.firstElementChild as HTMLElement;
    el.getBoundingClientRect = () =>
      ({
        top: rect.top,
        bottom: rect.bottom,
        height: rect.bottom - rect.top,
      }) as DOMRect;
  }

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("matches both in-flow install asks by their stable hooks", () => {
    expect(INSTALL_ASK_SELECTORS).toEqual([
      'section[aria-label="Get the Quiver app"]',
      '[data-testid^="content-page-app-handoff-cta"]',
    ]);
  });

  it.each([
    ["install section", '<section aria-label="Get the Quiver app"></section>'],
    ["handoff cta", '<div data-testid="content-page-app-handoff-cta-beach_detail"></div>'],
  ])("is true when the %s is mostly on screen", (_name, html) => {
    mountAsk(html, { top: 300, bottom: 500 });

    expect(isInstallAskInView(document, 800)).toBe(true);
  });

  it("is false when the ask is below the fold, above it, or absent", () => {
    mountAsk('<section aria-label="Get the Quiver app"></section>', { top: 790, bottom: 990 });
    expect(isInstallAskInView(document, 800)).toBe(false);

    mountAsk('<section aria-label="Get the Quiver app"></section>', { top: -300, bottom: -100 });
    expect(isInstallAskInView(document, 800)).toBe(false);

    document.body.innerHTML = "<p>nothing</p>";
    expect(isInstallAskInView(document, 800)).toBe(false);
  });

  it("counts an ask taller than the screen once a third of the screen shows it", () => {
    mountAsk('<section aria-label="Get the Quiver app"></section>', { top: 500, bottom: 3000 });

    expect(isInstallAskInView(document, 800)).toBe(true);
  });
});
