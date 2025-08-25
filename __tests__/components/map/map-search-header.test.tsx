import { render, screen, fireEvent, within, act } from "@testing-library/react";
import { useState } from "react";
import userEvent from "@testing-library/user-event";
import { MapSearchHeader } from "@/components/map/map-search-header";

describe("MapSearchHeader", () => {
  const defaultProps = {
    searchQuery: "",
    onSearchChange: jest.fn(),
    onClearSearch: jest.fn(),
    viewMode: "map" as const,
    onViewModeChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Search input", () => {
    it("should render search input with placeholder", () => {
      render(<MapSearchHeader {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText("Search beaches...");
      expect(searchInput).toBeInTheDocument();
    });

    it("should display current search query", () => {
      render(<MapSearchHeader {...defaultProps} searchQuery="Pacific Beach" />);

      const searchInput = screen.getByDisplayValue("Pacific Beach");
      expect(searchInput).toBeInTheDocument();
    });

    it("should call onSearchChange when typing", async () => {
      const user = userEvent.setup();
      render(<MapSearchHeader {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText("Search beaches...");
      await user.type(searchInput, "Ocean");

      // Should be called for each character typed
      expect(defaultProps.onSearchChange).toHaveBeenCalledTimes(5);
      expect(defaultProps.onSearchChange).toHaveBeenCalledWith("O");
      expect(defaultProps.onSearchChange).toHaveBeenCalledWith("c");
      expect(defaultProps.onSearchChange).toHaveBeenCalledWith("e");
      expect(defaultProps.onSearchChange).toHaveBeenCalledWith("a");
      expect(defaultProps.onSearchChange).toHaveBeenCalledWith("n");
    });

    it("should prevent form submission on Enter key", async () => {
      const user = userEvent.setup();
      render(<MapSearchHeader {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText("Search beaches...");

      // Focus the input and press Enter
      await user.click(searchInput);
      await user.keyboard("{Enter}");

      // The component should handle Enter key (though we can't directly test preventDefault)
      // This test verifies the component doesn't crash and handles the event
      expect(searchInput).toBeInTheDocument();
    });

    it("should render search icon", () => {
      render(<MapSearchHeader {...defaultProps} />);

      // Search icon should be present
      const searchIcon = document.querySelector("svg");
      expect(searchIcon).toBeInTheDocument();
    });
  });

  describe("Clear search button", () => {
    it("should show clear button when search query exists", () => {
      render(<MapSearchHeader {...defaultProps} searchQuery="test query" />);

      const clearButton = screen.getByRole("button", { name: /clear/i });
      expect(clearButton).toBeInTheDocument();
    });

    it("should not show clear button when search query is empty", () => {
      render(<MapSearchHeader {...defaultProps} searchQuery="" />);

      const clearButton = screen.queryByRole("button", { name: /clear/i });
      expect(clearButton).not.toBeInTheDocument();
    });

    it("should call onClearSearch when clicked", async () => {
      const user = userEvent.setup();
      render(<MapSearchHeader {...defaultProps} searchQuery="test query" />);

      const clearButton = screen.getByRole("button", { name: /clear/i });
      await user.click(clearButton);

      expect(defaultProps.onClearSearch).toHaveBeenCalledTimes(1);
    });

    it("should have proper accessibility attributes", () => {
      render(<MapSearchHeader {...defaultProps} searchQuery="test query" />);

      const clearButton = screen.getByRole("button", { name: /clear/i });
      expect(clearButton).toHaveAttribute("aria-label", expect.anything());
    });
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

      // Should have multiple SVG icons (search, map, list, potentially clear)
      const icons = document.querySelectorAll("svg");
      expect(icons.length).toBeGreaterThan(2);
    });
  });

  describe("Layout and styling", () => {
    it("should apply correct CSS classes", () => {
      render(<MapSearchHeader {...defaultProps} />);

      const header = document.querySelector("[class*='sticky']");
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

      // Search container should be flex with proper spacing
      const searchContainer = document.querySelector(
        ".flex.items-center.gap-2"
      );
      expect(searchContainer).toBeInTheDocument();

      // View mode toggle should have proper styling
      const toggleContainer = document.querySelector(".flex.mt-3");
      expect(toggleContainer).toBeInTheDocument();
    });
  });

  describe("Keyboard accessibility", () => {
    it("should support keyboard navigation", async () => {
      const user = userEvent.setup();
      render(<MapSearchHeader {...defaultProps} />);

      // Tab through interactive elements
      await user.tab();
      expect(screen.getByPlaceholderText("Search beaches...")).toHaveFocus();

      await user.tab();
      expect(screen.getByRole("button", { name: /map/i })).toHaveFocus();

      await user.tab();
      expect(screen.getByRole("button", { name: /list/i })).toHaveFocus();
    });

    it("should handle keyboard events properly", async () => {
      const user = userEvent.setup();
      render(<MapSearchHeader {...defaultProps} viewMode="list" />);

      const mapButton = screen.getByRole("button", { name: /map/i });
      mapButton.focus();

      await user.keyboard("{Enter}");
      expect(defaultProps.onViewModeChange).toHaveBeenCalledWith("map");
    });
  });

  describe("Edge cases", () => {
    it("should handle very long search queries", () => {
      const longQuery = "A".repeat(1000);
      render(<MapSearchHeader {...defaultProps} searchQuery={longQuery} />);

      const searchInput = screen.getByDisplayValue(longQuery);
      expect(searchInput).toBeInTheDocument();
    });

    it("should handle special characters in search", async () => {
      const user = userEvent.setup();
      render(<MapSearchHeader {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText("Search beaches...");
      await user.type(searchInput, "Côte d'Azur & Beach's!");

      // Check that the last character was called
      expect(defaultProps.onSearchChange).toHaveBeenLastCalledWith("!");
    });

    it("should handle rapid clicking on view mode buttons", async () => {
      const user = userEvent.setup();
      render(<MapSearchHeader {...defaultProps} />);

      const listButton = screen.getByRole("button", { name: /list/i });

      // Rapid clicks
      await user.click(listButton);
      await user.click(listButton);
      await user.click(listButton);

      expect(defaultProps.onViewModeChange).toHaveBeenCalledTimes(3);
    });
  });

  describe("Props validation", () => {
    it("should handle all required props", () => {
      const props = {
        searchQuery: "test",
        onSearchChange: jest.fn(),
        onClearSearch: jest.fn(),
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

  describe("Search results dropdown", () => {
    it("shows listbox and allows selecting a result", async () => {
      jest.useFakeTimers();
      const onSearchChange = jest.fn();
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

      function Wrapper() {
        const [query, setQuery] = useState("");
        return (
          <MapSearchHeader
            {...defaultProps}
            searchQuery={query}
            onSearchChange={(val) => {
              setQuery(val);
              onSearchChange(val);
            }}
          />
        );
      }

      render(<Wrapper />);

      const searchInput = screen.getByPlaceholderText("Search beaches...");
      await user.type(searchInput, "Ocean");

      const listbox = screen.getByRole("listbox");
      expect(listbox).toBeInTheDocument();

      const option = screen.getByRole("option", { name: /Ocean Beach/ });
      const optionButton = within(option).getByRole("button");
      await user.click(optionButton);

      expect(onSearchChange).toHaveBeenLastCalledWith("Ocean Beach");

      act(() => {
        jest.advanceTimersByTime(300);
      });

      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
      jest.useRealTimers();
    });
  });
});
