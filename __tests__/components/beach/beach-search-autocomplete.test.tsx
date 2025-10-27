import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BeachSearchAutocomplete } from "@/components/beach/beach-search-autocomplete";
import type { Beach } from "@/types/database";

// Mock Next.js router
const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

// Mock beach autocomplete hook
const mockSetQuery = jest.fn();
const mockHandleKeyDown = jest.fn();
const mockHandleSelect = jest.fn();
const mockSetIsOpen = jest.fn();
const mockClearSearch = jest.fn();

const mockUseBeachAutocomplete = jest.fn();

jest.mock("@/hooks/use-beach-autocomplete", () => ({
  useBeachAutocomplete: (options: any) => mockUseBeachAutocomplete(options),
}));

const mockBeaches: Beach[] = [
  {
    id: "1",
    name: "Swami's",
    slug: "swamis",
    location: "Encinitas, CA",
    break_type: "Point Break",
    average_rating: 4.5,
    lat: 33.0353,
    lon: -117.2913,
    created_at: "",
    updated_at: "",
    description: null,
    location_text: null,
    is_spot: true,
  } as Beach,
  {
    id: "2",
    name: "Ocean Beach",
    slug: "ocean-beach",
    location: "San Diego, CA",
    break_type: "Beach Break",
    average_rating: 3.2,
    lat: 32.7503,
    lon: -117.2534,
    created_at: "",
    updated_at: "",
    description: null,
    location_text: null,
    is_spot: true,
  } as Beach,
  {
    id: "3",
    name: "Black's Beach",
    slug: "blacks-beach",
    location: "La Jolla, CA",
    break_type: "Beach Break",
    average_rating: 2.8,
    lat: 32.8877,
    lon: -117.2531,
    created_at: "",
    updated_at: "",
    description: null,
    location_text: null,
    is_spot: true,
  } as Beach,
];

describe("BeachSearchAutocomplete", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock return value
    mockUseBeachAutocomplete.mockReturnValue({
      query: "",
      suggestions: [],
      loading: false,
      isOpen: false,
      selectedIndex: 0,
      setQuery: mockSetQuery,
      handleKeyDown: mockHandleKeyDown,
      handleSelect: mockHandleSelect,
      setIsOpen: mockSetIsOpen,
      clearSearch: mockClearSearch,
      error: null,
    });
  });

  it("renders with placeholder text", () => {
    render(
      <BeachSearchAutocomplete placeholder="Search surf spots..." />
    );

    expect(screen.getByPlaceholderText("Search surf spots...")).toBeInTheDocument();
  });

  it("renders with custom placeholder", () => {
    render(
      <BeachSearchAutocomplete placeholder="Find your beach..." />
    );

    expect(screen.getByPlaceholderText("Find your beach...")).toBeInTheDocument();
  });

  describe("Loading state", () => {
    it("shows loading spinner during search", () => {
      mockUseBeachAutocomplete.mockReturnValue({
        query: "swami",
        suggestions: [],
        loading: true,
        isOpen: true,
        selectedIndex: 0,
        setQuery: mockSetQuery,
        handleKeyDown: mockHandleKeyDown,
        handleSelect: mockHandleSelect,
        setIsOpen: mockSetIsOpen,
        clearSearch: mockClearSearch,
        error: null,
      });

      render(<BeachSearchAutocomplete />);

      const loader = document.querySelector(".animate-spin");
      expect(loader).toBeInTheDocument();
    });

    it("hides loading spinner when not loading", () => {
      mockUseBeachAutocomplete.mockReturnValue({
        query: "swami",
        suggestions: mockBeaches,
        loading: false,
        isOpen: true,
        selectedIndex: 0,
        setQuery: mockSetQuery,
        handleKeyDown: mockHandleKeyDown,
        handleSelect: mockHandleSelect,
        setIsOpen: mockSetIsOpen,
        clearSearch: mockClearSearch,
        error: null,
      });

      render(<BeachSearchAutocomplete />);

      const loader = document.querySelector(".animate-spin");
      expect(loader).not.toBeInTheDocument();
    });
  });

  describe("Search suggestions", () => {
    it("displays suggestions when available", () => {
      mockUseBeachAutocomplete.mockReturnValue({
        query: "beach",
        suggestions: mockBeaches,
        loading: false,
        isOpen: true,
        selectedIndex: 0,
        setQuery: mockSetQuery,
        handleKeyDown: mockHandleKeyDown,
        handleSelect: mockHandleSelect,
        setIsOpen: mockSetIsOpen,
        clearSearch: mockClearSearch,
        error: null,
      });

      render(<BeachSearchAutocomplete />);

      // Check that suggestions are rendered (Command component may virtualize)
      const options = screen.getAllByRole("option");
      expect(options.length).toBeGreaterThan(0);

      // Verify at least some beach names are visible
      expect(screen.getByText("Ocean Beach")).toBeInTheDocument();
      expect(screen.getByText("Black's Beach")).toBeInTheDocument();
    });

    it("shows heading 'Surf Spots' when suggestions exist", () => {
      mockUseBeachAutocomplete.mockReturnValue({
        query: "beach",
        suggestions: mockBeaches,
        loading: false,
        isOpen: true,
        selectedIndex: 0,
        setQuery: mockSetQuery,
        handleKeyDown: mockHandleKeyDown,
        handleSelect: mockHandleSelect,
        setIsOpen: mockSetIsOpen,
        clearSearch: mockClearSearch,
        error: null,
      });

      render(<BeachSearchAutocomplete />);

      expect(screen.getByText("Surf Spots")).toBeInTheDocument();
    });

    it("displays beach location and break type", () => {
      mockUseBeachAutocomplete.mockReturnValue({
        query: "swami",
        suggestions: [mockBeaches[0]],
        loading: false,
        isOpen: true,
        selectedIndex: 0,
        setQuery: mockSetQuery,
        handleKeyDown: mockHandleKeyDown,
        handleSelect: mockHandleSelect,
        setIsOpen: mockSetIsOpen,
        clearSearch: mockClearSearch,
        error: null,
      });

      render(<BeachSearchAutocomplete />);

      expect(screen.getByText(/Encinitas, CA/)).toBeInTheDocument();
      expect(screen.getByText(/Point Break/)).toBeInTheDocument();
    });

    it("displays beach rating", () => {
      mockUseBeachAutocomplete.mockReturnValue({
        query: "swami",
        suggestions: [mockBeaches[0]],
        loading: false,
        isOpen: true,
        selectedIndex: 0,
        setQuery: mockSetQuery,
        handleKeyDown: mockHandleKeyDown,
        handleSelect: mockHandleSelect,
        setIsOpen: mockSetIsOpen,
        clearSearch: mockClearSearch,
        error: null,
      });

      render(<BeachSearchAutocomplete />);

      expect(screen.getByText(/4\.5/)).toBeInTheDocument();
    });
  });

  describe("Empty state", () => {
    it("shows empty message when no results", () => {
      mockUseBeachAutocomplete.mockReturnValue({
        query: "xyz123",
        suggestions: [],
        loading: false,
        isOpen: true,
        selectedIndex: 0,
        setQuery: mockSetQuery,
        handleKeyDown: mockHandleKeyDown,
        handleSelect: mockHandleSelect,
        setIsOpen: mockSetIsOpen,
        clearSearch: mockClearSearch,
        error: null,
      });

      render(<BeachSearchAutocomplete />);

      expect(screen.getByText(/No beaches found matching "xyz123"/)).toBeInTheDocument();
    });

    it("shows helpful suggestion in empty state", () => {
      mockUseBeachAutocomplete.mockReturnValue({
        query: "xyz",
        suggestions: [],
        loading: false,
        isOpen: true,
        selectedIndex: 0,
        setQuery: mockSetQuery,
        handleKeyDown: mockHandleKeyDown,
        handleSelect: mockHandleSelect,
        setIsOpen: mockSetIsOpen,
        clearSearch: mockClearSearch,
        error: null,
      });

      render(<BeachSearchAutocomplete />);

      expect(screen.getByText(/Try searching for a specific beach name/)).toBeInTheDocument();
    });

    it("does not show suggestions when dropdown is closed", () => {
      mockUseBeachAutocomplete.mockReturnValue({
        query: "beach",
        suggestions: mockBeaches,
        loading: false,
        isOpen: false,
        selectedIndex: 0,
        setQuery: mockSetQuery,
        handleKeyDown: mockHandleKeyDown,
        handleSelect: mockHandleSelect,
        setIsOpen: mockSetIsOpen,
        clearSearch: mockClearSearch,
        error: null,
      });

      render(<BeachSearchAutocomplete />);

      expect(screen.queryByText("Swami's")).not.toBeInTheDocument();
    });

    it("does not show suggestions when query is too short", () => {
      mockUseBeachAutocomplete.mockReturnValue({
        query: "b",
        suggestions: mockBeaches,
        loading: false,
        isOpen: false,
        selectedIndex: 0,
        setQuery: mockSetQuery,
        handleKeyDown: mockHandleKeyDown,
        handleSelect: mockHandleSelect,
        setIsOpen: mockSetIsOpen,
        clearSearch: mockClearSearch,
        error: null,
      });

      render(<BeachSearchAutocomplete />);

      expect(screen.queryByText("Swami's")).not.toBeInTheDocument();
    });
  });

  describe("Condition badges", () => {
    it("shows GOOD badge for high ratings (>=4.0)", () => {
      mockUseBeachAutocomplete.mockReturnValue({
        query: "swami",
        suggestions: [mockBeaches[0]], // rating 4.5
        loading: false,
        isOpen: true,
        selectedIndex: 0,
        setQuery: mockSetQuery,
        handleKeyDown: mockHandleKeyDown,
        handleSelect: mockHandleSelect,
        setIsOpen: mockSetIsOpen,
        clearSearch: mockClearSearch,
        error: null,
      });

      render(
        <BeachSearchAutocomplete showCurrentConditions={true} />
      );

      expect(screen.getByText("GOOD")).toBeInTheDocument();
    });

    it("shows FAIR badge for medium ratings (3.0-4.0)", () => {
      mockUseBeachAutocomplete.mockReturnValue({
        query: "ocean",
        suggestions: [mockBeaches[1]], // rating 3.2
        loading: false,
        isOpen: true,
        selectedIndex: 0,
        setQuery: mockSetQuery,
        handleKeyDown: mockHandleKeyDown,
        handleSelect: mockHandleSelect,
        setIsOpen: mockSetIsOpen,
        clearSearch: mockClearSearch,
        error: null,
      });

      render(
        <BeachSearchAutocomplete showCurrentConditions={true} />
      );

      expect(screen.getByText("FAIR")).toBeInTheDocument();
    });

    it("shows POOR badge for low ratings (<3.0)", () => {
      mockUseBeachAutocomplete.mockReturnValue({
        query: "blacks",
        suggestions: [mockBeaches[2]], // rating 2.8
        loading: false,
        isOpen: true,
        selectedIndex: 0,
        setQuery: mockSetQuery,
        handleKeyDown: mockHandleKeyDown,
        handleSelect: mockHandleSelect,
        setIsOpen: mockSetIsOpen,
        clearSearch: mockClearSearch,
        error: null,
      });

      render(
        <BeachSearchAutocomplete showCurrentConditions={true} />
      );

      expect(screen.getByText("POOR")).toBeInTheDocument();
    });

    it("does not show badge when showCurrentConditions is false", () => {
      mockUseBeachAutocomplete.mockReturnValue({
        query: "swami",
        suggestions: [mockBeaches[0]],
        loading: false,
        isOpen: true,
        selectedIndex: 0,
        setQuery: mockSetQuery,
        handleKeyDown: mockHandleKeyDown,
        handleSelect: mockHandleSelect,
        setIsOpen: mockSetIsOpen,
        clearSearch: mockClearSearch,
        error: null,
      });

      render(
        <BeachSearchAutocomplete showCurrentConditions={false} />
      );

      expect(screen.queryByText("GOOD")).not.toBeInTheDocument();
      expect(screen.queryByText("FAIR")).not.toBeInTheDocument();
      expect(screen.queryByText("POOR")).not.toBeInTheDocument();
    });
  });

  describe("Beach selection", () => {
    it("calls onSelect callback when beach is clicked", async () => {
      const user = userEvent.setup();
      const onSelect = jest.fn();

      mockUseBeachAutocomplete.mockReturnValue({
        query: "swami",
        suggestions: [mockBeaches[0]],
        loading: false,
        isOpen: true,
        selectedIndex: 0,
        setQuery: mockSetQuery,
        handleKeyDown: mockHandleKeyDown,
        handleSelect: mockHandleSelect,
        setIsOpen: mockSetIsOpen,
        clearSearch: mockClearSearch,
        error: null,
      });

      render(
        <BeachSearchAutocomplete onSelect={onSelect} />
      );

      await user.click(screen.getByText("Swami's"));

      expect(mockHandleSelect).toHaveBeenCalledWith(mockBeaches[0]);
      expect(onSelect).toHaveBeenCalledWith(mockBeaches[0]);
    });

    it("navigates to beach detail page when no onSelect callback", async () => {
      const user = userEvent.setup();

      mockUseBeachAutocomplete.mockReturnValue({
        query: "swami",
        suggestions: [mockBeaches[0]],
        loading: false,
        isOpen: true,
        selectedIndex: 0,
        setQuery: mockSetQuery,
        handleKeyDown: mockHandleKeyDown,
        handleSelect: mockHandleSelect,
        setIsOpen: mockSetIsOpen,
        clearSearch: mockClearSearch,
        error: null,
      });

      render(<BeachSearchAutocomplete />);

      await user.click(screen.getByText("Swami's"));

      expect(mockPush).toHaveBeenCalledWith("/beach/swamis");
    });

    it("navigates using beach id when slug is missing", async () => {
      const user = userEvent.setup();
      const beachWithoutSlug = { ...mockBeaches[0], slug: undefined };

      mockUseBeachAutocomplete.mockReturnValue({
        query: "swami",
        suggestions: [beachWithoutSlug],
        loading: false,
        isOpen: true,
        selectedIndex: 0,
        setQuery: mockSetQuery,
        handleKeyDown: mockHandleKeyDown,
        handleSelect: mockHandleSelect,
        setIsOpen: mockSetIsOpen,
        clearSearch: mockClearSearch,
        error: null,
      });

      render(<BeachSearchAutocomplete />);

      await user.click(screen.getByText("Swami's"));

      expect(mockPush).toHaveBeenCalledWith("/beach/1");
    });
  });

  describe("Keyboard navigation", () => {
    it("calls handleKeyDown from hook on key events", async () => {
      const user = userEvent.setup();

      mockUseBeachAutocomplete.mockReturnValue({
        query: "beach",
        suggestions: mockBeaches,
        loading: false,
        isOpen: true,
        selectedIndex: 0,
        setQuery: mockSetQuery,
        handleKeyDown: mockHandleKeyDown,
        handleSelect: mockHandleSelect,
        setIsOpen: mockSetIsOpen,
        clearSearch: mockClearSearch,
        error: null,
      });

      render(<BeachSearchAutocomplete />);

      const input = screen.getByPlaceholderText("Search surf spots...");
      await user.type(input, "{ArrowDown}");

      expect(mockHandleKeyDown).toHaveBeenCalled();
    });

    it("selects beach with Enter key when dropdown is open", async () => {
      const user = userEvent.setup();
      const onSelect = jest.fn();

      mockUseBeachAutocomplete.mockReturnValue({
        query: "swami",
        suggestions: [mockBeaches[0]],
        loading: false,
        isOpen: true,
        selectedIndex: 0,
        setQuery: mockSetQuery,
        handleKeyDown: mockHandleKeyDown,
        handleSelect: mockHandleSelect,
        setIsOpen: mockSetIsOpen,
        clearSearch: mockClearSearch,
        error: null,
      });

      render(
        <BeachSearchAutocomplete onSelect={onSelect} />
      );

      const input = screen.getByPlaceholderText("Search surf spots...");
      await user.type(input, "{Enter}");

      expect(mockHandleSelect).toHaveBeenCalledWith(mockBeaches[0]);
      expect(onSelect).toHaveBeenCalledWith(mockBeaches[0]);
    });

    it("does not select beach with Enter when dropdown is closed", async () => {
      const user = userEvent.setup();
      const onSelect = jest.fn();

      mockUseBeachAutocomplete.mockReturnValue({
        query: "",
        suggestions: [],
        loading: false,
        isOpen: false,
        selectedIndex: 0,
        setQuery: mockSetQuery,
        handleKeyDown: mockHandleKeyDown,
        handleSelect: mockHandleSelect,
        setIsOpen: mockSetIsOpen,
        clearSearch: mockClearSearch,
        error: null,
      });

      render(
        <BeachSearchAutocomplete onSelect={onSelect} />
      );

      const input = screen.getByPlaceholderText("Search surf spots...");
      await user.type(input, "{Enter}");

      expect(onSelect).not.toHaveBeenCalled();
    });

    it("does not select beach with Enter when no suggestions", async () => {
      const user = userEvent.setup();
      const onSelect = jest.fn();

      mockUseBeachAutocomplete.mockReturnValue({
        query: "xyz",
        suggestions: [],
        loading: false,
        isOpen: true,
        selectedIndex: 0,
        setQuery: mockSetQuery,
        handleKeyDown: mockHandleKeyDown,
        handleSelect: mockHandleSelect,
        setIsOpen: mockSetIsOpen,
        clearSearch: mockClearSearch,
        error: null,
      });

      render(
        <BeachSearchAutocomplete onSelect={onSelect} />
      );

      const input = screen.getByPlaceholderText("Search surf spots...");
      await user.type(input, "{Enter}");

      expect(onSelect).not.toHaveBeenCalled();
    });
  });

  describe("Custom styling", () => {
    it("applies custom className", () => {
      render(
        <BeachSearchAutocomplete className="custom-class" />
      );

      const command = document.querySelector(".custom-class");
      expect(command).toBeInTheDocument();
    });
  });

  describe("Max results", () => {
    it("passes maxResults option to hook", () => {
      render(<BeachSearchAutocomplete maxResults={10} />);

      expect(mockUseBeachAutocomplete).toHaveBeenCalledWith({ maxResults: 10 });
    });

    it("uses default maxResults when not provided", () => {
      render(<BeachSearchAutocomplete />);

      expect(mockUseBeachAutocomplete).toHaveBeenCalledWith({ maxResults: 5 });
    });
  });
});
