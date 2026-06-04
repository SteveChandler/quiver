import {
  buildForecastWindowOgImagePath,
  buildForecastWindowShareMetadata,
  normalizeForecastWindowParam,
} from "@/lib/share/forecast-window-share";

describe("forecast-window-share", () => {
  it("returns fallback metadata for invalid or opaque window values", () => {
    const metadata = buildForecastWindowShareMetadata({
      slug: "scripps",
      window: "opaque-window-id",
    });

    expect(normalizeForecastWindowParam("opaque-window-id")).toBeNull();
    expect(metadata.isFallback).toBe(true);
    expect(metadata.title).toBe("Open Quiver Surf Window");
    expect(metadata.description).toContain("Open this surf window in Quiver");
  });

  it("builds selected forecast metadata with beach, local window, and CTA title", () => {
    const metadata = buildForecastWindowShareMetadata({
      slug: "scripps",
      beachName: "Scripps",
      locationLabel: "La Jolla, CA",
      timezone: "America/Los_Angeles",
      window: "2026-06-03T16:15:00.000Z",
      waveHeight: "4-5 ft",
      conditionSegments: ["18s SW", "10 mph SW", "2.7 ft rising"],
    });

    expect(metadata.title).toContain("Scripps");
    expect(metadata.title).toContain("9:15 AM");
    expect(metadata.title).toContain("is lining up");
    expect(metadata.description).toContain("4-5 ft");
    expect(metadata.description).toContain("Check it on Quiver.");
    expect(metadata.locationLabel).toBe("La Jolla, CA");
  });

  it("uses shared preview context for the exact CTA title and condition description", () => {
    const metadata = buildForecastWindowShareMetadata({
      slug: "204s",
      beachName: "204s",
      timezone: "America/Los_Angeles",
      window: "2026-06-04T22:30:00.000Z",
      windowLabel: "3:30-6:00 PM",
      waveHeight: "2-3 ft",
      conditionSegments: ["18s SSW", "7 mph SW", "3 ft, rising"],
    } as never);

    expect(metadata.title).toBe("204s 3:30-6:00 PM is lining up");
    expect(metadata.description).toBe(
      "204s 3:30-6:00 PM is lining up: 2-3 ft · 18s SSW · 7 mph SW · 3 ft, rising. Check it on Quiver.",
    );
    expect(metadata.windowLabel).toBe("3:30-6:00 PM");
  });

  it("builds an OG image path with share-preview params and no tracking params", () => {
    const path = buildForecastWindowOgImagePath({
      slug: "scripps",
      window: "2026-06-03T16:15:00.000Z",
      windowLabel: "9:15-11:45 AM",
      conditions: "4-5 ft · 18s SW · 10 mph SW · 2.7 ft rising",
    } as never);

    expect(path).toMatch(/^\/api\/og\/forecast-window\?/);
    expect(path).toContain("slug=scripps");
    expect(path).toContain("window=2026-06-03T16%3A15%3A00.000Z");
    expect(path).toContain("label=9%3A15-11%3A45+AM");
    expect(path).toContain("conditions=4-5+ft");
    expect(path).not.toContain("utm_");
  });

  it("omits missing condition values without noisy separators", () => {
    const metadata = buildForecastWindowShareMetadata({
      slug: "scripps",
      beachName: "Scripps",
      timezone: "America/Los_Angeles",
      window: "2026-06-03T16:15:00.000Z",
      waveHeight: "4-5 ft",
      conditionSegments: ["18s SW", undefined, "", null, "2.7 ft rising"],
    });

    expect(metadata.conditionRow).toBe("18s SW · 2.7 ft rising");
    expect(metadata.conditionRow).not.toContain("undefined");
    expect(metadata.conditionRow).not.toContain("null");
    expect(metadata.conditionRow).not.toContain("· ·");
  });
});
