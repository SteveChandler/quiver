import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MapView } from "@/components/map-view";

const mockLoadNearbyBeaches = jest.fn();
const mockRouterReplace = jest.fn();
const mockSetSearchQuery = jest.fn();
let mockIsMobile = false;
let mockSearchParams = new URLSearchParams();

jest.mock("next/navigation", () => ({
  usePathname: () => "/map",
  useRouter: () => ({ replace: mockRouterReplace }),
  useSearchParams: () => mockSearchParams,
}));

jest.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => mockIsMobile,
}));

jest.mock("@/hooks/use-geolocation", () => ({
  useGeolocation: () => ({
    userLocation: { lat: 32.7702, lon: -117.2525 },
    locationError: null,
    usingDefaultLocation: true,
    hasTimedOut: false,
    loading: false,
    getUserLocation: jest.fn(),
    useDefaultLocation: jest.fn(),
  }),
}));

jest.mock("@/hooks/use-beach-search", () => ({
  useBeachSearch: () => ({
    filteredBeaches: [],
    loading: false,
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

jest.mock("@/components/map/map-content", () => ({
  MapContent: ({
    autoNavigateOnMarkerClick,
    showSwellField,
  }: {
    autoNavigateOnMarkerClick?: boolean;
    showSwellField?: boolean;
  }) => (
    <div
      data-auto-navigate-on-marker-click={String(autoNavigateOnMarkerClick)}
      data-show-swell-field={String(showSwellField)}
      data-testid="map-content"
    />
  ),
}));

describe("MapView", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsMobile = false;
    mockSearchParams = new URLSearchParams();
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
    expect(screen.queryByTestId("view-mode-list")).not.toBeInTheDocument();
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
