import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MapContent } from "@/components/map/map-content";
import { createMockBeaches } from "@/__tests__/setup/test-utils";

let mockInteractiveMapMounts = 0;

// Mock the dynamic import for InteractiveMap
jest.mock("next/dynamic", () => () => {
  const InteractiveMapMock = ({
    customSpots,
    initialCenter,
    initialZoom,
    onLocationClick,
    onMapClick,
    layerControls,
    placementPin,
    onBeachSelect,
  }: any) => {
    const [mountId] = require("react").useState(
      () => ++mockInteractiveMapMounts,
    );

    return (
      <div
        data-testid="interactive-map"
        data-custom-spot-count={String(customSpots?.length ?? 0)}
        data-initial-center={initialCenter?.join(",")}
        data-initial-zoom={String(initialZoom)}
        data-mount-id={mountId}
        data-placement-pin={placementPin ? `${placementPin.lat},${placementPin.lon}` : ""}
      >
        {layerControls}
        <button
          onClick={() => onLocationClick?.(mockBeaches[0])}
          data-testid="mock-beach-click"
        >
          Click Beach
        </button>
        <button
          onClick={() => onBeachSelect?.(mockBeaches[0])}
          data-testid="mock-beach-select"
        >
          Select Beach
        </button>
        <button
          onClick={() => onMapClick?.({ lat: 32.81, lng: -117.28 })}
          data-testid="mock-map-click"
        >
          Click Map
        </button>
      </div>
    );
  };
  InteractiveMapMock.displayName = "InteractiveMap";
  return InteractiveMapMock;
});

// Mock the MapSkeleton component
jest.mock("@/components/skeletons/map-skeleton", () => ({
  MapSkeleton: () => <div data-testid="map-skeleton">Loading map...</div>,
}));

const mockBeaches = createMockBeaches(3);

describe("MapContent", () => {
  const defaultProps = {
    loading: false,
    locationError: null as string | null,
    usingDefaultLocation: false,
    userLocation: { lat: 32.7, lon: -117.2 } as {
      lat: number;
      lon: number;
    } | null,
    selectedBeach: null as any,
    filteredBeaches: mockBeaches as any,
    searchQuery: "",
    regionViewport: null as any,
    hasTimedOut: false,
    onGetUserLocation: jest.fn(),
    onUseDefaultLocation: jest.fn(),
    onBeachSelect: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockInteractiveMapMounts = 0;
  });

  it("should render map skeleton when loading", () => {
    render(<MapContent {...defaultProps} loading={true} />);

    expect(screen.getByTestId("map-skeleton")).toBeInTheDocument();
  });

  it("should render error state when location error exists", () => {
    render(
      <MapContent
        {...defaultProps}
        locationError="Location access denied"
        usingDefaultLocation={false}
      />,
    );

    expect(screen.getByText("Location access denied")).toBeInTheDocument();
    expect(screen.getByText("Try Again")).toBeInTheDocument();
    expect(screen.getByText("Use San Diego Location")).toBeInTheDocument();
  });

  it("should show location permission instructions when blocked", () => {
    render(
      <MapContent
        {...defaultProps}
        locationError="Location access blocked"
        usingDefaultLocation={false}
      />,
    );

    expect(screen.getByText("To enable location:")).toBeInTheDocument();
    expect(screen.getByText(/Click the 🔒 lock icon/)).toBeInTheDocument();
    expect(screen.getByText(/Set Location to "Allow"/)).toBeInTheDocument();
  });

  it("should render interactive map immediately without an idle placeholder", async () => {
    render(<MapContent {...defaultProps} />);

    const mapContainer = screen.getByTestId("map-container");

    expect(screen.getByTestId("interactive-map")).toBeInTheDocument();
    expect(mapContainer.querySelector("[aria-hidden='true']")).toBeNull();
    expect(mapContainer).toBeInTheDocument();
  });

  it("passes map click coordinates through to the parent", () => {
    const onMapClick = jest.fn();
    render(<MapContent {...defaultProps} onMapClick={onMapClick} />);

    fireEvent.click(screen.getByTestId("mock-map-click"));

    expect(onMapClick).toHaveBeenCalledWith({ lat: 32.81, lng: -117.28 });
  });

  it("raises initial zoom while placement mode is active", () => {
    render(
      <MapContent
        {...defaultProps}
        placementActive
        placementPin={{ lat: 32.77, lon: -117.25 }}
      />,
    );

    expect(screen.getByTestId("interactive-map")).toHaveAttribute(
      "data-initial-zoom",
      "14",
    );
    expect(screen.getByTestId("interactive-map")).toHaveAttribute(
      "data-placement-pin",
      "32.77,-117.25",
    );
  });

  it("should pass custom spots to the interactive map", () => {
    render(
      <MapContent
        {...defaultProps}
        customSpots={[
          {
            id: "spot-1",
            name: "Public Peak",
            lat: 32.75,
            lon: -117.25,
            nearestBeachId: null,
            visibility: "public",
          },
        ]}
      />,
    );

    expect(screen.getByTestId("interactive-map")).toHaveAttribute(
      "data-custom-spot-count",
      "1",
    );
  });

  it("should recenter user location changes without remounting the map", () => {
    const { rerender } = render(
      <MapContent
        {...defaultProps}
        filteredBeaches={[]}
        selectedBeach={null}
        userLocation={{ lat: 32.7702, lon: -117.2525 }}
      />,
    );

    const firstMap = screen.getByTestId("interactive-map");
    const firstMountId = firstMap.getAttribute("data-mount-id");
    if (!firstMountId) {
      throw new Error("Expected interactive map mount id");
    }
    expect(firstMap).toHaveAttribute("data-initial-center", "32.7702,-117.2525");

    rerender(
      <MapContent
        {...defaultProps}
        filteredBeaches={[]}
        selectedBeach={null}
        userLocation={{ lat: 33.63, lon: -117.95 }}
      />,
    );

    expect(screen.getByTestId("interactive-map")).toHaveAttribute(
      "data-mount-id",
      firstMountId,
    );
    expect(screen.getByTestId("interactive-map")).toHaveAttribute(
      "data-initial-center",
      "33.63,-117.95",
    );
  });

  it("should center the map on focusCenter when no beach or search result is selected", async () => {
    render(
      <MapContent
        {...defaultProps}
        focusCenter={{ lat: 33.63, lon: -117.95 }}
        selectedBeach={null}
        searchQuery=""
      />,
    );

    const mapContainer = screen.getByTestId("map-container");
    fireEvent.pointerDown(mapContainer);

    await waitFor(() => {
      expect(screen.getByTestId("interactive-map")).toHaveAttribute(
        "data-initial-center",
        "33.63,-117.95",
      );
    });
  });

  it("should not render the map status overlay", () => {
    render(<MapContent {...defaultProps} />);

    expect(screen.queryByTestId("map-overlay")).not.toBeInTheDocument();
    expect(
      screen.queryByText("Showing beaches near Mission Beach"),
    ).not.toBeInTheDocument();
  });

  it("should center the map on the first search result", async () => {
    render(
      <MapContent
        {...defaultProps}
        searchQuery="Ocean"
        filteredBeaches={[mockBeaches[0]] as any}
      />,
    );

    const mapContainer = screen.getByTestId("map-container");
    fireEvent.pointerDown(mapContainer);

    await waitFor(() => {
      expect(screen.getByTestId("interactive-map")).toHaveAttribute(
        "data-initial-center",
        `${mockBeaches[0].lat},${mockBeaches[0].lon}`,
      );
    });
  });

  it("does not render the duplicate map location button when using default location", () => {
    render(
      <MapContent
        {...defaultProps}
        usingDefaultLocation={true}
        userLocation={null}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Use My Location" }),
    ).not.toBeInTheDocument();
  });

  it("does not render the duplicate map location button when location is approximate", () => {
    render(
      <MapContent
        {...defaultProps}
        usingDefaultLocation={true}
        userLocation={{ lat: 32.7, lon: -117.2 }}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Use My Actual Location" }),
    ).not.toBeInTheDocument();
  });

  it("should handle try again button click", () => {
    render(
      <MapContent
        {...defaultProps}
        locationError="Location access denied"
        usingDefaultLocation={false}
      />,
    );

    const tryAgainButton = screen.getByText("Try Again");
    fireEvent.click(tryAgainButton);

    expect(defaultProps.onGetUserLocation).toHaveBeenCalled();
  });

  it("should handle use default location button click", () => {
    render(
      <MapContent
        {...defaultProps}
        locationError="Location access denied"
        usingDefaultLocation={false}
      />,
    );

    const defaultLocationButton = screen.getByText("Use San Diego Location");
    fireEvent.click(defaultLocationButton);

    expect(defaultProps.onUseDefaultLocation).toHaveBeenCalled();
  });

  it("should center focus-region navigation without rendering stale status copy", async () => {
    render(
      <MapContent
        {...defaultProps}
        usingDefaultLocation={true}
        focusCenter={{ lat: 37.76, lon: -122.51 }}
      />,
    );

    const mapContainer = screen.getByTestId("map-container");
    fireEvent.pointerDown(mapContainer);

    await waitFor(() => {
      expect(screen.getByTestId("interactive-map")).toHaveAttribute(
        "data-initial-center",
        "37.76,-122.51",
      );
    });
    expect(screen.queryByText("Mission Beach")).not.toBeInTheDocument();
  });

  // Bug 2: Map minHeight overflows mobile viewport
  describe("Bug 2: Map container min-height responsive", () => {
    it("should NOT have standalone min-h-[400px] class on map container", () => {
      render(<MapContent {...defaultProps} />);
      const mapContainer = screen.getByTestId("map-container");
      // Split classes and check none is exactly "min-h-[400px]" (sm:min-h-[400px] is fine)
      const classes = mapContainer.className.split(/\s+/);
      expect(classes).not.toContain("min-h-[400px]");
    });

    it("should have responsive min-h-[200px] sm:min-h-[400px] classes on map container", () => {
      render(<MapContent {...defaultProps} />);
      const mapContainer = screen.getByTestId("map-container");
      const classes = mapContainer.className.split(/\s+/);
      expect(classes).toContain("min-h-[200px]");
      expect(classes).toContain("sm:min-h-[400px]");
    });
  });

  describe("mobile map chrome", () => {
    it("does not render the old bottom-sheet recovery button", () => {
      render(<MapContent {...defaultProps} />);

      expect(
        screen.queryByRole("button", { name: "Show beach list" }),
      ).not.toBeInTheDocument();
    });
  });
});
