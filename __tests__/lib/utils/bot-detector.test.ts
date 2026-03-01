import { isBot } from "@/lib/utils/bot-detector";

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

  it("returns false for empty string", () => {
    expect(isBot("")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(isBot("GOOGLEBOT/2.1")).toBe(true);
    expect(isBot("googlebot/2.1")).toBe(true);
    expect(isBot("BINGBOT/2.0")).toBe(true);
  });
});
