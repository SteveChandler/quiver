import { EnhancedForecastService } from "@/lib/services/enhanced-forecast-service";

// Minimal Beach type shape for tests
const beach = {
  id: "beach-1",
  name: "Test Beach",
  latitude: 32.7,
  longitude: -117.2,
} as any;

function createWaveResult() {
  const now = Date.now();
  return {
    lat: beach.latitude,
    lng: beach.longitude,
    data_source: "NOAA_NWS",
    forecast: [
      {
        timestamp: new Date(now).toISOString(),
        significant_wave_height: 1.2,
        peak_wave_period: 12,
        peak_wave_direction: 225,
        swell_1_height: 0.8,
        swell_1_period: 14,
        swell_1_direction: 220,
        swell_2_height: 0.4,
        swell_2_period: 9,
        swell_2_direction: 210,
        wind_wave_height: 0.3,
        wind_wave_period: 6,
        wind_wave_direction: 200,
        data_source: "NOAA_NWS",
      },
    ],
  };
}

function createTideResult() {
  const now = Math.floor(Date.now() / 1000);
  return {
    tides: [
      { time: now, height: 2.5, name: "Low" },
      { time: now + 3 * 3600, height: 4.1, name: "High" },
    ],
  };
}

function createWeatherPeriods() {
  const now = new Date();
  return [
    {
      startTime: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
      windSpeed: "12 mph",
      windDirection: "W",
      temperature: 68,
      shortForecast: "Partly Cloudy",
    },
  ];
}

describe("EnhancedForecastService (unit)", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it("generates forecasts using CDIP when available (happy path)", async () => {
    // Spy on internal services to return deterministic data
    const service = new EnhancedForecastService() as any;

    jest
      .spyOn(service.waveWatchService, "fetchWaveWatchForecast")
      .mockResolvedValue(createWaveResult());

    jest
      .spyOn(service.coopsService, "getStationForLocation")
      .mockReturnValue("9444090");

    jest
      .spyOn(service.coopsService, "fetchCOOPSData")
      .mockResolvedValue(createTideResult());

    // Weather periods come from NOAAWeatherDataSource inside the class
    jest
      .spyOn(service, "fetchWeatherDataWithRetry")
      .mockResolvedValue(createWeatherPeriods());

    // CDIP: nearest station + buoy data (spy on instance held by service)
    jest
      .spyOn(service.cdipService, "getNearestStation")
      .mockResolvedValue("100");

    jest.spyOn(service.cdipService, "fetchBuoyData").mockResolvedValue({
      stationId: "100",
      stationName: "Torrey Pines Outer",
      dataSource: "CDIP",
      lastUpdated: new Date().toISOString(),
      data: [
        {
          timestamp: new Date().toISOString(),
          significantWaveHeight: 1.2,
          peakWavePeriod: 12,
          peakWaveDirection: 225,
          swellHeight: 1.0,
          swellPeriod: 14,
          swellDirection: 220,
          windWaveHeight: 0.2,
          windWavePeriod: 5,
          windWaveDirection: 200,
        },
      ],
    });

    const forecasts = await service.generateComprehensiveForecast(beach);
    expect(forecasts.length).toBeGreaterThan(0);
    // With CDIP present, primary data source set to CDIP
    expect(forecasts[0].data_source).toBe("CDIP");
    expect(forecasts[0].raw_forecast?.data_sources).toContain("CDIP");
  });

  it("falls back when CDIP is unavailable", async () => {
    const service = new EnhancedForecastService() as any;

    jest
      .spyOn(service.waveWatchService, "fetchWaveWatchForecast")
      .mockResolvedValue(createWaveResult());

    jest
      .spyOn(service.coopsService, "getStationForLocation")
      .mockReturnValue("9444090");

    jest
      .spyOn(service.coopsService, "fetchCOOPSData")
      .mockResolvedValue(createTideResult());

    jest
      .spyOn(service, "fetchWeatherDataWithRetry")
      .mockResolvedValue(createWeatherPeriods());

    jest
      .spyOn(service.cdipService, "getNearestStation")
      .mockResolvedValue(null);

    const forecasts = await service.generateComprehensiveForecast(beach);
    expect(forecasts.length).toBeGreaterThan(0);
    // Without CDIP, data source falls back to NOAA_NWS or FALLBACK
    expect(["NOAA_NWS", "FALLBACK"]).toContain(forecasts[0].data_source);
  });
});
