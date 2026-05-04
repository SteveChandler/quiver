import { isBot, isSuspiciousFingerprint } from "@/lib/utils/bot-detector";

describe("isBot", () => {
  it("detects Googlebot", () => {
    expect(isBot("Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)")).toBe(
      true
    );
  });

  it("detects Bingbot", () => {
    expect(
      isBot("Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)")
    ).toBe(true);
  });

  it("detects facebookexternalhit", () => {
    expect(isBot("facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)")).toBe(
      true
    );
  });

  it("detects Twitterbot", () => {
    expect(isBot("Twitterbot/1.0")).toBe(true);
  });

  it("detects AhrefsBot", () => {
    expect(isBot("Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)")).toBe(true);
  });

  it("detects SemrushBot", () => {
    expect(isBot("Mozilla/5.0 (compatible; SemrushBot/7~bl; +http://www.semrush.com/bot.html)")).toBe(
      true
    );
  });

  it("detects headless browsers", () => {
    expect(isBot("Mozilla/5.0 HeadlessChrome/120.0.0.0")).toBe(true);
    expect(isBot("puppeteer/1.0")).toBe(true);
    expect(isBot("playwright/1.0")).toBe(true);
    expect(isBot("PhantomJS/2.1.1")).toBe(true);
  });

  it("returns false for Chrome desktop UA", () => {
    expect(
      isBot(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      )
    ).toBe(false);
  });

  it("returns false for Safari mobile UA", () => {
    expect(
      isBot(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
      )
    ).toBe(false);
  });

  it("returns true for empty string (no UA = likely bot)", () => {
    expect(isBot("")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isBot("GOOGLEBOT/2.1")).toBe(true);
    expect(isBot("googlebot/2.1")).toBe(true);
    expect(isBot("BINGBOT/2.0")).toBe(true);
  });
});

describe("isSuspiciousFingerprint", () => {
  const WINDOWS_CHROME_UA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
  const MAC_CHROME_UA =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
  const WINDOWS_EDGE_UA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0";
  const WINDOWS_OPERA_UA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 OPR/106.0.0.0";

  it("returns true for Windows + Chrome + 1280px viewport", () => {
    expect(isSuspiciousFingerprint(WINDOWS_CHROME_UA, 1280)).toBe(true);
  });

  it("returns false for Windows + Chrome + 1920px viewport", () => {
    expect(isSuspiciousFingerprint(WINDOWS_CHROME_UA, 1920)).toBe(false);
  });

  it("returns false for Windows + Chrome + 1440px viewport", () => {
    expect(isSuspiciousFingerprint(WINDOWS_CHROME_UA, 1440)).toBe(false);
  });

  it("returns false for Windows + Chrome + 768px viewport", () => {
    expect(isSuspiciousFingerprint(WINDOWS_CHROME_UA, 768)).toBe(false);
  });

  it("returns false for Mac + Chrome + 1280px viewport", () => {
    expect(isSuspiciousFingerprint(MAC_CHROME_UA, 1280)).toBe(false);
  });

  it("returns false for Windows + Edge + 1280px viewport", () => {
    expect(isSuspiciousFingerprint(WINDOWS_EDGE_UA, 1280)).toBe(false);
  });

  it("returns false for Windows + Opera + 1280px viewport", () => {
    expect(isSuspiciousFingerprint(WINDOWS_OPERA_UA, 1280)).toBe(false);
  });

  it("returns false when viewportWidth is undefined", () => {
    expect(isSuspiciousFingerprint(WINDOWS_CHROME_UA, undefined)).toBe(false);
  });

  it("returns false when UA is empty", () => {
    expect(isSuspiciousFingerprint("", 1280)).toBe(false);
  });

  // Pattern B: Android + Chrome + 614px viewport
  const ANDROID_CHROME_UA =
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36";
  // Samsung Internet's UA legitimately contains both "SamsungBrowser" AND
  // "Chrome/" — the !isSamsung guard in Pattern B exists to keep real
  // Samsung Internet users from being flagged.
  const ANDROID_SAMSUNG_UA =
    "Mozilla/5.0 (Linux; Android 14; SM-S918U) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/24.0 Chrome/115.0.0.0 Mobile Safari/537.36";
  const ANDROID_EDGE_UA =
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Mobile Safari/537.36 EdgA/127.0.0.0 Edg/127.0.0.0";
  const IPHONE_SAFARI_UA =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

  it("returns true for Android + Chrome + 614px viewport (Pattern B)", () => {
    expect(isSuspiciousFingerprint(ANDROID_CHROME_UA, 614)).toBe(true);
  });

  it("returns false for Android + Chrome at common real viewports", () => {
    // Real Android devices: Pixel 360, Pixel Pro 412, Galaxy 360-412, foldable 717
    expect(isSuspiciousFingerprint(ANDROID_CHROME_UA, 360)).toBe(false);
    expect(isSuspiciousFingerprint(ANDROID_CHROME_UA, 393)).toBe(false);
    expect(isSuspiciousFingerprint(ANDROID_CHROME_UA, 412)).toBe(false);
    expect(isSuspiciousFingerprint(ANDROID_CHROME_UA, 430)).toBe(false);
  });

  it("returns false for Samsung Internet + 614px (avoid penalizing Samsung Browser)", () => {
    expect(isSuspiciousFingerprint(ANDROID_SAMSUNG_UA, 614)).toBe(false);
  });

  it("returns false for Edge on Android + 614px", () => {
    expect(isSuspiciousFingerprint(ANDROID_EDGE_UA, 614)).toBe(false);
  });

  it("returns false for iPhone Safari at any viewport", () => {
    expect(isSuspiciousFingerprint(IPHONE_SAFARI_UA, 614)).toBe(false);
    expect(isSuspiciousFingerprint(IPHONE_SAFARI_UA, 1280)).toBe(false);
  });

  it("returns false for Windows + Chrome + 614px (only Android matches Pattern B)", () => {
    expect(isSuspiciousFingerprint(WINDOWS_CHROME_UA, 614)).toBe(false);
  });
});
