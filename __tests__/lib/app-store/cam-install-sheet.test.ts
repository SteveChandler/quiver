import {
  CAM_INSTALL_SHEET_STORAGE_KEY,
  getCamInstallSheetPlatform,
  isCamInstallSheetEnabled,
  isCamSheetAllowed,
  markCamSheetShownThisPageLoad,
  playbackDeltaSeconds,
  readCamSheetCap,
  reportCamPlayback,
  resetCamSheetPageLoadForTests,
  subscribeCamPlayback,
  writeCamSheetCap,
} from "@/lib/app-store/cam-install-sheet";
import { buildSpotAskCopy } from "@/lib/app-store/spot-ask-copy";

const NOW = new Date("2026-11-27T20:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

function throwingStorage(error: Error): () => Storage {
  return () => {
    throw error;
  };
}

beforeEach(() => {
  window.localStorage.clear();
  resetCamSheetPageLoadForTests();
});

describe("playbackDeltaSeconds", () => {
  it("counts forward playback only", () => {
    expect(playbackDeltaSeconds(10, 10.25, true)).toBeCloseTo(0.25);
    expect(playbackDeltaSeconds(null, 10, true)).toBe(0);
    expect(playbackDeltaSeconds(10, 10.25, false)).toBe(0);
    expect(playbackDeltaSeconds(10, 9, true)).toBe(0);
  });

  it("ignores live-edge jumps and seeks, which are not watching", () => {
    expect(playbackDeltaSeconds(10, 40, true)).toBe(0);
    expect(playbackDeltaSeconds(10, 11.6, true)).toBe(0);
    expect(playbackDeltaSeconds(10, Number.NaN, true)).toBe(0);
  });
});

describe("cam playback bus", () => {
  it("delivers positive deltas to subscribers until they unsubscribe", () => {
    const listener = jest.fn();
    const unsubscribe = subscribeCamPlayback(listener);

    reportCamPlayback(0.25);
    reportCamPlayback(0);
    reportCamPlayback(-1);
    unsubscribe();
    reportCamPlayback(0.25);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(0.25);
  });
});

describe("7-day cap", () => {
  it("allows the first show and blocks for 7 days after", () => {
    expect(isCamSheetAllowed(readCamSheetCap(), NOW)).toBe(true);

    writeCamSheetCap(NOW);
    expect(window.localStorage.getItem(CAM_INSTALL_SHEET_STORAGE_KEY)).toBe(NOW.toISOString());
    expect(isCamSheetAllowed(readCamSheetCap(), new Date(NOW.getTime() + 6.9 * DAY))).toBe(false);
    expect(isCamSheetAllowed(readCamSheetCap(), new Date(NOW.getTime() + 7 * DAY))).toBe(true);
  });

  it("treats an unreadable or future date as not shown", () => {
    window.localStorage.setItem(CAM_INSTALL_SHEET_STORAGE_KEY, "garbage");
    expect(readCamSheetCap()).toEqual({ kind: "ok", shownAt: null });
    expect(isCamSheetAllowed(readCamSheetCap(), NOW)).toBe(true);

    window.localStorage.setItem(CAM_INSTALL_SHEET_STORAGE_KEY, "2027-01-01T00:00:00Z");
    expect(isCamSheetAllowed(readCamSheetCap(), NOW)).toBe(true);
  });

  it("shows at most once per page load, whatever storage says", () => {
    markCamSheetShownThisPageLoad();
    expect(isCamSheetAllowed({ kind: "ok", shownAt: null }, NOW)).toBe(false);
    expect(isCamSheetAllowed({ kind: "unavailable" }, NOW)).toBe(false);
  });
});

describe("storage failure", () => {
  it("reports blocked storage as unavailable and then caps at once per page load", () => {
    const blocked = throwingStorage(new DOMException("denied", "SecurityError"));

    const cap = readCamSheetCap(blocked);
    expect(cap).toEqual({ kind: "unavailable" });
    expect(isCamSheetAllowed(cap, NOW)).toBe(true);
    expect(writeCamSheetCap(NOW, blocked)).toBe(false);

    markCamSheetShownThisPageLoad();
    expect(isCamSheetAllowed(readCamSheetCap(blocked), NOW)).toBe(false);
  });

  it("does not treat an unrelated failure in a playback listener as a storage failure", () => {
    const unsubscribe = subscribeCamPlayback(() => {
      throw new TypeError("listener bug");
    });
    try {
      expect(() => reportCamPlayback(0.25)).toThrow("listener bug");
    } finally {
      unsubscribe();
    }
    expect(readCamSheetCap()).toEqual({ kind: "ok", shownAt: null });
  });
});

describe("platform", () => {
  it.each([
    ["Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1", "iphone"],
    ["Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 CriOS/120.0 Mobile/15E148 Safari/604.1", "iphone"],
    ["Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36", "none"],
    ["Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1", "none"],
    ["Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15", "desktop"],
  ])("maps %s to %s", (userAgent, platform) => {
    expect(getCamInstallSheetPlatform(userAgent)).toBe(platform);
  });

  it("treats a touch Mac user agent (iPadOS 13+ Safari) as iPad: none", () => {
    const ipadOsSafari =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15";
    expect(getCamInstallSheetPlatform(ipadOsSafari, 5)).toBe("none");
    expect(getCamInstallSheetPlatform(ipadOsSafari, 0)).toBe("desktop");
  });
});

describe("off switch NEXT_PUBLIC_CAM_INSTALL_SHEET", () => {
  const original = process.env.NEXT_PUBLIC_CAM_INSTALL_SHEET;
  afterEach(() => {
    if (original === undefined) delete process.env.NEXT_PUBLIC_CAM_INSTALL_SHEET;
    else process.env.NEXT_PUBLIC_CAM_INSTALL_SHEET = original;
  });

  it.each([
    [undefined, true],
    ["true", true],
    ["", true],
    ["false", false],
  ])("is %p -> enabled %p", (value, enabled) => {
    if (value === undefined) delete process.env.NEXT_PUBLIC_CAM_INSTALL_SHEET;
    else process.env.NEXT_PUBLIC_CAM_INSTALL_SHEET = value;
    expect(isCamInstallSheetEnabled()).toBe(enabled);
  });
});

describe("buildSpotAskCopy (sheet copy)", () => {
  it("is copy A by default", () => {
    expect(buildSpotAskCopy({ spotName: "Blacks Beach" })).toEqual({
      variant: "a",
      headline: "Make Blacks Beach your home break",
      body: "Alerts for your home break are free. We ping you when it turns on.",
      cta: "Get free alerts",
    });
  });

  it("is copy B when tomorrow's height is given", () => {
    expect(buildSpotAskCopy({ spotName: "Blacks Beach", tomorrowHeight: "6-7 ft" })).toEqual({
      variant: "b",
      headline: "6-7 ft at Blacks Beach tomorrow",
      body: "Get a dawn ping with the best window before you drive.",
      cta: "Ping me at dawn",
    });
  });

  it.each([null, undefined, "", "—", "Flat", "  "])("falls back to A for tomorrow height %p", (tomorrowHeight) => {
    expect(buildSpotAskCopy({ spotName: "Blacks Beach", tomorrowHeight }).variant).toBe("a");
  });

  it.each([null, undefined, "", "   "])("never shows a placeholder when the spot name is %p", (spotName) => {
    const copy = buildSpotAskCopy({ spotName, tomorrowHeight: "6-7 ft" });
    expect(copy).toEqual({
      variant: "a",
      headline: "Free alerts for your home break",
      body: "Alerts for your home break are free. We ping you when it turns on.",
      cta: "Get free alerts",
    });
  });

  it.each([
    ["a", buildSpotAskCopy({ spotName: "Blacks Beach" })],
    ["b", buildSpotAskCopy({ spotName: "Blacks Beach", tomorrowHeight: "6-7 ft" })],
  ])("copy %s avoids banned phrasing", (_variant, copy) => {
    const text = Object.values(copy).join(" ");
    expect(text).not.toMatch(/\bthe call\b|\bcalls?\b/i);
    expect(text).not.toMatch(/Worth a look|Worth the drive/i);
  });
});
