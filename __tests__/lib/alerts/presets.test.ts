import {
  PRESETS,
  getPreset,
  getPresetsForGroup,
  SIMILARITY_ALERT_DEFAULT_THRESHOLD,
  resolveSimilarityThreshold,
} from "@/lib/alerts/presets";
import type { BeachAlertMeta } from "@/lib/alerts/types";

const mockBeach: BeachAlertMeta = {
  id: "beach-1",
  name: "Blacks Beach",
  slug: "blacks-beach",
  lat: 32.88,
  lon: -117.25,
  timezone: "America/Los_Angeles",
  wind_offshore_deg: 45,
  wind_offshore_tol_deg: 45,
  aspect_deg: 270,
  preferred_tide_ft_min: 2,
  preferred_tide_ft_max: 5,
  preferred_tide_direction: "rising",
  swell_window_center_deg: 270,
  swell_window_halfwidth_deg: 60,
};

describe("presets", () => {
  it("defines exactly 8 presets", () => {
    expect(PRESETS).toHaveLength(8);
  });

  it("has 3 popular and 5 specific presets", () => {
    expect(getPresetsForGroup("popular")).toHaveLength(3);
    expect(getPresetsForGroup("specific")).toHaveLength(5);
  });

  it("each preset has required fields", () => {
    for (const preset of PRESETS) {
      expect(preset.type).toBeTruthy();
      expect(preset.name).toBeTruthy();
      expect(preset.description).toBeTruthy();
      expect(preset.conditionsSummary).toBeTruthy();
      expect(preset.group).toMatch(/^(popular|specific)$/);
      expect(typeof preset.buildConditions).toBe("function");
    }
  });

  it("glass_off builds correct conditions", () => {
    const preset = getPreset("glass_off")!;
    const conditions = preset.buildConditions(mockBeach);
    expect(conditions.wind_direction).toBe("offshore");
    expect(conditions.wind_speed_max_kt).toBe(5);
    expect(conditions.swell_height_min).toBe(2);
  });

  it("mellow_session uses beach preferred tide range", () => {
    const preset = getPreset("mellow_session")!;
    const conditions = preset.buildConditions(mockBeach);
    expect(conditions.tide_height_min_ft).toBe(2);
    expect(conditions.tide_height_max_ft).toBe(5);
    expect(conditions.swell_height_min).toBe(1);
    expect(conditions.swell_height_max).toBe(4);
  });

  it("tide_window uses beach preferred tide range and direction", () => {
    const preset = getPreset("tide_window")!;
    const conditions = preset.buildConditions(mockBeach);
    expect(conditions.tide_height_min_ft).toBe(2);
    expect(conditions.tide_height_max_ft).toBe(5);
    expect(conditions.tide_direction).toBe("rising");
  });

  it("epic_conditions uses all beach metadata", () => {
    const preset = getPreset("epic_conditions")!;
    const conditions = preset.buildConditions(mockBeach);
    expect(conditions.wind_direction).toBe("offshore");
    expect(conditions.tide_height_min_ft).toBe(2);
    expect(conditions.tide_height_max_ft).toBe(5);
    expect(conditions.swell_height_min).toBeGreaterThan(0);
    expect(conditions.swell_period_min).toBeGreaterThan(0);
  });

  it("getPreset returns undefined for invalid type", () => {
    expect(getPreset("nonexistent" as any)).toBeUndefined();
  });

  it("similarity_alert is registered and emits only a score threshold", () => {
    const preset = getPreset("similarity_alert");
    expect(preset).toBeDefined();
    expect(preset!.group).toBe("specific");
    const conditions = preset!.buildConditions(mockBeach);
    // similarity_alert intentionally stores NO static swell/wind/tide envelope.
    // The evaluator cron calls compute_spot_similarity_score per forecast hour;
    // the stored threshold is the only matching input the rule row needs.
    expect(conditions.similarity_threshold).toBe(SIMILARITY_ALERT_DEFAULT_THRESHOLD);
    expect(conditions.swell_height_min).toBeUndefined();
    expect(conditions.wind_speed_max_kt).toBeUndefined();
    expect(conditions.tide_height_min_ft).toBeUndefined();
  });

  it("SIMILARITY_ALERT_DEFAULT_THRESHOLD is in the RPC's 0–10 range", () => {
    expect(SIMILARITY_ALERT_DEFAULT_THRESHOLD).toBeGreaterThanOrEqual(0);
    expect(SIMILARITY_ALERT_DEFAULT_THRESHOLD).toBeLessThanOrEqual(10);
  });
});

describe("resolveSimilarityThreshold", () => {
  it("returns the stored threshold when finite", () => {
    expect(resolveSimilarityThreshold({ similarity_threshold: 8.2 })).toBe(8.2);
  });

  it("returns 0 when stored threshold is exactly 0 (not falsy-fallback)", () => {
    // A user might set threshold=0 to receive every computable match. Don't
    // let a truthy-check silently overwrite that with the default.
    expect(resolveSimilarityThreshold({ similarity_threshold: 0 })).toBe(0);
  });

  it("falls back to default for NaN", () => {
    // typeof NaN === "number" would pass a naive guard; NaN threshold would
    // make `score < NaN` false for every hour and the rule would never fire.
    expect(
      resolveSimilarityThreshold({ similarity_threshold: NaN }),
    ).toBe(SIMILARITY_ALERT_DEFAULT_THRESHOLD);
  });

  it("falls back to default for Infinity and -Infinity", () => {
    expect(
      resolveSimilarityThreshold({ similarity_threshold: Infinity }),
    ).toBe(SIMILARITY_ALERT_DEFAULT_THRESHOLD);
    expect(
      resolveSimilarityThreshold({ similarity_threshold: -Infinity }),
    ).toBe(SIMILARITY_ALERT_DEFAULT_THRESHOLD);
  });

  it("falls back to default for non-number types (string, null, undefined, object)", () => {
    expect(
      resolveSimilarityThreshold({ similarity_threshold: "7.5" as any }),
    ).toBe(SIMILARITY_ALERT_DEFAULT_THRESHOLD);
    expect(
      resolveSimilarityThreshold({ similarity_threshold: null as any }),
    ).toBe(SIMILARITY_ALERT_DEFAULT_THRESHOLD);
    expect(
      resolveSimilarityThreshold({ similarity_threshold: undefined }),
    ).toBe(SIMILARITY_ALERT_DEFAULT_THRESHOLD);
    expect(
      resolveSimilarityThreshold({ similarity_threshold: {} as any }),
    ).toBe(SIMILARITY_ALERT_DEFAULT_THRESHOLD);
  });

  it("accepts null/undefined conditions object", () => {
    expect(resolveSimilarityThreshold(null)).toBe(
      SIMILARITY_ALERT_DEFAULT_THRESHOLD,
    );
    expect(resolveSimilarityThreshold(undefined)).toBe(
      SIMILARITY_ALERT_DEFAULT_THRESHOLD,
    );
    expect(resolveSimilarityThreshold({})).toBe(
      SIMILARITY_ALERT_DEFAULT_THRESHOLD,
    );
  });
});
