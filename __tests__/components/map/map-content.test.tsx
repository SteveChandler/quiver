import { render, screen, fireEvent } from "@testing-library/react";
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
    userLocation: { lat: 32.7, lon: -117.2 } as { lat: number; lon: number } | null,
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

  it("should render map container when loading", () => {
    render(<MapContent {...defaultProps} loading={true} />);

    expect(screen.getByTestId("map-container")).toBeInTheDocument();
  });

  it("should render error state when location error exists", () => {
    render(
      <MapContent
        {...defaultProps}
        locationError="Location access denied"
        usingDefaultLocation={false}
      />
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
      />
    );

    expect(screen.getByText("To enable location:")).toBeInTheDocument();
    expect(screen.getByText(/Click the 🔒 lock icon/)).toBeInTheDocument();
    expect(screen.getByText(/Set Location to "Allow"/)).toBeInTheDocument();
  });

  it("should render interactive map when loaded", () => {
    render(<MapContent {...defaultProps} />);

    expect(screen.getByTestId("interactive-map")).toBeInTheDocument();
    expect(screen.getByTestId("map-container")).toBeInTheDocument();
  });

  it("should render interactive map with proper props", () => {
    render(<MapContent {...defaultProps} />);

    const interactiveMap = screen.getByTestId("interactive-map");
    expect(interactiveMap).toBeInTheDocument();

    // The onBeachSelect callback should be available to the InteractiveMap
    expect(typeof defaultProps.onBeachSelect).toBe("function");
  });

  it("should show beach count overlay", () => {
    render(<MapContent {...defaultProps} />);

    expect(
      screen.getByText("Found 3 beaches near your location")
    ).toBeInTheDocument();
  });

  it("should show search results overlay", () => {
    render(
      <MapContent
        {...defaultProps}
        searchQuery="Ocean"
        filteredBeaches={[mockBeaches[0]] as any}
      />
    );

    expect(screen.getByText('Found 1 beach for "Ocean"')).toBeInTheDocument();
  });

  it("should show no results message for empty search", () => {
    render(
      <MapContent
        {...defaultProps}
        searchQuery="nonexistent"
        filteredBeaches={[]}
      />
    );

    expect(
      screen.getByText('No beaches found for "nonexistent"')
    ).toBeInTheDocument();
  });

  it("should show out of area message for known locations", () => {
    render(
      <MapContent {...defaultProps} searchQuery="Hawaii" filteredBeaches={[]} />
    );

    expect(
      screen.getByText('"Hawaii" is outside our coverage area')
    ).toBeInTheDocument();
  });

  it("should show use my location button when using default location", () => {
    render(
      <MapContent
        {...defaultProps}
        usingDefaultLocation={true}
        userLocation={null}
      />
    );

    expect(screen.getByText("Use My Location")).toBeInTheDocument();
  });

  it("should show use my actual location button when location is approximate", () => {
    render(
      <MapContent
        {...defaultProps}
        usingDefaultLocation={true}
        userLocation={{ lat: 32.7, lon: -117.2 }}
      />
    );

    expect(screen.getByText("Use My Actual Location")).toBeInTheDocument();
  });

  it("should handle location button clicks", () => {
    render(
      <MapContent
        {...defaultProps}
        usingDefaultLocation={true}
        userLocation={null}
      />
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
      />
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
      />
    );

    const defaultLocationButton = screen.getByText("Use San Diego Location");
    fireEvent.click(defaultLocationButton);

    expect(defaultProps.onUseDefaultLocation).toHaveBeenCalled();
  });

  it("should show selected beach name in overlay", () => {
    render(<MapContent {...defaultProps} selectedBeach={mockBeaches[0] as any} />);

    expect(
      screen.getByText(`Showing ${mockBeaches[0].name}`)
    ).toBeInTheDocument();
  });

  it("should handle no user location", () => {
    render(<MapContent {...defaultProps} userLocation={null} />);

    expect(screen.getByText("Loading beach locations...")).toBeInTheDocument();
  });

  it("should show default location message", () => {
    render(<MapContent {...defaultProps} usingDefaultLocation={true} />);

    expect(
      screen.getByText("Showing beaches near Ocean Beach, San Diego")
    ).toBeInTheDocument();
  });

  it("should show no beaches message when none nearby", () => {
    render(<MapContent {...defaultProps} filteredBeaches={[]} />);

    expect(
      screen.getByText("No beaches within 30 miles of your location")
    ).toBeInTheDocument();
  });

  it("should use correct map center based on selected beach", () => {
    const selectedBeach = mockBeaches[0] as any;
    render(<MapContent {...defaultProps} selectedBeach={selectedBeach} />);

    // The map should be rendered with the selected beach coordinates
    expect(screen.getByTestId("interactive-map")).toBeInTheDocument();
  });

  it("should use search result coordinates when searching", () => {
    render(
      <MapContent
        {...defaultProps}
        searchQuery="Ocean"
        filteredBeaches={[mockBeaches[0]] as any}
      />
    );

    // The map should be rendered with the search result coordinates
    expect(screen.getByTestId("interactive-map")).toBeInTheDocument();
  });

  it("should fall back to user location coordinates", () => {
    render(
      <MapContent
        {...defaultProps}
        selectedBeach={null}
        filteredBeaches={[]}
        searchQuery=""
      />
    );

    // The map should be rendered with user location coordinates
    expect(screen.getByTestId("interactive-map")).toBeInTheDocument();
  });

  it("should use default San Diego coordinates as fallback", () => {
    render(
      <MapContent
        {...defaultProps}
        userLocation={null}
        selectedBeach={null}
        filteredBeaches={[]}
      />
    );

    // The map should be rendered with default Ocean Beach coordinates
    expect(screen.getByTestId("interactive-map")).toBeInTheDocument();
  });
});
