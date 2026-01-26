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

// Simple Mapbox mock
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
    flyTo: jest.fn(),
    getBounds: jest.fn(() => ({
      getNorthEast: () => ({ lat: 32.8, lng: -117.2 }),
      getSouthWest: () => ({ lat: 32.7, lng: -117.3 }),
      getWest: () => -117.3,
      getSouth: () => 32.7,
      getEast: () => -117.2,
      getNorth: () => 32.8,
    })),
    getCanvasContainer: jest.fn(() => document.createElement("div")),
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

// Mock other dependencies
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}));

jest.mock("@/context/auth-context", () => ({
  useAuth: () => ({ user: { id: "test-user" } }),
}));

jest.mock("@/lib/utils/current-forecast-utils", () => ({
  getCurrentForecast: jest.fn((forecasts) => {
    if (forecasts && forecasts.length > 0) {
      return forecasts[0];
    }
    return null;
  }),
}));

jest.mock("@/lib/utils/wave-height-formatter", () => ({
  formatWaveHeight: jest.fn((height) => height),
  getWaveHeightValue: jest.fn(() => 2.6),
}));

jest.mock("@/lib/utils/map-utilities", () => ({
  getOffshorePosition: jest.fn((lat, lng) => [lng + 0.001, lat + 0.001]),
  hasViewportChanged: jest.fn(() => true),
}));

jest.mock("@/lib/utils/distance-utils", () => ({
  calculateDistanceInMiles: jest.fn((lat1, lng1, lat2, lng2) => {
    console.log('calculateDistanceInMiles called with:', { lat1, lng1, lat2, lng2 });
    const distance = 5; // Mock distance within 30 mile limit
    console.log('calculateDistanceInMiles returning:', distance);
    return distance;
  }),
}));

jest.mock("@/hooks/use-cached-api", () => ({
  createCachedMapFetch: jest.fn(() => jest.fn().mockResolvedValue({ data: [] })),
}));

jest.mock("@/lib/constants/ui", () => ({
  CACHE_TTL: { MAP_NEARBY_BEACHES: 300000 },
  API_BATCH_CONFIG: { BEACH_ID_BATCH_SIZE: 50 },
}));

jest.mock("lodash", () => ({
  debounce: (fn: any) => fn,
}));

// Track API calls
const apiCalls: string[] = [];

// Set up fetch mock
global.fetch = jest.fn();

describe("Simple Map Test", () => {
  const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    jest.clearAllMocks();
    apiCalls.length = 0;
    
    mockFetch.mockImplementation((input: string | URL | Request) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      apiCalls.push(url);
      console.log('MOCK FETCH CALLED:', url);
      
      if (url.includes("/api/beaches/nearby")) {
        console.log('RETURNING NEARBY BEACHES MOCK');
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            data: [
              {
                id: "test-beach-1",
                name: "Test Beach",
                lat: 32.7493,
                lon: -117.2511,
              },
            ],
          }),
        } as Response);
      }
      
      if (url.includes("/api/beaches") && !url.includes("forecasts")) {
        console.log('RETURNING REGULAR BEACHES MOCK');
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            beaches: [
              {
                id: "test-beach-1",
                name: "Test Beach",
                lat: 32.7493,
                lon: -117.2511,
              },
              {
                id: "test-beach-2", 
                name: "Test Beach 2",
                lat: 32.7600,
                lon: -117.2600,
              },
            ]
          }),
        } as Response);
      }
      
      if (url.includes("/api/forecasts/update-enhanced")) {
        console.log('RETURNING FORECAST MOCK');
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
      
      console.log('MOCK FETCH UNHANDLED:', url);
      return Promise.reject(new Error(`Unhandled: ${url}`));
    });
  });

  it("should make API calls and process forecasts", async () => {
    const { InteractiveMap } = await import("@/components/map/interactive-map");
    
    render(<InteractiveMap />);
    
    // Wait for API calls to be made
    await waitFor(() => {
      expect(apiCalls.length).toBeGreaterThan(0);
    }, { timeout: 2000 });
    
    // Check that forecast API was called
    await waitFor(() => {
      const forecastCalls = apiCalls.filter(call => call.includes("forecasts"));
      expect(forecastCalls.length).toBeGreaterThan(0);
    }, { timeout: 3000 });
    
    console.log("All API calls made:", apiCalls);
  });
});
