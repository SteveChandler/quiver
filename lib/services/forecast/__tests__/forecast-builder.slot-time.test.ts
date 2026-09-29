import { ForecastBuilder } from "../forecast-builder";
import type { ForecastInputs } from "../forecast-builder";
import type { Beach } from "@/types/database";

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

jest.mock("../log-display-prediction", () => ({
  logDisplayPredictions: jest.fn(async () => undefined),
}));

const beach = {
  id: "beach-del-mar",
  name: "Del Mar",
  lat: 32.96,
  lon: -117.27,
  timezone: "America/Los_Angeles",
} as unknown as Beach;

// Del Mar, 2026-09-29: NOAA 9410230 low 1.6 ft at 12Z, high 6.1 ft at 18Z,
// low 0.1 ft at 01Z. The production build ran at 11:00:52Z.
const BUILD_AT = new Date("2026-09-29T11:00:52.180Z");
const at = (iso: string): number => Date.parse(iso) / 1000;
const tides = [
  { time: at("2026-09-29T05:00:00Z"), height: 5.0, type: "H", name: "High" },
  { time: at("2026-09-29T12:00:00Z"), height: 1.6, type: "L", name: "Low" },
  { time: at("2026-09-29T18:00:00Z"), height: 6.1, type: "H", name: "High" },
  { time: at("2026-09-30T01:00:00Z"), height: 0.1, type: "L", name: "Low" },
  { time: at("2026-09-30T07:00:00Z"), height: 3.7, type: "H", name: "High" },
];

const inputs = (): ForecastInputs =>
  ({
    beach,
    waveData: null,
    tideData: { station_id: "cached_beach-del-mar", station_name: "Cached", tides, water_level: null },
    weatherData: [],
    buoyData: null,
    cdipData: null,
    ioosWaterTempC: null,
    coopsWaterTempC: null,
    buildAnchorAt: BUILD_AT,
  }) as unknown as ForecastInputs;

describe("ForecastBuilder slot time alignment", () => {
  it("resolves tide at each row's forecast_at, not at build time + i*3h", async () => {
    const tideTimes: number[] = [];
    const builder = new ForecastBuilder({
      getWaveDirectionText: () => "W",
      getTideStatusAtTime: () => "Rising",
      getTideHeightAtTime: (_tides, time) => {
        tideTimes.push(time.getTime());
        return 1;
      },
      getNextTideFromTime: () => null,
      getDataQualityScore: () => 85,
    });

    const forecasts = await builder.buildForecasts(inputs());

    expect(forecasts.length).toBeGreaterThan(4);
    expect(forecasts.slice(0, 4).map((f) => f.forecast_at)).toEqual([
      "2026-09-29T09:00:00Z",
      "2026-09-29T12:00:00Z",
      "2026-09-29T15:00:00Z",
      "2026-09-29T18:00:00Z",
    ]);
    expect(tideTimes).toEqual(forecasts.map((f) => Date.parse(f.forecast_at!)));
  });

  it("stores the Del Mar tide at the labelled hour", async () => {
    const { getTideHeightAtTime, getTideStatusAtTime, getNextTideFromTime } =
      jest.requireActual("@/lib/services/noaa-coops/tide-analysis");
    const builder = new ForecastBuilder({
      getWaveDirectionText: () => "W",
      getTideStatusAtTime,
      getTideHeightAtTime,
      getNextTideFromTime,
      getDataQualityScore: () => 85,
    });

    const forecasts = await builder.buildForecasts(inputs());
    const byAt = new Map(forecasts.map((f) => [f.forecast_at, f]));

    // At the 18Z high the row must read the high, not 2h into the ebb (4.4 ft).
    expect(byAt.get("2026-09-29T18:00:00Z")?.tide_height).toBe("6.1 ft");
    expect(byAt.get("2026-09-29T12:00:00Z")?.tide_height).toBe("1.6 ft");
    expect(byAt.get("2026-09-29T15:00:00Z")?.tide_status).toBe("Rising");
    expect(byAt.get("2026-09-29T21:00:00Z")?.next_tide_at).toBe(
      new Date(tides[3].time * 1000).toISOString(),
    );
  });
});
