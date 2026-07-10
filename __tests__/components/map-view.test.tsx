import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MapView } from "@/components/map-view";
import type { Beach } from "@/types/database";

const mockLoadNearbyBeaches = jest.fn();
const mockRouterReplace = jest.fn();
const mockSetSearchQuery = jest.fn();
const mockGetUserLocation = jest.fn();
let mockIsMobile = false;
let mockSearchParams = new URLSearchParams();
let mockGeolocationLoading = false;
let mockUserLocation: { lat: number; lon: number } | null = {
  lat: 32.7702,
  lon: -117.2525,
};
let mockUsingDefaultLocation = true;
let mockBeachLoading = false;
let mockHomeBeach: { lat: number; lon: number } | null = null;
let mockProfileLoading = false;
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
    userLocation: mockUserLocation,
    locationError: null,
    usingDefaultLocation: mockUsingDefaultLocation,
    hasTimedOut: false,
    loading: mockGeolocationLoading,
    getUserLocation: mockGetUserLocation,
    useDefaultLocation: jest.fn(),
  }),
}));

jest.mock("@/hooks/use-beach-search", () => ({
  useBeachSearch: () => ({
    filteredBeaches: [],
    loading: mockBeachLoading,
    searchQuery: "",
    selectedBeach: null,
    filters: { beginnerFriendly: false, breakTypes: new Set<string>() },
    loadBeaches: jest.fn(),
    loadNearbyBeaches: mockLoadNearbyBeaches,
    setSearchQuery: mockSetSearchQuery,
    clearSearch: jest.fn(),
    setSelectedBeach: jest.fn(),
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
let lastMapContentProps: Record<string, unknown> = {};

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
  MapContent: (props: Record<string, unknown>) => {
    const {
      autoNavigateOnMarkerClick,
      customSpots,
      loading,
      showSwellField,
      swellTimelineSteps,
    } = props;
    lastMapContentProps = props;
    return (
    <div
      data-auto-navigate-on-marker-click={String(autoNavigateOnMarkerClick)}
      data-custom-spot-count={String((customSpots as unknown[] | undefined)?.length ?? 0)}
      data-loading={String(loading)}
      data-show-swell-field={String(showSwellField)}
      data-swell-timeline-steps={(swellTimelineSteps as string[] | undefined)?.join(",") ?? ""}
      data-testid="map-content"
    />
    );
  },
}));

describe("MapView", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsMobile = false;
    mockSearchParams = new URLSearchParams();
    mockGeolocationLoading = false;
    mockUserLocation = { lat: 32.7702, lon: -117.2525 };
    mockUsingDefaultLocation = true;
    mockBeachLoading = false;
    mockHomeBeach = null;
    mockProfileLoading = false;
    lastMapContentProps = {};
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
      "data-custom-spot-count",
      "1",
    );
    expect(screen.queryByTestId("view-mode-list")).not.toBeInTheDocument();
  });

  it("passes a 48-hour swell timeline to the map", () => {
    render(<MapView />);

    expect(screen.getByTestId("map-content")).toHaveAttribute(
      "data-swell-timeline-steps",
      "Now,+3h,+6h,+12h,+18h,+24h,+36h,+48h",
    );
  });

  it("shows the field guide trigger but keeps the panel collapsed on the live map", () => {
    render(<MapView />);

    const fieldGuideToggle = screen.getByTestId("map-field-guide-toggle");
    expect(fieldGuideToggle).toBeInTheDocument();
    expect(fieldGuideToggle.closest('[data-testid="map-toolbar-actions"]')).not.toBeNull();
    expect(screen.queryByTestId("map-learning-panel")).not.toBeInTheDocument();
  });

  it("opens and closes the field guide from the live map trigger", async () => {
    const user = userEvent.setup();
    render(<MapView />);

    await user.click(screen.getByTestId("map-field-guide-toggle"));

    expect(screen.getByTestId("map-learning-panel")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /buoy, wind, tide/i }),
    ).toBeInTheDocument();

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

    await waitFor(() => {
      expect(lastMapContentProps.cameraCommand).not.toBeNull();
    });

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

  it("does not restore GPS ownership after region, pin, or map interaction", async () => {
    const alaMoana = {
      id: "ala-moana",
      lat: 21.28,
      lon: -157.85,
    } as Beach;
    render(<MapView />);

    fireEvent.click(screen.getByRole("button", { name: "Regions and filters" }));
    fireEvent.click(screen.getByRole("button", { name: "Hawaii" }));
    expect(
      (lastMapContentProps.cameraCommand as { source: string }).source,
    ).toBe("region");

    act(() => {
      (lastMapContentProps.onBeachSelect as (beach: Beach) => void)(alaMoana);
    });
    expect(
      (lastMapContentProps.cameraCommand as { source: string }).source,
    ).toBe("pin");

    act(() => {
      (lastMapContentProps.onUserCameraInteraction as (interaction: {
        action: "pan" | "zoom" | "rotate";
        center: { lat: number; lon: number };
      }) => void)({
        action: "pan",
        center: { lat: 21.28, lon: -157.85 },
      });
      (lastMapContentProps.onMapClick as () => void)();
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(lastMapContentProps.cameraOwner).toBe("user");
    expect(
      (lastMapContentProps.cameraCommand as { source: string }).source,
    ).toBe("pin");
  });

  it("applies the fresh GPS result from an explicit location request", async () => {
    const { rerender } = render(<MapView />);

    await act(async () => {
      await Promise.resolve();
    });
    await screen.findByTestId("map-content");

    act(() => {
      (lastMapContentProps.onUserCameraInteraction as (interaction: {
        action: "pan" | "zoom" | "rotate";
        center: { lat: number; lon: number };
      }) => void)({
        action: "pan",
        center: { lat: 21.28, lon: -157.85 },
      });
    });
    const previousId = (lastMapContentProps.cameraCommand as { id: number }).id;
    const previousCommand = lastMapContentProps.cameraCommand;

    act(() => {
      (lastMapContentProps.onGetUserLocation as () => void)();
    });

    expect(mockGetUserLocation).toHaveBeenCalledWith(true);
    expect(lastMapContentProps.cameraOwner).toBe("user");
    expect(lastMapContentProps.cameraCommand).toBe(previousCommand);

    mockGeolocationLoading = true;
    rerender(<MapView />);
    expect(lastMapContentProps.cameraCommand).toBe(previousCommand);

    mockUserLocation = { lat: 34.0195, lon: -118.4912 };
    mockUsingDefaultLocation = false;
    mockGeolocationLoading = false;
    rerender(<MapView />);

    await waitFor(() => {
      expect(lastMapContentProps.cameraOwner).toBe("explicit-command");
    });
    expect(lastMapContentProps.cameraCommand).toMatchObject({
      id: previousId + 1,
      source: "gps",
      center: { lat: 34.0195, lon: -118.4912 },
    });
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
