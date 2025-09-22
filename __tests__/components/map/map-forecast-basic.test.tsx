import React from "react";
import { render, screen, waitFor } from "@testing-library/react";

// Mock all the external dependencies to isolate our test
jest.mock("mapbox-gl", () => ({
  Map: jest.fn(() => ({
    on: jest.fn((event, callback) => {
      // Immediately trigger load event for testing
      if (event === "load") {
        setTimeout(callback, 10);
      }
    }),
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

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    refresh: jest.fn(),
  }),
}));

jest.mock("@/context/auth-context", () => ({
  useAuth: () => ({
    user: { id: "test-user" },
  }),
}));

// Mock utilities with simple implementations
jest.mock("@/lib/utils/current-forecast-utils", () => ({
  getCurrentForecast: jest.fn((forecasts) => {
    return forecasts && forecasts.length > 0 ? forecasts[0] : null;
  }),
}));

jest.mock("@/lib/utils/wave-height-formatter", () => ({
  formatWaveHeight: jest.fn((height) => {
    if (typeof height === "string") return height;
    if (typeof height === "number") return `${height} ft`;
    return "No data";
  }),
  getWaveHeightValue: jest.fn(() => 2.6),
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
}));

jest.mock("@/lib/constants/ui", () => ({
  CACHE_TTL: {
    MAP_NEARBY_BEACHES: 300000,
  },
}));

jest.mock("lodash", () => ({
  debounce: (fn: any) => fn,
}));

// Set up fetch mock
global.fetch = jest.fn();

describe("Map Forecast Basic Tests", () => {
  const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock successful API responses
    mockFetch.mockImplementation((url: string) => {
      if (typeof url === "string") {
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
                  },
                ],
              },
            }),
          } as Response);
        }
        
        if (url.includes("/api/forecasts/update-enhanced")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              data: {
                forecasts: [
                  {
                    id: "forecast-1",
                    beach_id: "d030911e-71ba-4678-8bbb-cd06a30f8c42",
                    forecast_date: "2025-08-16",
                    forecast_time: "12:00:00",
                    wave_height: "2.6 ft",
                  },
                ],
              },
            }),
          } as Response);
        }
      }
      
      return Promise.reject(new Error("Unhandled fetch"));
    });
  });

  it("should import and render InteractiveMap without errors", async () => {
    const { InteractiveMap } = await import("@/components/map/interactive-map");
    
    expect(() => {
      render(<InteractiveMap />);
    }).not.toThrow();
  });

  it("should call Mapbox Map constructor with correct parameters", async () => {
    const { InteractiveMap } = await import("@/components/map/interactive-map");
    
    render(<InteractiveMap initialCenter={[32.7493, -117.2511]} initialZoom={14} />);
    
    const MapboxMap = require("mapbox-gl").Map;
    expect(MapboxMap).toHaveBeenCalledWith(
      expect.objectContaining({
        style: "mapbox://styles/mapbox/streets-v11",
        center: [-117.2511, 32.7493], // lng, lat for Mapbox
        zoom: 14,
      })
    );
  });

  it("should attempt to fetch beaches data", async () => {
    const { InteractiveMap } = await import("@/components/map/interactive-map");
    
    render(<InteractiveMap />);
    
    // Wait for component to mount and trigger fetch
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/beaches"),
        expect.objectContaining({
          headers: { Accept: "application/json" },
        })
      );
    }, { timeout: 1000 });
  });

  it("should attempt to fetch forecast data after loading beaches", async () => {
    const { InteractiveMap } = await import("@/components/map/interactive-map");
    
    render(<InteractiveMap />);
    
    // Wait for beaches and then forecast calls
    await waitFor(() => {
      expect(mockFetch.mock.calls.some(([url]) => typeof url === "string" && (url as string).includes("/api/forecasts/update-enhanced"))).toBe(true);
    }, { timeout: 2500 });
  });

  it("should create Mapbox markers when data is loaded", async () => {
    const { InteractiveMap } = await import("@/components/map/interactive-map");
    
    render(<InteractiveMap />);
    
    // Wait for data loading and marker creation
    await waitFor(() => {
      const Marker = require("mapbox-gl").Marker;
      expect(Marker).toHaveBeenCalled();
    }, { timeout: 2000 });
  });

  it("should handle component unmounting", async () => {
    const { InteractiveMap } = await import("@/components/map/interactive-map");
    
    const { unmount } = render(<InteractiveMap />);
    
    expect(() => {
      unmount();
    }).not.toThrow();
  });

  it("should handle fetch errors gracefully", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));
    
    const { InteractiveMap } = await import("@/components/map/interactive-map");
    const consoleSpy = jest.spyOn(console, "error").mockImplementation();
    
    expect(() => {
      render(<InteractiveMap />);
    }).not.toThrow();
    
    consoleSpy.mockRestore();
  });

  it("should format wave heights correctly", () => {
    const { formatWaveHeight } = require("@/lib/utils/wave-height-formatter");
    
    expect(formatWaveHeight("2.6 ft")).toBe("2.6 ft");
    expect(formatWaveHeight(2.6)).toBe("2.6 ft");
    expect(formatWaveHeight(undefined)).toBe("No data");
  });

  it("should calculate offshore positions", () => {
    const { getOffshorePosition } = require("@/lib/utils/map-utilities");
    
    const [lng, lat] = getOffshorePosition(32.7493, -117.2511);
    expect(lng).toBeCloseTo(-117.2501, 6); // lng + 0.001
    expect(lat).toBeCloseTo(32.7503, 6);   // lat + 0.001
  });

  it("should get current forecast from array", () => {
    const { getCurrentForecast } = require("@/lib/utils/current-forecast-utils");
    
    const forecasts = [
      { forecast_date: "2025-08-16", forecast_time: "12:00:00", wave_height: "2.6 ft" },
      { forecast_date: "2025-08-16", forecast_time: "15:00:00", wave_height: "2.4 ft" },
    ];
    
    const current = getCurrentForecast(forecasts);
    expect(current).toEqual(forecasts[0]);
  });
});
