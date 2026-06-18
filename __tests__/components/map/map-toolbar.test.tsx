import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MapToolbar } from "@/components/map/map-toolbar";
import type { MapRegionPill } from "@/components/map/map-regions";
import type { Beach } from "@/types/database";

const regions: MapRegionPill[] = [
  { id: "san-diego", label: "San Diego", center: { lat: 32.79, lon: -117.25 } },
  { id: "orange-county", label: "OC", center: { lat: 33.63, lon: -117.95 } },
];

const suggestions = [
  {
    id: "blacks",
    name: "Blacks",
    city: "San Diego",
    state: "CA",
    lat: 32.89,
    lon: -117.25,
  },
] as Beach[];

const defaultProps = {
  searchQuery: "",
  onSearchChange: jest.fn(),
  onClearSearch: jest.fn(),
  suggestions,
  onSuggestionSelect: jest.fn(),
  regions,
  onRegionSelect: jest.fn(),
  onUseMyLocation: jest.fn(),
  viewMode: "map" as const,
  onViewModeChange: jest.fn(),
  filters: { beginnerFriendly: false, breakTypes: new Set<string>() },
  onToggleBeginner: jest.fn(),
  onToggleBreakType: jest.fn(),
  onClearAll: jest.fn(),
  hasActiveFilters: false,
  showSwellField: false,
  onToggleSwellField: jest.fn(),
};

describe("MapToolbar", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders an always-visible beach search input", () => {
    render(<MapToolbar {...defaultProps} />);

    expect(
      screen.getByRole("searchbox", {
        name: "Search beaches, spots, or cities",
      }),
    ).toBeInTheDocument();
  });

  it("calls onSearchChange when typing in the search input", async () => {
    const user = userEvent.setup();
    render(<MapToolbar {...defaultProps} />);

    await user.type(
      screen.getByRole("searchbox", {
        name: "Search beaches, spots, or cities",
      }),
      "Black",
    );

    expect(defaultProps.onSearchChange).toHaveBeenCalled();
  });

  it("shows suggestions for a search and selects a suggestion", async () => {
    const user = userEvent.setup();
    render(<MapToolbar {...defaultProps} searchQuery="Black" />);

    await user.click(screen.getByRole("button", { name: /Blacks San Diego, CA/i }));

    expect(defaultProps.onSuggestionSelect).toHaveBeenCalledWith(suggestions[0]);
  });

  it("calls onRegionSelect with the selected region pill", async () => {
    const user = userEvent.setup();
    render(<MapToolbar {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: "OC" }));

    expect(defaultProps.onRegionSelect).toHaveBeenCalledWith(regions[1]);
  });

  it("calls onViewModeChange from the Map/List segmented control", async () => {
    const user = userEvent.setup();
    render(<MapToolbar {...defaultProps} />);

    await user.click(screen.getByTestId("view-mode-list"));

    expect(defaultProps.onViewModeChange).toHaveBeenCalledWith("list");
  });

  it("keeps the swell toggle testid and pressed state", () => {
    render(<MapToolbar {...defaultProps} showSwellField />);

    expect(screen.getByTestId("swell-field-toggle")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("only shows Clear all when active filters exist", () => {
    const { rerender } = render(<MapToolbar {...defaultProps} />);

    expect(screen.queryByTestId("map-clear-all")).not.toBeInTheDocument();

    rerender(<MapToolbar {...defaultProps} hasActiveFilters />);

    expect(screen.getByTestId("map-clear-all")).toBeInTheDocument();
  });
});
