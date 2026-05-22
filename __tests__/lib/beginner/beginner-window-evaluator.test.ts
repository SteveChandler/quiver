import {
  evaluateBeginnerWindow,
  getSandyBeginnerWindowProfile,
  isSandyBeginnerBeachMetadata,
} from "@/lib/beginner/beginner-window-evaluator";

const sandyBeginnerBeach = {
  skill_level: "beginner",
  break_type: "beach",
  features: ["sand bottom", "beginner sandy beachbreak"],
  preferred_tide_ft_min: 0.5,
  preferred_tide_ft_max: 3,
  preference_model: {
    beginner_window: {
      model: "socal_sandy_beginner",
      beginner_fit: "primary",
      ideal_wave_height_ft: { min: 1, max: 2 },
      acceptable_wave_height_ft: { min: 0.5, max: 3 },
      preferred_tide_stage: ["low", "rising", "mid"],
      best_time_local: { start: "06:00", end: "10:00" },
      max_beginner_wind_mph: 10,
      avoid_high_tide_under_ft: 2,
    },
  },
};

describe("beginner sandy-window evaluator", () => {
  it("rates 1-2 ft, light wind, low/rising tide, and morning as ideal", () => {
    const result = evaluateBeginnerWindow({
      beach: sandyBeginnerBeach,
      waveHeightFtMax: 2,
      windSpeedMph: 6,
      tideStatus: "Rising",
      tideHeightFt: 1.8,
      forecastAt: "2026-05-22T14:00:00Z",
      timezone: "America/Los_Angeles",
    });

    expect(result.applies).toBe(true);
    expect(result.rating).toBe("ideal");
    expect(result.statuses).toMatchObject({
      wave: "ideal",
      wind: "ideal",
      tide: "ideal",
      time: "ideal",
    });
  });

  it("does not rate tiny high tide as ideal even with light wind", () => {
    const result = evaluateBeginnerWindow({
      beach: sandyBeginnerBeach,
      waveHeightFtMax: 1.5,
      windSpeedMph: 4,
      tideStatus: "High",
      tideHeightFt: 5.2,
      forecastAt: "2026-05-22T14:00:00Z",
      timezone: "America/Los_Angeles",
    });

    expect(result.rating).toBe("poor");
    expect(result.statuses.tide).toBe("poor");
    expect(result.labels.tide).toContain("Tiny high tide");
  });

  it("does not treat completely missing forecast data as acceptable", () => {
    const result = evaluateBeginnerWindow({
      beach: sandyBeginnerBeach,
      waveHeightFtMax: null,
      windSpeedMph: null,
      tideStatus: null,
      tideHeightFt: null,
      forecastAt: null,
      timezone: "America/Los_Angeles",
    });

    expect(result.rating).toBe("poor");
    expect(result.statuses).toEqual({
      wave: "unknown",
      wind: "unknown",
      tide: "unknown",
      time: "unknown",
    });
  });

  it("keeps 3-4 ft out of the ideal true-beginner window", () => {
    const result = evaluateBeginnerWindow({
      beach: sandyBeginnerBeach,
      waveHeightFtMax: 3.5,
      windSpeedMph: 5,
      tideStatus: "Rising",
      tideHeightFt: 2,
      forecastAt: "2026-05-22T14:00:00Z",
      timezone: "America/Los_Angeles",
    });

    expect(result.rating).toBe("poor");
    expect(result.statuses.wave).toBe("poor");
  });

  it("does not apply the sandy beginner model to advanced reef breaks", () => {
    const advancedReef = {
      skill_level: "advanced",
      break_type: "reef",
      features: ["shallow reef", "powerful waves"],
      preference_model: {
        tide: "mid",
      },
    };

    expect(isSandyBeginnerBeachMetadata(advancedReef)).toBe(false);
    expect(getSandyBeginnerWindowProfile(advancedReef)).toBeNull();
    expect(
      evaluateBeginnerWindow({
        beach: advancedReef,
        waveHeightFtMax: 2,
        windSpeedMph: 4,
        tideStatus: "Rising",
        forecastAt: "2026-05-22T14:00:00Z",
        timezone: "America/Los_Angeles",
      }).rating,
    ).toBe("not_applicable");
  });
});
