import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MapView, resolveViewedMapTimezone } from "@/components/map-view";
import type { Beach } from "@/types/database";

const mockLoadNearbyBeaches = jest.fn();
const mockRouterReplace = jest.fn();
const mockRouterPush = jest.fn();
const mockSetSearchQuery = jest.fn();
const mockSetSelectedBeach = jest.fn();
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
let mockProfileLoading = true;
let mockFilteredBeaches: Beach[] = [];
let mockResultsQuery = "";
let mockSearchQuery = "";
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
  useRouter: () => ({ replace: mockRouterReplace, push: mockRouterPush }),
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
    filteredBeaches: mockFilteredBeaches,
    resultsQuery: mockResultsQuery,
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
      swellTimelineMode,
      viewTimezone,
    } = props;
    lastMapContentProps = props;
    return (
    <div
      data-auto-navigate-on-marker-click={String(autoNavigateOnMarkerClick)}
      data-custom-spot-count={String((customSpots as unknown[] | undefined)?.length ?? 0)}
      data-loading={String(loading)}
      data-show-swell-field={String(showSwellField)}
      data-swell-timeline-steps={(swellTimelineSteps as string[] | undefined)?.join(",") ?? ""}
      data-swell-timeline-mode={String(swellTimelineMode)}
      data-view-timezone={String(viewTimezone)}
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
    mockProfileLoading = true;
    mockFilteredBeaches = [];
    mockResultsQuery = "";
    mockSearchQuery = "";
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

  it("dismisses the location prompt when Use Near Me is requested", async () => {
    const user = userEvent.setup();
    render(<MapView />);

    expect(lastMapContentProps.locationDeniedPromptDismissed).toBe(false);

    await user.click(screen.getByRole("button", { name: "Use Near Me" }));

    expect(lastMapContentProps.locationDeniedPromptDismissed).toBe(true);
    expect(mockGetUserLocation).toHaveBeenCalledWith(true);
  });

  it("resolves viewed timezone from selected beach, explored beaches, then region", () => {
    const honolulu = {
      id: "honolulu",
      lat: 21.28,
      lon: -157.85,
      timezone: "Pacific/Honolulu",
    } as Beach;
    const sanDiego = {
      id: "san-diego",
      lat: 32.75,
      lon: -117.25,
      timezone: "America/Los_Angeles",
    } as Beach;
    expect(
      resolveViewedMapTimezone({
        selectedBeach: sanDiego,
        loadedBeaches: [honolulu, sanDiego],
        viewCenter: { lat: 21.29, lon: -157.86 },
      }),
    ).toBe("America/Los_Angeles");
    expect(
      resolveViewedMapTimezone({
        selectedBeach: null,
        loadedBeaches: [honolulu, sanDiego],
        viewCenter: { lat: 21.29, lon: -157.86 },
      }),
    ).toBe("Pacific/Honolulu");
  });

  it("enables the expandable local-time timeline for the public map", () => {
    render(<MapView />);

    expect(screen.getByTestId("map-content")).toHaveAttribute(
      "data-swell-timeline-mode",
      "expandable-hourly",
    );
    expect(screen.getByTestId("map-content")).toHaveAttribute("data-swell-timeline-steps", "");
  });

  it("commands once per search query while result reorders remain presentation-only", async () => {
    const alaMoana = {
      id: "ala-moana",
      name: "Ala Moana Bowls",
      lat: 21.28,
      lon: -157.85,
      timezone: "Pacific/Honolulu",
    } as Beach;
    const queens = {
      id: "queens",
      name: "Queens",
      lat: 21.27,
      lon: -157.83,
      timezone: "Pacific/Honolulu",
    } as Beach;
    mockSearchQuery = "south shore";
    mockResultsQuery = "south shore";
    mockFilteredBeaches = [alaMoana];
    const { rerender } = render(<MapView />);

    await waitFor(() => {
      expect((lastMapContentProps.cameraCommand as { source: string }).source)
        .toBe("search");
    });
    expect(screen.getByTestId("map-content")).toHaveAttribute(
      "data-view-timezone",
      "Pacific/Honolulu",
    );
    const firstSearchCommand = lastMapContentProps.cameraCommand as {
      id: number;
      source: string;
    };

    mockFilteredBeaches = [queens];
    rerender(<MapView />);
    expect(lastMapContentProps.cameraCommand).toBe(firstSearchCommand);

    mockSearchQuery = "waikiki";
    mockResultsQuery = "waikiki";
    rerender(<MapView />);
    await waitFor(() => {
      expect((lastMapContentProps.cameraCommand as { id: number }).id)
        .toBeGreaterThan(firstSearchCommand.id);
    });
    expect((lastMapContentProps.cameraCommand as { source: string }).source)
      .toBe("search");

    act(() => {
      (lastMapContentProps.onBeachSelect as (beach: Beach) => void)(queens);
    });
    expect((lastMapContentProps.cameraCommand as { source: string }).source)
      .toBe("pin");
  });

  it("waits for results from the current query before issuing a search camera command", async () => {
    const missionBeach = {
      id: "mission-beach",
      name: "Mission Beach",
      lat: 32.7702,
      lon: -117.2525,
    } as Beach;
    const waikiki = {
      id: "waikiki",
      name: "Waikiki",
      lat: 21.2767,
      lon: -157.8263,
    } as Beach;

    mockSearchQuery = "waikiki";
    mockResultsQuery = "mission beach";
    mockFilteredBeaches = [missionBeach];
    const { rerender } = render(<MapView />);

    expect(
      (lastMapContentProps.cameraCommand as { source?: string } | null)?.source,
    ).not.toBe("search");

    mockResultsQuery = "waikiki";
    mockFilteredBeaches = [waikiki];
    rerender(<MapView />);

    await waitFor(() => {
      expect(lastMapContentProps.cameraCommand).toMatchObject({
        source: "search",
        center: { lat: 21.2767, lon: -157.8263 },
      });
    });
  });

  it("keeps search suggestion selection on the map and centers the selected beach", async () => {
    const waikiki = {
      id: "waikiki",
      name: "Waikiki",
      slug: "waikiki",
      city: "Honolulu",
      state: "HI",
      lat: 21.2767,
      lon: -157.8263,
    } as Beach;
    mockSearchQuery = "waikiki";
    mockResultsQuery = "waikiki";
    mockFilteredBeaches = [waikiki];
    const user = userEvent.setup();

    render(<MapView />);
    await user.click(screen.getByRole("option", { name: /Waikiki/i }));

    expect(mockSetSelectedBeach).toHaveBeenCalledWith(waikiki);
    expect(lastMapContentProps.cameraCommand).toMatchObject({
      source: "pin",
      center: { lat: 21.2767, lon: -157.8263 },
    });
    expect(mockRouterPush).not.toHaveBeenCalled();
    expect(screen.queryByTestId("map-search-suggestions")).not.toBeInTheDocument();
    expect(screen.getByRole("combobox")).toHaveValue("waikiki");
  });

  it("uses the final user move center for timezone and background beach loading without recentering", () => {
    mockFilteredBeaches = [
      { id: "sd", lat: 32.75, lon: -117.25, timezone: "America/Los_Angeles" } as Beach,
      { id: "hi", lat: 21.28, lon: -157.85, timezone: "Pacific/Honolulu" } as Beach,
    ];
    render(<MapView />);
    const initialCommand = lastMapContentProps.cameraCommand;
    mockLoadNearbyBeaches.mockClear();

    const report = lastMapContentProps.onUserCameraInteraction as (interaction: {
      action: "pan";
      center: { lat: number; lon: number };
      phase: "start" | "end";
    }) => void;
    act(() => report({
      action: "pan",
      center: { lat: 32.75, lon: -117.25 },
      phase: "start",
    }));
    expect(lastMapContentProps.cameraOwner).toBe("user");
    expect(screen.getByTestId("map-content")).toHaveAttribute(
      "data-view-timezone",
      "UTC",
    );

    act(() => report({
      action: "pan",
      center: { lat: 21.29, lon: -157.86 },
      phase: "end",
    }));
    expect(screen.getByTestId("map-content")).toHaveAttribute(
      "data-view-timezone",
      "Pacific/Honolulu",
    );
    expect(lastMapContentProps.cameraCommand).toBe(initialCommand);
    expect(mockLoadNearbyBeaches).toHaveBeenCalledTimes(1);
    expect(mockLoadNearbyBeaches).toHaveBeenCalledWith(21.29, -157.86, { background: true });
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

    const guideTrigger = screen.getByTestId("map-field-guide-toggle");

    await user.click(guideTrigger);

    const panel = screen.getByTestId("map-learning-panel");
    expect(panel).toBeInTheDocument();
    expect(panel.parentElement).toHaveClass("min-h-0", "overflow-hidden");
    expect(panel.parentElement?.parentElement).toHaveClass(
      "grid-rows-[minmax(240px,1fr)_minmax(0,1fr)]",
    );
    expect(
      screen.getByRole("heading", { name: /buoy, wind, tide/i }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Close map field guide" }),
    );

    expect(screen.queryByTestId("map-learning-panel")).not.toBeInTheDocument();
    expect(guideTrigger).toHaveFocus();
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

    const windTab = screen.getByTestId("map-learning-mode-wind");
    fireEvent.keyDown(windTab, { key: "ArrowRight" });
    const tideTab = screen.getByTestId("map-learning-mode-tide");
    expect(tideTab).toHaveFocus();
    expect(tideTab).toHaveAttribute("aria-selected", "true");
    expect(tideTab).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("tabpanel")).toHaveAttribute(
      "aria-labelledby",
      "map-learning-tab-tide",
    );

    fireEvent.keyDown(tideTab, { key: "Home" });
    expect(screen.getByTestId("map-learning-mode-buoy")).toHaveFocus();
  });

  it("renders the map field-guide QR as a smart handoff URL", () => {
    mockSearchParams = new URLSearchParams("share=1");
    render(<MapView />);

    const qr = screen.getByTestId("map-learning-smart-qr");
    const value = qr.getAttribute("data-value") ?? "";
    const parsed = new URL(value);

    expect(parsed.pathname).toBe("/app/handoff");
    expect(parsed.searchParams.get("source")).toBe("map_literacy_panel");
    expect(parsed.searchParams.get("surface")).toBe("map");
    expect(parsed.searchParams.get("qr_id")).toBe("map_literacy_field_guide");
    expect(parsed.searchParams.get("target")).toBe("download");
    expect(parsed.searchParams.get("utm_source")).toBe("qr");
    expect(screen.queryByText("Smart QR")).not.toBeInTheDocument();
    expect(screen.getByText(/take the map with you/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Get the app" })).toHaveClass("min-h-11");
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

  it("centers on the signed-in home beach without prompting for GPS", async () => {
    mockProfileLoading = false;
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
    mockProfileLoading = false;
    render(<MapView />);

    await waitFor(() => {
      expect(mockLoadNearbyBeaches).toHaveBeenCalledWith(32.7702, -117.2525);
      expect(mockGetUserLocation).toHaveBeenCalled();
    });
  });

  it("does not restore GPS ownership after pin or map interaction", async () => {
    mockProfileLoading = false;
    const alaMoana = {
      id: "ala-moana",
      lat: 21.28,
      lon: -157.85,
    } as Beach;
    const { rerender } = render(<MapView />);

    act(() => {
      (lastMapContentProps.onBeachSelect as (beach: Beach) => void)(alaMoana);
    });
    expect(
      (lastMapContentProps.cameraCommand as { source: string }).source,
    ).toBe("pin");

    mockLoadNearbyBeaches.mockClear();
    mockUserLocation = { lat: 32.7702, lon: -117.2525 };
    rerender(<MapView />);
    expect(mockLoadNearbyBeaches).not.toHaveBeenCalledWith(
      32.7702,
      -117.2525,
    );

    act(() => {
      (lastMapContentProps.onUserCameraInteraction as (interaction: {
        action: "pan" | "zoom" | "rotate";
        center: { lat: number; lon: number };
        phase: "start" | "end";
      }) => void)({
        action: "pan",
        center: { lat: 21.28, lon: -157.85 },
        phase: "start",
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
    mockProfileLoading = false;
    const { rerender } = render(<MapView />);

    await act(async () => {
      await Promise.resolve();
    });
    await screen.findByTestId("map-content");

    act(() => {
      (lastMapContentProps.onUserCameraInteraction as (interaction: {
        action: "pan" | "zoom" | "rotate";
        center: { lat: number; lon: number };
        phase: "start" | "end";
      }) => void)({
        action: "pan",
        center: { lat: 21.28, lon: -157.85 },
        phase: "start",
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
