import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MapContent } from "@/components/map/map-content";
import { createMockBeaches } from "@/__tests__/setup/test-utils";

// Mock the InteractiveMap component to test integration
const mockMapMarkers = new Map();

jest.mock("next/dynamic", () => () => {
  const InteractiveMapMock = ({
    initialCenter,
    onLocationClick,
    onBeachSelect,
  }: any) => {
    const [markers, setMarkers] = React.useState<
      Array<{
        id: string;
        name: string;
        waveHeight: string | undefined;
        position: [number, number];
      }>
    >([]);

    // Simulate forecast loading and marker creation
    React.useEffect(() => {
      const loadForecastData = async () => {
        // Simulate the same logic as the real InteractiveMap
        try {
          // First get beaches
          const beachesResponse = await fetch("/api/beaches", {
            headers: { Accept: "application/json" },
          });

          if (!beachesResponse.ok) {
            setMarkers([]);
            return;
          }

          const beachesData = await beachesResponse.json();
          const beaches =
            beachesData?.data?.beaches || beachesData?.beaches || [];

          // Filter to nearby beaches (simplified)
          const nearbyBeaches = beaches.slice(0, 5);

          const markersWithForecasts = await Promise.all(
            nearbyBeaches.map(async (beach: any) => {
              // Mock forecast fetch with the same error handling
              try {
                const response = await fetch(
                  `/api/forecasts/update-enhanced?beachId=${beach.id}&days=2`
                );

                if (response.ok) {
                  const data = await response.json();
                  if (data.success && data.data?.forecasts?.length > 0) {
                    return {
                      id: beach.id,
                      name: beach.name,
                      waveHeight: data.data.forecasts[0].wave_height,
                      position: [beach.latitude, beach.longitude] as [
                        number,
                        number
                      ],
                    };
                  }
                }
              } catch (error) {
                console.warn(`Failed to fetch forecast for ${beach.name}`);
              }

              return {
                id: beach.id,
                name: beach.name,
                waveHeight: undefined,
                position: [beach.latitude, beach.longitude] as [number, number],
              };
            })
          );

          setMarkers(markersWithForecasts);
        } catch (error) {
          console.error("Error loading beach data:", error);
          setMarkers([]);
        }
      };

      // Simulate the map ready delay
      const timer = setTimeout(loadForecastData, 100);
      return () => clearTimeout(timer);
    }, []);

    return (
      <div
        data-testid="interactive-map"
        data-center={JSON.stringify(initialCenter)}
      >
        <div data-testid="map-markers">
          {markers.map((marker) => (
            <div
              key={marker.id}
              data-testid={`beach-marker-${marker.id}`}
              data-beach-name={marker.name}
              data-wave-height={marker.waveHeight || "No data"}
              className="beach-marker"
              onClick={() => onLocationClick?.(marker)}
            >
              <div className="wave-height-badge">
                {marker.waveHeight || "No forecast data"}
              </div>
              <div className="beach-name">{marker.name}</div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  InteractiveMapMock.displayName = "InteractiveMap";
  return InteractiveMapMock;
});

// Mock MapSkeleton
jest.mock("@/components/skeletons/map-skeleton", () => ({
  MapSkeleton: () => <div data-testid="map-skeleton">Loading map...</div>,
}));

// Mock forecast responses
const mockSuccessfulForecastResponse = {
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
      },
    ],
  },
};

const mockEmptyForecastResponse = {
  success: true,
  data: {
    forecasts: [],
  },
};

// Set up global fetch mock
global.fetch = jest.fn();

describe("Map Forecast Display Integration", () => {
  const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;
  const mockBeaches = createMockBeaches(2);

  const defaultProps = {
    loading: false,
    locationError: null,
    usingDefaultLocation: false,
    userLocation: { lat: 32.7493, lng: -117.2511 },
    selectedBeach: null,
    filteredBeaches: mockBeaches,
    searchQuery: "",
    onGetUserLocation: jest.fn(),
    onUseDefaultLocation: jest.fn(),
    onBeachSelect: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should display beaches with successful forecast data", async () => {
    // Mock successful forecast responses
    mockFetch.mockImplementation((url: string) => {
      if (
        typeof url === "string" &&
        url.includes("/api/forecasts/update-enhanced")
      ) {
        const beachId = new URL(url).searchParams.get("beachId");

        if (beachId === "d030911e-71ba-4678-8bbb-cd06a30f8c42") {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockSuccessfulForecastResponse),
          } as Response);
        }

        if (beachId === "6d65bfbd-454a-4767-a282-c8b46c7a86b9") {
          return Promise.resolve({
            ok: true,
            json: () =>
              Promise.resolve({
                ...mockSuccessfulForecastResponse,
                data: {
                  forecasts: [
                    {
                      ...mockSuccessfulForecastResponse.data.forecasts[0],
                      beach_id: beachId,
                      wave_height: "2.4 ft",
                    },
                  ],
                },
              }),
          } as Response);
        }
      }

      return Promise.reject(new Error("Unhandled fetch"));
    });

    render(<MapContent {...defaultProps} />);

    // Wait for the map to load and forecasts to be fetched
    await waitFor(
      () => {
        expect(screen.getByTestId("interactive-map")).toBeInTheDocument();
      },
      { timeout: 5000 }
    );

    // Wait for beach markers to appear
    await waitFor(
      () => {
        const oceanBeachMarker = screen.queryByTestId(
          "beach-marker-d030911e-71ba-4678-8bbb-cd06a30f8c42"
        );
        expect(oceanBeachMarker).toBeInTheDocument();
      },
      { timeout: 5000 }
    );

    // Check that Ocean Beach marker displays correct wave height
    const oceanBeachMarker = screen.getByTestId(
      "beach-marker-d030911e-71ba-4678-8bbb-cd06a30f8c42"
    );
    expect(oceanBeachMarker).toHaveAttribute("data-beach-name", "Ocean Beach");
    expect(oceanBeachMarker).toHaveAttribute("data-wave-height", "2.6 ft");

    // Check that Mission Beach marker displays correct wave height
    await waitFor(() => {
      const missionBeachMarker = screen.queryByTestId(
        "beach-marker-6d65bfbd-454a-4767-a282-c8b46c7a86b9"
      );
      expect(missionBeachMarker).toBeInTheDocument();
      expect(missionBeachMarker).toHaveAttribute(
        "data-beach-name",
        "Mission Beach"
      );
      expect(missionBeachMarker).toHaveAttribute("data-wave-height", "2.4 ft");
    });

    // Verify forecast API calls were made
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining(
        "/api/forecasts/update-enhanced?beachId=d030911e-71ba-4678-8bbb-cd06a30f8c42"
      )
    );
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining(
        "/api/forecasts/update-enhanced?beachId=6d65bfbd-454a-4767-a282-c8b46c7a86b9"
      )
    );
  }, 10000);

  it("should handle forecast fetch failures gracefully", async () => {
    // Mock failed forecast responses
    mockFetch.mockImplementation((url: string) => {
      if (
        typeof url === "string" &&
        url.includes("/api/forecasts/update-enhanced")
      ) {
        return Promise.resolve({
          ok: false,
          status: 500,
        } as Response);
      }

      return Promise.reject(new Error("Unhandled fetch"));
    });

    // Spy on console.warn to verify error handling
    const consoleSpy = jest.spyOn(console, "warn").mockImplementation();

    render(<MapContent {...defaultProps} />);

    await waitFor(
      () => {
        expect(screen.getByTestId("interactive-map")).toBeInTheDocument();
      },
      { timeout: 5000 }
    );

    // Wait for markers to appear even without forecast data
    await waitFor(
      () => {
        const oceanBeachMarker = screen.queryByTestId(
          "beach-marker-d030911e-71ba-4678-8bbb-cd06a30f8c42"
        );
        expect(oceanBeachMarker).toBeInTheDocument();
      },
      { timeout: 5000 }
    );

    // Check that markers show "No data" when forecast fails
    const oceanBeachMarker = screen.getByTestId(
      "beach-marker-d030911e-71ba-4678-8bbb-cd06a30f8c42"
    );
    expect(oceanBeachMarker).toHaveAttribute("data-wave-height", "No data");

    // Verify error handling was called
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining("Failed to fetch forecast for")
    );

    consoleSpy.mockRestore();
  });

  it("should handle empty forecast responses", async () => {
    // Mock empty forecast responses
    mockFetch.mockImplementation((url: string) => {
      if (
        typeof url === "string" &&
        url.includes("/api/forecasts/update-enhanced")
      ) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockEmptyForecastResponse),
        } as Response);
      }

      return Promise.reject(new Error("Unhandled fetch"));
    });

    render(<MapContent {...defaultProps} />);

    await waitFor(
      () => {
        expect(screen.getByTestId("interactive-map")).toBeInTheDocument();
      },
      { timeout: 5000 }
    );

    await waitFor(
      () => {
        const oceanBeachMarker = screen.queryByTestId(
          "beach-marker-d030911e-71ba-4678-8bbb-cd06a30f8c42"
        );
        expect(oceanBeachMarker).toBeInTheDocument();
      },
      { timeout: 5000 }
    );

    // Check that markers show "No data" when no forecasts are available
    const oceanBeachMarker = screen.getByTestId(
      "beach-marker-d030911e-71ba-4678-8bbb-cd06a30f8c42"
    );
    expect(oceanBeachMarker).toHaveAttribute("data-wave-height", "No data");
  });

  it("should display correct map center based on user location", () => {
    const customLocation = { lat: 33.0, lng: -117.0 };

    render(<MapContent {...defaultProps} userLocation={customLocation} />);

    const mapElement = screen.getByTestId("interactive-map");
    const centerData = mapElement.getAttribute("data-center");

    if (centerData) {
      const center = JSON.parse(centerData);
      expect(center[0]).toBe(customLocation.lat);
      expect(center[1]).toBe(customLocation.lng);
    }
  });

  it("should show loading state initially", () => {
    render(<MapContent {...defaultProps} loading={true} />);

    expect(screen.getByTestId("map-skeleton")).toBeInTheDocument();
    expect(screen.getByText("Loading map...")).toBeInTheDocument();
  });

  it("should show beach count in overlay", () => {
    render(<MapContent {...defaultProps} filteredBeaches={mockBeaches} />);

    expect(
      screen.getByText(`Found ${mockBeaches.length} beaches near your location`)
    ).toBeInTheDocument();
  });

  it("should handle mixed forecast success and failure", async () => {
    // Mock mixed responses - success for Ocean Beach, failure for Mission Beach
    mockFetch.mockImplementation((url: string) => {
      if (
        typeof url === "string" &&
        url.includes("/api/forecasts/update-enhanced")
      ) {
        const beachId = new URL(url).searchParams.get("beachId");

        if (beachId === "d030911e-71ba-4678-8bbb-cd06a30f8c42") {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockSuccessfulForecastResponse),
          } as Response);
        }

        // Fail for Mission Beach
        return Promise.resolve({
          ok: false,
          status: 404,
        } as Response);
      }

      return Promise.reject(new Error("Unhandled fetch"));
    });

    const consoleSpy = jest.spyOn(console, "warn").mockImplementation();

    render(<MapContent {...defaultProps} />);

    await waitFor(
      () => {
        expect(screen.getByTestId("interactive-map")).toBeInTheDocument();
      },
      { timeout: 5000 }
    );

    // Wait for both markers to appear
    await waitFor(
      () => {
        expect(
          screen.queryByTestId(
            "beach-marker-d030911e-71ba-4678-8bbb-cd06a30f8c42"
          )
        ).toBeInTheDocument();
        expect(
          screen.queryByTestId(
            "beach-marker-6d65bfbd-454a-4767-a282-c8b46c7a86b9"
          )
        ).toBeInTheDocument();
      },
      { timeout: 5000 }
    );

    // Ocean Beach should have forecast data
    const oceanBeachMarker = screen.getByTestId(
      "beach-marker-d030911e-71ba-4678-8bbb-cd06a30f8c42"
    );
    expect(oceanBeachMarker).toHaveAttribute("data-wave-height", "2.6 ft");

    // Mission Beach should show "No data"
    const missionBeachMarker = screen.getByTestId(
      "beach-marker-6d65bfbd-454a-4767-a282-c8b46c7a86b9"
    );
    expect(missionBeachMarker).toHaveAttribute("data-wave-height", "No data");

    consoleSpy.mockRestore();
  });
});
