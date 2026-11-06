/**
 * The ECMWF hybrid scale reads the WAM series from the outlook's one request.
 * The whole series (days 1-9 too) must reach the forecast, even when the
 * outlook seam gate rejects it, and there must be no second WAM call.
 */
import { NOAAWaveWatchService } from "@/lib/services/noaa-wavewatch/noaa-wavewatch-service";
import type { WaveWatchData } from "@/lib/services/noaa-wavewatch/types";
import { fetchOpenMeteoData } from "@/lib/services/noaa-wavewatch/api-client";
import { processOpenMeteoData } from "@/lib/services/noaa-wavewatch/data-processors";

const HOUR = 3_600_000;
const SLOT_MS = 3 * HOUR;
const START = Math.floor(Date.now() / SLOT_MS) * SLOT_MS;

jest.mock("@/lib/services/noaa-wavewatch/api-client", () => ({
  fetchNOAAPointData: jest.fn(async () => null),
  constructGridUrl: jest.fn(() => null),
  fetchNOAAGridData: jest.fn(async () => null),
  fetchOpenMeteoData: jest.fn(),
}));
jest.mock("@/lib/services/noaa-wavewatch/data-processors", () => ({
  processNOAAGridData: jest.fn(() => []),
  processOpenMeteoData: jest.fn(),
}));
jest.mock("@/lib/monitoring/fallback-tracker", () => ({ trackFallback: jest.fn() }));
jest.mock("@/lib/logger", () => ({
  createContextLogger: () => ({ debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }),
}));
jest.mock("@/lib/monitoring/forecast-logger", () => ({ isForecastVerboseLoggingEnabled: () => false }));

const omPoint = (ms: number): WaveWatchData => ({
  timestamp: new Date(ms).toISOString(),
  significant_wave_height: 1.1, peak_wave_period: 13, peak_wave_direction: 270,
  swell_1_height: 0.9, swell_1_period: 14, swell_1_direction: 265,
  swell_2_height: 0, swell_2_period: 0, swell_2_direction: 0,
  wind_wave_height: 0.2, wind_wave_period: 5, wind_wave_direction: 300,
  data_source: "OPEN_METEO",
});

/** WAM hourly over `hours` from START. */
function wamPayload(hours: number) {
  const time: number[] = [];
  const wave_height: number[] = [];
  for (let h = 0; h < hours; h += 1) {
    time.push((START + h * HOUR) / 1000);
    wave_height.push(1.4);
  }
  return { hourly: { time, wave_height } };
}

function mockFetch(wamHours: number): void {
  (fetchOpenMeteoData as jest.Mock).mockImplementation(async (_lat, _lon, _days, options?: { model?: string }) =>
    options?.model === "ecmwf_wam025" ? wamPayload(wamHours) : { hourly: { time: [] } });
}

describe("NOAAWaveWatchService keeps the whole WAM series", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (processOpenMeteoData as jest.Mock).mockReturnValue(
      Array.from({ length: 9 * 8 }, (_, i) => omPoint(START + i * SLOT_MS)),
    );
  });

  const wamCalls = () => (fetchOpenMeteoData as jest.Mock).mock.calls.filter((call) => call[3]?.model === "ecmwf_wam025");

  it("carries days 1-9 of WAM on the forecast with one WAM request", async () => {
    mockFetch(15 * 24);
    const forecast = await new NOAAWaveWatchService().fetchWaveWatchForecast(33.1, -117.3, 12);
    expect(wamCalls()).toHaveLength(1);
    expect(wamCalls()[0][3].model).toBe("ecmwf_wam025");
    expect(forecast!.ecmwf_outlook).toMatchObject({ model: "ecmwf_wam025" });
    expect(forecast!.ecmwf_wam![0]).toEqual({ ms: START, hsM: 1.4 });
    expect(forecast!.ecmwf_wam).toHaveLength(15 * 24);
  });

  it("keeps the series when the outlook gate rejects it (no tail past the model)", async () => {
    mockFetch(5 * 24);
    const forecast = await new NOAAWaveWatchService().fetchWaveWatchForecast(33.1, -117.3, 12);
    expect(wamCalls()).toHaveLength(1);
    expect(forecast!.ecmwf_outlook).toBeUndefined();
    expect(forecast!.ecmwf_wam).toHaveLength(5 * 24);
  });
});
