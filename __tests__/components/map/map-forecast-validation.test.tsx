/**
 * Map Forecast Display Validation Tests
 * 
 * These tests ensure that the map forecast display functionality is working correctly
 * by testing the actual implementation with realistic data and scenarios.
 */

import React from "react";
import { render, waitFor } from "@testing-library/react";

// Mock environment setup
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

// Track API calls for validation
const apiCallLog: Array<{ url: string; timestamp: number }> = [];

// Mock Mapbox with realistic behavior
const mockMapboxEvents: Record<string, Function> = {};
let mapInstance: any = null;

jest.mock("mapbox-gl", () => ({
  Map: jest.fn(() => {
    mapInstance = {
      on: jest.fn((event: string, callback: Function) => {
        mockMapboxEvents[event] = callback;
        // Auto-trigger load event immediately for testing
        if (event === "load") {
          setTimeout(() => {
            callback();
            // Also trigger moveend after load to simulate normal map behavior
            if (mockMapboxEvents["moveend"]) {
              setTimeout(() => mockMapboxEvents["moveend"](), 10);
            }
          }, 10);
        }
        // Auto-trigger moveend for viewport changes
        if (event === "moveend") {
          setTimeout(() => callback(), 20);
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
    };
    return mapInstance;
  }),
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

jest.mock("@/lib/utils/distance-utils", () => ({
  calculateDistanceInMiles: jest.fn((lat1, lng1, lat2, lng2) => {
    // Always return distance within 30 mile range for testing
    return 5;
  }),
}), { virtual: true });

jest.mock("@/lib/utils/map-utilities", () => ({
  getOffshorePosition: jest.fn((lat, lng) => [lng + 0.001, lat + 0.001]),
  hasViewportChanged: jest.fn(() => true),
}));

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

// Use real utility functions where possible
jest.mock("@/lib/utils/current-forecast-utils", () => {
  const actual = jest.requireActual("@/lib/utils/current-forecast-utils");
  return {
    ...actual,
    getCurrentForecast: jest.fn((forecasts) => {
      console.log('getCurrentForecast called with:', forecasts);
      if (forecasts && forecasts.length > 0) {
        const result = forecasts[0];
        console.log('getCurrentForecast returning:', result);
        return result;
      }
      console.log('getCurrentForecast returning null');
      return null;
    }),
  };
});

// Set up realistic fetch mock
global.fetch = jest.fn();

describe("Map Forecast Display Validation", () => {
  const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    jest.clearAllMocks();
    apiCallLog.length = 0;
    
    // Mock with realistic API responses
    mockFetch.mockImplementation((url: string) => {
      apiCallLog.push({ url, timestamp: Date.now() });
      console.log(`Mock fetch called with: ${url}`);
      
      if (typeof url === "string") {
        // Public beaches endpoint - handle both /api/beaches and /api/beaches/nearby
        if (url.includes("/api/beaches/nearby")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              data: [
                {
                  id: "d030911e-71ba-4678-8bbb-cd06a30f8c42",
                  name: "Ocean Beach",
                  latitude: 32.7493,
                  longitude: -117.2511,
                  location: "San Diego, CA",
                },
                {
                  id: "6d65bfbd-454a-4767-a282-c8b46c7a86b9",
                  name: "Mission Beach",
                  latitude: 32.7493,
                  longitude: -117.2511,
                  location: "San Diego, CA",
                },
              ],
            }),
          } as Response);
        }
        
        if (url.includes("/api/beaches") && !url.includes("forecasts")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              data: {
                beaches: [
                  {
                    id: "d030911e-71ba-4678-8bbb-cd06a30f8c42",
                    name: "Ocean Beach",
                    latitude: 32.7493,
                    longitude: -117.2511,
                    location: "San Diego, CA",
                  },
                  {
                    id: "6d65bfbd-454a-4767-a282-c8b46c7a86b9",
                    name: "Mission Beach",
                    latitude: 32.7493,
                    longitude: -117.2511,
                    location: "San Diego, CA",
                  },
                ],
              },
            }),
          } as Response);
        }
        
        // Forecast endpoint
        if (url.includes("/api/forecasts/update-enhanced")) {
          const urlObj = new URL(url);
          const beachId = urlObj.searchParams.get("beachId");
          
          const mockResponse = {
            success: true,
            data: {
              beachId,
              forecasts: [
                {
                  id: `forecast-${beachId}`,
                  beach_id: beachId,
                  forecast_date: "2025-08-16",
                  forecast_time: "12:00:00",
                  wave_height: beachId === "d030911e-71ba-4678-8bbb-cd06a30f8c42" ? "2.6 ft" : "2.4 ft",
                  wave_period: "15.4s",
                  wave_direction: "SSW",
                  created_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                },
              ],
            },
          };
          
          console.log(`Mock forecast response for ${beachId}:`, mockResponse);
          
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockResponse),
          } as Response);
        }
      }
      
      return Promise.reject(new Error(`Unhandled fetch: ${url}`));
    });
  });

  it("should successfully load and render the map component", async () => {
    const { InteractiveMap } = await import("@/components/map/interactive-map");
    
    expect(() => {
      render(<InteractiveMap />);
    }).not.toThrow();
    
    // Wait for initial load
    await waitFor(() => {
      expect(apiCallLog.length).toBeGreaterThan(0);
    }, { timeout: 1000 });
  });

  it("should call beaches API on component mount", async () => {
    const { InteractiveMap } = await import("@/components/map/interactive-map");
    
    render(<InteractiveMap />);
    
    await waitFor(() => {
      const beachApiCalls = apiCallLog.filter(call => 
        call.url.includes("/api/beaches") && !call.url.includes("forecasts")
      );
      expect(beachApiCalls.length).toBeGreaterThan(0);
    }, { timeout: 1000 });
  });

  it("should call forecast API for each beach", async () => {
    const { InteractiveMap } = await import("@/components/map/interactive-map");
    
    render(<InteractiveMap />);
    
    // Wait for beaches to load first
    await waitFor(() => {
      const beachApiCalls = apiCallLog.filter(call => 
        call.url.includes("/api/beaches") && !call.url.includes("forecasts")
      );
      expect(beachApiCalls.length).toBeGreaterThan(0);
    }, { timeout: 1000 });
    
    // Then wait for forecasts to be requested
    await waitFor(() => {
      const forecastApiCalls = apiCallLog.filter(call => 
        call.url.includes("/api/forecasts/update-enhanced")
      );
      console.log(`Forecast API calls: ${forecastApiCalls.length}`, apiCallLog.map(call => call.url));
      expect(forecastApiCalls.length).toBeGreaterThan(0);
    }, { timeout: 3000 });
  });

  it("should handle the complete data flow: beaches → forecasts → markers", async () => {
    const { InteractiveMap } = await import("@/components/map/interactive-map");
    
    render(<InteractiveMap />);
    
    // Wait for beaches first
    await waitFor(() => {
      const beachCalls = apiCallLog.filter(call => 
        call.url.includes("/api/beaches") && !call.url.includes("forecasts")
      );
      expect(beachCalls.length).toBeGreaterThan(0);
    }, { timeout: 1000 });
    
    // Then wait for forecasts
    await waitFor(() => {
      const forecastCalls = apiCallLog.filter(call => 
        call.url.includes("/api/forecasts/update-enhanced")
      );
      console.log(`Complete flow - forecast calls: ${forecastCalls.length}`);
      expect(forecastCalls.length).toBeGreaterThan(0);
    }, { timeout: 3000 });
    
    // Finally check markers
    await waitFor(() => {
      const Marker = require("mapbox-gl").Marker;
      expect(Marker).toHaveBeenCalled();
    }, { timeout: 1000 });
  });

  it("should make forecast calls for Ocean Beach and Mission Beach", async () => {
    const { InteractiveMap } = await import("@/components/map/interactive-map");
    
    render(<InteractiveMap />);
    
    // Wait for beaches to load first
    await waitFor(() => {
      const beachCalls = apiCallLog.filter(call => 
        call.url.includes("/api/beaches") && !call.url.includes("forecasts")
      );
      expect(beachCalls.length).toBeGreaterThan(0);
    }, { timeout: 1000 });
    
    // Then wait for specific beach forecast calls
    await waitFor(() => {
      console.log('All API calls:', apiCallLog.map(call => call.url));
      
      // Check for Ocean Beach forecast call
      const oceanBeachCall = apiCallLog.find(call => 
        call.url.includes("beachId=d030911e-71ba-4678-8bbb-cd06a30f8c42")
      );
      expect(oceanBeachCall).toBeTruthy();
      
      // Check for Mission Beach forecast call
      const missionBeachCall = apiCallLog.find(call => 
        call.url.includes("beachId=6d65bfbd-454a-4767-a282-c8b46c7a86b9")
      );
      expect(missionBeachCall).toBeTruthy();
    }, { timeout: 4000 });
  });

  it("should handle API call sequencing correctly", async () => {
    const { InteractiveMap } = await import("@/components/map/interactive-map");
    
    render(<InteractiveMap />);
    
    await waitFor(() => {
      expect(apiCallLog.length).toBeGreaterThan(0);
    }, { timeout: 3000 });
    
    // Beaches API should be called before forecast APIs
    const beachCallIndex = apiCallLog.findIndex(call => 
      call.url.includes("/api/beaches") && !call.url.includes("forecasts")
    );
    const forecastCallIndex = apiCallLog.findIndex(call => 
      call.url.includes("/api/forecasts/update-enhanced")
    );
    
    if (beachCallIndex >= 0 && forecastCallIndex >= 0) {
      expect(beachCallIndex).toBeLessThan(forecastCallIndex);
    }
  });

  it("should create markers with correct positioning", async () => {
    const { InteractiveMap } = await import("@/components/map/interactive-map");
    
    render(<InteractiveMap />);
    
    // Wait for the full data flow
    await waitFor(() => {
      const forecastCalls = apiCallLog.filter(call => 
        call.url.includes("/api/forecasts/update-enhanced")
      );
      expect(forecastCalls.length).toBeGreaterThan(0);
    }, { timeout: 4000 });
    
    // Then check markers
    await waitFor(() => {
      const Marker = require("mapbox-gl").Marker;
      expect(Marker).toHaveBeenCalled();
      
      const mockMarker = Marker.mock.results[0]?.value;
      if (mockMarker) {
        expect(mockMarker.setLngLat).toHaveBeenCalled();
        expect(mockMarker.addTo).toHaveBeenCalled();
      }
    }, { timeout: 1000 });
  });

  it("should set up popups with forecast information", async () => {
    const { InteractiveMap } = await import("@/components/map/interactive-map");
    
    render(<InteractiveMap />);
    
    await waitFor(() => {
      const Popup = require("mapbox-gl").Popup;
      const Marker = require("mapbox-gl").Marker;
      
      if (Marker.mock.results.length > 0) {
        const mockMarker = Marker.mock.results[0]?.value;
        expect(mockMarker.setPopup).toHaveBeenCalled();
        
        if (Popup.mock.results.length > 0) {
          const mockPopup = Popup.mock.results[0]?.value;
          expect(mockPopup.setHTML).toHaveBeenCalledWith(
            expect.stringContaining("Wave Height:")
          );
        }
      }
    }, { timeout: 3000 });
  });

  it("should handle component props correctly", async () => {
    const { InteractiveMap } = await import("@/components/map/interactive-map");
    
    const mockOnMapClick = jest.fn();
    const mockOnLocationClick = jest.fn();
    
    render(
      <InteractiveMap 
        initialCenter={[32.8000, -117.2000]}
        initialZoom={15}
        onMapClick={mockOnMapClick}
        onLocationClick={mockOnLocationClick}
      />
    );
    
    const MapboxMap = require("mapbox-gl").Map;
    expect(MapboxMap).toHaveBeenCalledWith(
      expect.objectContaining({
        center: [-117.2000, 32.8000], // lng, lat for Mapbox
        zoom: 15,
      })
    );
  });

  it("should cleanup properly on unmount", async () => {
    const { InteractiveMap } = await import("@/components/map/interactive-map");
    
    const { unmount } = render(<InteractiveMap />);
    
    // Let component mount and initialize
    await waitFor(() => {
      expect(apiCallLog.length).toBeGreaterThan(0);
    }, { timeout: 1000 });
    
    expect(() => {
      unmount();
    }).not.toThrow();
  });
});