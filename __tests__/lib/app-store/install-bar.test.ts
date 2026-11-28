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
    // Visitors see the short hub URL; proxy.ts rewrites it to /beaches/usa/...
    ["/ca/san-diego", "city_hub"],
    ["/ca/san-diego/", "city_hub"],
    ["/hi/haleiwa", "city_hub"],
    ["/surf-cams/san-diego", "surf_cams"],
    ["/surf-cams/southern-california/", "surf_cams"],
    ["/forecast/san-diego", "forecast_region"],
    ["/forecast/orange-county/", "forecast_region"],
    ["/best-time-to-surf/san-diego", "best_time"],
    ["/ca/san-diego/blacks/tides", "beach_tides"],
    ["/surf-cams", null],
    ["/surf-cams/san-diego/blacks", null],
    ["/cams/southern-california", null],
    ["/ca/san-diego/blacks/water-temp", null],
    ["/", null],
    ["/forecast", null],
    ["/best-time-to-surf", null],
    ["/learn/rip-currents", null],
    ["/beaches/usa/ca", null],
  ])("classifies %s as %s", (pathname, surface) => {
    expect(getInstallBarSurface(pathname)).toBe(surface);
  });

  // A matched path is also a suppression switch (banner gate, in-page asks),
  // so a 2-segment route that is not a city hub must never match.
  it.each([
    "/vs/surfline",
    "/vs/surfline/free",
    "/beginner/ca",
    "/beginner/san-diego",
    "/water-temp/ca/san-diego",
    "/hi/waimea-kauai",
    "/hi/waimea-big-island",
    "/p/abc123",
    "/mexico/baja-california",
    "/blog/some-post",
    "/guides/san-diego",
    "/tides/station/la-jolla",
    "/ca",
    "/zz/san-diego",
    "/ca/san-diego/blacks/forecast",
    "/forecast/san-diego/extra",
  ])("does not treat %s as a bar surface", (pathname) => {
    expect(getInstallBarSurface(pathname)).toBeNull();
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
    expect(getInstallBarOwnedSurface({ userAgent, pathname: "/ca/san-diego" })).toBe("city_hub");
    expect(getInstallBarOwnedSurface({ userAgent, pathname: "/forecast/san-diego" })).toBe("forecast_region");
    expect(getInstallBarOwnedSurface({ userAgent, pathname: "/best-time-to-surf/san-diego" })).toBe("best_time");
    expect(getInstallBarOwnedSurface({ userAgent, pathname: "/ca/san-diego/blacks/tides" })).toBe("beach_tides");
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
  // Intended change (2026-11-27 approved mock): the bar's copy moved from
  // "Now at {Spot}: {H}" / "Get the app" to the free home-break ask.
  it("uses copy A on spot pages by default", () => {
    for (const surface of ["beach_detail", "beach_tides"] as const) {
      expect(buildInstallBarCopy({ surface, placeName: "Blacks Beach" })).toEqual({
        headline: "Make Blacks Beach your home break",
        subline: "Free alerts",
        cta: "Get free alerts",
        variant: "a",
      });
    }
  });

  it("uses copy B on spot pages when tomorrow is bigger", () => {
    expect(
      buildInstallBarCopy({ surface: "beach_detail", placeName: "Blacks Beach", tomorrowHeight: "6-7 ft" }),
    ).toEqual({
      headline: "6-7 ft at Blacks Beach tomorrow",
      subline: "Dawn ping",
      cta: "Ping me at dawn",
      variant: "b",
    });
  });

  it.each(["water_temp", "city_hub", "surf_cams", "forecast_region", "best_time"] as const)(
    "uses the place ask on %s and never a height",
    (surface) => {
      expect(
        buildInstallBarCopy({ surface, placeName: "San Diego", tomorrowHeight: "6-7 ft" }),
      ).toEqual({
        headline: "Free alerts for your home break",
        subline: "Pick a spot near San Diego. We ping you when it turns on.",
        cta: "Get free alerts",
        variant: "place",
      });
    },
  );

  it.each([
    ["missing", ""],
    ["blank", "   "],
  ])("never shows a placeholder when the spot name is %s", (_case, placeName) => {
    const spot = buildInstallBarCopy({ surface: "beach_detail", placeName, tomorrowHeight: "6-7 ft" });
    const place = buildInstallBarCopy({ surface: "city_hub", placeName });

    for (const copy of [spot, place]) {
      expect(copy.headline).toBe("Free alerts for your home break");
      expect(copy.subline).toBe("Alerts for your home break are free. We ping you when it turns on.");
      expect(Object.values(copy).join(" ")).not.toMatch(/undefined|null|—|\{|\}|\bnear\s*\./);
    }
  });

  it.each([null, "", "—", "Flat"])("falls back to copy A when tomorrow's height is %p", (tomorrowHeight) => {
    expect(
      buildInstallBarCopy({ surface: "beach_detail", placeName: "Blacks Beach", tomorrowHeight }).variant,
    ).toBe("a");
  });

  it.each([
    ["beach_detail", "6-7 ft"],
    ["beach_detail", null],
    ["water_temp", null],
    ["city_hub", null],
  ] as const)("never uses call, AI or ML wording on %s", (surface, tomorrowHeight) => {
    const copy = Object.values(
      buildInstallBarCopy({ surface, placeName: "Blacks", tomorrowHeight }),
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
