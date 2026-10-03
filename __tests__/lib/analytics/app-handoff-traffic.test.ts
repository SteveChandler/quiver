import { classifyHandoffRequest } from "@/lib/analytics/app-handoff-traffic";

const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";
const ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
const DESKTOP_CHROME_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function classify(
  headers: Record<string, string | undefined>,
  handoffIdInUrl = true,
) {
  const lower = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]),
  );
  return classifyHandoffRequest({
    headers: { get: (name: string) => lower[name.toLowerCase()] ?? null },
    handoffIdInUrl,
  });
}

describe("classifyHandoffRequest", () => {
  it.each([
    [
      "Ahrefs Site Audit",
      "Mozilla/5.0 (compatible; AhrefsSiteAudit/6.1; +http://ahrefs.com/robot/)",
      "known_bot",
    ],
    ["HeadlessChrome", `${DESKTOP_CHROME_UA} HeadlessChrome/120.0.0.0`, "known_bot"],
    ["python-requests", "python-requests/2.31.0", "known_bot"],
    [
      "Applebot",
      "Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 Version/17.4 Safari/605.1.15 (Applebot/0.1)",
      "known_bot",
    ],
    [
      "facebookexternalhit",
      "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
      "preview_fetcher",
    ],
    ["WhatsApp", "WhatsApp/2.23.20.0 A", "preview_fetcher"],
    [
      "Slackbot-LinkExpanding",
      "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)",
      "preview_fetcher",
    ],
  ])("flags %s", (_label, ua, expectedClass) => {
    const result = classify({ "user-agent": ua, "accept-language": "en-US" });
    expect(result.metadata.traffic_class).toBe(expectedClass);
    expect(result.botFlagged).toBe(true);
    expect(result.metadata.hit_kind).toBe("route_hit");
    expect(result.metadata.ua_sample).toBe(ua.slice(0, 120));
  });

  it("flags an empty user agent", () => {
    const result = classify({ "accept-language": "en-US" });
    expect(result.botFlagged).toBe(true);
    expect(result.metadata.traffic_reason).toBe("empty-or-short-ua");
    expect(result.metadata.ua_class).toBe("non_browser");
    expect(result.metadata).not.toHaveProperty("ua_sample");
  });

  it("flags a missing Accept-Language header", () => {
    const result = classify({ "user-agent": DESKTOP_CHROME_UA });
    expect(result.botFlagged).toBe(true);
    expect(result.metadata.traffic_reason).toBe("missing-accept-language");
    expect(result.metadata.has_accept_language).toBe(false);
  });

  it("flags prefetch requests", () => {
    const result = classify({
      "user-agent": IPHONE_UA,
      "accept-language": "en-US",
      "sec-purpose": "prefetch",
    });
    expect(result.metadata.traffic_class).toBe("prefetch");
    expect(result.botFlagged).toBe(true);
  });

  it("treats an iPhone Safari navigation as a human candidate without storing the UA", () => {
    const result = classify({
      "user-agent": IPHONE_UA,
      "accept-language": "en-US",
      "sec-fetch-mode": "navigate",
      "sec-fetch-site": "same-origin",
      "x-vercel-ip-country": "us",
    });
    expect(result.botFlagged).toBe(false);
    expect(result.metadata).toMatchObject({
      traffic_class: "human_candidate",
      ua_class: "ios_safari",
      has_accept_language: true,
      sec_fetch_mode: "navigate",
      sec_fetch_site: "same-origin",
      geo_country: "US",
    });
    expect(result.metadata).not.toHaveProperty("ua_sample");
  });

  it("classifies Android Chrome", () => {
    const result = classify({
      "user-agent": ANDROID_UA,
      "accept-language": "en-US",
      "sec-fetch-mode": "navigate",
    });
    expect(result.metadata.ua_class).toBe("android_chrome");
    expect(result.metadata.traffic_class).toBe("human_candidate");
  });

  it("treats desktop Chrome with sec-fetch-user as a human candidate", () => {
    const result = classify({
      "user-agent": DESKTOP_CHROME_UA,
      "accept-language": "en-US",
      "sec-fetch-user": "?1",
    });
    expect(result.metadata.traffic_class).toBe("human_candidate");
    expect(result.metadata.ua_class).toBe("desktop_chrome");
    expect(result.botFlagged).toBe(false);
  });

  it("stores but does not flag unverified desktop navigation", () => {
    const result = classify({
      "user-agent": DESKTOP_CHROME_UA,
      "accept-language": "en-US",
      "sec-fetch-mode": "navigate",
      "sec-fetch-site": "none",
    });
    expect(result.metadata.traffic_class).toBe("unverified");
    expect(result.botFlagged).toBe(false);
    expect(result.metadata.ua_sample).toBe(DESKTOP_CHROME_UA.slice(0, 120));
  });

  it("records whether the handoff id came from the URL", () => {
    const headers = { "user-agent": IPHONE_UA, "accept-language": "en-US" };
    expect(classify(headers, true).metadata.handoff_id_source).toBe("url");
    expect(classify(headers, false).metadata.handoff_id_source).toBe("minted");
  });

  it("truncates sec-fetch header values and ignores malformed country codes", () => {
    const result = classify({
      "user-agent": IPHONE_UA,
      "accept-language": "en-US",
      "sec-fetch-site": "x".repeat(40),
      "x-vercel-ip-country": "United States",
    });
    expect(result.metadata.sec_fetch_site).toBe("x".repeat(16));
    expect(result.metadata).not.toHaveProperty("geo_country");
  });

  it("never throws when headers are unavailable", () => {
    const result = classifyHandoffRequest({
      headers: undefined as never,
      handoffIdInUrl: false,
    });
    expect(result.botFlagged).toBe(false);
    expect(result.metadata).toMatchObject({
      hit_kind: "route_hit",
      traffic_reason: "classifier_error",
      handoff_id_source: "minted",
    });
  });
});
