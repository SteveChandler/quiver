import React from "react";
import { render, waitFor } from "@testing-library/react";

// Mock environment
const originalEnv = process.env;
beforeAll(() => {
  process.env = {
    ...originalEnv,
    NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN: "pk.test123",
  };
});

afterAll(() => {
  process.env = originalEnv;
});

// Complete Mapbox mock
jest.mock("mapbox-gl", () => ({
  Map: jest.fn(() => ({
    on: jest.fn((event: string, callback: Function) => {
      if (event === "load") {
        setTimeout(() => callback(), 10);
      }
    }),
    off: jest.fn(),
    remove: jest.fn(),
    getCenter: jest.fn(() => ({ lat: 32.7493, lng: -117.2511 })),
    getZoom: jest.fn(() => 13),
    setCenter: jest.fn(),
    getBounds: jest.fn(() => ({
      getNorthEast: () => ({ lat: 32.8, lng: -117.2 }),
      getSouthWest: () => ({ lat: 32.7, lng: -117.3 }),
    })),
  })),
  Marker: jest.fn(() => ({
    setLngLat: jest.fn().mockReturnThis(),
    setPopup: jest.fn().mockReturnThis(),
    addTo: jest.fn().mockReturnThis(),
    remove: jest.fn(),
  })),
  Popup: jest.fn(() => ({
    setLngLat: jest.fn().mockReturnThis(),
    setHTML: jest.fn().mockReturnThis(),
    addTo: jest.fn().mockReturnThis(),
    remove: jest.fn(),
  })),
  accessToken: "",
}));

// Mock dependencies
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}));

jest.mock("@/context/auth-context", () => ({
  useAuth: () => ({ user: { id: "test-user" } }),
}));

// Use the actual implementation for utilities to see what's happening
const mockCurrentForecast = jest.fn((forecasts) => {
  console.log('getCurrentForecast mock called with:', forecasts);
  if (forecasts && forecasts.length > 0) {
    return forecasts[0];
  }
  return null;
});

jest.mock("@/lib/utils/current-forecast-utils", () => ({
  getCurrentForecast: mockCurrentForecast,
}));

jest.mock("@/lib/utils/wave-height-formatter", () => ({
  formatWaveHeight: jest.fn((height) => height),
  getWaveHeightValue: jest.fn(() => 2.6),
}));

jest.mock("@/lib/utils/map-utilities", () => ({
  getOffshorePosition: jest.fn((lat, lng) => [lng + 0.001, lat + 0.001]),
  hasViewportChanged: jest.fn(() => true),
}));

// Mock distance utils to work properly with dynamic import
const mockCalculateDistance = jest.fn((lat1, lng1, lat2, lng2) => {
  console.log('calculateDistanceInMiles called:', { lat1, lng1, lat2, lng2 });
  return 5; // Always return a value within 30 miles
});

jest.mock("@/lib/utils/distance-utils", () => ({
  calculateDistanceInMiles: mockCalculateDistance,
}), { virtual: true });

jest.mock("@/hooks/use-cached-api", () => ({
  createCachedMapFetch: jest.fn(() => jest.fn().mockResolvedValue({ data: [] })),
  createLocationCacheKey: jest.fn(() => "cache-key"),
}));

jest.mock("@/lib/constants/ui", () => ({
  CACHE_TTL: { MAP_NEARBY_BEACHES: 300000 },
}));

jest.mock("lodash", () => ({
  debounce: (fn: any) => fn,
}));

const apiCalls: string[] = [];
global.fetch = jest.fn();

describe("Map Forecast Display - Working Implementation Tests", () => {
  const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    jest.clearAllMocks();
    apiCalls.length = 0;
    mockCurrentForecast.mockClear();
    
    mockFetch.mockImplementation((url: string) => {
      apiCalls.push(url);
      console.log('FETCH:', url);
      
      if (url.includes("/api/beaches") && !url.includes("forecasts")) {
        console.log('RETURNING BEACHES');
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            beaches: [
              {
                id: "test-beach-1",
                name: "Test Beach",
                latitude: 32.7493,
                longitude: -117.2511,
              },
            ],
          }),
        } as Response);
      }
      
      if (url.includes("/api/forecasts/update-enhanced")) {
        console.log('RETURNING FORECAST');
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: {
              forecasts: [
                {
                  id: "test-forecast",
                  beach_id: "test-beach-1",
                  wave_height: "2.5 ft",
                  forecast_date: "2025-08-16",
                  forecast_time: "12:00:00",
                },
              ],
            },
          }),
        } as Response);
      }
      
      return Promise.reject(new Error(`Unhandled: ${url}`));
    });
  });

  it("should render the InteractiveMap component without errors", async () => {
    const { InteractiveMap } = await import("@/components/map/interactive-map");
    
    expect(() => {
      render(<InteractiveMap />);
    }).not.toThrow();
  });

  it("should make beaches API calls on component mount", async () => {
    const { InteractiveMap } = await import("@/components/map/interactive-map");
    
    render(<InteractiveMap />);
    
    await waitFor(() => {
      const beachCalls = apiCalls.filter(call => call.includes("/api/beaches"));
      expect(beachCalls.length).toBeGreaterThan(0);
    }, { timeout: 2000 });
  });

  it("should call forecast API for each beach after loading beaches", async () => {
    const { InteractiveMap } = await import("@/components/map/interactive-map");
    
    render(<InteractiveMap />);
    
    // Wait for beaches to load first
    await waitFor(() => {
      const beachCalls = apiCalls.filter(call => call.includes("/api/beaches"));
      expect(beachCalls.length).toBeGreaterThan(0);
    }, { timeout: 2000 });
    
    // Then wait for forecast calls
    await waitFor(() => {
      const forecastCalls = apiCalls.filter(call => call.includes("/api/forecasts"));
      expect(forecastCalls.length).toBeGreaterThan(0);
    }, { timeout: 3000 });
  });

  it("should process forecast responses with getCurrentForecast utility", async () => {
    const { InteractiveMap } = await import("@/components/map/interactive-map");
    
    render(<InteractiveMap />);
    
    await waitFor(() => {
      expect(mockCurrentForecast.mock.calls.length).toBeGreaterThan(0);
    }, { timeout: 4000 });

    // Verify the forecast processing was called with correct data structure
    const forecastCalls = mockCurrentForecast.mock.calls;
    const firstCall = forecastCalls[0];
    expect(firstCall[0]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          wave_height: expect.any(String),
          beach_id: expect.any(String),
        })
      ])
    );
  });

  it("should create markers on the map after processing forecasts", async () => {
    const { InteractiveMap } = await import("@/components/map/interactive-map");
    
    render(<InteractiveMap />);
    
    await waitFor(() => {
      const Marker = require("mapbox-gl").Marker;
      expect(Marker).toHaveBeenCalled();
    }, { timeout: 4000 });
  });

  it("should handle the complete data flow: beaches → distance calculation → forecasts → markers", async () => {
    const { InteractiveMap } = await import("@/components/map/interactive-map");
    
    render(<InteractiveMap />);
    
    // Wait for complete flow
    await waitFor(() => {
      expect(apiCalls.length).toBeGreaterThan(0);
      expect(mockCalculateDistance.mock.calls.length).toBeGreaterThan(0);
      expect(mockCurrentForecast.mock.calls.length).toBeGreaterThan(0);
    }, { timeout: 4000 });
    
    // Verify we had both types of API calls
    const beachCalls = apiCalls.filter(call => call.includes("/api/beaches"));
    const forecastCalls = apiCalls.filter(call => call.includes("/api/forecasts"));
    
    expect(beachCalls.length).toBeGreaterThan(0);
    expect(forecastCalls.length).toBeGreaterThan(0);
  });
});