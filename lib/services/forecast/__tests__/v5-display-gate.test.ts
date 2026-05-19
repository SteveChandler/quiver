import {
  applyV51DisplayOverrideToForecasts,
} from "../v5-display-gate";
import type { CalibrationVersion } from "../calibration-v5";
import type { EnhancedForecastEntity } from "@/types/forecast";

jest.mock("@/lib/logger", () => ({
  createContextLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: jest.fn(),
}));

const CALIBRATION: CalibrationVersion = {
  version: "v5_c.20260511_0630",
  knots: {
    "<0.5m": { om_anchor: 0.4, obs: 0.787, n: 1155 },
    "0.5-1.0m": { om_anchor: 0.803, obs: 0.803, n: 17999 },
    "1.0-1.5m": { om_anchor: 1.097, obs: 1.097, n: 8134 },
    "1.5m+": { om_anchor: 1.628, obs: 1.628, n: 2840 },
  },
  g_dir: {
    "S/SW": { g: -0.093, n: 6296 },
    W: { g: -0.097, n: 9475 },
    NW: { g: 0.231, n: 3670 },
    OTHER: { g: -0.01, n: 10687 },
  },
  guardrails: {
    passthrough_cells: [{ direction_bucket: "W", om_bucket: "0.5-1.0m" }],
  },
};

function forecast(
  overrides: Partial<EnhancedForecastEntity> = {}
): EnhancedForecastEntity {
  return {
    id: "forecast-1",
    beach_id: "beach-1",
    forecast_at: "2026-05-12T15:00:00Z",
    forecast_date: "2026-05-12",
    forecast_time: "15:00:00",
    wave_height: "3-4ft",
    wave_height_om: 1,
    wave_direction_om: null,
    swell_direction_om: null,
    swell_1_direction: "SSW",
    water_temp: null,
    confidence_score: 80,
    data_source: "OPEN_METEO",
    created_at: "2026-05-12T12:00:00Z",
    updated_at: "2026-05-12T12:00:00Z",
    ...overrides,
  };
}

describe("applyV51DisplayOverrideToForecasts", () => {
  it("leaves forecasts untouched when disabled", async () => {
    const rows = [forecast()];
    await expect(
      applyV51DisplayOverrideToForecasts(rows, {
        enabled: false,
        calibration: CALIBRATION,
      })
    ).resolves.toBe(rows);
  });

  it("replaces wave_height with v5.1 display by default", async () => {
    const [row] = await applyV51DisplayOverrideToForecasts([forecast()], {
      calibration: CALIBRATION,
    });

    expect(row.wave_height).toBe("2-4ft");
  });

  it("replaces wave_height with v5.1 display when enabled", async () => {
    const [row] = await applyV51DisplayOverrideToForecasts([forecast()], {
      enabled: true,
      calibration: CALIBRATION,
    });

    expect(row.wave_height).toBe("2-4ft");
  });

  it("uses the W x 0.5-1.0m raw-OM passthrough guardrail", async () => {
    const [row] = await applyV51DisplayOverrideToForecasts(
      [forecast({ wave_height: "1ft", wave_height_om: 0.8, swell_1_direction: "W" })],
      { enabled: true, calibration: CALIBRATION }
    );

    expect(row.wave_height).toBe("2-3ft");
  });

  it("uses raw OM display for NW swells at or above 1m", async () => {
    const [row] = await applyV51DisplayOverrideToForecasts(
      [forecast({ wave_height: "1ft", wave_height_om: 1.2, swell_1_direction: "WNW" })],
      { enabled: true, calibration: CALIBRATION }
    );

    expect(row.wave_height).toBe("3-4ft");
  });

  it("falls back to OM direction when swell_1_direction is missing", async () => {
    const [row] = await applyV51DisplayOverrideToForecasts(
      [forecast({ wave_height_om: 0.8, swell_1_direction: null, wave_direction_om: 270 })],
      { enabled: true, calibration: CALIBRATION }
    );

    expect(row.wave_height).toBe("2-4ft");
  });
});
