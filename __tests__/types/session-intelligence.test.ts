import {
  SURF_WINDOW_BEST_FOR_TAGS,
  SURF_WINDOW_CONFIDENCE_LEVELS,
  SURF_WINDOW_SOURCE_FLAG_KEYS,
  SURF_WINDOW_TIDE_TRENDS,
  SURF_WINDOW_VERDICTS,
  SURF_WINDOW_WIND_QUALITIES,
  isSurfWindowBestForTag,
  isSurfWindowConfidenceLevel,
  isSurfWindowVerdict,
  type SurfWindowRecommendation,
} from "@/types/session-intelligence";

describe("Session Intelligence shared model", () => {
  it("keeps the exact recommendation vocabulary stable", () => {
    expect(SURF_WINDOW_VERDICTS).toEqual(["Worth it", "Maybe", "Skip"]);
    expect(SURF_WINDOW_WIND_QUALITIES).toEqual([
      "offshore",
      "cross-shore",
      "onshore",
      "variable",
      "unknown",
    ]);
    expect(SURF_WINDOW_TIDE_TRENDS).toEqual([
      "rising",
      "falling",
      "high",
      "low",
      "unknown",
    ]);
    expect(SURF_WINDOW_BEST_FOR_TAGS).toEqual([
      "beginner",
      "intermediate",
      "advanced",
      "longboard",
      "shortboard",
      "fish",
      "mid-length",
      "foamie",
      "dawn-patrol",
      "sunset-session",
    ]);
    expect(SURF_WINDOW_CONFIDENCE_LEVELS).toEqual([
      "low",
      "medium",
      "high",
    ]);
  });

  it("keeps source flag keys aligned with Phase 15 source claims", () => {
    expect(SURF_WINDOW_SOURCE_FLAG_KEYS).toEqual([
      "forecast-model",
      "tide",
      "buoy",
      "cam",
      "user-report",
      "local-spot-intel",
    ]);
  });

  it("validates supported vocabulary values with narrow type guards", () => {
    expect(isSurfWindowVerdict("Worth it")).toBe(true);
    expect(isSurfWindowVerdict("Go")).toBe(false);
    expect(isSurfWindowBestForTag("longboard")).toBe(true);
    expect(isSurfWindowBestForTag("tow-in")).toBe(false);
    expect(isSurfWindowConfidenceLevel("medium")).toBe(true);
    expect(isSurfWindowConfidenceLevel("certain")).toBe(false);
  });

  it("represents a serializable recommendation with unavailable sources set false", () => {
    const recommendation: SurfWindowRecommendation = {
      windowId: "beach-1-2026-06-03T14-00-00-000Z",
      rank: 1,
      beach: {
        id: "beach-1",
        name: "Ocean Beach",
        slug: "ocean-beach",
        city: "San Diego",
        state: "CA",
        country: "USA",
        region: "Southern California",
        lat: 32.75,
        lon: -117.25,
        photoUrl: null,
      },
      startIso: "2026-06-03T14:00:00.000Z",
      endIso: "2026-06-03T16:30:00.000Z",
      peakIso: "2026-06-03T15:00:00.000Z",
      timezone: "America/Los_Angeles",
      forecastAt: "2026-06-03T14:00:00.000Z",
      localTimeLabel: "7:00-9:30 AM",
      score: 82,
      verdict: "Worth it",
      headline: "Clean morning window at Ocean Beach",
      wave: {
        height: "4",
        period: "12s",
        direction: "W",
        summary: "4 ft at 12s from W",
      },
      wind: {
        speed: "5",
        direction: "NE",
        quality: "offshore",
        summary: "Light offshore wind",
      },
      tide: {
        status: "Rising",
        height: "3.5",
        nextTideAt: "2026-06-03T18:00:00.000Z",
        trend: "rising",
        summary: "Rising tide in the preferred range",
      },
      bestFor: ["intermediate", "longboard", "dawn-patrol"],
      positives: ["Good wave size", "Light offshore wind"],
      watchouts: ["Bring some patience for morning crowd"],
      dataNotes: ["No cam or user-report source is attached to this window"],
      confidence: {
        level: "high",
        score: 84,
        summary: "High confidence from recent forecast model data",
        reasons: ["Forecast confidence is above 80"],
      },
      sources: {
        forecastModel: true,
        tide: true,
        buoy: false,
        cam: false,
        userReport: false,
        localSpotIntel: true,
      },
      appDeepLink: "/beach/ocean-beach?window=beach-1-2026-06-03T14-00-00-000Z",
      universalLink:
        "https://www.quiversurf.app/beach/ocean-beach?window=beach-1-2026-06-03T14-00-00-000Z",
      canonicalWebUrl: "https://www.quiversurf.app/ca/san-diego/ocean-beach",
    };

    expect(recommendation.sources.buoy).toBe(false);
    expect(recommendation.sources.cam).toBe(false);
    expect(recommendation.sources.userReport).toBe(false);
    expect(recommendation.appDeepLink).toContain("/beach/ocean-beach");
    expect(recommendation.universalLink).toMatch(/^https:\/\//);
    expect(recommendation.canonicalWebUrl).not.toContain("window=");
  });
});
