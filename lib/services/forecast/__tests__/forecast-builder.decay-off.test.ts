import { toFaceHeightFeetDecomposedWithDebug } from "@/lib/utils/wave-formatters";
import { ForecastBuilder } from "../forecast-builder";
import type { ForecastInputs } from "../forecast-builder";
import type { Beach } from "@/types/database";

const insertMock: jest.Mock = jest.fn().mockResolvedValue({ data: null, error: null });
// The Phase 21 trusted layer resolves coverage beach slugs through the same
// service-role client. Answering with no rows keeps this suite on the
// "coverage unavailable -> baseline" path, which is what an unconfigured
// environment does.
const fromMock: jest.Mock = jest.fn(() => ({
  insert: insertMock,
  select: () => ({ in: async () => ({ data: [], error: null }) }),
}));

jest.mock("@/lib/supabase", () => ({
  createServiceRoleClient: () => ({
    from: (table: string) => fromMock(table),
  }),
}));

jest.mock("@/lib/services/forecast/confidence-scorer", () => ({
  calculateConfidenceScore: jest.fn(() => 75),
}));

jest.mock("@/lib/logger", () => ({
  createContextLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

jest.mock("@/lib/utils/wave-formatters", () => {
  const actual = jest.requireActual("@/lib/utils/unit-conversions");
  return {
    toFaceHeightFeet: jest.fn(() => "3 ft"),
    toFaceHeightFeetDecomposed: jest.fn(() => "3 ft"),
    toFaceHeightFeetDecomposedWithDebug: jest.fn(() => ({
      value: "3 ft",
      debug: {
        source: "model_swell",
        rawHeightFt: 3,
        provenance: "generic",
        transformPath: "decomposed",
        componentsUsed: true,
        calibratedShoalingFired: false,
      },
    })),
    metersToFeet: jest.fn((m: number) => m * actual.METERS_TO_FEET),
    METERS_TO_FEET: actual.METERS_TO_FEET,
  };
});

jest.mock("../log-display-prediction", () => ({
  logDisplayPredictions: jest.fn(async () => undefined),
}));

const baseBeach: Beach = {
  id: "beach-1",
  name: "Test Beach",
  lat: 32.7,
  lon: -117.2,
} as Beach;

const buildInputs = (overrides: Partial<ForecastInputs> = {}): ForecastInputs =>
  ({
    beach: baseBeach,
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
          data_source: "NOAA_NWS" as const,
          om_values: {
            wave_height_om: 1.1,
            wave_period_om: 11,
            wave_direction_om: 230,
            wave_peak_period_om: 12,
            swell_height_om: 0.7,
            swell_period_om: 13,
            swell_direction_om: 225,
            swell_wave_peak_period_om: 15,
            wind_wave_height_om: 0.2,
            wind_wave_period_om: 5,
            wind_wave_direction_om: 205,
            wind_wave_peak_period_om: 7,
            secondary_swell_height_om: 0.25,
            secondary_swell_period_om: 11,
            secondary_swell_direction_om: 190,
            tertiary_swell_height_om: 0.15,
            tertiary_swell_period_om: 9,
            tertiary_swell_direction_om: 145,
            om_wind_wave_missing: false,
            om_primary_swell_missing: false,
            om_secondary_swell_missing: false,
            om_tertiary_swell_missing: false,
            om_partition_schema_version: 1,
          },
        },
      ],
    } as any,
    tideData: null,
    weatherData: [
      {
        startTime: new Date().toISOString(),
        temperature: 66,
        windSpeed: "12 mph",
        windDirection: "W",
        shortForecast: "Clear",
      },
    ],
    buoyData: null,
    cdipData: null,
    ioosWaterTempC: null,
    coopsWaterTempC: null,
    ...overrides,
  }) as ForecastInputs;

const newBuilder = () =>
  new ForecastBuilder({
    getWaveDirectionText: () => "SW",
    getTideStatusAtTime: () => "Rising",
    getTideHeightAtTime: () => 3.5,
    getNextTideFromTime: () => ({
      time: Math.floor(Date.now() / 1000) + 7200,
      height: 5.2,
      type: "high",
      name: "High",
    }),
    getDataQualityScore: () => 85,
  });

const transformMock = toFaceHeightFeetDecomposedWithDebug as unknown as jest.Mock;

const malibuBeach = (decay: number | null) =>
  ({
    id: "beach-1",
    name: "Malibu First Point",
    slug: "malibu-first-point-surfrider",
    lat: 34.03,
    lon: -118.68,
    deepwater_decay_factor: decay,
  }) as unknown as Beach;

const decayPassedToTransform = (): Array<number | null> =>
  transformMock.mock.calls.map((c) => c[0]?.beach?.deepwater_decay_factor ?? null);

describe("ForecastBuilder scoped decay-off wiring", () => {
  const prev = process.env.DECAY_OFF_ENABLED;
  beforeEach(() => {
    transformMock.mockClear();
    insertMock.mockClear();
    fromMock.mockClear();
  });

  afterEach(() => {
    if (prev === undefined) delete process.env.DECAY_OFF_ENABLED;
    else process.env.DECAY_OFF_ENABLED = prev;
  });

  it("flag off -> transform receives the real decay factor (0.6)", async () => {
    delete process.env.DECAY_OFF_ENABLED;
    await newBuilder().buildForecasts(buildInputs({ beach: malibuBeach(0.6) }));
    expect(decayPassedToTransform().length).toBeGreaterThan(0);
    expect(decayPassedToTransform()).toContain(0.6);
    expect(decayPassedToTransform()).not.toContain(null);
  });

  it("flag on + allowlisted + in band -> transform receives null (decay removed)", async () => {
    process.env.DECAY_OFF_ENABLED = "true";
    await newBuilder().buildForecasts(buildInputs({ beach: malibuBeach(0.6) }));
    const passed = decayPassedToTransform();
    expect(passed.length).toBeGreaterThan(0);
    expect(passed.every((d) => d === null)).toBe(true);
  });

  it("flag on but beach not allowlisted -> transform receives the real decay", async () => {
    process.env.DECAY_OFF_ENABLED = "true";
    const other = { ...malibuBeach(0.6), slug: "county-line-malibu-ca" } as Beach;
    await newBuilder().buildForecasts(buildInputs({ beach: other }));
    expect(decayPassedToTransform()).toContain(0.6);
  });

  it("flag on + allowlisted but below band (0.4) -> transform still receives 0.4", async () => {
    process.env.DECAY_OFF_ENABLED = "true";
    await newBuilder().buildForecasts(buildInputs({ beach: malibuBeach(0.4) }));
    expect(decayPassedToTransform()).toContain(0.4);
  });
});
