import {
  GFS_WAVE_SHADOW_CAPTURE_DISABLED,
  GFS_WAVE_SHADOW_MODEL,
  buildGfsWaveShadowForecast,
  buildGfsWaveShadowRows,
  fetchGfsWaveShadowForecast,
  isAllZeroWaveHeightPayload,
  isGfsWaveShadowCaptureEnabled,
  mapGfsWaveShadowRowsForInsert,
  type GfsWaveShadowRow,
} from "@/lib/services/noaa-wavewatch/gfs-wave-shadow";
import { fetchOpenMeteoData } from "@/lib/services/noaa-wavewatch/api-client";
import type { OpenMeteoMarineResponse } from "@/lib/services/noaa-wavewatch/types";

jest.mock("@/lib/services/noaa-wavewatch/api-client", () => ({
  fetchOpenMeteoData: jest.fn(),
}));

function payload(overrides: Partial<NonNullable<OpenMeteoMarineResponse["hourly"]>> = {}): OpenMeteoMarineResponse {
  const time = Array.from({ length: 12 }, (_, index) =>
    new Date(Date.parse("2026-06-10T00:00:00Z") + index * 60 * 60 * 1000).toISOString(),
  );
  return {
    hourly: {
      time,
      wave_height: time.map((_, index) => 1 + index * 0.1),
      wave_period: time.map((_, index) => 10 + index * 0.1),
      wave_direction: time.map((_, index) => 220 + index),
      swell_wave_height: time.map((_, index) => 0.7 + index * 0.01),
      swell_wave_period: time.map((_, index) => 12 + index * 0.1),
      swell_wave_direction: time.map((_, index) => 210 + index),
      wind_wave_height: time.map(() => 0.2),
      wind_wave_period: time.map(() => 5),
      wind_wave_direction: time.map(() => 180),
      secondary_swell_wave_height: time.map(() => 0.3),
      secondary_swell_wave_period: time.map(() => 9),
      secondary_swell_wave_direction: time.map(() => 190),
      tertiary_swell_wave_height: time.map(() => 0.1),
      tertiary_swell_wave_period: time.map(() => 8),
      tertiary_swell_wave_direction: time.map(() => 150),
      ...overrides,
    },
  };
}

describe("GFS-Wave shadow capture helpers", () => {
  it("is controlled solely by GFS_WAVE_SHADOW_CAPTURE_DISABLED", () => {
    expect(GFS_WAVE_SHADOW_CAPTURE_DISABLED).toBe(true);
    expect(isGfsWaveShadowCaptureEnabled()).toBe(false);

    // No env var can turn capture on: the removed GFS_WAVE_SHADOW_CAPTURE_ENABLED
    // was always short-circuited by the constant above.
    process.env.GFS_WAVE_SHADOW_CAPTURE_ENABLED = "true";
    expect(isGfsWaveShadowCaptureEnabled()).toBe(false);
    delete process.env.GFS_WAVE_SHADOW_CAPTURE_ENABLED;
  });

  it("classifies an all-zero wave_height payload as missing-source data", () => {
    expect(isAllZeroWaveHeightPayload(payload({ wave_height: [0, 0, 0, 0] }))).toBe(true);
    expect(isAllZeroWaveHeightPayload(payload({ wave_height: [0, 0.2, 0, 0] }))).toBe(false);
    expect(isAllZeroWaveHeightPayload(payload({ wave_height: [0, null as unknown as number, 0] }))).toBe(true);
    expect(isAllZeroWaveHeightPayload(payload({ wave_height: [] }))).toBe(false);
  });

  it("builds ok rows from ncep_gfswave016 without changing best_match fields", () => {
    const shadow = buildGfsWaveShadowForecast(payload(), {
      model: GFS_WAVE_SHADOW_MODEL,
      forecastDays: 1,
    });

    const rows = buildGfsWaveShadowRows({
      beachId: "beach-1",
      generatedAt: new Date("2026-06-10T00:00:00Z"),
      forecastTimes: [
        new Date("2026-06-10T00:00:00Z"),
        new Date("2026-06-10T03:00:00Z"),
      ],
      shadow,
    });

    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual(
      expect.objectContaining({
        beach_id: "beach-1",
        predicted_at: "2026-06-10T00:00:00Z",
        forecast_horizon_hours: 0,
        capture_status: "ok",
        source_model: "ncep_gfswave016",
        wave_height_m: 1,
        wave_period_s: 10,
        tertiary_swell_height_m: 0.1,
      }),
    );
    expect(rows[1].wave_height_m).toBe(1.3);
  });

  it("requests model-pinned GFS-Wave data with Unix timestamps", async () => {
    (fetchOpenMeteoData as jest.Mock).mockResolvedValue(payload());

    await fetchGfsWaveShadowForecast(32.7, -117.3, 8);

    expect(fetchOpenMeteoData).toHaveBeenCalledWith(32.7, -117.3, 8, {
      model: GFS_WAVE_SHADOW_MODEL,
      timeformat: "unixtime",
      timezone: "America/Los_Angeles",
    });
  });

  it("passes abort signals to the Open-Meteo shadow request", async () => {
    const controller = new AbortController();
    (fetchOpenMeteoData as jest.Mock).mockResolvedValue(payload());

    await fetchGfsWaveShadowForecast(32.7, -117.3, 8, {
      signal: controller.signal,
    });

    expect(fetchOpenMeteoData).toHaveBeenCalledWith(32.7, -117.3, 8, {
      model: GFS_WAVE_SHADOW_MODEL,
      timeformat: "unixtime",
      timezone: "America/Los_Angeles",
      signal: controller.signal,
    });
  });

  it("parses Open-Meteo unixtime hourly timestamps as seconds", () => {
    const unixTime = Array.from({ length: 12 }, (_, index) =>
      (Date.parse("2026-06-10T00:00:00Z") + index * 60 * 60 * 1000) / 1000,
    );
    const shadow = buildGfsWaveShadowForecast(payload({ time: unixTime }), {
      model: GFS_WAVE_SHADOW_MODEL,
      forecastDays: 1,
    });

    const rows = buildGfsWaveShadowRows({
      beachId: "beach-1",
      generatedAt: new Date("2026-06-10T00:00:00Z"),
      forecastTimes: [new Date("2026-06-10T03:00:00Z")],
      shadow,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual(
      expect.objectContaining({
        predicted_at: "2026-06-10T03:00:00Z",
        wave_height_m: 1.3,
      }),
    );
  });

  it("uses floor-aligned slots when matching GFS-Wave points to display forecasts", () => {
    const shadow = buildGfsWaveShadowForecast(
      payload({
        time: [
          "2026-06-10T01:40:00Z",
          "2026-06-10T02:40:00Z",
          "2026-06-10T03:40:00Z",
        ],
        wave_height: [1.8, 2.0, 2.2],
      }),
      {
        model: GFS_WAVE_SHADOW_MODEL,
        forecastDays: 1,
      },
    );

    const rows = buildGfsWaveShadowRows({
      beachId: "beach-1",
      generatedAt: new Date("2026-06-10T00:00:00Z"),
      forecastTimes: [new Date("2026-06-10T00:30:00Z")],
      shadow,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual(
      expect.objectContaining({
        predicted_at: "2026-06-10T00:00:00Z",
        wave_height_m: 1.8,
      }),
    );
  });

  it("does not build placeholder rows for all-zero payload slots", () => {
    const zeroPayload = payload({
      wave_height: Array.from({ length: 12 }, () => 0),
      wave_period: Array.from({ length: 12 }, () => 0),
      wave_direction: Array.from({ length: 12 }, () => 0),
    });
    const shadow = buildGfsWaveShadowForecast(zeroPayload, {
      model: GFS_WAVE_SHADOW_MODEL,
      forecastDays: 1,
    });

    const rows = buildGfsWaveShadowRows({
      beachId: "beach-1",
      generatedAt: new Date("2026-06-10T00:00:00Z"),
      forecastTimes: [new Date("2026-06-10T00:00:00Z")],
      shadow,
    });

    expect(rows).toHaveLength(0);
  });

  it("does not build placeholder rows for missing wave-height slots", () => {
    const shadow = buildGfsWaveShadowForecast(
      payload({ wave_height: [null as unknown as number, 1, 1] }),
      {
        model: GFS_WAVE_SHADOW_MODEL,
        forecastDays: 1,
      },
    );

    const rows = buildGfsWaveShadowRows({
      beachId: "beach-1",
      generatedAt: new Date("2026-06-10T00:00:00Z"),
      forecastTimes: [new Date("2026-06-10T00:00:00Z")],
      shadow,
    });

    expect(rows).toHaveLength(0);
  });

  it("maps rows for first-write-wins upserts", () => {
    const row: GfsWaveShadowRow = {
      beach_id: "beach-1",
      predicted_at: "2026-06-10T00:00:00Z",
      forecast_horizon_hours: 0,
      source_model: GFS_WAVE_SHADOW_MODEL,
      source: "open_meteo",
      capture_status: "ok",
      wave_height_m: 1,
      wave_period_s: 10,
      wave_direction_deg: 220,
      wave_peak_period_s: null,
      swell_height_m: 0.7,
      swell_period_s: 12,
      swell_direction_deg: 210,
      swell_wave_peak_period_s: null,
      wind_wave_height_m: 0.2,
      wind_wave_period_s: 5,
      wind_wave_direction_deg: 180,
      wind_wave_peak_period_s: null,
      secondary_swell_height_m: 0.3,
      secondary_swell_period_s: 9,
      secondary_swell_direction_deg: 190,
      tertiary_swell_height_m: 0.1,
      tertiary_swell_period_s: 8,
      tertiary_swell_direction_deg: 150,
      fetched_at: "2026-06-10T00:00:00.000Z",
    };

    expect(mapGfsWaveShadowRowsForInsert([row])).toEqual([
      expect.objectContaining({
        beach_id: "beach-1",
        predicted_at: "2026-06-10T00:00:00Z",
        source_model: "ncep_gfswave016",
        capture_status: "ok",
        wave_height_m: 1,
      }),
    ]);
  });
});
