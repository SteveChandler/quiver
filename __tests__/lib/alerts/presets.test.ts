import { PRESETS, getPreset, getPresetsForGroup } from "@/lib/alerts/presets";
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
      expect(preset.type.length).toBeGreaterThan(0);
      expect(preset.name.length).toBeGreaterThan(0);
      expect(preset.description.length).toBeGreaterThan(0);
      expect(preset.conditionsSummary.length).toBeGreaterThan(0);
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
    expect(conditions.swell_height_min).toBe(1.5);
    expect(conditions.swell_height_max).toBe(4);
  });

  it("mellow_session tightens size, wind, tide, and time for sandy beginner beaches", () => {
    const preset = getPreset("mellow_session")!;
    const conditions = preset.buildConditions({
      ...mockBeach,
      name: "Bolsa Chica",
      slug: "bolsa-chica",
      skill_level: "beginner",
      break_type: "beach",
      features: ["sand bottom", "beginner sandy beachbreak"],
      preference_model: {
        beginner_window: {
          model: "socal_sandy_beginner",
          beginner_fit: "primary",
          acceptable_wave_height_ft: { min: 0.5, max: 3 },
          best_time_local: { start: "06:00", end: "10:00" },
          max_beginner_wind_mph: 10,
        },
      },
      preferred_tide_ft_min: 0.5,
      preferred_tide_ft_max: 3,
    });

    expect(conditions.beginner_sandy_window).toBe(true);
    expect(conditions.swell_height_min).toBe(0.5);
    expect(conditions.swell_height_max).toBe(3);
    expect(conditions.wind_speed_max_kt).toBe(9);
    expect(conditions.tide_height_min_ft).toBe(0.5);
    expect(conditions.tide_height_max_ft).toBe(3);
    expect(conditions.avoid_tide_statuses).toEqual(["high"]);
    expect(conditions.local_time_start).toBe("06:00");
    expect(conditions.local_time_end).toBe("10:00");
  });

  it("does not apply sandy beginner scoring to non-sandy advanced breaks", () => {
    const preset = getPreset("mellow_session")!;
    const conditions = preset.buildConditions({
      ...mockBeach,
      skill_level: "advanced",
      break_type: "reef",
      features: ["shallow reef"],
    });

    expect(conditions.beginner_sandy_window).toBeUndefined();
    expect(conditions.swell_height_min).toBe(1.5);
    expect(conditions.swell_height_max).toBe(4);
  });

  it("clean_groundswell has 2ft floor + 12s period", () => {
    const preset = getPreset("clean_groundswell")!;
    const conditions = preset.buildConditions(mockBeach);
    expect(conditions.swell_height_min).toBe(2);
    expect(conditions.swell_period_min).toBe(12);
    expect(conditions.wind_speed_max_kt).toBe(10);
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
});
