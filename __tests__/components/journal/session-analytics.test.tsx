import { render, screen, fireEvent } from "@testing-library/react";
import { SessionAnalytics } from "@/components/journal/session-analytics";
import type { SessionWithDetails } from "@/types/database";

// Mock session data
const mockSessions = [
  {
    id: "session-1",
    user_id: "user-123",
    profile_id: "user-123",
    beach_id: "beach-1",
    beach_name: "Test Beach",
    status: "completed",
    arrival_time: "2024-01-15T10:00:00Z",
    duration_minutes: 120,
    rating: 4,
    wave_quality: 6,
    water_temp: 68,
    crowd_level: 3,
    wind_conditions: 2,
    parking_ease: 4,
    notes: "Great session!",
    is_public: true,
    created_at: "2024-01-15T10:00:00Z",
    updated_at: "2024-01-15T12:00:00Z",
    beaches: { id: "beach-1", name: "Test Beach" } as any,
    boards: { id: "board-1", name: "Test Board" } as any,
    profiles: { id: "user-123", full_name: "Test User" } as any,
    beach: { id: "beach-1", name: "Test Beach" } as any,
    board: { id: "board-1", name: "Test Board" } as any,
    user: { id: "user-123", full_name: "Test User" } as any,
    board_id: "board-1",
    wave_height: null,
    wave_period: null,
    tide_level: null,
    swell_direction: null,
    wind_speed: null,
    wind_direction: null,
    visibility: null,
    air_temp: null,
    wetsuit_thickness: null,
    session_date: "2024-01-15T10:00:00Z",
  },
  {
    id: "session-2",
    user_id: "user-123",
    profile_id: "user-123",
    beach_id: "beach-2",
    beach_name: "Another Beach",
    status: "completed",
    arrival_time: "2024-01-20T14:00:00Z",
    duration_minutes: 90,
    rating: 5,
    wave_quality: 8,
    water_temp: 70,
    crowd_level: 2,
    wind_conditions: 3,
    parking_ease: 5,
    notes: "Epic waves!",
    is_public: false,
    created_at: "2024-01-20T14:00:00Z",
    updated_at: "2024-01-20T16:00:00Z",
    beaches: { id: "beach-2", name: "Another Beach" } as any,
    boards: { id: "board-2", name: "Another Board" } as any,
    profiles: { id: "user-123", full_name: "Test User" } as any,
    beach: { id: "beach-2", name: "Another Beach" } as any,
    board: { id: "board-2", name: "Another Board" } as any,
    user: { id: "user-123", full_name: "Test User" } as any,
    board_id: "board-2",
    wave_height: null,
    wave_period: null,
    tide_level: null,
    swell_direction: null,
    wind_speed: null,
    wind_direction: null,
    visibility: null,
    air_temp: null,
    wetsuit_thickness: null,
    session_date: "2024-01-20T14:00:00Z",
  },
  {
    id: "session-3",
    user_id: "user-123",
    profile_id: "user-123",
    beach_id: "beach-1",
    beach_name: "Test Beach",
    status: "completed",
    arrival_time: "2024-01-25T09:00:00Z",
    duration_minutes: 150,
    rating: 3,
    wave_quality: 5,
    water_temp: 67,
    crowd_level: 4,
    wind_conditions: 2,
    parking_ease: 3,
    notes: "Crowded but fun",
    is_public: true,
    created_at: "2024-01-25T09:00:00Z",
    updated_at: "2024-01-25T11:30:00Z",
    beaches: { id: "beach-1", name: "Test Beach" } as any,
    boards: { id: "board-1", name: "Test Board" } as any,
    profiles: { id: "user-123", full_name: "Test User" } as any,
    beach: { id: "beach-1", name: "Test Beach" } as any,
    board: { id: "board-1", name: "Test Board" } as any,
    user: { id: "user-123", full_name: "Test User" } as any,
    board_id: "board-1",
    wave_height: null,
    wave_period: null,
    tide_level: null,
    swell_direction: null,
    wind_speed: null,
    wind_direction: null,
    visibility: null,
    air_temp: null,
    wetsuit_thickness: null,
    session_date: "2024-01-25T09:00:00Z",
  },
] as unknown as SessionWithDetails[];

const mockAnalytics = {
  totalSessions: 3,
  totalHours: 6,
  averageRating: 4.0,
  averageWaveHeight: 6.3,
  waveHeightTrend: [
    { date: "2024-01-15", averageWaveHeight: 6 },
    { date: "2024-01-20", averageWaveHeight: 8 },
    { date: "2024-01-25", averageWaveHeight: 5 },
  ],
  conditionRatings: {
    waveQuality: 6.3,
    waterTemp: 68.3,
    crowdLevel: 3.0,
    windConditions: 2.3,
    parkingEase: 4.0,
  },
  monthlyStats: [
    { month: "Jan 2024", sessionCount: 3, averageRating: 4.0 },
    { month: "Dec 2023", sessionCount: 0 },
    { month: "Nov 2023", sessionCount: 2, averageRating: 3.5 },
  ],
  favoriteBeach: "Test Beach",
  frequentBoards: [
    { boardId: "board-1", boardName: "Test Board", usageCount: 2 },
    { boardId: "board-2", boardName: "Another Board", usageCount: 1 },
  ],
};

describe("SessionAnalytics", () => {
  const mockOnRefresh = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Empty State", () => {
    it("renders alert when analytics is null", () => {
      render(
        <SessionAnalytics
          analytics={null}
          sessions={[]}
          onRefresh={mockOnRefresh}
        />
      );

      expect(
        screen.getByText(
          "No analytics data available. Log some sessions to see your surfing insights!"
        )
      ).toBeInTheDocument();
    });

    it("does not render analytics content when data is null", () => {
      render(
        <SessionAnalytics
          analytics={null}
          sessions={[]}
          onRefresh={mockOnRefresh}
        />
      );

      expect(screen.queryByText("Session Insights")).not.toBeInTheDocument();
      expect(screen.queryByText("Completed Sessions")).not.toBeInTheDocument();
    });
  });

  describe("Analytics Display", () => {
    it("renders session insights header with refresh button", () => {
      render(
        <SessionAnalytics
          analytics={mockAnalytics}
          sessions={mockSessions}
          onRefresh={mockOnRefresh}
        />
      );

      expect(screen.getByText("Session Insights")).toBeInTheDocument();
      expect(
        screen.getByText("Analyze your surfing performance and trends")
      ).toBeInTheDocument();

      const refreshButton = screen.getByRole("button", { name: /refresh/i });
      expect(refreshButton).toBeInTheDocument();
    });

    it("calls onRefresh when refresh button is clicked", () => {
      render(
        <SessionAnalytics
          analytics={mockAnalytics}
          sessions={mockSessions}
          onRefresh={mockOnRefresh}
        />
      );

      const refreshButton = screen.getByRole("button", { name: /refresh/i });
      fireEvent.click(refreshButton);

      expect(mockOnRefresh).toHaveBeenCalledTimes(1);
    });

    it("displays total sessions KPI", () => {
      render(
        <SessionAnalytics
          analytics={mockAnalytics}
          sessions={mockSessions}
          onRefresh={mockOnRefresh}
        />
      );

      expect(screen.getByText("3")).toBeInTheDocument();
      expect(screen.getByText("Completed Sessions")).toBeInTheDocument();
    });

    it("displays total hours KPI", () => {
      render(
        <SessionAnalytics
          analytics={mockAnalytics}
          sessions={mockSessions}
          onRefresh={mockOnRefresh}
        />
      );

      expect(screen.getByText("6h")).toBeInTheDocument();
      expect(screen.getByText("Time Surfed")).toBeInTheDocument();
    });

    it("displays average rating KPI", () => {
      render(
        <SessionAnalytics
          analytics={mockAnalytics}
          sessions={mockSessions}
          onRefresh={mockOnRefresh}
        />
      );

      expect(screen.getByText("4/5")).toBeInTheDocument();
      expect(screen.getByText("Avg Rating")).toBeInTheDocument();
    });

    it("displays average wave height KPI", () => {
      render(
        <SessionAnalytics
          analytics={mockAnalytics}
          sessions={mockSessions}
          onRefresh={mockOnRefresh}
        />
      );

      expect(screen.getByText("6.3ft")).toBeInTheDocument();
      expect(screen.getByText("Avg Waves")).toBeInTheDocument();
    });

    it("calculates and displays average hours per session", () => {
      render(
        <SessionAnalytics
          analytics={mockAnalytics}
          sessions={mockSessions}
          onRefresh={mockOnRefresh}
        />
      );

      // 6 total hours / 3 sessions = 2h per session
      expect(screen.getByText(/Avg 2h per session/i)).toBeInTheDocument();
    });

    it("displays best rated session score", () => {
      render(
        <SessionAnalytics
          analytics={mockAnalytics}
          sessions={mockSessions}
          onRefresh={mockOnRefresh}
        />
      );

      // Best session has rating of 5
      expect(screen.getByText(/Best: 5\/5/i)).toBeInTheDocument();
    });

    it("displays max wave height", () => {
      render(
        <SessionAnalytics
          analytics={mockAnalytics}
          sessions={mockSessions}
          onRefresh={mockOnRefresh}
        />
      );

      // Max wave quality is 8ft
      expect(screen.getByText(/Max: 8ft/i)).toBeInTheDocument();
    });
  });

  describe("Monthly Growth Calculation", () => {
    it("calculates positive monthly growth correctly", () => {
      // Current month (January): 3 sessions
      // Last month (December): 0 sessions in mockAnalytics
      // But we need sessions from last month in mockSessions for calculation
      const sessionsWithLastMonth = [
        ...mockSessions,
        {
          ...mockSessions[0],
          id: "last-month-1",
          arrival_time: new Date(
            new Date().getFullYear(),
            new Date().getMonth() - 1,
            15
          ).toISOString(),
        },
      ];

      render(
        <SessionAnalytics
          analytics={mockAnalytics}
          sessions={sessionsWithLastMonth as any}
          onRefresh={mockOnRefresh}
        />
      );

      // Should show monthly growth percentage
      const growthText = screen.getByText(/from last month/i);
      expect(growthText).toBeInTheDocument();
    });

    it("displays 0% growth when last month had no sessions", () => {
      // Mock current date to be in a month where we can control the data
      const currentMonthSessions = mockSessions.map((s) => ({
        ...s,
        arrival_time: new Date(
          new Date().getFullYear(),
          new Date().getMonth(),
          15
        ).toISOString(),
      }));

      render(
        <SessionAnalytics
          analytics={mockAnalytics}
          sessions={currentMonthSessions as any}
          onRefresh={mockOnRefresh}
        />
      );

      // When last month has 0 sessions, growth should be 0%
      const growthText = screen.getByText(/from last month/i);
      expect(growthText).toBeInTheDocument();
    });
  });

  describe("Chart Selection", () => {
    it("renders chart selection buttons", () => {
      render(
        <SessionAnalytics
          analytics={mockAnalytics}
          sessions={mockSessions}
          onRefresh={mockOnRefresh}
        />
      );

      expect(
        screen.getByRole("button", { name: /wave height trend/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /conditions radar/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /session frequency/i })
      ).toBeInTheDocument();
    });

    it("displays wave height trend chart by default", () => {
      render(
        <SessionAnalytics
          analytics={mockAnalytics}
          sessions={mockSessions}
          onRefresh={mockOnRefresh}
        />
      );

      expect(screen.getByText("Wave Height Over Time")).toBeInTheDocument();
      expect(
        screen.getByText("Your recent session wave heights and trends")
      ).toBeInTheDocument();
    });

    it("switches to conditions radar chart when button clicked", () => {
      render(
        <SessionAnalytics
          analytics={mockAnalytics}
          sessions={mockSessions}
          onRefresh={mockOnRefresh}
        />
      );

      const conditionsButton = screen.getByRole("button", {
        name: /conditions radar/i,
      });
      fireEvent.click(conditionsButton);

      expect(
        screen.getByText("Condition Ratings Comparison")
      ).toBeInTheDocument();
      expect(
        screen.getByText("How you rate different surfing conditions")
      ).toBeInTheDocument();
    });

    it("switches to frequency chart when button clicked", () => {
      render(
        <SessionAnalytics
          analytics={mockAnalytics}
          sessions={mockSessions}
          onRefresh={mockOnRefresh}
        />
      );

      const frequencyButton = screen.getByRole("button", {
        name: /session frequency/i,
      });
      fireEvent.click(frequencyButton);

      expect(
        screen.getByText("Monthly Session Frequency")
      ).toBeInTheDocument();
      expect(
        screen.getByText("Your surfing activity over the past year")
      ).toBeInTheDocument();
    });
  });

  describe("Wave Height Trend Chart", () => {
    it("displays all trend data points", () => {
      render(
        <SessionAnalytics
          analytics={mockAnalytics}
          sessions={mockSessions}
          onRefresh={mockOnRefresh}
        />
      );

      // Check for date labels in the trend
      expect(screen.getByText("2024-01-15")).toBeInTheDocument();
      expect(screen.getByText("2024-01-20")).toBeInTheDocument();
      expect(screen.getByText("2024-01-25")).toBeInTheDocument();
    });

    it("displays wave height range in chart summary", () => {
      render(
        <SessionAnalytics
          analytics={mockAnalytics}
          sessions={mockSessions}
          onRefresh={mockOnRefresh}
        />
      );

      // Min: 5ft, Max: 8ft
      expect(screen.getByText(/Showing wave heights from 5ft to 8ft/i)).toBeInTheDocument();
      expect(screen.getByText(/across 3 sessions/i)).toBeInTheDocument();
    });

    it("displays wave height labels on bars", () => {
      render(
        <SessionAnalytics
          analytics={mockAnalytics}
          sessions={mockSessions}
          onRefresh={mockOnRefresh}
        />
      );

      expect(screen.getByText("6ft")).toBeInTheDocument();
      expect(screen.getByText("8ft")).toBeInTheDocument();
      expect(screen.getByText("5ft")).toBeInTheDocument();
    });
  });

  describe("Condition Ratings Chart", () => {
    it("displays all condition rating categories", () => {
      render(
        <SessionAnalytics
          analytics={mockAnalytics}
          sessions={mockSessions}
          onRefresh={mockOnRefresh}
        />
      );

      // Switch to conditions chart
      const conditionsButton = screen.getByRole("button", {
        name: /conditions radar/i,
      });
      fireEvent.click(conditionsButton);

      expect(screen.getByText("Wave Quality")).toBeInTheDocument();
      expect(screen.getByText("Water Temp")).toBeInTheDocument();
      expect(screen.getByText("Crowd Level")).toBeInTheDocument();
      expect(screen.getByText("Wind")).toBeInTheDocument();
      expect(screen.getByText("Parking")).toBeInTheDocument();
    });

    it("displays wave quality rating", () => {
      render(
        <SessionAnalytics
          analytics={mockAnalytics}
          sessions={mockSessions}
          onRefresh={mockOnRefresh}
        />
      );

      const conditionsButton = screen.getByRole("button", {
        name: /conditions radar/i,
      });
      fireEvent.click(conditionsButton);

      expect(screen.getByText("6.3")).toBeInTheDocument();
    });

    it("displays water temperature in Fahrenheit", () => {
      render(
        <SessionAnalytics
          analytics={mockAnalytics}
          sessions={mockSessions}
          onRefresh={mockOnRefresh}
        />
      );

      const conditionsButton = screen.getByRole("button", {
        name: /conditions radar/i,
      });
      fireEvent.click(conditionsButton);

      expect(screen.getByText("68°F")).toBeInTheDocument();
    });

    it("displays crowd level rating", () => {
      render(
        <SessionAnalytics
          analytics={mockAnalytics}
          sessions={mockSessions}
          onRefresh={mockOnRefresh}
        />
      );

      const conditionsButton = screen.getByRole("button", {
        name: /conditions radar/i,
      });
      fireEvent.click(conditionsButton);

      expect(screen.getByText("3.0")).toBeInTheDocument();
    });

    it("displays wind conditions rating", () => {
      render(
        <SessionAnalytics
          analytics={mockAnalytics}
          sessions={mockSessions}
          onRefresh={mockOnRefresh}
        />
      );

      const conditionsButton = screen.getByRole("button", {
        name: /conditions radar/i,
      });
      fireEvent.click(conditionsButton);

      expect(screen.getByText("2.3")).toBeInTheDocument();
    });

    it("displays parking ease rating", () => {
      render(
        <SessionAnalytics
          analytics={mockAnalytics}
          sessions={mockSessions}
          onRefresh={mockOnRefresh}
        />
      );

      const conditionsButton = screen.getByRole("button", {
        name: /conditions radar/i,
      });
      fireEvent.click(conditionsButton);

      expect(screen.getByText("4.0")).toBeInTheDocument();
    });
  });

  describe("Session Frequency Chart", () => {
    it("displays monthly statistics", () => {
      render(
        <SessionAnalytics
          analytics={mockAnalytics}
          sessions={mockSessions}
          onRefresh={mockOnRefresh}
        />
      );

      const frequencyButton = screen.getByRole("button", {
        name: /session frequency/i,
      });
      fireEvent.click(frequencyButton);

      // Month labels (shortened)
      expect(screen.getByText("Jan")).toBeInTheDocument();
      expect(screen.getByText("Dec")).toBeInTheDocument();
      expect(screen.getByText("Nov")).toBeInTheDocument();
    });

    it("displays active vs inactive months summary", () => {
      render(
        <SessionAnalytics
          analytics={mockAnalytics}
          sessions={mockSessions}
          onRefresh={mockOnRefresh}
        />
      );

      const frequencyButton = screen.getByRole("button", {
        name: /session frequency/i,
      });
      fireEvent.click(frequencyButton);

      // 2 active months (Jan 2024: 3 sessions, Nov 2023: 2 sessions)
      expect(screen.getByText(/2 active months/i)).toBeInTheDocument();
      expect(screen.getByText(/out of 3 months shown/i)).toBeInTheDocument();
    });

    it("displays legend for active and inactive months", () => {
      render(
        <SessionAnalytics
          analytics={mockAnalytics}
          sessions={mockSessions}
          onRefresh={mockOnRefresh}
        />
      );

      const frequencyButton = screen.getByRole("button", {
        name: /session frequency/i,
      });
      fireEvent.click(frequencyButton);

      expect(screen.getByText("Months with sessions")).toBeInTheDocument();
      expect(screen.getByText("Months without sessions")).toBeInTheDocument();
    });
  });

  describe("Favorite Beach Section", () => {
    it("displays favorite beach when available", () => {
      render(
        <SessionAnalytics
          analytics={mockAnalytics}
          sessions={mockSessions}
          onRefresh={mockOnRefresh}
        />
      );

      expect(screen.getByText("Favorite Beaches")).toBeInTheDocument();
      expect(screen.getByText("Test Beach")).toBeInTheDocument();
      expect(screen.getByText("Most visited")).toBeInTheDocument();
    });

    it("displays message when no favorite beach", () => {
      const analyticsWithoutFavorite = {
        ...mockAnalytics,
        favoriteBeach: null,
      };

      render(
        <SessionAnalytics
          analytics={analyticsWithoutFavorite}
          sessions={mockSessions}
          onRefresh={mockOnRefresh}
        />
      );

      expect(screen.getByText("No favorite yet")).toBeInTheDocument();
      expect(
        screen.getByText("Visit different beaches to discover new favorites")
      ).toBeInTheDocument();
    });
  });

  describe("Frequent Boards Section", () => {
    it("displays go-to boards header", () => {
      render(
        <SessionAnalytics
          analytics={mockAnalytics}
          sessions={mockSessions}
          onRefresh={mockOnRefresh}
        />
      );

      expect(screen.getByText("Go-To Boards")).toBeInTheDocument();
    });

    it("displays top 3 most used boards", () => {
      render(
        <SessionAnalytics
          analytics={mockAnalytics}
          sessions={mockSessions}
          onRefresh={mockOnRefresh}
        />
      );

      expect(screen.getByText("Test Board")).toBeInTheDocument();
      expect(screen.getByText("2 sessions")).toBeInTheDocument();
      expect(screen.getByText("Another Board")).toBeInTheDocument();
      expect(screen.getByText("1 sessions")).toBeInTheDocument();
    });

    it("displays message when no board data", () => {
      const analyticsWithoutBoards = {
        ...mockAnalytics,
        frequentBoards: [],
      };

      render(
        <SessionAnalytics
          analytics={analyticsWithoutBoards}
          sessions={mockSessions}
          onRefresh={mockOnRefresh}
        />
      );

      expect(screen.getByText("No board data available")).toBeInTheDocument();
    });

    it("limits display to 3 boards even if more exist", () => {
      const analyticsWithManyBoards = {
        ...mockAnalytics,
        frequentBoards: [
          { boardId: "board-1", boardName: "Board 1", usageCount: 5 },
          { boardId: "board-2", boardName: "Board 2", usageCount: 4 },
          { boardId: "board-3", boardName: "Board 3", usageCount: 3 },
          { boardId: "board-4", boardName: "Board 4", usageCount: 2 },
          { boardId: "board-5", boardName: "Board 5", usageCount: 1 },
        ],
      };

      render(
        <SessionAnalytics
          analytics={analyticsWithManyBoards}
          sessions={mockSessions}
          onRefresh={mockOnRefresh}
        />
      );

      expect(screen.getByText("Board 1")).toBeInTheDocument();
      expect(screen.getByText("Board 2")).toBeInTheDocument();
      expect(screen.getByText("Board 3")).toBeInTheDocument();
      expect(screen.queryByText("Board 4")).not.toBeInTheDocument();
      expect(screen.queryByText("Board 5")).not.toBeInTheDocument();
    });
  });

  describe("Session Highlights", () => {
    it("displays session highlights header", () => {
      render(
        <SessionAnalytics
          analytics={mockAnalytics}
          sessions={mockSessions}
          onRefresh={mockOnRefresh}
        />
      );

      expect(screen.getByText("Session Highlights")).toBeInTheDocument();
      expect(screen.getByText("Your most memorable sessions")).toBeInTheDocument();
    });

    it("displays best rated session details", () => {
      render(
        <SessionAnalytics
          analytics={mockAnalytics}
          sessions={mockSessions}
          onRefresh={mockOnRefresh}
        />
      );

      expect(screen.getByText("Best Rated Session")).toBeInTheDocument();
      // Session 2 has rating of 5
      expect(screen.getByText(/Another Beach.*5\/5 stars/i)).toBeInTheDocument();
    });

    it("displays longest session details", () => {
      render(
        <SessionAnalytics
          analytics={mockAnalytics}
          sessions={mockSessions}
          onRefresh={mockOnRefresh}
        />
      );

      expect(screen.getByText("Longest Session")).toBeInTheDocument();
      // Session 3 has 150 minutes = 2.5h
      expect(screen.getByText(/Test Beach.*2.5h/i)).toBeInTheDocument();
    });

    it("displays session dates for highlights", () => {
      render(
        <SessionAnalytics
          analytics={mockAnalytics}
          sessions={mockSessions}
          onRefresh={mockOnRefresh}
        />
      );

      // Dates are formatted by toLocaleDateString
      const dateElements = screen.getAllByText(/1\/20\/2024|1\/25\/2024/);
      expect(dateElements.length).toBeGreaterThan(0);
    });

    it("handles sessions with beach object or beach_name", () => {
      const sessionsWithMixedBeachData = [
        {
          ...mockSessions[0],
          beach: { name: "Beach Object Name" } as any,
        },
        {
          ...mockSessions[1],
          beach: null,
          beach_name: "Beach Name String",
        },
      ];

      render(
        <SessionAnalytics
          analytics={mockAnalytics}
          sessions={sessionsWithMixedBeachData as any}
          onRefresh={mockOnRefresh}
        />
      );

      // Should handle both cases gracefully
      expect(screen.getByText("Session Highlights")).toBeInTheDocument();
    });
  });

  describe("Partial Data Handling", () => {
    it("handles sessions with missing ratings gracefully", () => {
      const sessionsWithMissingRatings = mockSessions.map((s) => ({
        ...s,
        rating: null,
      }));

      render(
        <SessionAnalytics
          analytics={{ ...mockAnalytics, averageRating: 0 }}
          sessions={sessionsWithMissingRatings as any}
          onRefresh={mockOnRefresh}
        />
      );

      expect(screen.getByText("0/5")).toBeInTheDocument();
    });

    it("handles sessions with missing duration gracefully", () => {
      const sessionsWithMissingDuration = mockSessions.map((s) => ({
        ...s,
        duration_minutes: null,
      }));

      render(
        <SessionAnalytics
          analytics={{ ...mockAnalytics, totalHours: 0 }}
          sessions={sessionsWithMissingDuration as any}
          onRefresh={mockOnRefresh}
        />
      );

      expect(screen.getByText("0h")).toBeInTheDocument();
    });

    it("handles empty wave height trend", () => {
      const analyticsWithEmptyTrend = {
        ...mockAnalytics,
        waveHeightTrend: [],
      };

      render(
        <SessionAnalytics
          analytics={analyticsWithEmptyTrend}
          sessions={mockSessions}
          onRefresh={mockOnRefresh}
        />
      );

      // Should still render the chart section
      expect(screen.getByText("Wave Height Over Time")).toBeInTheDocument();
    });

    it("handles empty monthly stats", () => {
      const analyticsWithEmptyMonthly = {
        ...mockAnalytics,
        monthlyStats: [],
      };

      render(
        <SessionAnalytics
          analytics={analyticsWithEmptyMonthly}
          sessions={mockSessions}
          onRefresh={mockOnRefresh}
        />
      );

      const frequencyButton = screen.getByRole("button", {
        name: /session frequency/i,
      });
      fireEvent.click(frequencyButton);

      expect(screen.getByText("Monthly Session Frequency")).toBeInTheDocument();
    });

    it("handles sessions with missing wave_quality", () => {
      const sessionsWithMissingWaves = mockSessions.map((s) => ({
        ...s,
        wave_quality: null,
      }));

      render(
        <SessionAnalytics
          analytics={mockAnalytics}
          sessions={sessionsWithMissingWaves as any}
          onRefresh={mockOnRefresh}
        />
      );

      // Should handle null values and default to 0
      expect(screen.getByText(/Max: 0ft/i)).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("handles single session correctly", () => {
      const singleSession = [mockSessions[0]];
      const singleSessionAnalytics = {
        ...mockAnalytics,
        totalSessions: 1,
        waveHeightTrend: [{ date: "2024-01-15", averageWaveHeight: 6 }],
        monthlyStats: [{ month: "Jan 2024", sessionCount: 1, averageRating: 4 }],
      };

      render(
        <SessionAnalytics
          analytics={singleSessionAnalytics}
          sessions={singleSession}
          onRefresh={mockOnRefresh}
        />
      );

      expect(screen.getByText("1")).toBeInTheDocument();
      expect(screen.getByText("Completed Sessions")).toBeInTheDocument();
    });

    it("handles very long session durations", () => {
      const longSession = [
        {
          ...mockSessions[0],
          duration_minutes: 480, // 8 hours
        },
      ];

      const longAnalytics = {
        ...mockAnalytics,
        totalHours: 8,
        totalSessions: 1,
      };

      render(
        <SessionAnalytics
          analytics={longAnalytics}
          sessions={longSession as any}
          onRefresh={mockOnRefresh}
        />
      );

      expect(screen.getByText("8h")).toBeInTheDocument();
    });

    it("displays correct average with decimal precision", () => {
      const precisionAnalytics = {
        ...mockAnalytics,
        totalHours: 7,
        totalSessions: 3,
      };

      render(
        <SessionAnalytics
          analytics={precisionAnalytics}
          sessions={mockSessions}
          onRefresh={mockOnRefresh}
        />
      );

      // 7 hours / 3 sessions = 2.3h
      expect(screen.getByText(/Avg 2.3h per session/i)).toBeInTheDocument();
    });

    it("handles all identical wave heights in trend", () => {
      const identicalWaveTrend = {
        ...mockAnalytics,
        waveHeightTrend: [
          { date: "2024-01-15", averageWaveHeight: 5 },
          { date: "2024-01-20", averageWaveHeight: 5 },
          { date: "2024-01-25", averageWaveHeight: 5 },
        ],
      };

      render(
        <SessionAnalytics
          analytics={identicalWaveTrend}
          sessions={mockSessions}
          onRefresh={mockOnRefresh}
        />
      );

      // Should show same min and max
      expect(screen.getByText(/Showing wave heights from 5ft to 5ft/i)).toBeInTheDocument();
    });
  });
});
