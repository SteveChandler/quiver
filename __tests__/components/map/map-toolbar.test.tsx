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
      screen.getByRole("combobox", {
        name: "Search beaches, spots, or cities",
      }),
    ).toBeInTheDocument();
  });

  it("calls onSearchChange when typing in the search input", async () => {
    const user = userEvent.setup();
    render(<MapToolbar {...defaultProps} />);

    await user.type(
      screen.getByRole("combobox", {
        name: "Search beaches, spots, or cities",
      }),
      "Black",
    );

    expect(defaultProps.onSearchChange).toHaveBeenCalled();
  });

  it("shows suggestions for a search and selects a suggestion", async () => {
    const user = userEvent.setup();
    render(<MapToolbar {...defaultProps} searchQuery="Black" />);

    await user.click(screen.getByRole("option", { name: /Blacks San Diego, CA/i }));

    expect(defaultProps.onSuggestionSelect).toHaveBeenCalledWith(suggestions[0]);
  });

  it("supports keyboard selection from the suggestions combobox", async () => {
    const user = userEvent.setup();
    render(<MapToolbar {...defaultProps} searchQuery="Black" />);

    const search = screen.getByRole("combobox", {
      name: "Search beaches, spots, or cities",
    });

    expect(search).toHaveAttribute("aria-expanded", "true");

    await user.click(search);
    await user.keyboard("{ArrowDown}{Enter}");

    expect(defaultProps.onSuggestionSelect).toHaveBeenCalledWith(suggestions[0]);
  });

  it("calls onRegionSelect with the selected region pill", async () => {
    const user = userEvent.setup();
    render(<MapToolbar {...defaultProps} />);

    await user.click(
      screen.getByRole("button", { name: "Regions and filters" }),
    );
    await user.click(screen.getByRole("button", { name: "OC" }));

    expect(defaultProps.onRegionSelect).toHaveBeenCalledWith(regions[1]);
  });

  it("does not render the removed Map/List segmented control", () => {
    render(<MapToolbar {...defaultProps} />);

    expect(screen.queryByTestId("view-mode-map")).not.toBeInTheDocument();
    expect(screen.queryByTestId("view-mode-list")).not.toBeInTheDocument();
  });

  it("keeps the swell toggle testid and pressed state", () => {
    render(<MapToolbar {...defaultProps} showSwellField />);

    expect(screen.getByTestId("swell-field-toggle")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("only shows Clear all when active filters exist", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<MapToolbar {...defaultProps} />);

    await user.click(
      screen.getByRole("button", { name: "Regions and filters" }),
    );

    expect(screen.queryByTestId("map-clear-all")).not.toBeInTheDocument();

    rerender(<MapToolbar {...defaultProps} hasActiveFilters />);

    expect(screen.getByTestId("map-clear-all")).toBeInTheDocument();
  });

  it("moves regions and filters into a dropdown", async () => {
    const user = userEvent.setup();
    render(<MapToolbar {...defaultProps} hasActiveFilters />);

    expect(
      screen.getByRole("button", { name: "Regions and filters" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("map-region-pill-san-diego"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Beginner-friendly" }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Regions and filters" }),
    );

    expect(screen.getByTestId("map-region-pill-san-diego")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Beginner-friendly" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("map-clear-all")).toBeInTheDocument();
  });
});
