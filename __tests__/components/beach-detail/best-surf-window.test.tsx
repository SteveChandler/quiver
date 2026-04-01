import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BestSurfWindow } from "@/components/beach-detail/best-surf-window";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { useMagicHour } from "@/hooks/use-magic-hour";
import { findNextBestWindow } from "@/lib/utils/morning-intel-utils";
import { getWindowStatus } from "@/lib/utils/window-status";
import type { EnhancedForecastEntity } from "@/types/forecast";

// Mock dependencies
jest.mock("@/hooks/use-data-fetcher");
jest.mock("@/hooks/use-magic-hour");
jest.mock("@/lib/utils/morning-intel-utils");
jest.mock("@/lib/utils/window-status");
jest.mock("next/navigation", () => ({
  usePathname: jest.fn(() => "/beach/123"),
}));
jest.mock("@/components/share/share-sheet", () => ({
  ShareSheet: ({ open }: { open: boolean }) =>
    open ? <div data-testid="share-sheet" /> : null,
}));
// Mock timezone-utils so forecastDate is always "2024-01-15" (matching mockIntel/mockForecasts)
jest.mock("@/lib/utils/timezone-utils", () => ({
  DEFAULT_TIMEZONE: "America/Los_Angeles",
  resolveBeachTimezone: jest.fn((tz?: string | null) => tz || "America/Los_Angeles"),
  getLocalDateString: jest.fn(() => "2024-01-15"),
}));

const mockUseDataFetcher = useDataFetcher as jest.Mock;
const mockUseMagicHour = useMagicHour as jest.Mock;
const mockFindNextBestWindow = findNextBestWindow as jest.Mock;
const mockGetWindowStatus = getWindowStatus as jest.Mock;

describe("BestSurfWindow", () => {
  const defaultProps = {
    beachId: "test-beach-123",
    beachName: "Test Beach",
    beachTimezone: "America/Los_Angeles",
  };

  const mockIntel = {
    id: "intel-1",
    beach_id: "test-beach-123",
    forecast_date: "2024-01-15",
    best_window_start: "06:00:00",
    best_window_end: "09:00:00",
    best_window_description: "Clean offshore winds with rising swell",
    surf_min_ft: 3,
    surf_max_ft: 5,
    surf_description: "Chest to head high",
    wind_speed_mph: 5,
    wind_direction_text: "NE",
    wind_quality: "Offshore",
    tide_height_ft: 2.5,
    tide_time: "07:30:00",
    tide_optimal_range: "2-4 ft",
    next_tide_type: "High",
    next_tide_time: "13:45",
    next_tide_height_ft: 5.2,
    confidence: "High",
    conditions_score: 8.5,
    recommendation: "Perfect morning session with offshore winds",
    generated_at: "2024-01-15T05:00:00Z",
    raw_intel_data: {},
  };

  const mockForecasts = [
    {
      id: "1",
      beach_id: "test-beach-123",
      forecast_at: "2024-01-15T06:00:00Z",
      forecast_date: "2024-01-15",
      forecast_time: "06:00:00",
      wind_speed: 5,
      wind_direction: 45,
      wave_period: 12,
      swell_1_period: 14,
      tide_height: 2.5,
      created_at: "2024-01-15T00:00:00Z",
      updated_at: "2024-01-15T00:00:00Z",
    },
    {
      id: "2",
      beach_id: "test-beach-123",
      forecast_at: "2024-01-15T09:00:00Z",
      forecast_date: "2024-01-15",
      forecast_time: "09:00:00",
      wind_speed: 8,
      wind_direction: 90,
      wave_period: 10,
      swell_1_period: 12,
      tide_height: 3.5,
      created_at: "2024-01-15T00:00:00Z",
      updated_at: "2024-01-15T00:00:00Z",
    },
  ] as unknown as EnhancedForecastEntity[];

  beforeEach(() => {
    jest.clearAllMocks();
    // Default mocks
    mockUseMagicHour.mockReturnValue({
      magicHour: null,
      isLoading: false,
      error: null,
    });
    mockFindNextBestWindow.mockReturnValue(null);
    // Default: upcoming window status (safe default that renders the full component)
    mockGetWindowStatus.mockReturnValue({
      status: "upcoming",
      message: "Starts in 1 hour",
    });
  });

  describe("Loading state", () => {
    it("should render loading skeleton when data is loading", () => {
      mockUseDataFetcher.mockReturnValue({
        data: null,
        loading: true,
        error: null,
        refetch: jest.fn(),
      });

      const { container } = render(<BestSurfWindow {...defaultProps} />);

      // Check for skeleton elements by looking for animate-pulse class
      const skeletons = container.querySelectorAll(".animate-pulse");
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });

  describe("Time window rendering", () => {
    it("should render time window range with start and end times", () => {
      mockUseDataFetcher.mockReturnValue({
        data: mockIntel,
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      render(<BestSurfWindow {...defaultProps} />);

      // Look for time range display
      expect(screen.getByText(/6:00 AM - 9:00 AM/i)).toBeInTheDocument();
    });

    it("should format times correctly using toLocaleTimeString", () => {
      mockUseDataFetcher.mockReturnValue({
        data: {
          ...mockIntel,
          best_window_start: "14:30:00",
          best_window_end: "17:00:00",
        },
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      render(<BestSurfWindow {...defaultProps} />);

      // Check for afternoon times
      expect(screen.getByText(/2:30 PM - 5:00 PM/i)).toBeInTheDocument();
    });

    it("should handle midnight crossing times", () => {
      mockUseDataFetcher.mockReturnValue({
        data: {
          ...mockIntel,
          best_window_start: "23:00:00",
          best_window_end: "01:00:00",
        },
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      render(<BestSurfWindow {...defaultProps} />);

      // Times should be rendered (crossing midnight) - use getAllByText as the
      // time may appear in more than one element (e.g. the display and share text)
      expect(screen.getAllByText(/11:00 PM/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/1:00 AM/i).length).toBeGreaterThan(0);
    });
  });

  describe("Conditions summary rendering", () => {
    it("should render conditions summary text", () => {
      mockUseDataFetcher.mockReturnValue({
        data: mockIntel,
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      render(<BestSurfWindow {...defaultProps} />);

      expect(
        screen.getByText(/Clean offshore winds with rising swell/i)
      ).toBeInTheDocument();
    });

    it("should display surf metrics", () => {
      mockUseDataFetcher.mockReturnValue({
        data: mockIntel,
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      const { container } = render(<BestSurfWindow {...defaultProps} />);

      // Look for surf metrics in the conditions grid
      const surfSection = container.querySelector('[class*="font-semibold"]');
      expect(surfSection).toBeInTheDocument();
      // Check that surf description is present
      expect(screen.getByText(/Chest to head high/i)).toBeInTheDocument();
    });

    it("should display wind metrics", () => {
      mockUseDataFetcher.mockReturnValue({
        data: mockIntel,
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      render(<BestSurfWindow {...defaultProps} />);

      // Check for wind quality in the conditions grid
      const offshoreText = screen.getAllByText(/offshore/i);
      expect(offshoreText.length).toBeGreaterThan(0);
    });

    it("should display tide metrics", () => {
      mockUseDataFetcher.mockReturnValue({
        data: mockIntel,
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      render(<BestSurfWindow {...defaultProps} />);

      expect(screen.getByText(/2.5 ft @ 7:30 AM/i)).toBeInTheDocument();
      expect(screen.getByText(/Best: 2-4 ft/i)).toBeInTheDocument();
    });

    it("should display confidence and score", () => {
      mockUseDataFetcher.mockReturnValue({
        data: mockIntel,
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      render(<BestSurfWindow {...defaultProps} />);

      expect(screen.getByText("High")).toBeInTheDocument();
      expect(screen.getByText(/Score: 8.5\/10/i)).toBeInTheDocument();
    });

    it("should display recommendation text", () => {
      mockUseDataFetcher.mockReturnValue({
        data: mockIntel,
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      render(<BestSurfWindow {...defaultProps} />);

      expect(
        screen.getByText(/Perfect morning session with offshore winds/i)
      ).toBeInTheDocument();
    });
  });

  describe("Null/missing window data handling", () => {
    it("should handle missing intel data gracefully", () => {
      mockUseDataFetcher.mockReturnValue({
        data: null,
        loading: false,
        error: null,
        refetch: jest.fn(),
      });
      mockFindNextBestWindow.mockReturnValue(null);

      render(<BestSurfWindow {...defaultProps} />);

      expect(
        screen.getByText(/Surf intel not available yet/i)
      ).toBeInTheDocument();
    });

    it("should handle error state gracefully", () => {
      mockUseDataFetcher.mockReturnValue({
        data: null,
        loading: false,
        error: new Error("Failed to fetch"),
        refetch: jest.fn(),
      });
      mockFindNextBestWindow.mockReturnValue(null);

      render(<BestSurfWindow {...defaultProps} />);

      expect(
        screen.getByText(/Surf intel not available yet/i)
      ).toBeInTheDocument();
    });

    it("should show fallback when no best window times exist", () => {
      mockUseDataFetcher.mockReturnValue({
        data: {
          ...mockIntel,
          best_window_start: null,
          best_window_end: null,
          best_window_description: "No optimal window found today",
        },
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      render(<BestSurfWindow {...defaultProps} />);

      expect(
        screen.getByText(/No optimal window found today/i)
      ).toBeInTheDocument();
    });

    it("should show fallback message when intel unavailable and no forecast window", () => {
      mockUseDataFetcher.mockReturnValue({
        data: null,
        loading: false,
        error: null,
        refetch: jest.fn(),
      });
      // Mock returns null indicating no good window found
      mockFindNextBestWindow.mockReturnValue(null);

      render(<BestSurfWindow {...defaultProps} forecasts={[]} />);

      // Should show the fallback message
      expect(
        screen.getByText(/Surf intel not available yet/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Intel is generated daily for select beaches/i)
      ).toBeInTheDocument();
    });
  });

  describe("Window status indicators", () => {
    it("should show upcoming status when window hasn't started", () => {
      mockGetWindowStatus.mockReturnValue({
        status: "upcoming",
        message: "Starts in 1 hour",
      });

      mockUseDataFetcher.mockReturnValue({
        data: mockIntel,
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      render(<BestSurfWindow {...defaultProps} />);

      expect(screen.getByText(/Starts in/i)).toBeInTheDocument();
    });

    it("should show current status when in the window", () => {
      mockGetWindowStatus.mockReturnValue({
        status: "current",
        message: "120 mins remaining",
      });

      mockUseDataFetcher.mockReturnValue({
        data: mockIntel,
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      render(<BestSurfWindow {...defaultProps} />);

      expect(screen.getByText(/SURF NOW!/i)).toBeInTheDocument();
      expect(screen.getByText(/remaining/i)).toBeInTheDocument();
    });

    it("should show passed status when window has ended", () => {
      mockGetWindowStatus.mockReturnValue({
        status: "passed",
        message: "Window has passed",
      });

      mockUseDataFetcher.mockReturnValue({
        data: mockIntel,
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      render(<BestSurfWindow {...defaultProps} />);

      expect(screen.getByText(/Window has passed/i)).toBeInTheDocument();
    });
  });

  describe("Magic Hour integration", () => {
    it("should display Magic Hour when available", () => {
      // Window must not be "passed" for Magic Hour to show
      mockGetWindowStatus.mockReturnValue({
        status: "current",
        message: "120 mins remaining",
      });

      const mockMagicHour = {
        found: true,
        peakTime: new Date("2024-01-15T15:30:00Z"),
        windowStart: "7:00 AM",
        windowEnd: "8:00 AM",
        confidence: 0.85,
        windQuality: "perfect" as const,
        swellMatch: true,
        tideInRange: true,
      };

      mockUseDataFetcher.mockReturnValue({
        data: mockIntel,
        loading: false,
        error: null,
        refetch: jest.fn(),
      });
      mockUseMagicHour.mockReturnValue({
        magicHour: mockMagicHour,
        isLoading: false,
        error: null,
      });

      render(<BestSurfWindow {...defaultProps} />);

      expect(screen.getByText(/Magic Hour/i)).toBeInTheDocument();
      expect(screen.getByText(/High confidence/i)).toBeInTheDocument();
    });

    it("should show Magic Hour loading state", () => {
      // Window must not be "passed" for loading indicator to show
      mockGetWindowStatus.mockReturnValue({
        status: "current",
        message: "120 mins remaining",
      });

      mockUseDataFetcher.mockReturnValue({
        data: mockIntel,
        loading: false,
        error: null,
        refetch: jest.fn(),
      });
      mockUseMagicHour.mockReturnValue({
        magicHour: null,
        isLoading: true,
        error: null,
      });

      render(<BestSurfWindow {...defaultProps} />);

      expect(
        screen.getByText(/Calculating peak time/i)
      ).toBeInTheDocument();
    });

    it("should display wind quality badges correctly", () => {
      // Window must not be "passed" for Magic Hour to show
      mockGetWindowStatus.mockReturnValue({
        status: "current",
        message: "120 mins remaining",
      });

      const mockMagicHour = {
        found: true,
        peakTime: new Date("2024-01-15T15:30:00Z"),
        windowStart: "7:00 AM",
        windowEnd: "8:00 AM",
        confidence: 0.9,
        windQuality: "perfect" as const,
        swellMatch: true,
        tideInRange: true,
      };

      mockUseDataFetcher.mockReturnValue({
        data: mockIntel,
        loading: false,
        error: null,
        refetch: jest.fn(),
      });
      mockUseMagicHour.mockReturnValue({
        magicHour: mockMagicHour,
        isLoading: false,
        error: null,
      });

      render(<BestSurfWindow {...defaultProps} />);

      // Check for Magic Hour indicators
      expect(screen.getByText(/Swell aligned/i)).toBeInTheDocument();
      expect(screen.getByText(/Optimal tide/i)).toBeInTheDocument();
    });
  });

  describe("Next window display", () => {
    it("should show next best window when primary has passed", () => {
      mockGetWindowStatus.mockReturnValue({
        status: "passed",
        message: "Window has passed",
      });

      mockUseDataFetcher.mockReturnValue({
        data: mockIntel,
        loading: false,
        error: null,
        refetch: jest.fn(),
      });
      mockFindNextBestWindow.mockReturnValue({
        startTime: "14:00:00",
        endTime: "16:00:00",
        description: "Afternoon session",
        conditions: "Moderate winds",
      });

      render(<BestSurfWindow {...defaultProps} forecasts={mockForecasts} />);

      expect(
        screen.getByText(/Next Best Window Today/i)
      ).toBeInTheDocument();
      expect(screen.getByText(/2:00.*PM.*4:00.*PM/i)).toBeInTheDocument();
    });

    it("should show current conditions when window passed and no next window", () => {
      mockGetWindowStatus.mockReturnValue({
        status: "passed",
        message: "Window has passed",
      });

      mockUseDataFetcher.mockReturnValue({
        data: mockIntel,
        loading: false,
        error: null,
        refetch: jest.fn(),
      });
      mockFindNextBestWindow.mockReturnValue(null);

      render(<BestSurfWindow {...defaultProps} />);

      expect(screen.getByText(/Current Conditions/i)).toBeInTheDocument();
      expect(screen.getByText(/Right now/i)).toBeInTheDocument();
    });
  });

  describe("Visual elements", () => {
    it("should render clock icon for time window", () => {
      mockUseDataFetcher.mockReturnValue({
        data: mockIntel,
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      const { container } = render(<BestSurfWindow {...defaultProps} />);

      // Check for lucide-react icon presence
      const icons = container.querySelectorAll("svg");
      expect(icons.length).toBeGreaterThan(0);
    });

    it("should render wave icon for surf conditions", () => {
      mockUseDataFetcher.mockReturnValue({
        data: mockIntel,
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      render(<BestSurfWindow {...defaultProps} />);

      // Surf section should be present (case insensitive)
      const surfLabels = screen.getAllByText(/surf/i);
      expect(surfLabels.length).toBeGreaterThan(0);
    });

    it("should render wind icon for wind conditions", () => {
      mockUseDataFetcher.mockReturnValue({
        data: mockIntel,
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      render(<BestSurfWindow {...defaultProps} />);

      // Wind section should be present
      const windLabels = screen.getAllByText(/wind/i);
      expect(windLabels.length).toBeGreaterThan(0);
    });

    it("should render alert icon when intel not available", () => {
      mockUseDataFetcher.mockReturnValue({
        data: null,
        loading: false,
        error: null,
        refetch: jest.fn(),
      });
      mockFindNextBestWindow.mockReturnValue(null);

      render(<BestSurfWindow {...defaultProps} />);

      const alertText = screen.getByText(/Surf intel not available yet/i);
      expect(alertText).toBeInTheDocument();
    });

    it("should apply correct styling classes based on window status", () => {
      // Mock "current" status so green styling is applied
      mockGetWindowStatus.mockReturnValue({
        status: "current",
        message: "120 mins remaining",
      });

      mockUseDataFetcher.mockReturnValue({
        data: mockIntel,
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      const { container } = render(<BestSurfWindow {...defaultProps} />);

      // Check for green styling when current
      const greenElements = container.querySelectorAll('[class*="green"]');
      expect(greenElements.length).toBeGreaterThan(0);
    });
  });

  describe("Share functionality", () => {
    it("should render share button", () => {
      mockUseDataFetcher.mockReturnValue({
        data: mockIntel,
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      render(<BestSurfWindow {...defaultProps} />);

      const shareButton = screen.getByTitle(/Share surf intel/i);
      expect(shareButton).toBeInTheDocument();
    });

    it("should open ShareSheet when share button clicked", async () => {
      const user = userEvent.setup();

      mockUseDataFetcher.mockReturnValue({
        data: mockIntel,
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      render(<BestSurfWindow {...defaultProps} />);

      expect(screen.queryByTestId("share-sheet")).not.toBeInTheDocument();

      const shareButton = screen.getByTitle(/Share surf intel/i);
      await user.click(shareButton);

      expect(screen.getByTestId("share-sheet")).toBeInTheDocument();
    });
  });

  describe("Timezone handling", () => {
    it("should use beach timezone for calculations", () => {
      mockUseDataFetcher.mockReturnValue({
        data: mockIntel,
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      render(
        <BestSurfWindow {...defaultProps} beachTimezone="Pacific/Honolulu" />
      );

      // Component should render without errors
      expect(
        screen.getByText(/Best Time to Surf Today/i)
      ).toBeInTheDocument();
    });

    it("should handle null timezone gracefully", () => {
      mockUseDataFetcher.mockReturnValue({
        data: mockIntel,
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      render(<BestSurfWindow {...defaultProps} beachTimezone={null} />);

      // Should use default timezone
      expect(
        screen.getByText(/Best Time to Surf Today/i)
      ).toBeInTheDocument();
    });
  });

  describe("Edge cases", () => {
    it("should handle identical start and end times", () => {
      mockUseDataFetcher.mockReturnValue({
        data: {
          ...mockIntel,
          best_window_start: "08:00:00",
          best_window_end: "08:00:00",
        },
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      render(<BestSurfWindow {...defaultProps} />);

      // Component should render the title without crashing
      expect(
        screen.getByText(/Best Time to Surf Today/i)
      ).toBeInTheDocument();
      // Description should be shown when times are equal (using getAllByText since it might appear multiple times)
      const descriptions = screen.getAllByText(
        /Clean offshore winds with rising swell/i
      );
      expect(descriptions.length).toBeGreaterThan(0);
    });

    it("should handle null confidence score", () => {
      mockUseDataFetcher.mockReturnValue({
        data: {
          ...mockIntel,
          conditions_score: null,
        },
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      render(<BestSurfWindow {...defaultProps} />);

      // Should still render confidence
      expect(screen.getByText("High")).toBeInTheDocument();
      // Score should not appear when null
      expect(screen.queryByText(/Score:/i)).not.toBeInTheDocument();
    });

    it("should handle empty forecasts array", () => {
      mockUseDataFetcher.mockReturnValue({
        data: null,
        loading: false,
        error: null,
        refetch: jest.fn(),
      });
      mockFindNextBestWindow.mockReturnValue(null);

      render(<BestSurfWindow {...defaultProps} forecasts={[]} />);

      expect(
        screen.getByText(/Surf intel not available yet/i)
      ).toBeInTheDocument();
    });

    it("should handle very long description text", () => {
      const longDescription =
        "This is an extremely long description that contains a lot of detail about the surf conditions and might cause layout issues if not properly handled in the component rendering logic and CSS";

      mockUseDataFetcher.mockReturnValue({
        data: {
          ...mockIntel,
          best_window_description: longDescription,
        },
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      render(<BestSurfWindow {...defaultProps} />);

      expect(screen.getByText(longDescription)).toBeInTheDocument();
    });
  });

  describe("Generated time display", () => {
    it("should display when intel was generated", () => {
      mockUseDataFetcher.mockReturnValue({
        data: mockIntel,
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      render(<BestSurfWindow {...defaultProps} />);

      expect(screen.getByText(/Updated at/i)).toBeInTheDocument();
    });
  });
});
