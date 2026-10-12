import { ForecastBuilder } from "../forecast-builder";
import type { ForecastInputs } from "../forecast-builder";
import { logDisplayPredictions } from "../log-display-prediction";
import type { Beach } from "@/types/database";
import type { WeatherPeriod } from "@/types/forecast";

const fromMock: jest.Mock = jest.fn(() => ({
  insert: jest.fn().mockResolvedValue({ data: null, error: null }),
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

// A numeric display height is what makes the builder emit ml_predictions_log
// snapshot rows, so the wind written there can be compared with the row.
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

const logMock = logDisplayPredictions as unknown as jest.Mock;

// Mexican beach: NWS has no grid point here, so weatherData is empty.
const beach = {
  id: "beach-mx",
  name: "Test Beach",
  lat: 23.2,
  lon: -106.4,
} as unknown as Beach;

const weatherPeriod = (windSpeed: string, windDirection: string): WeatherPeriod => ({
  startTime: new Date().toISOString(),
  temperature: 70,
  windSpeed,
  windDirection,
  shortForecast: "Clear",
});

const inputs = (weatherData: WeatherPeriod[]): ForecastInputs =>
  ({
    beach,
    waveData: null,
    tideData: null,
    weatherData,
    buoyData: null,
    cdipData: null,
    ioosWaterTempC: null,
    coopsWaterTempC: null,
  }) as unknown as ForecastInputs;

const newBuilder = () =>
  new ForecastBuilder({
    getWaveDirectionText: () => "W",
    getTideStatusAtTime: () => "Rising",
    getTideHeightAtTime: () => 3,
    getNextTideFromTime: () => null,
    getDataQualityScore: () => 85,
  });

const loggedWind = () =>
  logMock.mock.calls.flatMap(([rows]) =>
    (rows as Array<{ wind_speed_ms: number | null; wind_direction_deg: number | null }>).map(
      (row) => ({ ms: row.wind_speed_ms, deg: row.wind_direction_deg }),
    ),
  );

describe("ForecastBuilder wind: no invented values", () => {
  beforeEach(() => logMock.mockClear());

  it("stores no wind when NWS has no point for the beach", async () => {
    const forecasts = await newBuilder().buildForecasts(inputs([]));

    expect(forecasts.length).toBeGreaterThan(0);
    for (const row of forecasts) {
      expect(row.wind_speed).toBeNull();
      expect(row.wind_direction).toBeNull();
      expect(row.wind_direction_deg).toBeNull();
      expect(row.wind_source).toBeNull();
    }
    const logged = loggedWind();
    expect(logged.length).toBeGreaterThan(0);
    expect(logged.every((w) => w.ms === null && w.deg === null)).toBe(true);
  });

  it("stores no wind speed when the NWS period has no wind speed", async () => {
    const forecasts = await newBuilder().buildForecasts(inputs([weatherPeriod("", "")]));

    for (const row of forecasts) {
      expect(row.wind_speed).toBeNull();
      expect(row.wind_direction).toBeNull();
      expect(row.wind_direction_deg).toBeNull();
      expect(row.wind_source).toBeNull();
    }
  });

  it("keeps calm as 0 mph with no direction (NWS leaves direction blank when calm)", async () => {
    const forecasts = await newBuilder().buildForecasts(inputs([weatherPeriod("0 mph", "")]));

    expect(forecasts.length).toBeGreaterThan(0);
    for (const row of forecasts) {
      expect(row.wind_speed).toBe("0 mph");
      expect(row.wind_direction).toBeNull();
      expect(row.wind_direction_deg).toBeNull();
      expect(row.wind_source).toBe("NWS");
    }
    const logged = loggedWind();
    expect(logged.length).toBeGreaterThan(0);
    expect(logged.every((w) => w.ms === 0 && w.deg === null)).toBe(true);
  });

  it("keeps a normal NWS wind unchanged", async () => {
    const forecasts = await newBuilder().buildForecasts(inputs([weatherPeriod("8 mph", "NW")]));

    expect(forecasts.length).toBeGreaterThan(0);
    for (const row of forecasts) {
      expect(row.wind_speed).toBe("8 mph");
      expect(row.wind_direction).toBe("NW");
      expect(row.wind_direction_deg).toBe(315);
      expect(row.wind_source).toBe("NWS");
    }
    const logged = loggedWind();
    expect(logged.length).toBeGreaterThan(0);
    expect(logged.every((w) => w.deg === 315 && w.ms !== null && w.ms > 3.5 && w.ms < 3.6)).toBe(true);
  });
});
