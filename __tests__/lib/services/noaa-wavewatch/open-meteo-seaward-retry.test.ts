/**
 * Open-Meteo snaps some shore points to a land cell, which returns null for every wave height
 * (Pompano Pier, FL). The service then asks once more ~5 km seaward along the beach's facing.
 */
import { NOAAWaveWatchService } from "@/lib/services/noaa-wavewatch/noaa-wavewatch-service";
import { fetchOpenMeteoData } from "@/lib/services/noaa-wavewatch/api-client";
import { trackFallback } from "@/lib/monitoring/fallback-tracker";
import type { OpenMeteoMarineResponse } from "@/lib/services/noaa-wavewatch/types";

jest.mock("@/lib/services/noaa-wavewatch/api-client", () => ({
  fetchNOAAPointData: jest.fn(async () => null),
  constructGridUrl: jest.fn(() => null),
  fetchNOAAGridData: jest.fn(async () => null),
  fetchOpenMeteoData: jest.fn(),
}));

jest.mock("@/lib/services/noaa-wavewatch/ecmwf-outlook", () => ({
  fetchEcmwfWamSeries: jest.fn(async () => null),
  buildEcmwfOutlookSeries: jest.fn(() => null),
  WAM_FETCH_TIMEOUT_MS: 1000,
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

const LAT = 26.23598;
const LON = -80.08637;
const ASPECT = 100;
const HOURS = 72;

function marine(waveHeight: number | null): OpenMeteoMarineResponse {
  const start = Math.floor(Date.now() / 3600000) * 3600000;
  const time = Array.from({ length: HOURS }, (_, i) => new Date(start + i * 3600000).toISOString().slice(0, 16));
  const fill = (value: number | null) => Array.from({ length: HOURS }, () => value);
  return {
    hourly: {
      time,
      wave_height: fill(waveHeight),
      wave_direction: fill(waveHeight === null ? null : 95),
      wave_period: fill(waveHeight === null ? null : 7),
      wave_peak_period: fill(waveHeight === null ? null : 8),
      swell_wave_height: fill(waveHeight === null ? null : waveHeight * 0.8),
      swell_wave_direction: fill(waveHeight === null ? null : 100),
      swell_wave_period: fill(waveHeight === null ? null : 8),
    },
  };
}

const fetchOm = fetchOpenMeteoData as jest.Mock;

describe("Open-Meteo seaward retry for land cells", () => {
  const service = new NOAAWaveWatchService();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("retries ~5 km seaward along the facing when every wave height is null, and uses that response", async () => {
    fetchOm.mockResolvedValueOnce(marine(null)).mockResolvedValueOnce(marine(0.64));

    const result = await service.fetchWaveWatchForecast(LAT, LON, 3, undefined, ASPECT);

    expect(fetchOm).toHaveBeenCalledTimes(2);
    const [seawardLat, seawardLon] = fetchOm.mock.calls[1];
    // Bearing 100° is east-southeast: a little south, mostly east.
    expect(seawardLat).toBeCloseTo(26.2282, 3);
    expect(seawardLon).toBeCloseTo(-80.0370, 3);

    expect(result).not.toBeNull();
    expect(result!.lat).toBe(LAT);
    expect(result!.lng).toBe(LON);
    expect(result!.forecast.length).toBeGreaterThan(0);
    expect(result!.forecast.every((slot) => slot.has_reported_wave_height)).toBe(true);
    expect(result!.forecast[0].om_values?.wave_height_om).toBe(0.64);
    expect(trackFallback).not.toHaveBeenCalledWith(expect.objectContaining({ field: "open_meteo_point" }));
  });

  it("makes no extra request when the first response has wave heights", async () => {
    fetchOm.mockResolvedValueOnce(marine(1.2));

    const result = await service.fetchWaveWatchForecast(LAT, LON, 3, undefined, ASPECT);

    expect(fetchOm).toHaveBeenCalledTimes(1);
    expect(result!.forecast[0].om_values?.wave_height_om).toBe(1.2);
  });

  it("makes no extra request when the beach has no facing", async () => {
    fetchOm.mockResolvedValueOnce(marine(null));

    await service.fetchWaveWatchForecast(LAT, LON, 3, undefined, null);
    await service.fetchWaveWatchForecast(LAT, LON, 3);

    expect(fetchOm).toHaveBeenCalledTimes(2);
    for (const [lat, lon] of fetchOm.mock.calls) {
      expect(lat).toBe(LAT);
      expect(lon).toBe(LON);
    }
  });

  it("keeps today's result when the seaward point is also empty", async () => {
    fetchOm.mockResolvedValueOnce(marine(null));
    const withoutRetry = await service.fetchWaveWatchForecast(LAT, LON, 3);

    fetchOm.mockResolvedValueOnce(marine(null)).mockResolvedValueOnce(marine(null));
    const withRetry = await service.fetchWaveWatchForecast(LAT, LON, 3, undefined, ASPECT);

    expect(fetchOm).toHaveBeenCalledTimes(3);
    expect(withRetry).toEqual(withoutRetry);
    expect(trackFallback).not.toHaveBeenCalledWith(expect.objectContaining({ field: "open_meteo_point" }));
  });
});
