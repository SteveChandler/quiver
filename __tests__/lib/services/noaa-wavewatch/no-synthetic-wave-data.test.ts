/**
 * The wave service must never invent wave values. A synthetic generator used
 * to pad every forecast past the Open-Meteo horizon (days 10-12 on every
 * beach) with random heights, periods and directions tagged FALLBACK, and to
 * replace the whole forecast with them when both sources failed. Those rows
 * were scored, ranked and shown as real forecasts.
 */
import { NOAAWaveWatchService } from "@/lib/services/noaa-wavewatch/noaa-wavewatch-service";
import type { WaveWatchData } from "@/lib/services/noaa-wavewatch/types";
import { fetchOpenMeteoData } from "@/lib/services/noaa-wavewatch/api-client";
import {
  processNOAAGridData,
  processOpenMeteoData,
} from "@/lib/services/noaa-wavewatch/data-processors";

jest.mock("@/lib/services/noaa-wavewatch/api-client", () => ({
  fetchNOAAPointData: jest.fn(async () => ({ properties: { gridId: "X", gridX: 1, gridY: 1 } })),
  constructGridUrl: jest.fn(() => "https://example.test/grid"),
  fetchNOAAGridData: jest.fn(async () => ({ properties: {} })),
  fetchOpenMeteoData: jest.fn(async () => ({ hourly: { time: [] } })),
}));

jest.mock("@/lib/services/noaa-wavewatch/wave-analysis", () => ({
  ...jest.requireActual("@/lib/services/noaa-wavewatch/wave-analysis"),
  hasValidWaveData: () => true,
  logWaveDataAvailability: jest.fn(),
}));

jest.mock("@/lib/services/noaa-wavewatch/data-processors", () => ({
  processNOAAGridData: jest.fn(),
  processOpenMeteoData: jest.fn(),
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

const SLOT_MS = 3 * 3600000;
const slotAt = (hoursAhead: number): string =>
  new Date((Math.floor(Date.now() / SLOT_MS) + hoursAhead / 3) * SLOT_MS).toISOString();

const omPoint = (timestamp: string): WaveWatchData => ({
  timestamp,
  significant_wave_height: 1.1,
  peak_wave_period: 13,
  peak_wave_direction: 270,
  swell_1_height: 0.9,
  swell_1_period: 14,
  swell_1_direction: 265,
  swell_2_height: 0,
  swell_2_period: 0,
  swell_2_direction: 0,
  wind_wave_height: 0.2,
  wind_wave_period: 5,
  wind_wave_direction: 300,
  data_source: "OPEN_METEO",
});

describe("NOAAWaveWatchService never synthesizes wave data", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (processNOAAGridData as jest.Mock).mockReturnValue([]);
  });

  it("returns only real slots when the model horizon is shorter than the request", async () => {
    // Open-Meteo covers ~9 of the 12 requested days in production.
    const realSlots = Array.from({ length: 9 * 8 }, (_, i) => omPoint(slotAt(i * 3)));
    (processOpenMeteoData as jest.Mock).mockReturnValue(realSlots);

    const service = new NOAAWaveWatchService();
    const first = await service.fetchWaveWatchForecast(32.7, -117.2, 12);
    const second = await service.fetchWaveWatchForecast(32.7, -117.2, 12);

    expect(first!.forecast).toHaveLength(9 * 8);
    expect(first!.forecast.every((slot) => slot.data_source === "OPEN_METEO")).toBe(true);
    expect(first!.forecast.some((slot) => slot.data_source === "FALLBACK")).toBe(false);
    expect(second!.forecast).toEqual(first!.forecast);
  });

  it("returns null when neither source has usable wave data", async () => {
    (processOpenMeteoData as jest.Mock).mockReturnValue([]);

    await expect(
      new NOAAWaveWatchService().fetchWaveWatchForecast(32.7, -117.2, 12)
    ).resolves.toBeNull();
  });

  it("returns null when fetching throws", async () => {
    (processOpenMeteoData as jest.Mock).mockImplementation(() => {
      throw new Error("bad payload");
    });
    (fetchOpenMeteoData as jest.Mock).mockRejectedValueOnce(new Error("network down"));
    (processNOAAGridData as jest.Mock).mockImplementation(() => {
      throw new Error("bad grid");
    });

    await expect(
      new NOAAWaveWatchService().fetchWaveWatchForecast(32.7, -117.2, 12)
    ).resolves.toBeNull();
  });
});
