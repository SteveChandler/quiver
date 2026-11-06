/**
 * Slots past the last real wave timestamp must be stored as FALLBACK rows
 * with every wave field null. Explicit nulls (not undefined) matter: the
 * storage upsert only overwrites columns present in the payload, so this is
 * what clears the random synthetic values older syncs wrote to those slots.
 */
import { expectConsoleErrors } from "@/__tests__/setup/test-utils";
import { ForecastBuilder } from "@/lib/services/forecast/forecast-builder";
import type { ForecastInputs } from "@/lib/services/forecast/forecast-builder";
import type { Beach } from "@/types/database";
import { FORECAST_CONSTANTS, TOTAL_FORECASTS } from "@/types/forecast";

jest.mock("@/lib/services/forecast/confidence-scorer", () => ({
  calculateConfidenceScore: jest.fn(() => 75),
}));

const WAVE_FIELDS = [
  "wave_height",
  "wave_period",
  "wave_direction",
  "swell_1_height",
  "swell_1_period",
  "swell_1_direction",
  "swell_2_height",
  "swell_2_period",
  "swell_2_direction",
  "wind_wave_height",
  "wind_wave_period",
  "wind_wave_direction",
] as const;

describe("ForecastBuilder past the real wave horizon", () => {
  // The trusted layer reports coverage as unavailable against the shared
  // service-role mock, as in forecast-builder.test.ts.
  afterEach(() => {
    expectConsoleErrors([/trusted_forecast_coverage_unavailable/]);
  });

  const builder = new ForecastBuilder({
    getWaveDirectionText: () => "SW",
    getTideStatusAtTime: () => "Rising",
    getTideHeightAtTime: () => 3.5,
    getNextTideFromTime: () => null,
    getDataQualityScore: () => 85,
  } as never);

  const inputs = (): ForecastInputs =>
    ({
      beach: { id: "beach-1", name: "Test Beach", lat: 32.7, lon: -117.2 } as Beach,
      waveData: {
        lat: 32.7,
        lng: -117.2,
        forecast: [
          {
            timestamp: new Date().toISOString(),
            significant_wave_height: 1.2,
            peak_wave_period: 12,
            peak_wave_direction: 225,
            swell_1_height: 0.8,
            swell_1_period: 14,
            swell_1_direction: 220,
            swell_2_height: 0,
            swell_2_period: 0,
            swell_2_direction: 0,
            wind_wave_height: 0.3,
            wind_wave_period: 6,
            wind_wave_direction: 200,
            data_source: "OPEN_METEO" as const,
          },
        ],
      },
      tideData: null,
      weatherData: null,
      buoyData: null,
      cdipData: null,
    }) as unknown as ForecastInputs;

  it("stores slots with no wave point as FALLBACK with explicit null wave fields", async () => {
    const rows = await builder.buildForecasts(inputs());
    const pending = rows.filter((row) => row.data_source === "FALLBACK");

    expect(rows[0].data_source).toBe("OPEN_METEO");
    expect(rows[0].wave_height).not.toBeNull();
    expect(pending.length).toBeGreaterThan(0);
    for (const row of pending) {
      for (const field of WAVE_FIELDS) {
        expect(row).toHaveProperty(field, null);
      }
    }
  });

  it("puts the ECMWF outlook on FALLBACK rows after the seam and keeps them FALLBACK", async () => {
    const slotMs = 3 * 3_600_000;
    const firstSlot = Math.floor(Date.now() / slotMs) * slotMs;
    const base = inputs() as unknown as { waveData: { forecast: Array<Record<string, unknown>>; ecmwf_outlook?: unknown } };
    const template = base.waveData.forecast[0];
    // Four days of model slots, then nothing: the seam is at day 4.
    base.waveData.forecast = Array.from({ length: 32 }, (_, i) => ({
      ...template,
      timestamp: new Date(firstSlot + i * slotMs).toISOString(),
    }));
    const seamMs = firstSlot + 31 * slotMs;
    base.waveData.ecmwf_outlook = {
      model: "ecmwf_wam025",
      points: Array.from({ length: 12 * 24 }, (_, h) => ({ ms: firstSlot + h * 3_600_000, hs_m: 1.5 })),
      starts_after_ms: seamMs,
      model_ratio: 1.1,
      model_ratio_pairs: 24,
    };

    const rows = await builder.buildForecasts(base as unknown as ForecastInputs);
    const outlookRows = rows.filter((row) => row.raw_forecast?.ecmwf_outlook);

    expect(outlookRows.length).toBeGreaterThan(0);
    expect(outlookRows.every((row) => Date.parse(row.forecast_at!) > seamMs)).toBe(true);
    expect(outlookRows.every((row) => row.data_source === "FALLBACK" && row.wave_height === null)).toBe(true);
    expect(rows.filter((row) => row.data_source !== "FALLBACK").some((row) => row.raw_forecast?.ecmwf_outlook)).toBe(false);
  });

  it("stores the outlook to the end of the WAM run past day 12 (stored horizon is 15 days)", async () => {
    const slotMs = 3 * 3_600_000;
    const firstSlot = Math.floor(Date.now() / slotMs) * slotMs;
    const base = inputs() as unknown as { waveData: { forecast: Array<Record<string, unknown>>; ecmwf_outlook?: unknown } };
    const template = base.waveData.forecast[0];
    // Model to about day 9.3, WAM to about day 14.3, as measured Nov 6 2026.
    base.waveData.forecast = Array.from({ length: 75 }, (_, i) => ({
      ...template,
      timestamp: new Date(firstSlot + i * slotMs).toISOString(),
    }));
    const seamMs = firstSlot + 74 * slotMs;
    const wamEndHour = Math.round(14.3 * 24);
    base.waveData.ecmwf_outlook = {
      model: "ecmwf_wam025",
      points: Array.from({ length: wamEndHour + 1 }, (_, h) => ({ ms: firstSlot + h * 3_600_000, hs_m: 1.5 })),
      starts_after_ms: seamMs,
      model_ratio: 1.1,
      model_ratio_pairs: 24,
    };

    const rows = await builder.buildForecasts(base as unknown as ForecastInputs);
    const outlookMs = rows
      .filter((row) => row.raw_forecast?.ecmwf_outlook)
      .map((row) => Date.parse(row.forecast_at!));
    const lastOutlookDay = (Math.max(...outlookMs) - firstSlot) / 86_400_000;

    expect(FORECAST_CONSTANTS.DAYS).toBe(15);
    expect(rows).toHaveLength(TOTAL_FORECASTS);
    expect(lastOutlookDay).toBeGreaterThan(14);
    expect(lastOutlookDay).toBeLessThanOrEqual(14.3);
    const pastDay12 = rows.filter((row) => Date.parse(row.forecast_at!) >= firstSlot + 12 * 86_400_000);
    expect(pastDay12.length).toBe(3 * FORECAST_CONSTANTS.FORECASTS_PER_DAY);
    expect(pastDay12.every((row) => row.data_source === "FALLBACK" && row.wave_height === null)).toBe(true);
  });
});
