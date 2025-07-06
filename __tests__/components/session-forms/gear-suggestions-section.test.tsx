import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { GearSuggestionsSection } from "@/components/session-forms/GearSuggestionsSection";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import {
  mockGearSuggestionsResponse,
  mockBoardSuggestions,
  mockSessionFormState,
  createMockDataFetcherResponse,
  mockFetchSuccess,
  mockFetchError,
  setupMockFetch,
} from "../../setup/session-planner-test-utils";

// Mock the useDataFetcher hook
jest.mock("@/hooks/use-data-fetcher");
const mockUseDataFetcher = useDataFetcher as jest.MockedFunction<
  typeof useDataFetcher
>;

// Mock fetch
setupMockFetch();

describe("GearSuggestionsSection", () => {
  const mockUpdateField = jest.fn();

  const defaultProps = {
    formState: mockSessionFormState,
    updateField: mockUpdateField,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Loading state", () => {
    it("should show loading skeleton when data is being fetched", () => {
      mockUseDataFetcher.mockReturnValue(
        createMockDataFetcherResponse(null, true)
      );

      render(<GearSuggestionsSection {...defaultProps} />);

      expect(screen.getByText("Analyzing Your Quiver...")).toBeInTheDocument();
      expect(screen.getAllByTestId("skeleton")).toHaveLength(3);
    });

    it("should show loading message with surfboard icon", () => {
      mockUseDataFetcher.mockReturnValue(
        createMockDataFetcherResponse(null, true)
      );

      render(<GearSuggestionsSection {...defaultProps} />);

      expect(screen.getByText("Analyzing Your Quiver...")).toBeInTheDocument();
    });
  });

  describe("Error state", () => {
    it("should show error message when fetch fails", () => {
      const error = new Error("Failed to fetch gear suggestions");
      mockUseDataFetcher.mockReturnValue(
        createMockDataFetcherResponse(null, false, error)
      );

      render(<GearSuggestionsSection {...defaultProps} />);

      expect(
        screen.getByText("Unable to Load Gear Suggestions")
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Failed to analyze your boards/)
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /try again/i })
      ).toBeInTheDocument();
    });

    it("should allow retrying after error", () => {
      const mockRefetch = jest.fn();
      const error = new Error("Network error");
      mockUseDataFetcher.mockReturnValue({
        data: null,
        loading: false,
        error,
        refetch: mockRefetch,
      });

      render(<GearSuggestionsSection {...defaultProps} />);

      const retryButton = screen.getByRole("button", { name: /try again/i });
      fireEvent.click(retryButton);

      expect(mockRefetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("Empty state", () => {
    it("should show message when no beach is selected", () => {
      const formStateWithoutBeach = {
        ...mockSessionFormState,
        selectedBeachId: "",
      };

      mockUseDataFetcher.mockReturnValue(
        createMockDataFetcherResponse(null, false)
      );

      render(
        <GearSuggestionsSection
          formState={formStateWithoutBeach}
          updateField={mockUpdateField}
        />
      );

      expect(
        screen.getByText("Select a beach to see smart board recommendations")
      ).toBeInTheDocument();
    });

    it("should show message when no boards found", () => {
      const emptyResponse = {
        success: true,
        data: {
          ...mockGearSuggestionsResponse.data,
          suggestions: [],
        },
      };

      mockUseDataFetcher.mockReturnValue(
        createMockDataFetcherResponse(emptyResponse, false)
      );

      render(<GearSuggestionsSection {...defaultProps} />);

      expect(screen.getByText("Board Recommendations")).toBeInTheDocument();
      expect(
        screen.getByText(/No boards found in your quiver/)
      ).toBeInTheDocument();
    });
  });

  describe("Success state with data", () => {
    beforeEach(() => {
      mockUseDataFetcher.mockReturnValue(
        createMockDataFetcherResponse(mockGearSuggestionsResponse, false)
      );
    });

    it("should render board suggestions successfully", () => {
      render(<GearSuggestionsSection {...defaultProps} />);

      expect(
        screen.getByText("Smart Board Recommendations")
      ).toBeInTheDocument();
      expect(screen.getByText("Daily Driver")).toBeInTheDocument();
      expect(screen.getByText("Big Wave Gun")).toBeInTheDocument();
    });

    it("should show conditions badge with wave height and wind speed", () => {
      render(<GearSuggestionsSection {...defaultProps} />);

      expect(screen.getByText("4ft waves • 10mph wind")).toBeInTheDocument();
    });

    it("should show analysis results", () => {
      render(<GearSuggestionsSection {...defaultProps} />);

      expect(screen.getByText("15 sessions analyzed")).toBeInTheDocument();
      expect(
        screen.getByText("Based on your surf history and current conditions")
      ).toBeInTheDocument();
    });

    it("should display board details correctly", () => {
      render(<GearSuggestionsSection {...defaultProps} />);

      // Check first board
      expect(screen.getByText("Daily Driver")).toBeInTheDocument();
      expect(
        screen.getByText('Shortboard • 6\'2" x 19" x 2.5"')
      ).toBeInTheDocument();
      expect(screen.getByText("85")).toBeInTheDocument(); // Score
      expect(screen.getByText("High confidence")).toBeInTheDocument();

      // Check second board
      expect(screen.getByText("Big Wave Gun")).toBeInTheDocument();
      expect(screen.getByText('Gun • 7\'0" x 18" x 3"')).toBeInTheDocument();
      expect(screen.getByText("65")).toBeInTheDocument(); // Score
      expect(screen.getByText("Good confidence")).toBeInTheDocument();
    });

    it("should show session and rating statistics", () => {
      render(<GearSuggestionsSection {...defaultProps} />);

      expect(screen.getByText("12 sessions")).toBeInTheDocument();
      expect(screen.getByText("4.2 avg rating")).toBeInTheDocument();
      expect(screen.getByText("8 sessions")).toBeInTheDocument();
      expect(screen.getByText("4.1 avg rating")).toBeInTheDocument();
    });

    it("should show reasons for recommendations", () => {
      render(<GearSuggestionsSection {...defaultProps} />);

      expect(screen.getByText(/Good wave height \(4ft\)/)).toBeInTheDocument();
      expect(screen.getByText(/Recently used board/)).toBeInTheDocument();
      expect(
        screen.getByText(/Good performance in other conditions/)
      ).toBeInTheDocument();
    });

    it("should mark top choice as recommended", () => {
      render(<GearSuggestionsSection {...defaultProps} />);

      const recommendedBadges = screen.getAllByText("Recommended");
      expect(recommendedBadges).toHaveLength(1);
    });

    it("should limit display to top 3 suggestions", () => {
      const manyBoardsResponse = {
        success: true,
        data: {
          ...mockGearSuggestionsResponse.data,
          suggestions: Array.from({ length: 5 }, (_, i) => ({
            ...mockBoardSuggestions[0],
            board: {
              ...mockBoardSuggestions[0].board,
              id: `board-${i + 1}`,
              name: `Board ${i + 1}`,
            },
          })),
        },
      };

      mockUseDataFetcher.mockReturnValue(
        createMockDataFetcherResponse(manyBoardsResponse, false)
      );

      render(<GearSuggestionsSection {...defaultProps} />);

      expect(screen.getByText("Board 1")).toBeInTheDocument();
      expect(screen.getByText("Board 2")).toBeInTheDocument();
      expect(screen.getByText("Board 3")).toBeInTheDocument();
      expect(screen.queryByText("Board 4")).not.toBeInTheDocument();
      expect(
        screen.getByText("Showing top 3 recommendations from your 5 boards.")
      ).toBeInTheDocument();
    });
  });

  describe("Board selection", () => {
    beforeEach(() => {
      mockUseDataFetcher.mockReturnValue(
        createMockDataFetcherResponse(mockGearSuggestionsResponse, false)
      );
    });

    it("should allow selecting a board", async () => {
      render(<GearSuggestionsSection {...defaultProps} />);

      const boardButton = screen.getByRole("button", { name: /Daily Driver/ });
      fireEvent.click(boardButton);

      expect(mockUpdateField).toHaveBeenCalledWith("boardId", "board-1");
      expect(mockUpdateField).toHaveBeenCalledWith("selectedBoard", "board-1");
    });

    it("should show selected board with visual indicators", () => {
      const formStateWithSelectedBoard = {
        ...mockSessionFormState,
        boardId: "board-1",
      };

      render(
        <GearSuggestionsSection
          formState={formStateWithSelectedBoard}
          updateField={mockUpdateField}
        />
      );

      const selectedButton = screen.getByRole("button", {
        name: /Daily Driver/,
      });
      expect(selectedButton).toHaveClass("ring-2", "ring-primary");
    });

    it("should show check mark for selected board", () => {
      const formStateWithSelectedBoard = {
        ...mockSessionFormState,
        boardId: "board-1",
      };

      render(
        <GearSuggestionsSection
          formState={formStateWithSelectedBoard}
          updateField={mockUpdateField}
        />
      );

      // Check for the CheckCircle2 icon (may need to adjust based on how it's rendered)
      expect(screen.getByTestId("check-circle-icon")).toBeInTheDocument();
    });
  });

  describe("Data fetching integration", () => {
    it("should call useDataFetcher with correct parameters", () => {
      mockUseDataFetcher.mockReturnValue(
        createMockDataFetcherResponse(null, true)
      );

      render(<GearSuggestionsSection {...defaultProps} />);

      expect(mockUseDataFetcher).toHaveBeenCalledWith(expect.any(Function), {
        enabled: true,
      });
    });

    it("should disable data fetching when no beach is selected", () => {
      const formStateWithoutBeach = {
        ...mockSessionFormState,
        selectedBeachId: "",
      };

      mockUseDataFetcher.mockReturnValue(
        createMockDataFetcherResponse(null, false)
      );

      render(
        <GearSuggestionsSection
          formState={formStateWithoutBeach}
          updateField={mockUpdateField}
        />
      );

      expect(mockUseDataFetcher).toHaveBeenCalledWith(expect.any(Function), {
        enabled: false,
      });
    });

    it("should update form state when suggestions are loaded", async () => {
      mockUseDataFetcher.mockReturnValue(
        createMockDataFetcherResponse(mockGearSuggestionsResponse, false)
      );

      render(<GearSuggestionsSection {...defaultProps} />);

      await waitFor(() => {
        expect(mockUpdateField).toHaveBeenCalledWith(
          "boardSuggestions",
          expect.arrayContaining([
            expect.objectContaining({
              boardId: "board-1",
              score: 85,
              confidence: 0.8,
            }),
          ])
        );
      });
    });
  });

  describe("Wave height and conditions", () => {
    it("should use wave height from optimal times selection", () => {
      const formStateWithOptimalTime = {
        ...mockSessionFormState,
        selectedOptimalTime: "06:00:00",
        optimalTimes: [
          {
            time: "06:00:00",
            conditions: { waveHeight: 5, windSpeed: 12 },
          },
        ],
      };

      mockUseDataFetcher.mockReturnValue(
        createMockDataFetcherResponse(null, true)
      );

      render(
        <GearSuggestionsSection
          formState={formStateWithOptimalTime}
          updateField={mockUpdateField}
        />
      );

      expect(screen.getByText("5ft waves • 12mph wind")).toBeInTheDocument();
    });

    it("should use default values when no optimal time is selected", () => {
      const formStateWithoutOptimalTime = {
        ...mockSessionFormState,
        selectedOptimalTime: null,
        optimalTimes: [],
      };

      mockUseDataFetcher.mockReturnValue(
        createMockDataFetcherResponse(null, true)
      );

      render(
        <GearSuggestionsSection
          formState={formStateWithoutOptimalTime}
          updateField={mockUpdateField}
        />
      );

      expect(screen.getByText("3ft waves • 10mph wind")).toBeInTheDocument();
    });
  });

  describe("Confidence indicators", () => {
    const testConfidenceValues = [
      { confidence: 0.9, expected: "High confidence", color: "text-green-600" },
      { confidence: 0.7, expected: "Good confidence", color: "text-blue-600" },
      {
        confidence: 0.5,
        expected: "Medium confidence",
        color: "text-yellow-600",
      },
      { confidence: 0.3, expected: "Low confidence", color: "text-gray-600" },
    ];

    testConfidenceValues.forEach(({ confidence, expected }) => {
      it(`should show "${expected}" for confidence ${confidence}`, () => {
        const responseWithConfidence = {
          success: true,
          data: {
            ...mockGearSuggestionsResponse.data,
            suggestions: [
              {
                ...mockBoardSuggestions[0],
                confidence,
              },
            ],
          },
        };

        mockUseDataFetcher.mockReturnValue(
          createMockDataFetcherResponse(responseWithConfidence, false)
        );

        render(<GearSuggestionsSection {...defaultProps} />);

        expect(screen.getByText(expected)).toBeInTheDocument();
      });
    });
  });

  describe("Accessibility", () => {
    beforeEach(() => {
      mockUseDataFetcher.mockReturnValue(
        createMockDataFetcherResponse(mockGearSuggestionsResponse, false)
      );
    });

    it("should have proper button roles for board selection", () => {
      render(<GearSuggestionsSection {...defaultProps} />);

      const boardButtons = screen.getAllByRole("button");
      expect(boardButtons.length).toBeGreaterThan(0);
    });

    it("should have proper headings", () => {
      render(<GearSuggestionsSection {...defaultProps} />);

      expect(
        screen.getByRole("heading", { name: /Smart Board Recommendations/ })
      ).toBeInTheDocument();
    });

    it("should have descriptive text for screen readers", () => {
      render(<GearSuggestionsSection {...defaultProps} />);

      expect(
        screen.getByText(
          /Recommendations are based on your past session ratings/
        )
      ).toBeInTheDocument();
    });
  });
});
