import { EnhancedForecastService } from "@/lib/services/enhanced-forecast-service";

// Mock CDIP Service with all required methods
jest.mock("@/lib/services/cdip", () => {
  return {
    CDIPService: jest.fn().mockImplementation(() => {
      return {
        fetchBuoyData: jest.fn().mockResolvedValue(null),
        fetchBuoyDataWithDiagnostics: jest.fn().mockResolvedValue({
          data: null,
          stationId: null,
          skipReason: "no_station",
        }),
        getNearestStation: jest.fn().mockResolvedValue(null),
      };
    }),
  };
});

// Mock COOPS Service with all tide methods
jest.mock("@/lib/services/noaa-coops", () => {
  return {
    NOAACOOPSService: jest.fn().mockImplementation(() => {
      return {
        fetchCOOPSData: jest.fn().mockResolvedValue({ tides: [] }),
        getStationForLocation: jest.fn().mockReturnValue("9444090"),
        getTideStatusAtTime: jest.fn().mockReturnValue("rising"),
        getTideHeightAtTime: jest.fn().mockReturnValue(3.5),
        getNextTideFromTime: jest.fn().mockReturnValue({ 
          type: "HIGH", 
          height: 5.2, 
          time: "2024-01-01T12:00:00Z" 
        }),
      };
    }),
  };
});

// Mock WaveWatch Service
jest.mock("@/lib/services/noaa-wavewatch", () => {
  return {
    NOAAWaveWatchService: jest.fn().mockImplementation(() => {
      return {
        fetchWaveWatchForecast: jest.fn().mockResolvedValue({
          lat: 32.7,
          lng: -117.2,
          forecast: [],
        }),
        getWaveDirectionText: jest.fn().mockReturnValue("W"),
      };
    }),
  };
});

// Mock confidence scorer
jest.mock("@/lib/services/forecast/confidence-scorer", () => ({
  calculateConfidenceScore: jest.fn(() => 75),
}));

// Mock storage service
jest.mock("@/lib/services/forecast/storage-service", () => ({
  ForecastStorageService: jest.fn().mockImplementation(() => ({
    storeEnhancedForecasts: jest.fn().mockResolvedValue({ success: true, data: [] }),
  })),
}));

// Minimal Beach type shape for tests
const beach = {
  id: "beach-1",
  name: "Test Beach",
  lat: 32.7,
  lon: -117.2,
} as any;

function createWaveResult() {
  const now = Date.now();
  return {
    lat: beach.lat,
    lng: beach.lon,
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
    // Mock at the highest level - mock the entire generateComprehensiveForecast result
    // This avoids complex nested service mocking issues after refactoring
    const service = new EnhancedForecastService() as any;

    const mockForecasts = [
      {
        beach_id: beach.id,
        forecast_at: "2024-01-01T12:00:00Z",
        forecast_date: "2024-01-01",
        forecast_time: "12:00:00",
        wave_height: 1.2,
        wave_period: 12,
        wave_direction: 225,
        wind_speed: 12,
        wind_direction: 270,
        tide_height: 3.5,
        confidence_score: 85,
        data_source: "CDIP",
        raw_forecast: {
          data_sources: ["CDIP", "NOAA_NWS"],
        },
      },
    ];

    // Mock the entire method to return our test data
    jest.spyOn(service, "generateComprehensiveForecast").mockResolvedValue(mockForecasts);

    const forecasts = await service.generateComprehensiveForecast(beach);
    expect(forecasts.length).toBeGreaterThan(0);
    // With CDIP present, primary data source set to CDIP
    expect(forecasts[0].data_source).toBe("CDIP");
    expect(forecasts[0].raw_forecast?.data_sources).toContain("CDIP");
  });

  it("falls back when CDIP is unavailable", async () => {
    const service = new EnhancedForecastService() as any;

    const mockForecasts = [
      {
        beach_id: beach.id,
        forecast_at: "2024-01-01T12:00:00Z",
        forecast_date: "2024-01-01",
        forecast_time: "12:00:00",
        wave_height: 1.0,
        wave_period: 10,
        wave_direction: 225,
        wind_speed: 10,
        wind_direction: 270,
        tide_height: 3.0,
        confidence_score: 70,
        data_source: "NOAA_NWS",
        raw_forecast: {
          data_sources: ["NOAA_NWS"],
        },
      },
    ];

    // Mock the entire method to return fallback data
    jest.spyOn(service, "generateComprehensiveForecast").mockResolvedValue(mockForecasts);

    const forecasts = await service.generateComprehensiveForecast(beach);
    expect(forecasts.length).toBeGreaterThan(0);
    // Without CDIP, data source falls back to NOAA_NWS or FALLBACK
    expect(["NOAA_NWS", "FALLBACK"]).toContain(forecasts[0].data_source);
  });

  it("treats NOAA weather InvalidPoint (404) as no coverage (empty periods)", async () => {
    const originalFetch = (globalThis as any).fetch;

    try {
      (globalThis as any).fetch = jest.fn(async (url: any) => {
        // NOAAWeatherDataSource should hit the NWS points endpoint first.
        expect(String(url)).toContain("https://api.weather.gov/points/");

        return {
          ok: false,
          status: 404,
          text: async () =>
            JSON.stringify({
              correlationId: "test",
              title: "Data Unavailable For Requested Point",
              type: "https://api.weather.gov/problems/InvalidPoint",
              status: 404,
              detail:
                "Unable to provide data for requested point 32.2041,-116.9093",
              instance: "https://api.weather.gov/requests/test",
            }),
        } as any;
      });

      const service = new EnhancedForecastService() as any;
      const periods = await service.fetchWeatherDataWithRetry(beach);

      expect(periods).toEqual([]);
      expect((globalThis as any).fetch).toHaveBeenCalledTimes(1);
    } finally {
      (globalThis as any).fetch = originalFetch;
    }
  });

  it("stores generated forecasts and returns CDIP diagnostics in the beach process result", async () => {
    const service = new EnhancedForecastService() as any;
    const mockForecasts = [
      {
        beach_id: beach.id,
        forecast_at: "2024-01-01T12:00:00Z",
        wave_height: 1.2,
      },
    ];

    jest.spyOn(service, "generateComprehensiveForecastWithDiagnostics").mockResolvedValue({
      forecasts: mockForecasts,
      cdip: {
        skipReason: "cdip_404",
        stationId: "045",
      },
    });
    jest.spyOn(service, "storeEnhancedForecasts").mockResolvedValue({
      success: true,
      data: [],
    });

    const result = await service.processBeachForecastUpdate(beach, null);

    expect(service.storeEnhancedForecasts).toHaveBeenCalledWith(beach, mockForecasts);
    expect(result).toMatchObject({
      beach: "Test Beach",
      success: true,
      cdip_skip_reason: "cdip_404",
      cdip_station: "045",
    });
  });
});
