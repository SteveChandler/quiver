import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { OptimalTimesSection } from "@/components/session-forms/OptimalTimesSection";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import {
  mockOptimalTimesResponse,
  mockOptimalTimes,
  mockSessionFormState,
  createMockDataFetcherResponse,
  setupMockFetch,
} from "../../setup/session-planner-test-utils";

// Mock the useDataFetcher hook
jest.mock("@/hooks/use-data-fetcher");
const mockUseDataFetcher = useDataFetcher as jest.MockedFunction<
  typeof useDataFetcher
>;

// Mock fetch
setupMockFetch();

describe("OptimalTimesSection", () => {
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

      render(<OptimalTimesSection {...defaultProps} />);

      expect(screen.getByText("Finding Optimal Times...")).toBeInTheDocument();
      expect(screen.getAllByTestId("skeleton")).toHaveLength(3);
    });

    it("should show loading message with clock icon", () => {
      mockUseDataFetcher.mockReturnValue(
        createMockDataFetcherResponse(null, true)
      );

      render(<OptimalTimesSection {...defaultProps} />);

      expect(screen.getByText("Finding Optimal Times...")).toBeInTheDocument();
    });
  });

  describe("Error state", () => {
    it("should show error message when fetch fails", () => {
      const error = new Error("Failed to fetch optimal times");
      mockUseDataFetcher.mockReturnValue(
        createMockDataFetcherResponse(null, false, error)
      );

      render(<OptimalTimesSection {...defaultProps} />);

      expect(
        screen.getByText("Unable to Load Optimal Times")
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Failed to analyze surf conditions/)
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

      render(<OptimalTimesSection {...defaultProps} />);

      const retryButton = screen.getByRole("button", { name: /try again/i });
      fireEvent.click(retryButton);

      expect(mockRefetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("Empty state", () => {
    it("should show message when no beach or date is selected", () => {
      const formStateWithoutData = {
        ...mockSessionFormState,
        selectedBeachId: "",
        selectedDate: "",
      };

      mockUseDataFetcher.mockReturnValue(
        createMockDataFetcherResponse(null, false)
      );

      render(
        <OptimalTimesSection
          formState={formStateWithoutData}
          updateField={mockUpdateField}
        />
      );

      expect(
        screen.getByText("Select a beach and date to see optimal surf times")
      ).toBeInTheDocument();
    });

    it("should show message when no forecast data is available", () => {
      const emptyResponse = {
        success: true,
        data: {
          ...mockOptimalTimesResponse.data,
          optimalTimes: [],
        },
      };

      mockUseDataFetcher.mockReturnValue(
        createMockDataFetcherResponse(emptyResponse, false)
      );

      render(<OptimalTimesSection {...defaultProps} />);

      expect(screen.getByText("Optimal Times")).toBeInTheDocument();
      expect(
        screen.getByText(/No forecast data available for this date/)
      ).toBeInTheDocument();
    });
  });

  describe("Success state with data", () => {
    beforeEach(() => {
      mockUseDataFetcher.mockReturnValue(
        createMockDataFetcherResponse(mockOptimalTimesResponse, false)
      );
    });

    it("should render optimal times successfully", () => {
      render(<OptimalTimesSection {...defaultProps} />);

      expect(
        screen.getByText("Optimal Times for 2024-01-17")
      ).toBeInTheDocument();
      expect(screen.getByText("Enhanced Forecast")).toBeInTheDocument();
      expect(screen.getByText("6:00 AM")).toBeInTheDocument();
      expect(screen.getByText("7:00 AM")).toBeInTheDocument();
    });

    it("should show forecast source badge", () => {
      render(<OptimalTimesSection {...defaultProps} />);

      expect(screen.getByText("Enhanced Forecast")).toBeInTheDocument();
    });

    it("should show instructional text", () => {
      render(<OptimalTimesSection {...defaultProps} />);

      expect(
        screen.getByText(
          "Based on wave conditions, wind, and forecast confidence. Tap to select your preferred time."
        )
      ).toBeInTheDocument();
    });

    it("should display time slot details correctly", () => {
      render(<OptimalTimesSection {...defaultProps} />);

      // Check first time slot
      expect(screen.getByText("6:00 AM")).toBeInTheDocument();
      expect(screen.getByText("excellent")).toBeInTheDocument();
      expect(screen.getByText("4.5ft")).toBeInTheDocument();
      expect(screen.getByText("5mph NE")).toBeInTheDocument();
      expect(screen.getByText("85% confidence")).toBeInTheDocument();
      expect(screen.getByText("92")).toBeInTheDocument(); // Score

      // Check second time slot
      expect(screen.getByText("7:00 AM")).toBeInTheDocument();
      expect(screen.getByText("good")).toBeInTheDocument();
      expect(screen.getByText("4.2ft")).toBeInTheDocument();
      expect(screen.getByText("7mph E")).toBeInTheDocument();
      expect(screen.getByText("80% confidence")).toBeInTheDocument();
      expect(screen.getByText("88")).toBeInTheDocument(); // Score
    });

    it("should show reasons for time slot recommendations", () => {
      render(<OptimalTimesSection {...defaultProps} />);

      expect(
        screen.getByText(/Good wave height \(4.5ft\)/)
      ).toBeInTheDocument();
      expect(screen.getByText(/Light winds \(5mph\)/)).toBeInTheDocument();
      expect(screen.getByText(/Offshore winds \(NE\)/)).toBeInTheDocument();
    });

    it("should mark top choice as best", () => {
      render(<OptimalTimesSection {...defaultProps} />);

      const bestBadges = screen.getAllByText("Best");
      expect(bestBadges).toHaveLength(1);
    });

    it("should limit display to top 4 time slots", () => {
      const manyTimesResponse = {
        success: true,
        data: {
          ...mockOptimalTimesResponse.data,
          optimalTimes: Array.from({ length: 6 }, (_, i) => ({
            ...mockOptimalTimes[0],
            time: `${6 + i}:00:00`,
            score: 90 - i * 5,
          })),
        },
      };

      mockUseDataFetcher.mockReturnValue(
        createMockDataFetcherResponse(manyTimesResponse, false)
      );

      render(<OptimalTimesSection {...defaultProps} />);

      expect(screen.getByText("6:00 AM")).toBeInTheDocument();
      expect(screen.getByText("7:00 AM")).toBeInTheDocument();
      expect(screen.getByText("8:00 AM")).toBeInTheDocument();
      expect(screen.getByText("9:00 AM")).toBeInTheDocument();
      expect(screen.queryByText("10:00 AM")).not.toBeInTheDocument();
      expect(
        screen.getByText(
          "Showing top 4 optimal times. More conditions available in forecast."
        )
      ).toBeInTheDocument();
    });
  });

  describe("Time slot selection", () => {
    beforeEach(() => {
      mockUseDataFetcher.mockReturnValue(
        createMockDataFetcherResponse(mockOptimalTimesResponse, false)
      );
    });

    it("should allow selecting a time slot", async () => {
      render(<OptimalTimesSection {...defaultProps} />);

      const timeButton = screen.getByRole("button", { name: /6:00 AM/ });
      fireEvent.click(timeButton);

      expect(mockUpdateField).toHaveBeenCalledWith(
        "selectedOptimalTime",
        "06:00:00"
      );
      expect(mockUpdateField).toHaveBeenCalledWith("selectedTime", "06:00:00");
    });

    it("should show selected time slot with visual indicators", () => {
      const formStateWithSelectedTime = {
        ...mockSessionFormState,
        selectedOptimalTime: "06:00:00",
      };

      render(
        <OptimalTimesSection
          formState={formStateWithSelectedTime}
          updateField={mockUpdateField}
        />
      );

      const selectedButton = screen.getByRole("button", { name: /6:00 AM/ });
      expect(selectedButton).toHaveClass("ring-2", "ring-primary");
    });

    it("should show check mark for selected time slot", () => {
      const formStateWithSelectedTime = {
        ...mockSessionFormState,
        selectedOptimalTime: "06:00:00",
      };

      render(
        <OptimalTimesSection
          formState={formStateWithSelectedTime}
          updateField={mockUpdateField}
        />
      );

      // Check for the CheckCircle2 icon
      expect(screen.getByTestId("check-circle-icon")).toBeInTheDocument();
    });
  });

  describe("Data fetching integration", () => {
    it("should call useDataFetcher with correct parameters when beach and date are selected", () => {
      mockUseDataFetcher.mockReturnValue(
        createMockDataFetcherResponse(null, true)
      );

      render(<OptimalTimesSection {...defaultProps} />);

      expect(mockUseDataFetcher).toHaveBeenCalledWith(expect.any(Function), {
        enabled: true,
      });
    });

    it("should disable data fetching when beach is not selected", () => {
      const formStateWithoutBeach = {
        ...mockSessionFormState,
        selectedBeachId: "",
      };

      mockUseDataFetcher.mockReturnValue(
        createMockDataFetcherResponse(null, false)
      );

      render(
        <OptimalTimesSection
          formState={formStateWithoutBeach}
          updateField={mockUpdateField}
        />
      );

      expect(mockUseDataFetcher).toHaveBeenCalledWith(expect.any(Function), {
        enabled: false,
      });
    });

    it("should disable data fetching when date is not selected", () => {
      const formStateWithoutDate = {
        ...mockSessionFormState,
        selectedDate: "",
      };

      mockUseDataFetcher.mockReturnValue(
        createMockDataFetcherResponse(null, false)
      );

      render(
        <OptimalTimesSection
          formState={formStateWithoutDate}
          updateField={mockUpdateField}
        />
      );

      expect(mockUseDataFetcher).toHaveBeenCalledWith(expect.any(Function), {
        enabled: false,
      });
    });

    it("should update form state when optimal times are loaded", async () => {
      mockUseDataFetcher.mockReturnValue(
        createMockDataFetcherResponse(mockOptimalTimesResponse, false)
      );

      render(<OptimalTimesSection {...defaultProps} />);

      await waitFor(() => {
        expect(mockUpdateField).toHaveBeenCalledWith(
          "optimalTimes",
          mockOptimalTimes
        );
      });
    });
  });

  describe("Rating colors and icons", () => {
    const ratingTestCases = [
      {
        rating: "excellent",
        expectedIcon: "star",
        expectedColor: "bg-green-500",
      },
      {
        rating: "good",
        expectedIcon: "trending-up",
        expectedColor: "bg-blue-500",
      },
      { rating: "fair", expectedIcon: "clock", expectedColor: "bg-yellow-500" },
      {
        rating: "poor",
        expectedIcon: "alert-circle",
        expectedColor: "bg-gray-500",
      },
    ];

    ratingTestCases.forEach(({ rating, expectedColor }) => {
      it(`should show correct color for ${rating} rating`, () => {
        const responseWithRating = {
          success: true,
          data: {
            ...mockOptimalTimesResponse.data,
            optimalTimes: [
              {
                ...mockOptimalTimes[0],
                rating: rating as any,
              },
            ],
          },
        };

        mockUseDataFetcher.mockReturnValue(
          createMockDataFetcherResponse(responseWithRating, false)
        );

        render(<OptimalTimesSection {...defaultProps} />);

        const ratingBadge = screen.getByText(rating);
        expect(ratingBadge).toHaveClass(expectedColor);
      });
    });
  });

  describe("Forecast source handling", () => {
    it('should show "Basic Forecast" badge for basic forecasts', () => {
      const basicForecastResponse = {
        success: true,
        data: {
          ...mockOptimalTimesResponse.data,
          forecastSource: "basic",
        },
      };

      mockUseDataFetcher.mockReturnValue(
        createMockDataFetcherResponse(basicForecastResponse, false)
      );

      render(<OptimalTimesSection {...defaultProps} />);

      expect(screen.getByText("Basic Forecast")).toBeInTheDocument();
    });

    it('should show "Enhanced Forecast" badge for enhanced forecasts', () => {
      render(<OptimalTimesSection {...defaultProps} />);

      expect(screen.getByText("Enhanced Forecast")).toBeInTheDocument();
    });
  });

  describe("Time formatting", () => {
    it("should format 24-hour time to 12-hour format correctly", () => {
      const timeFormatResponse = {
        success: true,
        data: {
          ...mockOptimalTimesResponse.data,
          optimalTimes: [
            {
              ...mockOptimalTimes[0],
              time: "13:30:00", // 1:30 PM
            },
            {
              ...mockOptimalTimes[1],
              time: "00:15:00", // 12:15 AM
            },
          ],
        },
      };

      mockUseDataFetcher.mockReturnValue(
        createMockDataFetcherResponse(timeFormatResponse, false)
      );

      render(<OptimalTimesSection {...defaultProps} />);

      expect(screen.getByText("1:30 PM")).toBeInTheDocument();
      expect(screen.getByText("12:15 AM")).toBeInTheDocument();
    });
  });

  describe("Conditions display", () => {
    it("should display wave height, wind, and confidence correctly", () => {
      render(<OptimalTimesSection {...defaultProps} />);

      // Check for wave icon and height
      expect(screen.getByText("4.5ft")).toBeInTheDocument();
      expect(screen.getByText("4.2ft")).toBeInTheDocument();

      // Check for wind icon and conditions
      expect(screen.getByText("5mph NE")).toBeInTheDocument();
      expect(screen.getByText("7mph E")).toBeInTheDocument();

      // Check for confidence percentage
      expect(screen.getByText("85% confidence")).toBeInTheDocument();
      expect(screen.getByText("80% confidence")).toBeInTheDocument();
    });

    it("should truncate long reason lists correctly", () => {
      const longReasonsResponse = {
        success: true,
        data: {
          ...mockOptimalTimesResponse.data,
          optimalTimes: [
            {
              ...mockOptimalTimes[0],
              reasons: [
                "Good wave height (4.5ft)",
                "Light winds (5mph)",
                "Offshore winds (NE)",
                "High forecast confidence",
                "Perfect tide conditions",
              ],
            },
          ],
        },
      };

      mockUseDataFetcher.mockReturnValue(
        createMockDataFetcherResponse(longReasonsResponse, false)
      );

      render(<OptimalTimesSection {...defaultProps} />);

      expect(
        screen.getByText(
          /Good wave height \(4.5ft\), Light winds \(5mph\)\.\.\./
        )
      ).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    beforeEach(() => {
      mockUseDataFetcher.mockReturnValue(
        createMockDataFetcherResponse(mockOptimalTimesResponse, false)
      );
    });

    it("should have proper button roles for time slot selection", () => {
      render(<OptimalTimesSection {...defaultProps} />);

      const timeButtons = screen.getAllByRole("button");
      expect(timeButtons.length).toBeGreaterThan(0);
    });

    it("should have proper headings", () => {
      render(<OptimalTimesSection {...defaultProps} />);

      expect(
        screen.getByRole("heading", { name: /Optimal Times for 2024-01-17/ })
      ).toBeInTheDocument();
    });

    it("should have descriptive text for screen readers", () => {
      render(<OptimalTimesSection {...defaultProps} />);

      expect(
        screen.getByText(
          /Scores are based on wave height, wind conditions, and forecast confidence/
        )
      ).toBeInTheDocument();
    });
  });

  describe("Sorting behavior", () => {
    it("should display time slots sorted by score descending", () => {
      const unsortedResponse = {
        success: true,
        data: {
          ...mockOptimalTimesResponse.data,
          optimalTimes: [
            { ...mockOptimalTimes[1], score: 88 }, // Lower score
            { ...mockOptimalTimes[0], score: 92 }, // Higher score
          ],
        },
      };

      mockUseDataFetcher.mockReturnValue(
        createMockDataFetcherResponse(unsortedResponse, false)
      );

      render(<OptimalTimesSection {...defaultProps} />);

      const buttons = screen.getAllByRole("button");
      const scores = screen.getAllByText(/^\d{2}$/); // Match 2-digit scores

      // First button should have the higher score (92)
      expect(scores[0]).toHaveTextContent("92");
      expect(scores[1]).toHaveTextContent("88");
    });
  });
});
