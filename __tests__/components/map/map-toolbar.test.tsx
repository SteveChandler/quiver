import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MapToolbar } from "@/components/map/map-toolbar";
import type { Beach } from "@/types/database";

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

    expect(screen.getByTestId("map-controls")).toHaveStyle({
      background: "#F4EBD8",
      color: "#11100D",
    });
    expect(
      screen.getByRole("combobox", {
        name: "Search beaches, spots, or cities",
      }),
    ).toHaveClass("border-2", "border-[#11100D]", "bg-[#F5EEDC]");
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
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
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
    expect(search).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("only shows filters in the filters popover", async () => {
    const user = userEvent.setup();
    render(<MapToolbar {...defaultProps} />);

    await user.click(screen.getByRole("button", { name: "Filters" }));

    expect(screen.queryByText("Regions")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Beginner-friendly" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByRole("button", { name: "beach" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("exposes active filters as pressed toggle buttons", async () => {
    const user = userEvent.setup();
    render(
      <MapToolbar
        {...defaultProps}
        filters={{ beginnerFriendly: true, breakTypes: new Set(["reef"]) }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Filters" }));

    expect(screen.getByRole("button", { name: "Beginner-friendly" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "reef" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
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

  it("keeps the three toolbar actions in one compact mobile row", () => {
    render(<MapToolbar {...defaultProps} showSwellField />);

    const actions = screen.getByTestId("map-toolbar-actions");
    expect(actions.className).toContain("grid-cols-3");
    expect(actions.className).not.toContain("grid-cols-1");
  });

  it("keeps search and toolbar actions at least 44px tall", () => {
    render(<MapToolbar {...defaultProps} searchQuery="Black" />);

    expect(screen.getByRole("combobox")).toHaveClass("h-11");
    expect(screen.getByRole("button", { name: "Clear map search" })).toHaveClass(
      "h-11",
      "w-11",
    );
    expect(screen.getByRole("button", { name: "Filters" })).toHaveClass("h-11");
  });

  it("includes the field guide in the consolidated toolbar action row", async () => {
    const user = userEvent.setup();
    const onOpenFieldGuide = jest.fn();

    render(
      <MapToolbar
        {...defaultProps}
        fieldGuideVisible={false}
        onOpenFieldGuide={onOpenFieldGuide}
      />,
    );

    const actions = screen.getByTestId("map-toolbar-actions");
    const guideToggle = screen.getByTestId("map-field-guide-toggle");

    expect(actions.className).toContain("grid-cols-4");
    expect(actions).toContainElement(guideToggle);

    await user.click(guideToggle);
    expect(onOpenFieldGuide).toHaveBeenCalledTimes(1);
  });

  it("only shows Clear all when active filters exist", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<MapToolbar {...defaultProps} />);

    await user.click(
      screen.getByRole("button", { name: "Filters" }),
    );

    expect(screen.queryByTestId("map-clear-all")).not.toBeInTheDocument();

    rerender(<MapToolbar {...defaultProps} hasActiveFilters />);

    expect(screen.getByTestId("map-clear-all")).toBeInTheDocument();
  });

  it("moves filters into a dropdown", async () => {
    const user = userEvent.setup();
    render(<MapToolbar {...defaultProps} hasActiveFilters />);

    expect(
      screen.getByRole("button", { name: "Filters" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Beginner-friendly" }),
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Filters" }),
    );

    expect(
      screen.getByRole("button", { name: "Beginner-friendly" }),
    ).toBeInTheDocument();
    expect(screen.getByTestId("map-clear-all")).toBeInTheDocument();
  });
});
