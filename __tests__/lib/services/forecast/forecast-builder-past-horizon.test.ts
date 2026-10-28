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
});
