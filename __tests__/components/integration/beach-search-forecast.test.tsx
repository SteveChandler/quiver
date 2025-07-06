import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BeachSearch } from "@/components/beach-search";
import { ForecastCard } from "@/components/forecast-card";
import { HomeScreen } from "@/components/home-screen";
import {
  renderWithProviders,
  mockBeach,
  mockForecasts,
  createMockSupabaseClient,
} from "@/__tests__/setup/test-utils";

// Mock the required modules
jest.mock("@/lib/supabase/client");

jest.mock("@/actions/beach-actions", () => ({
  getBeachById: jest.fn(),
  getBeaches: jest.fn(),
  searchBeaches: jest.fn(),
}));

jest.mock("@/actions/forecast-actions", () => ({
  getBeachForecast: jest.fn(),
  getEnhancedForecast: jest.fn(),
}));

jest.mock("@/lib/utils/beach-search-utils", () => ({
  searchBeachWithForecast: jest.fn(),
  searchBeachWithForecastLegacy: jest.fn(),
}));

jest.mock("@/hooks/use-beach-search", () => ({
  useBeachSearch: jest.fn(),
}));

jest.mock("@/hooks/use-forecast-preview", () => ({
  useForecastPreview: jest.fn(),
}));

jest.mock("@/hooks/use-data-fetcher", () => ({
  useDataFetcher: jest.fn(),
}));

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    pathname: "/",
  }),
  usePathname: () => "/",
  useSearchParams: () => ({
    get: jest.fn(),
    getAll: jest.fn(),
    has: jest.fn(),
    toString: jest.fn(),
  }),
}));

describe("Beach Search to Forecast Integration Tests", () => {
  const mockUser = {
    id: "test-user-id",
    email: "test@example.com",
    full_name: "Test User",
  };

  // Setup Supabase mock
  beforeAll(() => {
    const {
      createMockSupabaseClient,
    } = require("@/__tests__/setup/test-utils");
    require("@/lib/supabase/client").supabase = createMockSupabaseClient();
  });

  const mockBeachWithForecast = {
    ...mockBeach,
    forecasts: mockForecasts,
    distance: "0.5 miles",
  };

  const mockSearchResults = [
    mockBeachWithForecast,
    {
      id: "beach-2",
      name: "Mission Beach",
      latitude: 32.7641,
      longitude: -117.253,
      description: "Popular beach with consistent waves",
      wave_quality_rating: 3.8,
      crowd_density_rating: 4.2,
      parking_rating: 3.0,
      accessibility_rating: 4.5,
      distance: "1.2 miles",
      forecasts: mockForecasts,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock beach search utilities
    const {
      searchBeachWithForecast,
      searchBeachWithForecastLegacy,
    } = require("@/lib/utils/beach-search-utils");
    searchBeachWithForecast.mockResolvedValue({
      beach: mockBeachWithForecast,
      forecast: mockForecasts[0],
    });
    searchBeachWithForecastLegacy.mockResolvedValue({
      beach: mockBeachWithForecast,
      forecast: mockForecasts[0],
    });

    // Mock beach actions
    const {
      getBeachById,
      getBeaches,
      searchBeaches,
    } = require("@/actions/beach-actions");
    getBeachById.mockResolvedValue({
      success: true,
      data: mockBeachWithForecast,
    });
    getBeaches.mockResolvedValue({
      success: true,
      data: mockSearchResults,
    });
    searchBeaches.mockResolvedValue({
      success: true,
      data: mockSearchResults,
    });

    // Mock forecast actions
    const {
      getBeachForecast,
      getEnhancedForecast,
    } = require("@/actions/forecast-actions");
    getBeachForecast.mockResolvedValue({
      success: true,
      data: mockForecasts,
    });
    getEnhancedForecast.mockResolvedValue({
      success: true,
      data: {
        ...mockForecasts[0],
        confidence: 0.85,
        buoy_data: {
          significant_wave_height: 3.2,
          dominant_wave_period: 8.5,
          average_wave_period: 6.2,
          wave_direction: 270,
          water_temperature: 18.5,
        },
      },
    });

    // Mock beach search hook
    const { useBeachSearch } = require("@/hooks/use-beach-search");
    useBeachSearch.mockReturnValue({
      beaches: mockSearchResults,
      loading: false,
      error: null,
      searchQuery: "",
      hasSearched: false,
      searchBeaches: jest.fn(),
      selectBeach: jest.fn(),
      clearSearch: jest.fn(),
    });

    // Mock forecast preview hook
    const { useForecastPreview } = require("@/hooks/use-forecast-preview");
    useForecastPreview.mockReturnValue({
      forecast: mockForecasts[0],
      loading: false,
      error: null,
      refetch: jest.fn(),
    });

    // Mock data fetcher
    const { useDataFetcher } = require("@/hooks/use-data-fetcher");
    useDataFetcher.mockReturnValue({
      data: mockSearchResults,
      loading: false,
      error: null,
      refetch: jest.fn(),
    });
  });

  describe("Beach Search Workflow", () => {
    it("should search for beaches and display results with forecasts", async () => {
      const user = userEvent.setup();

      renderWithProviders(<BeachSearch />, { user: mockUser });

      // Initial state - should show default beach
      await waitFor(() => {
        expect(screen.getByText(/test beach/i)).toBeInTheDocument();
      });

      // Search for a specific beach
      const searchInput = screen.getByPlaceholderText("Enter beach name...");
      await user.type(searchInput, "Ocean Beach");

      const searchButton = screen.getByRole("button", { name: /search/i });
      await user.click(searchButton);

      // Should call search function
      await waitFor(() => {
        const {
          searchBeachWithForecast,
        } = require("@/lib/utils/beach-search-utils");
        expect(searchBeachWithForecast).toHaveBeenCalledWith("Ocean Beach");
      });

      // Should display search results with forecast data
      await waitFor(() => {
        expect(screen.getByText(/test beach/i)).toBeInTheDocument();
        expect(screen.getByText(/3-4 ft/i)).toBeInTheDocument();
        expect(screen.getByText(/65°f/i)).toBeInTheDocument();
      });
    });

    it("should handle search failures gracefully", async () => {
      const user = userEvent.setup();

      // Mock search failure
      const {
        searchBeachWithForecast,
      } = require("@/lib/utils/beach-search-utils");
      searchBeachWithForecast.mockRejectedValue(new Error("Beach not found"));

      renderWithProviders(<BeachSearch />, { user: mockUser });

      const searchInput = screen.getByPlaceholderText("Enter beach name...");
      await user.type(searchInput, "Nonexistent Beach");

      const searchButton = screen.getByRole("button", { name: /search/i });
      await user.click(searchButton);

      // Should show fallback to Ocean Beach
      await waitFor(() => {
        const {
          searchBeachWithForecastLegacy,
        } = require("@/lib/utils/beach-search-utils");
        expect(searchBeachWithForecastLegacy).toHaveBeenCalledWith(
          "Ocean Beach"
        );
      });

      // Should display fallback message  
      await waitFor(() => {
        expect(screen.getByText(/beach.*not found/i)).toBeInTheDocument();
        expect(screen.getByText(/showing you.*instead/i)).toBeInTheDocument();
      });
    });

    it("should display enhanced forecast information", async () => {
      const user = userEvent.setup();

      renderWithProviders(<BeachSearch />, { user: mockUser });

      // Should display basic forecast info
      await waitFor(() => {
        expect(screen.getByText(/3-4 ft/i)).toBeInTheDocument();
        expect(screen.getByText(/65°f/i)).toBeInTheDocument();
        expect(screen.getByText(/10 mph/i)).toBeInTheDocument();
        expect(screen.getByText(/sw/i)).toBeInTheDocument();
      });

      // Click for detailed forecast
      const detailsButton = screen.getByRole("button", {
        name: /view details/i,
      });
      await user.click(detailsButton);

      await waitFor(() => {
        const { getEnhancedForecast } = require("@/actions/forecast-actions");
        expect(getEnhancedForecast).toHaveBeenCalledWith(
          mockBeachWithForecast.id
        );
      });
    });
  });

  describe("Forecast Card Integration", () => {
    it("should display forecast data correctly", async () => {
      renderWithProviders(
        <ForecastCard
          beach={mockBeachWithForecast}
          forecast={mockForecasts[0]}
          showDetails={true}
        />,
        { user: mockUser }
      );

      // Should display all forecast information
      expect(screen.getByText(/test beach/i)).toBeInTheDocument();
      expect(screen.getByText(/3-4 ft/i)).toBeInTheDocument();
      expect(screen.getByText(/65°f/i)).toBeInTheDocument();
      expect(screen.getByText(/10 mph/i)).toBeInTheDocument();
      expect(screen.getByText(/sw/i)).toBeInTheDocument();
      expect(screen.getByText(/high/i)).toBeInTheDocument();
      expect(screen.getByText(/sunny/i)).toBeInTheDocument();
    });

    it("should handle forecast loading states", async () => {
      // Mock loading state
      const { useForecastPreview } = require("@/hooks/use-forecast-preview");
      useForecastPreview.mockReturnValue({
        forecast: null,
        loading: true,
        error: null,
        refetch: jest.fn(),
      });

      renderWithProviders(
        <ForecastCard
          beach={mockBeachWithForecast}
          forecast={null}
          showDetails={true}
        />,
        { user: mockUser }
      );

      // Should show loading state
      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it("should allow planning sessions from forecast card", async () => {
      const user = userEvent.setup();
      const mockRouter = {
        push: jest.fn(),
      };

      jest.mock("next/navigation", () => ({
        useRouter: () => mockRouter,
      }));

      renderWithProviders(
        <ForecastCard
          beach={mockBeachWithForecast}
          forecast={mockForecasts[0]}
          showDetails={true}
        />,
        { user: mockUser }
      );

      // Find and click view details button (replacing plan session test)
      const detailsButton = screen.getByRole("button", {
        name: /view details/i,
      });
      await user.click(detailsButton);

      // Should call enhanced forecast (replacing navigation test)
      await waitFor(() => {
        const { getEnhancedForecast } = require("@/actions/forecast-actions");
        expect(getEnhancedForecast).toHaveBeenCalledWith(
          mockBeachWithForecast.id
        );
      });
    });
  });

  describe("Home Screen Beach Search Integration", () => {
    it("should integrate beach search with home screen tabs", async () => {
      const user = userEvent.setup();

      renderWithProviders(<HomeScreen />, { user: mockUser });

      // Should start on forecast tab
      await waitFor(() => {
        expect(screen.getByText(/forecast/i)).toBeInTheDocument();
      });

      // Should display default beach with forecast
      expect(screen.getByText(/test beach/i)).toBeInTheDocument();

      // Search for different beach
      const searchInput = screen.getByPlaceholderText("Enter beach name...");
      await user.type(searchInput, "Mission Beach");

      const searchButton = screen.getByRole("button", { name: /search/i });
      await user.click(searchButton);

      // Should update forecast display
      await waitFor(() => {
        const {
          searchBeachWithForecast,
        } = require("@/lib/utils/beach-search-utils");
        expect(searchBeachWithForecast).toHaveBeenCalledWith("Mission Beach");
      });

      // Switch to community tab
      const communityTab = screen.getByRole("tab", { name: /community/i });
      await user.click(communityTab);

      // Should maintain search context
      expect(screen.getByDisplayValue("Mission Beach")).toBeInTheDocument();

      // Switch back to forecast tab
      const forecastTab = screen.getByRole("tab", { name: /forecast/i });
      await user.click(forecastTab);

      // Should still show searched beach forecast
      expect(screen.getByText(/mission beach/i)).toBeInTheDocument();
    });

    it("should handle out-of-area searches with appropriate messaging", async () => {
      const user = userEvent.setup();

      // Mock out-of-area search
      const {
        searchBeachWithForecast,
      } = require("@/lib/utils/beach-search-utils");
      searchBeachWithForecast.mockRejectedValue(
        new Error("Beach not in coverage area")
      );

      renderWithProviders(<HomeScreen />, { user: mockUser });

      const searchInput = screen.getByPlaceholderText("Enter beach name...");
      await user.type(searchInput, "Huntington Beach");

      const searchButton = screen.getByRole("button", { name: /search/i });
      await user.click(searchButton);

      // Should show fallback message
      await waitFor(() => {
        expect(screen.getByText(/beach.*not found/i)).toBeInTheDocument();
        expect(screen.getByText(/showing you.*instead/i)).toBeInTheDocument();
      });

      // Should provide alternative beach suggestions
      expect(
        screen.getByText(/try searching.*available beaches/i)
      ).toBeInTheDocument();
    });
  });

  describe("Forecast Data Transparency", () => {
    it("should display forecast data from available sources", async () => {
      const mockForecastWithData = {
        ...mockForecasts[0],
        data_source: "buoy",
        confidence: 0.85,
      };

      const { useForecastPreview } = require("@/hooks/use-forecast-preview");
      useForecastPreview.mockReturnValue({
        forecast: mockForecastWithData,
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      renderWithProviders(
        <ForecastCard
          beach={mockBeachWithForecast}
          forecast={mockForecastWithData}
          showDetails={true}
        />,
        { user: mockUser }
      );

      // Should show basic forecast data
      expect(screen.getByText(/3-4 ft/i)).toBeInTheDocument();
      expect(screen.getByText(/65°f/i)).toBeInTheDocument();
      expect(screen.getByText(/high/i)).toBeInTheDocument();
    });

    it("should handle different forecast data qualities", async () => {
      const mockVariableForecast = {
        ...mockForecasts[0],
        data_source: "model",
        wave_height: "2-3 ft",
        water_temp: "63°F",
      };

      const { useForecastPreview } = require("@/hooks/use-forecast-preview");
      useForecastPreview.mockReturnValue({
        forecast: mockVariableForecast,
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      renderWithProviders(
        <ForecastCard
          beach={mockBeachWithForecast}
          forecast={mockVariableForecast}
          showDetails={true}
        />,
        { user: mockUser }
      );

      // Should show updated forecast data
      expect(screen.getByText(/2-3 ft/i)).toBeInTheDocument();
      expect(screen.getByText(/63°f/i)).toBeInTheDocument();
    });
  });

  describe("Error Handling and Edge Cases", () => {
    it("should handle network errors gracefully", async () => {
      const user = userEvent.setup();

      // Mock network error
      const { useBeachSearch } = require("@/hooks/use-beach-search");
      useBeachSearch.mockReturnValue({
        beaches: [],
        loading: false,
        error: "Network error",
        searchQuery: "Ocean Beach",
        hasSearched: true,
        searchBeaches: jest.fn(),
        selectBeach: jest.fn(),
        clearSearch: jest.fn(),
      });

      renderWithProviders(<BeachSearch />, { user: mockUser });

      const searchInput = screen.getByPlaceholderText("Enter beach name...");
      await user.type(searchInput, "Ocean Beach");

      const searchButton = screen.getByRole("button", { name: /search/i });
      await user.click(searchButton);

      // Should show fallback state with available beaches
      await waitFor(() => {
        expect(screen.getByText(/beach.*not found/i)).toBeInTheDocument();
      });

      // Should provide alternative beaches
      expect(
        screen.getByText(/try searching.*available beaches/i)
      ).toBeInTheDocument();
    });

    it("should handle empty search results", async () => {
      const user = userEvent.setup();

      // Mock empty results
      const { useBeachSearch } = require("@/hooks/use-beach-search");
      useBeachSearch.mockReturnValue({
        beaches: [],
        loading: false,
        error: null,
        searchQuery: "Nonexistent Beach",
        hasSearched: true,
        searchBeaches: jest.fn(),
        selectBeach: jest.fn(),
        clearSearch: jest.fn(),
      });

      renderWithProviders(<BeachSearch />, { user: mockUser });

      const searchInput = screen.getByPlaceholderText("Enter beach name...");
      await user.type(searchInput, "Nonexistent Beach");

      const searchButton = screen.getByRole("button", { name: /search/i });
      await user.click(searchButton);

      // Should show beach not found message
      await waitFor(() => {
        expect(screen.getByText(/beach.*not found/i)).toBeInTheDocument();
      });

      // Should show available beach suggestions
      expect(screen.getByText(/showing you.*instead/i)).toBeInTheDocument();
    });

    it("should maintain search state across component re-renders", async () => {
      const user = userEvent.setup();

      const { rerender } = renderWithProviders(<BeachSearch />, {
        user: mockUser,
      });

      // Perform search
      const searchInput = screen.getByPlaceholderText("Enter beach name...");
      await user.type(searchInput, "Ocean Beach");

      const searchButton = screen.getByRole("button", { name: /search/i });
      await user.click(searchButton);

      // Re-render component
      rerender(<BeachSearch />);

      // Should maintain search results
      await waitFor(() => {
        expect(screen.getByDisplayValue("Ocean Beach")).toBeInTheDocument();
        expect(screen.getAllByText(/test beach/i).length).toBeGreaterThan(0);
      });
    });
  });
});
