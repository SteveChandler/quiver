import { PRESETS, getPreset, getPresetsForGroup } from "@/lib/alerts/presets";
import { evaluateConditions } from "@/lib/alerts/condition-evaluator";
import type { BeachAlertMeta, ForecastHour } from "@/lib/alerts/types";

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

const baseForecast: ForecastHour = {
  forecast_at: "2026-04-04T15:00:00Z",
  wave_height: 3,
  wave_period: 12,
  wave_direction: "W",
  swell_1_height: 3,
  swell_1_period: 12,
  swell_1_direction: 250,
  wind_speed: 5,
  wind_direction_deg: 45,
  tide_height: 3.5,
  tide_status: "rising",
};

describe("presets", () => {
  it("defines exactly 10 presets", () => {
    expect(PRESETS).toHaveLength(10);
  });

  it("has 5 popular, 4 specific, and 1 internal preset", () => {
    expect(getPresetsForGroup("popular")).toHaveLength(5);
    expect(getPresetsForGroup("specific")).toHaveLength(4);
    expect(PRESETS.filter((preset) => preset.group === "internal")).toHaveLength(
      1,
    );
  });

  it("each preset has required fields", () => {
    for (const preset of PRESETS) {
      expect(preset.type.length).toBeGreaterThan(0);
      expect(preset.name.length).toBeGreaterThan(0);
      expect(preset.description.length).toBeGreaterThan(0);
      expect(preset.conditionsSummary.length).toBeGreaterThan(0);
      expect(preset.group).toMatch(/^(popular|specific|internal)$/);
      expect(typeof preset.buildConditions).toBe("function");
    }
  });

  it("excludes daily_check_in from user-facing preset groups", () => {
    const userFacingPresetTypes = [
      ...getPresetsForGroup("popular"),
      ...getPresetsForGroup("specific"),
    ].map((preset) => preset.type);

    expect(userFacingPresetTypes).not.toContain("daily_check_in");
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

  it("does not apply sandy beginner scoring from legacy tags alone", () => {
    const preset = getPreset("mellow_session")!;
    const conditions = preset.buildConditions({
      ...mockBeach,
      skill_level: "beginner",
      break_type: "beach",
      features: ["sand bottom", "beginner sandy beachbreak"],
      preference_model: {},
    });

    expect(conditions.beginner_sandy_window).toBeUndefined();
    expect(conditions.swell_height_min).toBe(1.5);
    expect(conditions.swell_height_max).toBe(4);
    expect(conditions.wind_speed_max_kt).toBe(8);
  });

  it("requires primary or conditional beginner_fit metadata for sandy beginner scoring", () => {
    const preset = getPreset("mellow_session")!;
    const conditions = preset.buildConditions({
      ...mockBeach,
      skill_level: "beginner",
      break_type: "beach",
      features: ["sand bottom", "beginner sandy beachbreak"],
      preference_model: {
        beginner_window: {
          model: "socal_sandy_beginner",
          acceptable_wave_height_ft: { min: 0.5, max: 3 },
        },
      },
    });

    expect(conditions.beginner_sandy_window).toBeUndefined();
    expect(conditions.swell_height_min).toBe(1.5);
    expect(conditions.swell_height_max).toBe(4);
    expect(conditions.wind_speed_max_kt).toBe(8);
  });

  it("clean_groundswell has 2ft floor + 12s period", () => {
    const preset = getPreset("clean_groundswell")!;
    const conditions = preset.buildConditions(mockBeach);
    expect(conditions.swell_height_min).toBe(2);
    expect(conditions.swell_period_min).toBe(12);
    expect(conditions.wind_speed_max_kt).toBe(10);
  });

  it("dawn_patrol is time-bound to first light with calmer wind", () => {
    const preset = getPreset("dawn_patrol")!;
    const conditions = preset.buildConditions(mockBeach);

    expect(conditions).toMatchObject({
      swell_height_min: 1.5,
      wind_speed_max_kt: 8,
      local_time_start: "05:00",
      local_time_end: "09:00",
    });
    expect(
      evaluateConditions(
        conditions,
        { ...baseForecast, forecast_at: "2026-04-04T13:00:00Z" },
        mockBeach,
      ),
    ).toBe(true);
    expect(
      evaluateConditions(
        conditions,
        {
          ...baseForecast,
          forecast_at: "2026-04-04T13:00:00Z",
          wind_speed: 15,
        },
        mockBeach,
      ),
    ).toBe(false);
  });

  it("weekend_warrior is limited to Saturday and Sunday", () => {
    const preset = getPreset("weekend_warrior")!;
    const conditions = preset.buildConditions(mockBeach);

    expect(conditions).toMatchObject({
      swell_height_min: 2,
      wind_speed_max_kt: 12,
      days_of_week: [0, 6],
    });
    expect(evaluateConditions(conditions, baseForecast, mockBeach)).toBe(true);
    expect(
      evaluateConditions(
        conditions,
        { ...baseForecast, forecast_at: "2026-04-01T15:00:00Z" },
        mockBeach,
      ),
    ).toBe(false);
  });

  it("after_work is limited to the 4-8 PM local window", () => {
    const preset = getPreset("after_work")!;
    const conditions = preset.buildConditions(mockBeach);

    expect(conditions).toMatchObject({
      swell_height_min: 2,
      wind_speed_max_kt: 10,
      local_time_start: "16:00",
      local_time_end: "20:00",
    });
    expect(
      evaluateConditions(
        conditions,
        { ...baseForecast, forecast_at: "2026-04-04T00:00:00Z" },
        mockBeach,
      ),
    ).toBe(true);
    expect(
      evaluateConditions(
        conditions,
        { ...baseForecast, forecast_at: "2026-04-04T04:00:00Z" },
        mockBeach,
      ),
    ).toBe(false);
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
