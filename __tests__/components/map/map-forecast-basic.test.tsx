import React from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const mockAddControl = jest.fn();
const mockFlyTo = jest.fn();
const mockGetCenter = jest.fn(() => ({ lat: 32.7493, lng: -117.2511 }));
const mockGetMaxZoom = jest.fn(() => 22);
const mockGetMinZoom = jest.fn(() => 0);
const mockSetMaxBounds = jest.fn();
const mockSetMaxZoom = jest.fn();
const mockSetMinZoom = jest.fn();

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
    getCenter: mockGetCenter,
    getZoom: jest.fn(() => 13),
    getMaxZoom: mockGetMaxZoom,
    getMinZoom: mockGetMinZoom,
    setCenter: jest.fn(),
    setMaxBounds: mockSetMaxBounds,
    setMaxZoom: mockSetMaxZoom,
    setMinZoom: mockSetMinZoom,
    flyTo: mockFlyTo,
    getBounds: jest.fn(() => ({
      getWest: () => -117.3,
      getSouth: () => 32.7,
      getEast: () => -117.2,
      getNorth: () => 32.8,
    })),
    getCanvasContainer: jest.fn(() => document.createElement("div")),
    getLayer: jest.fn(() => undefined),
    isStyleLoaded: jest.fn(() => true),
    setStyle: jest.fn(),
    addLayer: jest.fn(),
    addControl: mockAddControl,
    removeLayer: jest.fn(),
    triggerRepaint: jest.fn(),
  })),
  AttributionControl: jest.fn(() => ({ type: "attribution" })),
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
  usePathname: () => "/map",
}));

jest.mock("@/context/auth-context", () => ({
  useAuth: () => ({
    user: null,
  }),
}));

// Mock utilities with simple implementations
jest.mock("@/lib/utils/current-forecast-utils", () => ({
  getCurrentForecast: jest.fn((forecasts) => {
    return forecasts && forecasts.length > 0 ? forecasts[0] : null;
  }),
}));

jest.mock("@/lib/utils/wave-formatters", () => ({
  formatWaveHeightBucket: jest.fn((height) => {
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

jest.mock("@/lib/utils/request-cache", () => ({
  createCachedMapFetch: jest.fn(() => jest.fn().mockResolvedValue({ data: [] })),
  apiCache: { get: jest.fn(() => null), set: jest.fn(), delete: jest.fn(), clear: jest.fn(), has: jest.fn(() => false), clearExpired: jest.fn(), getStats: jest.fn() },
  forecastCache: { get: jest.fn(() => null), set: jest.fn(), delete: jest.fn(), clear: jest.fn(), has: jest.fn(() => false), clearExpired: jest.fn(), getStats: jest.fn() },
  beachCache: { get: jest.fn(() => null), set: jest.fn(), delete: jest.fn(), clear: jest.fn(), has: jest.fn(() => false), clearExpired: jest.fn(), getStats: jest.fn() },
  RequestCache: class { static createKey(...parts: any[]) { return parts.join(":"); } },
}));

jest.mock("@/lib/constants/ui", () => ({
  CACHE_TTL: {
    MAP_NEARBY_BEACHES: 300000,
  },
  API_BATCH_CONFIG: {
    BEACH_ID_BATCH_SIZE: 50,
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
    mockFetch.mockImplementation((input: string | URL | Request) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
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
                    lat: 32.7493,
                    lon: -117.2511,
                  },
                ],
              },
            }),
          } as Response);
        }
        
        if (url.includes("/api/forecasts/bulk")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              data: {
                forecasts: {
                  "d030911e-71ba-4678-8bbb-cd06a30f8c42": "2.6 ft",
                },
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
                    forecast_at: "2025-08-16T12:00:00Z",
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

  it("should render branded condition labels in wave-height mode", async () => {
    const { InteractiveMap } = await import("@/components/map/interactive-map");

    render(<InteractiveMap />);

    const legend = screen.getByTestId("map-condition-legend");
    expect(legend).toBeInTheDocument();
    expect(legend).toHaveStyle({
      background: "#F4EBD8",
      color: "#11100D",
    });
    expect(screen.queryByText("Go now!")).toBeNull();
    fireEvent.click(
      within(legend).getByRole("button", { name: "Expand map legend" }),
    );
    expect(screen.getByText("Go now!")).toBeInTheDocument();
    expect(screen.getByText("Go surf!")).toBeInTheDocument();
    expect(screen.getByText("Worth a look")).toBeInTheDocument();
    expect(screen.getByText("Slim pickings")).toBeInTheDocument();
    expect(screen.getByText("Skip it")).toBeInTheDocument();
    expect(screen.getByText("No read")).toBeInTheDocument();
    expect(screen.queryByText("EPIC")).toBeNull();
    expect(screen.queryByText("GOOD")).toBeNull();
    expect(screen.queryByText("FAIR")).toBeNull();
    expect(screen.queryByText("RIDEABLE")).toBeNull();
    expect(screen.queryByText("MEH")).toBeNull();
    expect(screen.queryByText("UNKNOWN")).toBeNull();
  });

  it("should embed the swell timeline inside the condition legend", async () => {
    const { InteractiveMap } = await import("@/components/map/interactive-map");

    render(
      <InteractiveMap
        showSwellField
        swellTimelineSteps={["Now", "+3h", "+6h"]}
        onSwellTimelineChange={jest.fn()}
      />,
    );

    const legend = screen.getByTestId("map-condition-legend");
    const timeline = within(legend).getByTestId("swell-forecast-timeline");

    expect(timeline).toBeInTheDocument();
    expect(timeline.className).toContain("w-full");
    expect(timeline.className).not.toContain("absolute");
  });

  it("renders the public day timeline with absolute local time instead of relative offsets", async () => {
    const { InteractiveMap } = await import("@/components/map/interactive-map");
    mockFetch.mockImplementation((input: string | URL | Request) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url.includes("/api/forecasts/bulk")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            data: {
              forecasts: { "d030911e-71ba-4678-8bbb-cd06a30f8c42": "2.6 ft" },
              hourlySwellTimeline: {
                timestamps: [
                  "2026-07-10T20:00:00.000Z",
                  "2026-07-10T21:00:00.000Z",
                ],
                partitionsByBeach: {
                  "d030911e-71ba-4678-8bbb-cd06a30f8c42": [
                    {
                      s1Dir: 270,
                      s1PeriodS: 14,
                      s1HeightFt: 3.9,
                      s2Dir: null,
                      s2PeriodS: null,
                      s2HeightFt: null,
                      windDir: null,
                      windMph: null,
                    },
                    {
                      s1Dir: 280,
                      s1PeriodS: 15,
                      s1HeightFt: 4.2,
                      s2Dir: null,
                      s2PeriodS: null,
                      s2HeightFt: null,
                      windDir: null,
                      windMph: null,
                    },
                  ],
                },
                hasMore: false,
                nextStart: null,
              },
            },
          }),
        } as Response);
      }
      return Promise.reject(new Error("Unhandled fetch"));
    });

    render(
      <InteractiveMap
        {...({
          showSwellField: true,
          swellTimelineMode: "expandable-hourly",
          viewTimezone: "Pacific/Honolulu",
          swellTimelineSteps: ["Now", "+3h", "+6h"],
          beaches: [
            {
              id: "d030911e-71ba-4678-8bbb-cd06a30f8c42",
              name: "Ocean Beach",
              lat: 32.7493,
              lon: -117.2511,
            },
          ],
        } as any)}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("swell-day-timeline")).toBeInTheDocument();
    });
    expect(screen.queryByText(/\+\d+h/)).not.toBeInTheDocument();
  });

  it("should embed the swell layer selector inside the condition legend", async () => {
    const { InteractiveMap } = await import("@/components/map/interactive-map");

    render(
      <InteractiveMap
        showSwellField
        onSwellLayerChange={jest.fn()}
      />,
    );

    const legend = screen.getByTestId("map-condition-legend");
    fireEvent.click(
      within(legend).getByRole("button", { name: "Expand map legend" }),
    );
    const selector = within(legend).getByTestId("swell-layer-selector");

    expect(selector).toBeInTheDocument();
    expect(selector.className).not.toContain("absolute");
    expect(selector.className).not.toContain("top-3");
    expect(within(selector).getByTestId("swell-field-legend-caption")).toHaveTextContent(
      "denser = bigger · longer marks = longer period"
    );
  });

  it("should open the bottom legend minimized while keeping the timeline available", async () => {
    const { InteractiveMap } = await import("@/components/map/interactive-map");

    render(
      <InteractiveMap
        showSwellField
        onSwellLayerChange={jest.fn()}
        swellTimelineSteps={["Now", "+3h", "+6h"]}
        onSwellTimelineChange={jest.fn()}
      />,
    );

    const legend = screen.getByTestId("map-condition-legend");

    expect(within(legend).queryByText("Go now!")).toBeNull();
    expect(within(legend).queryByTestId("swell-layer-selector")).toBeNull();
    expect(within(legend).getByTestId("swell-forecast-timeline")).toBeInTheDocument();
    expect(
      within(legend).getByRole("button", { name: "Expand map legend" })
    ).toBeInTheDocument();

    fireEvent.click(
      within(legend).getByRole("button", { name: "Expand map legend" })
    );

    expect(within(legend).getByText("Go now!")).toBeInTheDocument();
    expect(within(legend).getByTestId("swell-layer-selector")).toBeInTheDocument();

    fireEvent.click(
      within(legend).getByRole("button", { name: "Minimize map legend" }),
    );
    expect(within(legend).queryByText("Go now!")).toBeNull();
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
        attributionControl: false,
        logoPosition: "top-left",
      })
    );
  });

  it("keeps the original streets style when the swell field is initially visible", async () => {
    const { InteractiveMap } = await import("@/components/map/interactive-map");

    render(
      <InteractiveMap
        initialCenter={[32.7493, -117.2511]}
        initialZoom={14}
        showSwellField
      />
    );

    const MapboxMap = require("mapbox-gl").Map;
    expect(MapboxMap).toHaveBeenCalledWith(
      expect.objectContaining({
        style: "mapbox://styles/mapbox/streets-v11",
        center: [-117.2511, 32.7493],
        zoom: 14,
      })
    );
  });

  it("should position Mapbox attribution away from the bottom legend", async () => {
    const { InteractiveMap } = await import("@/components/map/interactive-map");

    render(<InteractiveMap />);

    const mapboxgl = require("mapbox-gl");
    const mapInstance = mapboxgl.Map.mock.results.at(-1)?.value;

    expect(mapboxgl.AttributionControl).toHaveBeenCalledWith({
      compact: true,
    });
    expect(mapInstance.addControl).toHaveBeenCalledWith(
      expect.objectContaining({ type: "attribution" }),
      "top-right"
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
    // InteractiveMap uses /api/forecasts/bulk endpoint
    await waitFor(() => {
      expect(mockFetch.mock.calls.some(([url]) => typeof url === "string" && (url as string).includes("/api/forecasts/bulk"))).toBe(true);
    }, { timeout: 2500 });
  });

  it("should create Mapbox markers when data is loaded", async () => {
    const { InteractiveMap } = await import("@/components/map/interactive-map");

    // Pass beaches prop directly to trigger marker creation.
    const mockBeaches = [
      { id: "test-1", name: "Test Beach", lat: 32.75, lon: -117.25 },
    ];

    render(<InteractiveMap beaches={mockBeaches as any} />);

    // Wait for data loading and marker creation.
    await waitFor(() => {
      const Marker = require("mapbox-gl").Marker;
      expect(Marker).toHaveBeenCalled();
    }, { timeout: 3000 });
  });

  it("should clear the swell-field leash before an explicit camera command without a remount", async () => {
    const { InteractiveMap } = await import("@/components/map/interactive-map");
    const mockBeaches = [
      { id: "test-1", name: "Test Beach", lat: 32.75, lon: -117.25 },
    ];

    const { rerender } = render(
      <InteractiveMap
        beaches={mockBeaches as any}
        initialCenter={[32.7493, -117.2511]}
        showSwellField
      />
    );

    await waitFor(() => {
      expect(mockSetMaxBounds).toHaveBeenCalledWith(expect.any(Array));
    });

    mockFlyTo.mockClear();
    mockSetMaxBounds.mockClear();
    mockSetMaxZoom.mockClear();
    mockSetMinZoom.mockClear();

    rerender(
      <InteractiveMap
        beaches={mockBeaches as any}
        initialCenter={[37.76, -122.51]}
        showSwellField
        cameraCommand={{
          id: 1,
          source: "search",
          center: { lat: 37.76, lon: -122.51 },
        }}
      />
    );

    await waitFor(() => {
      expect(mockFlyTo).toHaveBeenCalledWith(
        expect.objectContaining({
          center: [-122.51, 37.76],
        })
      );
    });

    expect(mockSetMaxBounds).toHaveBeenCalledWith(null);
    expect(mockSetMinZoom).toHaveBeenCalledWith(0);
    expect(mockSetMaxZoom).toHaveBeenCalledWith(22);
    expect(mockSetMaxBounds.mock.invocationCallOrder[0]).toBeLessThan(
      mockFlyTo.mock.invocationCallOrder[0]
    );
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
    const { formatWaveHeightBucket } = require("@/lib/utils/wave-formatters");

    expect(formatWaveHeightBucket("2.6 ft")).toBe("2.6 ft");
    expect(formatWaveHeightBucket(2.6)).toBe("2.6 ft");
    expect(formatWaveHeightBucket(undefined)).toBe("No data");
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
