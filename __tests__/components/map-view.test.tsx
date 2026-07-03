import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MapView } from "@/components/map-view";

const mockLoadNearbyBeaches = jest.fn();
const mockRouterReplace = jest.fn();
const mockSetSearchQuery = jest.fn();
const mockSetSelectedBeach = jest.fn();
const mockGetUserLocation = jest.fn();
let mockIsMobile = false;
let mockSearchParams = new URLSearchParams();
let mockSearchQuery = "";
let mockGeolocationLoading = false;
let mockBeachLoading = false;
let mockHomeBeach: { lat: number; lon: number } | null = null;
let mockProfileLoading = false;
let mockFilteredBeaches: Array<{
  id: string;
  name: string;
  city?: string | null;
  state?: string | null;
  lat: number;
  lon: number;
}> = [];
const mockCustomSpots = [
  {
    id: "spot-1",
    name: "Public Peak",
    lat: 32.75,
    lon: -117.25,
    nearestBeachId: null,
    visibility: "public",
  },
];

jest.mock("next/navigation", () => ({
  usePathname: () => "/map",
  useRouter: () => ({ replace: mockRouterReplace }),
  useSearchParams: () => mockSearchParams,
}));

jest.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => mockIsMobile,
}));

jest.mock("@/context/profile-context", () => ({
  useProfileContext: () => ({
    profile: null,
    homeBeach: mockHomeBeach,
    isLoading: mockProfileLoading,
    error: null,
    updateProfile: jest.fn(),
    refreshProfile: jest.fn(),
  }),
}));

jest.mock("@/hooks/use-geolocation", () => ({
  useGeolocation: () => ({
    userLocation: { lat: 32.7702, lon: -117.2525 },
    locationError: null,
    usingDefaultLocation: true,
    hasTimedOut: false,
    loading: mockGeolocationLoading,
    getUserLocation: mockGetUserLocation,
    useDefaultLocation: jest.fn(),
  }),
}));

jest.mock("@/hooks/use-beach-search", () => ({
  useBeachSearch: () => ({
    filteredBeaches: mockFilteredBeaches,
    loading: mockBeachLoading,
    searchQuery: mockSearchQuery,
    selectedBeach: null,
    filters: { beginnerFriendly: false, breakTypes: new Set<string>() },
    loadBeaches: jest.fn(),
    loadNearbyBeaches: mockLoadNearbyBeaches,
    setSearchQuery: mockSetSearchQuery,
    clearSearch: jest.fn(),
    setSelectedBeach: mockSetSelectedBeach,
    toggleBeginnerFriendly: jest.fn(),
    toggleBreakType: jest.fn(),
    clearAllFilters: jest.fn(),
  }),
}));

jest.mock("@/hooks/use-custom-spots", () => ({
  useCustomSpots: () => ({
    customSpots: mockCustomSpots,
    loading: false,
  }),
}));

const mockTrackMapEvent = jest.fn();
const mockTrackQrRendered = jest.fn();

jest.mock("@/hooks/use-track-event", () => ({
  useTrackEvent: () => ({ track: mockTrackMapEvent }),
}));

jest.mock("@/lib/analytics/app-handoff-tracking", () => ({
  trackAppHandoffQrRendered: (...args: unknown[]) => mockTrackQrRendered(...args),
}));

jest.mock("qrcode.react", () => ({
  QRCodeSVG: ({
    value,
    "data-testid": dataTestId,
  }: {
    value: string;
    "data-testid"?: string;
  }) => <svg data-testid={dataTestId} data-value={value} />,
}));

jest.mock("@/components/map/map-content", () => ({
  MapContent: ({
    autoNavigateOnMarkerClick,
    customSpots,
    layerControls,
    loading,
    onMapClick,
    onPlacementPinChange,
    placementActive,
    placementPin,
    placementPinDraggable,
    showSurfSpots,
    showSwellField,
    swellTimelineSteps,
  }: {
    autoNavigateOnMarkerClick?: boolean;
    customSpots?: unknown[];
    layerControls?: React.ReactNode;
    loading?: boolean;
    onMapClick?: (latlng: { lat: number; lng: number }) => void;
    onPlacementPinChange?: (latlng: { lat: number; lng: number }) => void;
    placementActive?: boolean;
    placementPin?: { lat: number; lon: number } | null;
    placementPinDraggable?: boolean;
    showSurfSpots?: boolean;
    showSwellField?: boolean;
    swellTimelineSteps?: string[];
  }) => (
    <div
      data-auto-navigate-on-marker-click={String(autoNavigateOnMarkerClick)}
      data-custom-spot-count={String(customSpots?.length ?? 0)}
      data-loading={String(loading)}
      data-placement-active={String(placementActive)}
      data-placement-draggable={String(placementPinDraggable)}
      data-placement-pin={placementPin ? `${placementPin.lat},${placementPin.lon}` : ""}
      data-show-swell-field={String(showSwellField)}
      data-show-surf-spots={String(showSurfSpots)}
      data-swell-timeline-steps={swellTimelineSteps?.join(",") ?? ""}
      data-testid="map-content"
    >
      {layerControls}
      <button
        type="button"
        data-testid="mock-map-content-click"
        onClick={() => onMapClick?.({ lat: 32.82, lng: -117.28 })}
      >
        map click
      </button>
      <button
        type="button"
        data-testid="mock-placement-drag"
        onClick={() =>
          placementPinDraggable
            ? onPlacementPinChange?.({ lat: 32.83, lng: -117.29 })
            : undefined
        }
      >
        drag pin
      </button>
    </div>
  ),
}));

describe("MapView", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsMobile = false;
    mockSearchParams = new URLSearchParams();
    mockSearchQuery = "";
    mockGeolocationLoading = false;
    mockBeachLoading = false;
    mockHomeBeach = null;
    mockProfileLoading = false;
    mockFilteredBeaches = [];
    try {
      window.localStorage.clear();
    } catch {
      // ignore
    }
  });

  it("enables the swell field by default", () => {
    render(<MapView />);

    expect(screen.getByTestId("swell-field-toggle")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      screen.getByRole("button", { name: "Hide swell field" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("map-content")).toHaveAttribute(
      "data-show-swell-field",
      "true",
    );
    expect(screen.getByTestId("map-content")).toHaveAttribute(
      "data-show-surf-spots",
      "true",
    );
    expect(screen.getByTestId("map-content")).toHaveAttribute(
      "data-custom-spot-count",
      "1",
    );
    expect(screen.queryByTestId("view-mode-list")).not.toBeInTheDocument();
  });

  it("passes readable clock-time swell timeline labels to the map", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 6, 2, 20, 6));

    try {
      render(<MapView />);

      expect(screen.getByTestId("map-content")).toHaveAttribute(
        "data-swell-timeline-steps",
        "Now,11 PM,Fri 2 AM,Fri 8 AM,Fri 2 PM,Fri 8 PM,Sat 8 AM,Sat 8 PM",
      );
    } finally {
      jest.useRealTimers();
    }
  });

  it("shows the field guide trigger but keeps the panel collapsed on the live map", () => {
    render(<MapView />);

    expect(screen.getByTestId("map-field-guide-toggle")).toBeInTheDocument();
    expect(screen.queryByTestId("map-learning-panel")).not.toBeInTheDocument();
  });

  it("passes controlled layer state to the map and toolbar", async () => {
    const user = userEvent.setup();
    const onShowSwellFieldChange = jest.fn();
    render(
      <MapView
        toolbarLayerControls={<div data-testid="mock-toolbar-layers">Layer menu</div>}
        showSwellField={false}
        onShowSwellFieldChange={onShowSwellFieldChange}
        showSurfSpots={false}
      />,
    );

    expect(screen.getByTestId("map-content")).toHaveAttribute(
      "data-show-swell-field",
      "false",
    );
    expect(screen.getByTestId("map-content")).toHaveAttribute(
      "data-show-surf-spots",
      "false",
    );
    expect(screen.queryByTestId("swell-field-toggle")).not.toBeInTheDocument();

    await user.click(screen.getByTestId("map-layers-toggle"));

    expect(screen.getByTestId("mock-toolbar-layers")).toBeInTheDocument();
  });

  it("opens and closes the field guide from the live map trigger", async () => {
    const user = userEvent.setup();
    render(<MapView />);

    await user.click(screen.getByTestId("map-field-guide-toggle"));

    expect(screen.getByTestId("map-learning-panel")).toBeInTheDocument();
    expect(screen.queryByText("Read the call")).not.toBeInTheDocument();
    expect(screen.queryByText(/YES, MAYBE, or NO/i)).not.toBeInTheDocument();
    expect(
      screen.getByText(/Switch layers to see how swell energy, wind, and tide/i),
    ).toBeInTheDocument();
    expect(screen.getByTestId("map-learning-panel")).toHaveClass(
      "flex",
      "overflow-hidden",
    );
    expect(screen.getByTestId("map-learning-panel-scroll")).toHaveClass(
      "min-h-0",
      "flex-1",
      "overflow-y-auto",
      "overscroll-contain",
    );
    expect(document.getElementById("map-field-guide-panel")).toHaveClass(
      "overflow-hidden",
    );
    expect(
      document.getElementById("map-field-guide-panel")?.parentElement,
    ).toHaveClass("lg:grid-cols-[minmax(0,1fr)_360px]");
    expect(
      screen.getByRole("heading", { name: /buoy, wind, tide/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Start with the buoy." })).toBeInTheDocument();
    expect(
      screen.queryByText(/before trusting the spot number/i),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Close map field guide" }),
    );

    expect(screen.queryByTestId("map-learning-panel")).not.toBeInTheDocument();
  });

  it("renders the interactive buoy wind tide field guide on a shared map", async () => {
    mockSearchParams = new URLSearchParams("share=1");
    const user = userEvent.setup();
    render(<MapView />);

    expect(screen.getByTestId("map-field-guide-toggle")).toBeInTheDocument();
    expect(screen.getByTestId("map-learning-panel")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /buoy, wind, tide/i }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("map-learning-mode-buoy")).toHaveAttribute(
      "aria-selected",
      "true",
    );

    await user.click(screen.getByTestId("map-learning-mode-wind"));

    expect(screen.getByTestId("map-learning-mode-wind")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByText(/wind decides whether the swell/i)).toBeInTheDocument();
    expect(mockTrackMapEvent).toHaveBeenCalledWith("map_interaction", {
      metadata: {
        action: "filter_change",
        filter: "forecast_literacy_mode:wind",
      },
      debounceMs: 0,
    });
  });

  it("renders the map field-guide QR as a smart handoff URL", () => {
    mockSearchParams = new URLSearchParams("share=1");
    render(<MapView />);

    const qr = screen.getByTestId("map-learning-smart-qr");
    const value = qr.getAttribute("data-value") ?? "";
    const parsed = new URL(value);

    expect(parsed.pathname).toBe("/app");
    expect(parsed.searchParams.get("source")).toBe("map_literacy_panel");
    expect(parsed.searchParams.get("surface")).toBe("map");
    expect(parsed.searchParams.get("qr_id")).toBe("map_literacy_field_guide");
    expect(parsed.searchParams.get("target")).toBe("download");
    expect(parsed.searchParams.get("utm_source")).toBe("qr");
    expect(mockTrackQrRendered).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "map_literacy_panel",
        qr_id: "map_literacy_field_guide",
      }),
    );
  });

  it("does not block the map behind geolocation or beach loading", () => {
    mockGeolocationLoading = true;
    mockBeachLoading = true;

    render(<MapView />);

    expect(screen.getByTestId("map-content")).toHaveAttribute(
      "data-loading",
      "false",
    );
  });

  it("strips stale search URL params when toolbar search changes", async () => {
    const user = userEvent.setup();
    mockSearchParams = new URLSearchParams("search=Blacks");

    const { rerender } = render(<MapView />);

    await user.type(
      screen.getByRole("combobox", {
        name: "Search beaches, spots, or cities",
      }),
      "M",
    );

    expect(mockRouterReplace).toHaveBeenCalledWith("/map", { scroll: false });

    mockSetSearchQuery.mockClear();
    mockSearchParams = new URLSearchParams();
    rerender(<MapView />);

    expect(mockSetSearchQuery).not.toHaveBeenCalledWith("");
  });

  it("does not clear search state when the map canvas is clicked", async () => {
    const user = userEvent.setup();
    mockSearchQuery = "Blacks";
    mockFilteredBeaches = [
      {
        id: "blacks",
        name: "Blacks",
        city: "San Diego",
        state: "CA",
        lat: 32.891,
        lon: -117.253,
      },
    ];

    render(<MapView />);
    mockSetSelectedBeach.mockClear();
    mockSetSearchQuery.mockClear();

    await user.click(screen.getByTestId("mock-map-content-click"));

    expect(mockSetSelectedBeach).not.toHaveBeenCalledWith(null);
    expect(mockSetSearchQuery).not.toHaveBeenCalledWith("");
  });

  it("commits a selected search suggestion to the map state", async () => {
    const user = userEvent.setup();
    mockSearchQuery = "isl";
    mockFilteredBeaches = [
      {
        id: "isle-of-palms",
        name: "Isle of Palms",
        city: "Isle of Palms",
        state: "SC",
        lat: 32.7868,
        lon: -79.7948,
      },
      {
        id: "pawleys-island-pier",
        name: "Pawleys Island Pier",
        city: "Pawleys Island",
        state: "SC",
        lat: 33.4294,
        lon: -79.1215,
      },
    ];

    render(<MapView />);

    await user.click(
      screen.getByRole("option", { name: /Isle of Palms Isle of Palms, SC/i }),
    );

    expect(mockSetSearchQuery).toHaveBeenCalledWith("Isle of Palms");
    expect(mockSetSelectedBeach).toHaveBeenCalledWith(mockFilteredBeaches[0]);
  });

  it("uses map clicks and marker drags to update the active placement pin", async () => {
    const user = userEvent.setup();
    const onPlacementPinChange = jest.fn();

    render(
      <MapView
        placementActive
        placementPin={{ lat: 32.77, lon: -117.25 }}
        onPlacementPinChange={onPlacementPinChange}
      />,
    );

    await user.click(screen.getByTestId("mock-map-content-click"));
    await user.click(screen.getByTestId("mock-placement-drag"));

    expect(onPlacementPinChange).toHaveBeenCalledWith({
      lat: 32.82,
      lon: -117.28,
    });
    expect(onPlacementPinChange).toHaveBeenCalledWith({
      lat: 32.83,
      lon: -117.29,
    });
  });

  it("keeps a frozen placement pin visible without allowing map updates", async () => {
    const user = userEvent.setup();
    const onPlacementPinChange = jest.fn();

    render(
      <MapView
        placementActive
        placementPin={{ lat: 32.77, lon: -117.25 }}
        placementPinDraggable={false}
        onPlacementPinChange={onPlacementPinChange}
      />,
    );

    expect(screen.getByTestId("map-content")).toHaveAttribute(
      "data-placement-active",
      "true",
    );
    expect(screen.getByTestId("map-content")).toHaveAttribute(
      "data-placement-draggable",
      "false",
    );
    expect(screen.getByTestId("map-content")).toHaveAttribute(
      "data-placement-pin",
      "32.77,-117.25",
    );

    await user.click(screen.getByTestId("mock-map-content-click"));
    await user.click(screen.getByTestId("mock-placement-drag"));

    expect(onPlacementPinChange).not.toHaveBeenCalled();
  });

  it("strips stale search URL params when a region is selected", async () => {
    const user = userEvent.setup();
    mockSearchParams = new URLSearchParams("search=Blacks");

    render(<MapView />);

    await user.click(
      screen.getByRole("button", { name: "Regions and filters" }),
    );
    await user.click(screen.getByRole("button", { name: "OC" }));

    expect(mockRouterReplace).toHaveBeenCalledWith("/map", { scroll: false });
    expect(mockLoadNearbyBeaches).toHaveBeenCalledWith(33.63, -117.95);
  });

  it("centers on the signed-in home beach without prompting for GPS", async () => {
    mockHomeBeach = { lat: 36.9512, lon: -122.0258 }; // Steamer Lane, Santa Cruz

    render(<MapView />);

    await screen.findByTestId("map-content");

    expect(mockLoadNearbyBeaches).toHaveBeenCalledWith(36.9512, -122.0258);
    expect(mockLoadNearbyBeaches).not.toHaveBeenCalledWith(32.7702, -117.2525);
    expect(mockGetUserLocation).not.toHaveBeenCalled();
  });

  it("falls back to GPS (with a default baseline load) when no home or last beach", async () => {
    render(<MapView />);

    await screen.findByTestId("map-content");
    // Wait a tick for the async last-beach resolver to fall through to GPS.
    await Promise.resolve();

    expect(mockLoadNearbyBeaches).toHaveBeenCalledWith(32.7702, -117.2525);
    expect(mockGetUserLocation).toHaveBeenCalled();
  });

  it("does not render the mobile bottom sheet and keeps marker navigation enabled on mobile", () => {
    mockIsMobile = true;

    render(<MapView />);

    expect(screen.queryByTestId("map-bottom-sheet")).not.toBeInTheDocument();
    expect(screen.getByTestId("map-content")).toHaveAttribute(
      "data-auto-navigate-on-marker-click",
      "true",
    );
  });
});
