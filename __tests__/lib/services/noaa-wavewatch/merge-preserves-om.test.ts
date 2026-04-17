/**
 * Merge test: NOAA + OM parallel fetch co-locates raw OM values on merged
 * slots in the days-1-3 horizon (where NOAA wins as the primary data_source).
 *
 * Guards the Seaside ML contract that `enhanced_forecasts` rows carry OM
 * values alongside NOAA values whenever both sources had data for the slot.
 */

import { NOAAWaveWatchService } from "@/lib/services/noaa-wavewatch/noaa-wavewatch-service";
import type { WaveWatchData } from "@/lib/services/noaa-wavewatch/types";

// Mock API + fallback internals so we can feed synthetic NOAA / OM forecasts.
jest.mock("@/lib/services/noaa-wavewatch/api-client", () => ({
  fetchNOAAPointData: jest.fn(async () => ({ properties: { gridId: "X", gridX: 1, gridY: 1 } })),
  constructGridUrl: jest.fn(() => "https://example.test/grid"),
  fetchNOAAGridData: jest.fn(async () => ({ properties: { waveHeight: { uom: "wmoUnit:m", values: [{ validTime: "now/PT3H", value: 1.2 }] } } })),
  fetchOpenMeteoData: jest.fn(async () => ({ hourly: { time: [] } })),
}));

jest.mock("@/lib/services/noaa-wavewatch/wave-analysis", () => {
  const actual = jest.requireActual("@/lib/services/noaa-wavewatch/wave-analysis");
  return {
    ...actual,
    hasValidWaveData: () => true,
    logWaveDataAvailability: jest.fn(),
  };
});

jest.mock("@/lib/services/noaa-wavewatch/data-processors", () => ({
  processNOAAGridData: jest.fn(),
  processOpenMeteoData: jest.fn(),
}));

jest.mock("@/lib/services/noaa-wavewatch/fallback-generator", () => ({
  generateFallbackData: jest.fn(() => []),
  generateFallbackSlotsFrom: jest.fn(() => []),
}));

jest.mock("@/lib/monitoring/fallback-tracker", () => ({
  trackFallback: jest.fn(),
}));

jest.mock("@/lib/logger", () => ({
  createContextLogger: () => ({
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

jest.mock("@/lib/monitoring/forecast-logger", () => ({
  isForecastVerboseLoggingEnabled: () => false,
}));

import {
  processNOAAGridData,
  processOpenMeteoData,
} from "@/lib/services/noaa-wavewatch/data-processors";

describe("NOAAWaveWatchService.mergeForecasts: OM co-location", () => {
  const snapSlot = (d: Date): Date => {
    const ms = Math.round(d.getTime() / (3 * 3600000)) * (3 * 3600000);
    return new Date(ms);
  };

  const makeSlotNow = (offsetHours: number): string =>
    snapSlot(new Date(Date.now() + offsetHours * 3600000)).toISOString();

  const noaaPoint = (ts: string, height: number): WaveWatchData => ({
    timestamp: ts,
    significant_wave_height: height,
    peak_wave_period: 12,
    peak_wave_direction: 225,
    swell_1_height: height * 0.7,
    swell_1_period: 14,
    swell_1_direction: 220,
    swell_2_height: 0,
    swell_2_period: 0,
    swell_2_direction: 0,
    wind_wave_height: 0.3,
    wind_wave_period: 6,
    wind_wave_direction: 200,
    data_source: "NOAA_NWS",
  });

  const omPoint = (ts: string, height: number): WaveWatchData => ({
    timestamp: ts,
    significant_wave_height: height,
    peak_wave_period: 11,
    peak_wave_direction: 230,
    swell_1_height: height * 0.7,
    swell_1_period: 13,
    swell_1_direction: 225,
    swell_2_height: 0,
    swell_2_period: 0,
    swell_2_direction: 0,
    wind_wave_height: 0.3,
    wind_wave_period: 6,
    wind_wave_direction: 200,
    data_source: "OPEN_METEO",
    om_values: {
      wave_height_om: height,
      wave_period_om: 11,
      wave_direction_om: 230,
      swell_height_om: height * 0.7,
      swell_period_om: 13,
      swell_direction_om: 225,
      wind_wave_height_om: 0.3,
    },
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("carries om_values on NOAA-primary slots (days 1-3) when OM has the slot", async () => {
    const earlySlot = makeSlotNow(6); // within 72h → NOAA wins
    const lateSlot = makeSlotNow(96); // >72h → OM wins

    (processNOAAGridData as jest.Mock).mockReturnValue([
      noaaPoint(earlySlot, 1.1),
      noaaPoint(lateSlot, 0.9),
    ]);
    (processOpenMeteoData as jest.Mock).mockReturnValue([
      omPoint(earlySlot, 1.05),
      omPoint(lateSlot, 0.95),
    ]);

    const service = new NOAAWaveWatchService();
    const result = await service.fetchWaveWatchForecast(32.7, -117.2, 7);

    expect(result).not.toBeNull();
    const merged = result!.forecast;
    // Both slots must carry om_values populated from the raw OM mock.
    const early = merged.find((m) => m.timestamp === earlySlot);
    const late = merged.find((m) => m.timestamp === lateSlot);

    expect(early).toEqual(expect.any(Object));
    expect(early!.data_source).toBe("NOAA_NWS");
    expect(early!.om_values?.wave_height_om).toBe(1.05);
    expect(early!.om_values?.wave_period_om).toBe(11);

    expect(late).toEqual(expect.any(Object));
    expect(late!.data_source).toBe("OPEN_METEO");
    expect(late!.om_values?.wave_height_om).toBe(0.95);
  });

  it("leaves om_values undefined on NOAA slots when OM did not cover that slot", async () => {
    const slotOnlyNoaa = makeSlotNow(9);
    const slotOnlyOm = makeSlotNow(96);

    (processNOAAGridData as jest.Mock).mockReturnValue([noaaPoint(slotOnlyNoaa, 1.1)]);
    (processOpenMeteoData as jest.Mock).mockReturnValue([omPoint(slotOnlyOm, 0.8)]);

    const service = new NOAAWaveWatchService();
    const result = await service.fetchWaveWatchForecast(32.7, -117.2, 7);

    expect(result).not.toBeNull();
    const onlyNoaa = result!.forecast.find((m) => m.timestamp === slotOnlyNoaa);
    expect(onlyNoaa).toEqual(expect.any(Object));
    expect(onlyNoaa!.data_source).toBe("NOAA_NWS");
    expect(onlyNoaa!.om_values).toBeUndefined();
  });
});
