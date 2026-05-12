import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MapContent } from "@/components/map/map-content";
import { createMockBeaches } from "@/__tests__/setup/test-utils";

// Mock the dynamic import for InteractiveMap
jest.mock("next/dynamic", () => () => {
  const InteractiveMapMock = ({ onLocationClick, onBeachSelect }: any) => (
    <div data-testid="interactive-map">
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
    </div>
  );
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

  it("should render interactive map after interaction", async () => {
    render(<MapContent {...defaultProps} />);

    const mapContainer = screen.getByTestId("map-container");
    fireEvent.pointerDown(mapContainer);

    await waitFor(() => {
      expect(screen.getByTestId("interactive-map")).toBeInTheDocument();
    });
    expect(mapContainer).toBeInTheDocument();
  });

  it("should show beach count overlay", () => {
    render(<MapContent {...defaultProps} />);

    expect(screen.getByText("Found 3 beaches near you")).toBeInTheDocument();
  });

  it("should show search results overlay", () => {
    render(
      <MapContent
        {...defaultProps}
        searchQuery="Ocean"
        filteredBeaches={[mockBeaches[0]] as any}
      />,
    );

    expect(screen.getByText('Found 1 beach for "Ocean"')).toBeInTheDocument();
  });

  it("should show no results message for empty search", () => {
    render(
      <MapContent
        {...defaultProps}
        searchQuery="nonexistent"
        filteredBeaches={[]}
      />,
    );

    expect(
      screen.getByText('No beaches found for "nonexistent"'),
    ).toBeInTheDocument();
  });

  it("should treat in-coverage regions like Hawaii as normal search", () => {
    render(
      <MapContent
        {...defaultProps}
        searchQuery="Hawaii"
        filteredBeaches={[]}
      />,
    );

    expect(
      screen.getByText('No beaches found for "Hawaii"'),
    ).toBeInTheDocument();
  });

  it("should show use my location button when using default location", () => {
    render(
      <MapContent
        {...defaultProps}
        usingDefaultLocation={true}
        userLocation={null}
      />,
    );

    expect(screen.getByText("Use My Location")).toBeInTheDocument();
  });

  it("should show use my actual location button when location is approximate", () => {
    render(
      <MapContent
        {...defaultProps}
        usingDefaultLocation={true}
        userLocation={{ lat: 32.7, lon: -117.2 }}
      />,
    );

    expect(screen.getByText("Use My Actual Location")).toBeInTheDocument();
  });

  it("should handle location button clicks", () => {
    render(
      <MapContent
        {...defaultProps}
        usingDefaultLocation={true}
        userLocation={null}
      />,
    );

    const locationButton = screen.getByText("Use My Location");
    fireEvent.click(locationButton);

    expect(defaultProps.onGetUserLocation).toHaveBeenCalled();
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

  it("should show selected beach name in overlay", () => {
    render(
      <MapContent {...defaultProps} selectedBeach={mockBeaches[0] as any} />,
    );

    expect(
      screen.getByText(`Showing ${mockBeaches[0].name}`),
    ).toBeInTheDocument();
  });

  it("should handle no user location", () => {
    render(<MapContent {...defaultProps} userLocation={null} />);

    expect(screen.getByText("Loading beach locations...")).toBeInTheDocument();
  });

  it("should show default location message", () => {
    render(<MapContent {...defaultProps} usingDefaultLocation={true} />);

    expect(
      screen.getByText("Showing beaches near Mission Beach"),
    ).toBeInTheDocument();
  });

  it("should show no beaches message when none nearby", () => {
    render(<MapContent {...defaultProps} filteredBeaches={[]} />);

    expect(
      screen.getByText("No beaches within 30 miles of your location"),
    ).toBeInTheDocument();
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

  // Bug 9: Beach count overlay too wide on mobile
  describe("Bug 9: Beach count overlay responsive width", () => {
    it("should NOT have standalone max-w-xs class on overlay", () => {
      render(<MapContent {...defaultProps} />);
      const overlay = screen.getByTestId("map-overlay");
      // Split classes and check none is exactly "max-w-xs" (sm:max-w-xs is fine)
      const classes = overlay.className.split(/\s+/);
      expect(classes).not.toContain("max-w-xs");
    });

    it("should have responsive max-w-[55vw] sm:max-w-xs classes on overlay", () => {
      render(<MapContent {...defaultProps} />);
      const overlay = screen.getByTestId("map-overlay");
      const classes = overlay.className.split(/\s+/);
      expect(classes).toContain("max-w-[55vw]");
      expect(classes).toContain("sm:max-w-xs");
    });
  });

  // Bug 13: Recovery button for drawer dismissal
  describe("Bug 13: Show Beaches recovery button", () => {
    it("should render Show Beaches button when onShowBeaches is provided", () => {
      const onShowBeaches = jest.fn();
      render(<MapContent {...defaultProps} onShowBeaches={onShowBeaches} />);
      const button = screen.getByRole("button", { name: "Show beach list" });
      expect(button).toBeInTheDocument();
    });

    it("should call onShowBeaches when button is clicked", () => {
      const onShowBeaches = jest.fn();
      render(<MapContent {...defaultProps} onShowBeaches={onShowBeaches} />);
      const button = screen.getByRole("button", { name: "Show beach list" });
      fireEvent.click(button);
      expect(onShowBeaches).toHaveBeenCalledTimes(1);
    });

    it("should NOT render Show Beaches button when onShowBeaches is not provided", () => {
      render(<MapContent {...defaultProps} />);
      const button = screen.queryByRole("button", { name: "Show beach list" });
      expect(button).not.toBeInTheDocument();
    });

    it("should have md:hidden class to only show on mobile", () => {
      const onShowBeaches = jest.fn();
      render(<MapContent {...defaultProps} onShowBeaches={onShowBeaches} />);
      const button = screen.getByRole("button", { name: "Show beach list" });
      expect(button.className).toContain("md:hidden");
    });
  });
});
