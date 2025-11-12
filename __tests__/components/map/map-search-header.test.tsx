import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MapSearchHeader } from "@/components/map/map-search-header";

describe("MapSearchHeader", () => {
  const defaultProps = {
    viewMode: "map" as const,
    onViewModeChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("View mode toggle", () => {
    it("should render both map and list buttons", () => {
      render(<MapSearchHeader {...defaultProps} />);

      const mapButton = screen.getByRole("button", { name: /map/i });
      const listButton = screen.getByRole("button", { name: /list/i });

      expect(mapButton).toBeInTheDocument();
      expect(listButton).toBeInTheDocument();
    });

    it("should highlight active view mode", () => {
      render(<MapSearchHeader {...defaultProps} viewMode="map" />);

      const mapButton = screen.getByRole("button", { name: /map/i });
      const listButton = screen.getByRole("button", { name: /list/i });

      // Map button should have default variant (active)
      expect(mapButton).toHaveClass("bg-primary");
      // List button should have ghost variant (inactive)
      expect(listButton).toHaveClass("hover:bg-accent");
    });

    it("should call onViewModeChange when map button clicked", async () => {
      const user = userEvent.setup();
      render(<MapSearchHeader {...defaultProps} viewMode="list" />);

      const mapButton = screen.getByRole("button", { name: /map/i });
      await user.click(mapButton);

      expect(defaultProps.onViewModeChange).toHaveBeenCalledWith("map");
    });

    it("should call onViewModeChange when list button clicked", async () => {
      const user = userEvent.setup();
      render(<MapSearchHeader {...defaultProps} viewMode="map" />);

      const listButton = screen.getByRole("button", { name: /list/i });
      await user.click(listButton);

      expect(defaultProps.onViewModeChange).toHaveBeenCalledWith("list");
    });

    it("should render icons for both buttons", () => {
      render(<MapSearchHeader {...defaultProps} />);

      const mapButton = screen.getByRole("button", { name: /map/i });
      const listButton = screen.getByRole("button", { name: /list/i });

      // Both buttons should have icons (svg elements)
      expect(mapButton.querySelector("svg")).toBeInTheDocument();
      expect(listButton.querySelector("svg")).toBeInTheDocument();
    });
  });

  describe("Near me button", () => {
    it("should render near me button when onNearMe prop provided", () => {
      const onNearMe = jest.fn();
      render(<MapSearchHeader {...defaultProps} onNearMe={onNearMe} />);

      const nearMeButton = screen.getByRole("button", { name: /use near me/i });
      expect(nearMeButton).toBeInTheDocument();
    });

    it("should not render near me button when onNearMe prop not provided", () => {
      render(<MapSearchHeader {...defaultProps} />);

      const nearMeButton = screen.queryByRole("button", { name: /use near me/i });
      expect(nearMeButton).not.toBeInTheDocument();
    });

    it("should call onNearMe when clicked", async () => {
      const user = userEvent.setup();
      const onNearMe = jest.fn();
      render(<MapSearchHeader {...defaultProps} onNearMe={onNearMe} />);

      const nearMeButton = screen.getByRole("button", { name: /use near me/i });
      await user.click(nearMeButton);

      expect(onNearMe).toHaveBeenCalledTimes(1);
    });
  });

  describe("Layout and styling", () => {
    it("should apply correct CSS classes", () => {
      render(<MapSearchHeader {...defaultProps} />);

      const header = screen.getByTestId("map-controls");
      expect(header).toHaveClass(
        "sticky",
        "top-0",
        "z-10",
        "bg-background",
        "border-b",
        "p-4"
      );
    });

    it("should maintain responsive layout", () => {
      render(<MapSearchHeader {...defaultProps} />);

      // Container should be flex with proper spacing
      const container = screen.getByTestId("map-controls").querySelector(".flex.items-center.gap-2");
      expect(container).toBeInTheDocument();
    });
  });

  describe("Deprecated search props", () => {
    it("should ignore deprecated search props", () => {
      // Component no longer renders search input, but accepts props for backward compatibility
      render(
        <MapSearchHeader
          {...defaultProps}
          searchQuery="test"
          onSearchChange={jest.fn()}
          onClearSearch={jest.fn()}
        />
      );

      // Search input should not be rendered
      const searchInput = screen.queryByPlaceholderText("Search beaches...");
      expect(searchInput).not.toBeInTheDocument();
    });
  });

  describe("Props validation", () => {
    it("should handle all required props", () => {
      const props = {
        viewMode: "list" as const,
        onViewModeChange: jest.fn(),
      };

      expect(() => render(<MapSearchHeader {...props} />)).not.toThrow();
    });

    it("should handle different view modes correctly", () => {
      const { rerender } = render(
        <MapSearchHeader {...defaultProps} viewMode="map" />
      );
      expect(screen.getByRole("button", { name: /map/i })).toBeInTheDocument();

      rerender(<MapSearchHeader {...defaultProps} viewMode="list" />);
      expect(screen.getByRole("button", { name: /list/i })).toBeInTheDocument();
    });
  });
});
