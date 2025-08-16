import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { InteractiveMap } from "@/components/map/interactive-map";
import { createMockBeaches } from "@/__tests__/setup/test-utils";

// Mock Mapbox GL JS
const mockMapboxMap = {
  on: jest.fn(),
  off: jest.fn(),
  remove: jest.fn(),
  getCenter: jest.fn(() => ({ lat: 32.7493, lng: -117.2511 })),
  getZoom: jest.fn(() => 13),
  setCenter: jest.fn(),
  addTo: jest.fn(),
};

const mockMapboxMarker = {
  setLngLat: jest.fn().mockReturnThis(),
  setPopup: jest.fn().mockReturnThis(),
  addTo: jest.fn().mockReturnThis(),
  remove: jest.fn(),
};

const mockMapboxPopup = {
  setLngLat: jest.fn().mockReturnThis(),
  setHTML: jest.fn().mockReturnThis(),
  addTo: jest.fn().mockReturnThis(),
  remove: jest.fn(),
};

jest.mock("mapbox-gl", () => ({
  Map: jest.fn(() => mockMapboxMap),
  Marker: jest.fn(() => mockMapboxMarker),
  Popup: jest.fn(() => mockMapboxPopup),
  accessToken: "",
}));

// Mock next/navigation
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

// Mock forecast utility
jest.mock("@/lib/utils/current-forecast-utils", () => ({
  getCurrentForecast: jest.fn((forecasts: any[]) => {
    if (forecasts && forecasts.length > 0) {
      return forecasts[0]; // Return the first forecast for testing
    }
    return null;
  }),
}));

// Mock wave height formatter
jest.mock("@/lib/utils/wave-height-formatter", () => ({
  formatWaveHeight: jest.fn((height: any) => {
    if (typeof height === "string") return height;
    if (typeof height === "number") return `${height} ft`;
    return "No data";
  }),
  getWaveHeightValue: jest.fn((height: any) => {
    if (typeof height === "string") return parseFloat(height) || 0;
    if (typeof height === "number") return height;
    return 0;
  }),
}));

// Mock map utilities
jest.mock("@/lib/utils/map-utilities", () => ({
  getOffshorePosition: jest.fn((lat: number, lng: number) => [lng + 0.001, lat + 0.001]),
  hasViewportChanged: jest.fn(() => true),
}));

// Mock distance utils
jest.mock("@/lib/utils/distance-utils", () => ({
  calculateDistanceInMiles: jest.fn(() => 5),
}));

// Mock cached API
jest.mock("@/hooks/use-cached-api", () => ({
  createCachedMapFetch: jest.fn(() => jest.fn().mockResolvedValue({ data: [] })),
  createLocationCacheKey: jest.fn(() => "cache-key"),
}));

// Create mock beaches with IDs matching our test data
const mockBeaches = [
  {
    id: "d030911e-71ba-4678-8bbb-cd06a30f8c42", // Ocean Beach ID from actual data
    name: "Ocean Beach",
    latitude: 32.7493,
    longitude: -117.2511,
    location: "San Diego, CA",
  },
  {
    id: "6d65bfbd-454a-4767-a282-c8b46c7a86b9", // Mission Beach ID from actual data
    name: "Mission Beach",
    latitude: 32.7702,
    longitude: -117.2525,
    location: "San Diego, CA",
  },
  {
    id: "test-beach-3",
    name: "Pacific Beach",
    latitude: 32.7979,
    longitude: -117.255,
    location: "San Diego, CA",
  },
];

// Mock fetch responses
const mockForecastResponse = {
  success: true,
  data: {
    forecasts: [
      {
        id: "forecast-1",
        beach_id: "d030911e-71ba-4678-8bbb-cd06a30f8c42",
        forecast_date: "2025-08-16",
        forecast_time: "12:00:00",
        wave_height: "2.6 ft",
        wave_period: "15.4s",
        wave_direction: "SSW",
        created_at: "2025-08-16T19:39:47.438+00:00",
      },
    ],
  },
};

// Set up global fetch mock
global.fetch = jest.fn();

describe("InteractiveMap Forecast Display", () => {
  const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock successful responses for beaches and forecasts
    mockFetch.mockImplementation((url: string) => {
      if (typeof url === "string") {
        if (url.includes("/api/beaches/nearby")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ data: mockBeaches }),
          } as Response);
        }
        
        if (url.includes("/api/beaches") && !url.includes("nearby")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ 
              success: true,
              data: { beaches: mockBeaches }
            }),
          } as Response);
        }
        
        if (url.includes("/api/forecasts/update-enhanced")) {
          const beachId = new URL(url).searchParams.get("beachId");
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              ...mockForecastResponse,
              data: {
                forecasts: [{
                  ...mockForecastResponse.data.forecasts[0],
                  beach_id: beachId,
                }],
              },
            }),
          } as Response);
        }
      }
      
      return Promise.reject(new Error("Unhandled fetch"));
    });

    // Reset Mapbox mocks
    mockMapboxMap.on.mockClear();
    mockMapboxMap.getCenter.mockReturnValue({ lat: 32.7493, lng: -117.2511 });
    mockMapboxMap.getZoom.mockReturnValue(13);
  });

  it("should render map container", () => {
    render(<InteractiveMap />);
    
    // Map container should be present
    const mapContainer = document.querySelector("[style*='width: 100%']");
    expect(mapContainer).toBeInTheDocument();
  });

  it("should initialize Mapbox map with correct settings", () => {
    render(<InteractiveMap initialCenter={[32.7493, -117.2511]} initialZoom={14} />);
    
    const MapboxMap = require("mapbox-gl").Map;
    expect(MapboxMap).toHaveBeenCalledWith(
      expect.objectContaining({
        style: "mapbox://styles/mapbox/streets-v11",
        center: [-117.2511, 32.7493], // lng, lat order for Mapbox
        zoom: 14,
      })
    );
  });

  it("should set up map event handlers", () => {
    render(<InteractiveMap />);
    
    expect(mockMapboxMap.on).toHaveBeenCalledWith("load", expect.any(Function));
    expect(mockMapboxMap.on).toHaveBeenCalledWith("error", expect.any(Function));
    expect(mockMapboxMap.on).toHaveBeenCalledWith("moveend", expect.any(Function));
    expect(mockMapboxMap.on).toHaveBeenCalledWith("click", expect.any(Function));
  });

  it("should fetch and display beaches when map loads", async () => {
    render(<InteractiveMap />);
    
    // Simulate map load event
    const loadHandler = mockMapboxMap.on.mock.calls.find(
      call => call[0] === "load"
    )?.[1];
    
    if (loadHandler) {
      await loadHandler();
    }

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/beaches"),
        expect.any(Object)
      );
    });
  });

  it("should fetch forecast data for each beach", async () => {
    render(<InteractiveMap />);
    
    // Simulate map load
    const loadHandler = mockMapboxMap.on.mock.calls.find(
      call => call[0] === "load"
    )?.[1];
    
    if (loadHandler) {
      await loadHandler();
    }

    await waitFor(() => {
      // Should fetch forecasts for Ocean Beach
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/forecasts/update-enhanced?beachId=d030911e-71ba-4678-8bbb-cd06a30f8c42")
      );
      
      // Should fetch forecasts for Mission Beach
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/forecasts/update-enhanced?beachId=6d65bfbd-454a-4767-a282-c8b46c7a86b9")
      );
    });
  });

  it("should create markers with wave height badges", async () => {
    const Marker = require("mapbox-gl").Marker;
    
    render(<InteractiveMap />);
    
    // Simulate map load
    const loadHandler = mockMapboxMap.on.mock.calls.find(
      call => call[0] === "load"
    )?.[1];
    
    if (loadHandler) {
      await loadHandler();
    }

    await waitFor(() => {
      // Should create markers for beaches
      expect(Marker).toHaveBeenCalled();
      
      // Check that markers are configured with offshore positions
      expect(mockMapboxMarker.setLngLat).toHaveBeenCalled();
      expect(mockMapboxMarker.addTo).toHaveBeenCalled();
    });
  });

  it("should display wave height in marker popup", async () => {
    render(<InteractiveMap />);
    
    // Simulate map load
    const loadHandler = mockMapboxMap.on.mock.calls.find(
      call => call[0] === "load"
    )?.[1];
    
    if (loadHandler) {
      await loadHandler();
    }

    await waitFor(() => {
      expect(mockMapboxMarker.setPopup).toHaveBeenCalledWith(
        expect.any(Object)
      );
      
      // Check that popup HTML contains wave height information
      expect(mockMapboxPopup.setHTML).toHaveBeenCalledWith(
        expect.stringContaining("Wave Height:")
      );
    });
  });

  it("should handle forecast fetch failures gracefully", async () => {
    // Mock fetch to return error for forecast
    mockFetch.mockImplementation((url: string) => {
      if (typeof url === "string") {
        if (url.includes("/api/beaches")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ 
              success: true,
              data: { beaches: mockBeaches }
            }),
          } as Response);
        }
        
        if (url.includes("/api/forecasts/update-enhanced")) {
          return Promise.resolve({
            ok: false,
            status: 500,
          } as Response);
        }
      }
      
      return Promise.reject(new Error("Unhandled fetch"));
    });

    // Spy on console.warn to check error handling
    const consoleSpy = jest.spyOn(console, "warn").mockImplementation();
    
    render(<InteractiveMap />);
    
    // Simulate map load
    const loadHandler = mockMapboxMap.on.mock.calls.find(
      call => call[0] === "load"
    )?.[1];
    
    if (loadHandler) {
      await loadHandler();
    }

    await waitFor(() => {
      // Should still create markers even without forecast data
      expect(mockMapboxMarker.addTo).toHaveBeenCalled();
    });

    consoleSpy.mockRestore();
  });

  it("should show 'No forecast data' when no wave height available", async () => {
    // Mock fetch to return empty forecast data
    mockFetch.mockImplementation((url: string) => {
      if (typeof url === "string") {
        if (url.includes("/api/beaches")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ 
              success: true,
              data: { beaches: mockBeaches }
            }),
          } as Response);
        }
        
        if (url.includes("/api/forecasts/update-enhanced")) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({
              success: true,
              data: { forecasts: [] },
            }),
          } as Response);
        }
      }
      
      return Promise.reject(new Error("Unhandled fetch"));
    });

    render(<InteractiveMap />);
    
    // Simulate map load
    const loadHandler = mockMapboxMap.on.mock.calls.find(
      call => call[0] === "load"
    )?.[1];
    
    if (loadHandler) {
      await loadHandler();
    }

    await waitFor(() => {
      expect(mockMapboxPopup.setHTML).toHaveBeenCalledWith(
        expect.stringContaining("No forecast data")
      );
    });
  });

  it("should handle map click events", () => {
    const onMapClick = jest.fn();
    render(<InteractiveMap onMapClick={onMapClick} />);
    
    // Simulate map click
    const clickHandler = mockMapboxMap.on.mock.calls.find(
      call => call[0] === "click"
    )?.[1];
    
    if (clickHandler) {
      const mockEvent = {
        lngLat: { lat: 32.7493, lng: -117.2511 }
      };
      clickHandler(mockEvent);
      
      expect(onMapClick).toHaveBeenCalledWith(mockEvent.lngLat);
    }
  });

  it("should update center when initialCenter prop changes", () => {
    const { rerender } = render(
      <InteractiveMap initialCenter={[32.7493, -117.2511]} />
    );

    // Change the center
    rerender(
      <InteractiveMap initialCenter={[32.8000, -117.2000]} />
    );

    expect(mockMapboxMap.setCenter).toHaveBeenCalledWith(
      [-117.2000, 32.8000] // lng, lat order
    );
  });

  it("should cleanup markers when component unmounts", () => {
    const { unmount } = render(<InteractiveMap />);
    
    unmount();
    
    expect(mockMapboxMap.off).toHaveBeenCalledWith("moveend", expect.any(Function));
    expect(mockMapboxMap.remove).toHaveBeenCalled();
  });

  it("should debounce map move events", async () => {
    jest.useFakeTimers();
    
    render(<InteractiveMap />);
    
    // Simulate multiple rapid move events
    const moveHandler = mockMapboxMap.on.mock.calls.find(
      call => call[0] === "moveend"
    )?.[1];
    
    if (moveHandler) {
      moveHandler();
      moveHandler();
      moveHandler();
      
      // Fast-forward debounce timer
      jest.advanceTimersByTime(1500);
      
      await waitFor(() => {
        // Should only make one API call despite multiple move events
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });
    }
    
    jest.useRealTimers();
  });
});