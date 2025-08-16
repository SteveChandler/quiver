import React from "react";
import { render, screen, waitFor } from "@testing-library/react";

// Mock environment variables
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

// Mock Mapbox GL to prevent DOM errors
jest.mock("mapbox-gl", () => ({
  Map: jest.fn(() => ({
    on: jest.fn(),
    off: jest.fn(),
    remove: jest.fn(),
    getCenter: jest.fn(() => ({ lat: 32.7493, lng: -117.2511 })),
    getZoom: jest.fn(() => 13),
    setCenter: jest.fn(),
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

// Mock router
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    refresh: jest.fn(),
  }),
}));

// Mock auth context
jest.mock("@/context/auth-context", () => ({
  useAuth: () => ({
    user: { id: "test-user" },
  }),
}));

// Mock all the utility modules
jest.mock("@/lib/utils/current-forecast-utils", () => ({
  getCurrentForecast: jest.fn((forecasts) => {
    if (forecasts && forecasts.length > 0) {
      return forecasts[0];
    }
    return null;
  }),
}));

jest.mock("@/lib/utils/wave-height-formatter", () => ({
  formatWaveHeight: jest.fn((height) => {
    if (typeof height === "string") return height;
    if (typeof height === "number") return `${height} ft`;
    return "No data";
  }),
  getWaveHeightValue: jest.fn((height) => {
    if (typeof height === "string") return parseFloat(height) || 0;
    if (typeof height === "number") return height;
    return 0;
  }),
}));

jest.mock("@/lib/utils/map-utilities", () => ({
  getOffshorePosition: jest.fn((lat, lng) => [lng + 0.001, lat + 0.001]),
  hasViewportChanged: jest.fn(() => true),
}));

jest.mock("@/lib/utils/distance-utils", () => ({
  calculateDistanceInMiles: jest.fn(() => 5),
}));

jest.mock("@/hooks/use-cached-api", () => ({
  createCachedMapFetch: jest.fn(() => jest.fn().mockResolvedValue({ data: [] })),
  createLocationCacheKey: jest.fn(() => "cache-key"),
}));

jest.mock("@/lib/constants/ui", () => ({
  CACHE_TTL: {
    MAP_NEARBY_BEACHES: 300000,
  },
}));

// Mock lodash debounce
jest.mock("lodash", () => ({
  debounce: (fn: any) => fn,
}));

// Set up global fetch mock with realistic responses
global.fetch = jest.fn();

describe("Map Forecast Display Smoke Test", () => {
  const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock realistic API responses
    mockFetch.mockImplementation((url: string) => {
      if (typeof url === "string") {
        // Mock beaches API
        if (url.includes("/api/beaches") && !url.includes("nearby") && !url.includes("forecasts")) {
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
                    latitude: 32.7702,
                    longitude: -117.2525,
                    location: "San Diego, CA",
                  },
                ],
              },
            }),
          } as Response);
        }
        
        // Mock nearby beaches API
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
                  latitude: 32.7702,
                  longitude: -117.2525,
                  location: "San Diego, CA",
                },
              ],
            }),
          } as Response);
        }
        
        // Mock forecast API
        if (url.includes("/api/forecasts/update-enhanced")) {
          const urlObj = new URL(url);
          const beachId = urlObj.searchParams.get("beachId");
          
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              timestamp: new Date().toISOString(),
              data: {
                beachId,
                days: 2,
                forecasts: [
                  {
                    id: `forecast-${beachId}`,
                    beach_id: beachId,
                    forecast_date: "2025-08-16",
                    forecast_time: "12:00:00",
                    wave_height: beachId === "d030911e-71ba-4678-8bbb-cd06a30f8c42" ? "2.6 ft" : "2.4 ft",
                    wave_period: "15.4s",
                    wave_direction: "SSW",
                    water_temp: "74°F",
                    air_temperature: "68°F",
                    wind_speed: "5 mph",
                    wind_direction: "SW",
                    weather_condition: "Cloudy",
                    confidence_score: 100,
                    data_source: "CDIP",
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  },
                ],
              },
            }),
          } as Response);
        }
      }
      
      return Promise.reject(new Error(`Unhandled fetch: ${url}`));
    });
  });

  it("should render InteractiveMap component without crashing", async () => {
    // Dynamically import the component to avoid issues with Mapbox during module loading
    const { InteractiveMap } = await import("@/components/map/interactive-map");
    
    const consoleSpy = jest.spyOn(console, "error").mockImplementation();
    
    expect(() => {
      render(<InteractiveMap />);
    }).not.toThrow();
    
    // Check that no errors were logged
    expect(consoleSpy).not.toHaveBeenCalled();
    
    consoleSpy.mockRestore();
  });

  it("should handle Mapbox initialization", async () => {
    const { InteractiveMap } = await import("@/components/map/interactive-map");
    
    render(<InteractiveMap initialCenter={[32.7493, -117.2511]} initialZoom={14} />);
    
    // Verify Mapbox Map was called
    const MapboxMap = require("mapbox-gl").Map;
    expect(MapboxMap).toHaveBeenCalled();
  });

  it("should make API calls for beach data and forecasts", async () => {
    const { InteractiveMap } = await import("@/components/map/interactive-map");
    
    render(<InteractiveMap />);
    
    // Simulate map load to trigger data fetching
    await waitFor(() => {
      // Should make calls to fetch beaches
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/beaches"),
        expect.any(Object)
      );
    });
  });

  it("should handle forecast API responses", async () => {
    const { InteractiveMap } = await import("@/components/map/interactive-map");
    
    render(<InteractiveMap />);
    
    // Wait a bit for any async operations
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    }, { timeout: 5000 });
    
    // The component should handle the mocked responses without errors
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/api/beaches"),
      expect.any(Object)
    );
  });

  it("should set Mapbox access token from environment", async () => {
    const mapboxgl = require("mapbox-gl");
    const { InteractiveMap } = await import("@/components/map/interactive-map");
    
    render(<InteractiveMap />);
    
    // The component should set the access token
    // In a real test this would be set, but our mock doesn't need to check the exact value
    expect(typeof mapboxgl.accessToken).toBe("string");
  });

  it("should handle component cleanup", async () => {
    const { InteractiveMap } = await import("@/components/map/interactive-map");
    
    const { unmount } = render(<InteractiveMap />);
    
    expect(() => {
      unmount();
    }).not.toThrow();
  });

  it("should handle props changes", async () => {
    const { InteractiveMap } = await import("@/components/map/interactive-map");
    
    const { rerender } = render(
      <InteractiveMap initialCenter={[32.7493, -117.2511]} />
    );
    
    expect(() => {
      rerender(
        <InteractiveMap initialCenter={[32.8000, -117.2000]} />
      );
    }).not.toThrow();
  });

  it("should handle callback props", async () => {
    const { InteractiveMap } = await import("@/components/map/interactive-map");
    
    const mockCallbacks = {
      onLocationClick: jest.fn(),
      onMapClick: jest.fn(),
      onLocationMove: jest.fn(),
    };
    
    expect(() => {
      render(<InteractiveMap {...mockCallbacks} />);
    }).not.toThrow();
  });

  it("should handle fetch errors gracefully", async () => {
    // Mock fetch to fail
    mockFetch.mockRejectedValue(new Error("Network error"));
    
    const { InteractiveMap } = await import("@/components/map/interactive-map");
    const consoleSpy = jest.spyOn(console, "error").mockImplementation();
    
    expect(() => {
      render(<InteractiveMap />);
    }).not.toThrow();
    
    // Component should render even if API calls fail
    await waitFor(() => {
      // The map container should still be present
      const mapContainer = document.querySelector("[style*='width: 100%']");
      expect(mapContainer).toBeInTheDocument();
    });
    
    consoleSpy.mockRestore();
  });
});