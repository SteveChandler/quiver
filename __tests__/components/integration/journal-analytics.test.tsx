import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { JournalView } from "@/components/journal/journal-view";
import { SessionAnalytics } from "@/components/journal/session-analytics";
import { CalendarHeatmap } from "@/components/journal/calendar-heatmap";
import {
  renderWithProviders,
  mockSession,
  mockBeach,
  createMockSupabaseClient,
} from "@/__tests__/setup/test-utils";

// Mock the required modules
jest.mock("@/lib/supabase/client");

jest.mock("@/actions/session-actions", () => ({
  getUserSessions: jest.fn(),
  deleteSession: jest.fn(),
}));

jest.mock("@/actions/analytics-actions", () => ({
  getSessionAnalytics: jest.fn(),
}));

jest.mock("@/hooks/use-data-fetcher", () => ({
  useDataFetcher: jest.fn(),
}));

// Remove non-existent hook mock

jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
  },
}));

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    pathname: "/profile",
  }),
  usePathname: () => "/profile",
  useSearchParams: () => ({
    get: jest.fn(),
    getAll: jest.fn(),
    has: jest.fn(),
    toString: jest.fn(),
  }),
}));

describe("Journal Analytics Integration Tests", () => {
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

  const mockBeachWithDetails = {
    ...mockBeach,
    reviews: [],
  };

  const mockSessionsData = [
    {
      ...mockSession,
      id: "session-1",
      beach: mockBeachWithDetails,
      arrival_time: "2024-01-15T10:00:00Z",
      rating: 4,
      wave_quality: 4,
      water_temp: "65",
      crowd_level: 3,
      parking_ease: 4,
      wind_conditions: 3,
      duration_minutes: 120,
      notes: "Great morning session!",
      board: {
        id: "board-1",
        name: "Longboard",
        user_id: mockUser.id,
        length: "9'0\"",
        width: '22.5"',
        thickness: '2.75"',
        volume: "55L",
        type: "longboard",
      },
    },
    {
      ...mockSession,
      id: "session-2",
      beach: mockBeachWithDetails,
      arrival_time: "2024-01-20T14:00:00Z",
      rating: 5,
      wave_quality: 5,
      water_temp: "68",
      crowd_level: 2,
      parking_ease: 3,
      wind_conditions: 4,
      duration_minutes: 90,
      notes: "Perfect afternoon waves!",
      board: {
        id: "board-2",
        name: "Shortboard",
        user_id: mockUser.id,
        length: "6'2\"",
        width: '19"',
        thickness: '2.25"',
        volume: "28L",
        type: "shortboard",
      },
    },
    {
      ...mockSession,
      id: "session-3",
      beach: mockBeachWithDetails,
      arrival_time: "2024-01-25T08:00:00Z",
      rating: 3,
      wave_quality: 3,
      water_temp: "62",
      crowd_level: 4,
      parking_ease: 2,
      wind_conditions: 2,
      duration_minutes: 150,
      notes: "Challenging conditions but fun!",
      board: {
        id: "board-1",
        name: "Longboard",
        user_id: mockUser.id,
        length: "9'0\"",
        width: '22.5"',
        thickness: '2.75"',
        volume: "55L",
        type: "longboard",
      },
    },
  ];

  const mockAnalytics = {
    totalSessions: 3,
    totalHours: 6.0,
    averageRating: 4.0,
    averageWaveHeight: 4.0,
    favoriteBeach: "Test Beach",
    frequentBoards: [
      { boardId: "board-1", boardName: "Longboard", usageCount: 2 },
      { boardId: "board-2", boardName: "Shortboard", usageCount: 1 },
    ],
    waveHeightTrend: [
      { date: "Jan 15", averageWaveHeight: 4.0 },
      { date: "Jan 20", averageWaveHeight: 5.0 },
      { date: "Jan 25", averageWaveHeight: 3.0 },
    ],
    conditionRatings: {
      waveQuality: 4.0,
      waterTemp: 65.0,
      crowdLevel: 3.0,
      windConditions: 3.0,
      parkingEase: 3.0,
    },
    monthlyStats: [
      {
        month: "January 2024",
        sessionCount: 3,
        averageRating: 4.0,
        totalHours: 6.0,
      },
      {
        month: "December 2023",
        sessionCount: 2,
        averageRating: 3.5,
        totalHours: 4.0,
      },
      {
        month: "November 2023",
        sessionCount: 0,
        averageRating: 0,
        totalHours: 0,
      },
    ],
  };

  const mockHeatmapData = [
    { date: "2024-01-15", count: 1 },
    { date: "2024-01-20", count: 1 },
    { date: "2024-01-25", count: 1 },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock session actions
    const {
      getUserSessions,
      deleteSession,
    } = require("@/actions/session-actions");
    getUserSessions.mockResolvedValue({
      success: true,
      data: mockSessionsData,
    });
    deleteSession.mockResolvedValue({ success: true });

    // Mock analytics actions
    const { getSessionAnalytics } = require("@/actions/analytics-actions");
    getSessionAnalytics.mockResolvedValue({
      success: true,
      data: mockAnalytics,
    });

    // Mock data fetcher
    const { useDataFetcher } = require("@/hooks/use-data-fetcher");
    useDataFetcher.mockReturnValue({
      data: mockSessionsData,
      loading: false,
      error: null,
      refetch: jest.fn(),
    });

    // Mock session analytics hook would go here if it existed
    // For now, we'll test the SessionAnalytics component directly
  });

  describe("Journal View Integration", () => {
    it("should display sessions with analytics overview", async () => {
      renderWithProviders(<JournalView />, { user: mockUser });

      // Should display session count
      await waitFor(() => {
        expect(screen.getByText(/3.*sessions/i)).toBeInTheDocument();
      });

      // Should display total hours
      expect(screen.getByText(/6.*hours/i)).toBeInTheDocument();

      // Should display average rating
      expect(screen.getByText(/4\.0/)).toBeInTheDocument();

      // Should display individual sessions
      expect(screen.getByText(/great morning session/i)).toBeInTheDocument();
      expect(screen.getByText(/perfect afternoon waves/i)).toBeInTheDocument();
      expect(screen.getByText(/challenging conditions/i)).toBeInTheDocument();
    });

    it("should switch between different view modes", async () => {
      const user = userEvent.setup();

      renderWithProviders(<JournalView />, { user: mockUser });

      // Should start in list view
      await waitFor(() => {
        expect(screen.getByText(/list view/i)).toBeInTheDocument();
      });

      // Switch to calendar view
      const calendarViewButton = screen.getByRole("button", {
        name: /calendar view/i,
      });
      await user.click(calendarViewButton);

      // Should show calendar heatmap
      await waitFor(() => {
        expect(screen.getByTestId("calendar-heatmap")).toBeInTheDocument();
      });

      // Switch to analytics view
      const analyticsViewButton = screen.getByRole("button", {
        name: /analytics view/i,
      });
      await user.click(analyticsViewButton);

      // Should show detailed analytics
      await waitFor(() => {
        expect(screen.getByText(/session insights/i)).toBeInTheDocument();
        expect(screen.getByText(/wave height trend/i)).toBeInTheDocument();
      });
    });

    it("should filter sessions by date range", async () => {
      const user = userEvent.setup();

      renderWithProviders(<JournalView />, { user: mockUser });

      // Open date filter
      const filterButton = screen.getByRole("button", { name: /filter/i });
      await user.click(filterButton);

      // Set date range
      const startDateInput = screen.getByLabelText(/start date/i);
      await user.clear(startDateInput);
      await user.type(startDateInput, "2024-01-18");

      const endDateInput = screen.getByLabelText(/end date/i);
      await user.clear(endDateInput);
      await user.type(endDateInput, "2024-01-22");

      // Apply filter
      const applyFilterButton = screen.getByRole("button", {
        name: /apply filter/i,
      });
      await user.click(applyFilterButton);

      // Should show filtered results
      await waitFor(() => {
        expect(
          screen.getByText(/perfect afternoon waves/i)
        ).toBeInTheDocument();
        expect(
          screen.queryByText(/great morning session/i)
        ).not.toBeInTheDocument();
        expect(
          screen.queryByText(/challenging conditions/i)
        ).not.toBeInTheDocument();
      });

      // Should update analytics for filtered data
      expect(screen.getByText(/1.*session/i)).toBeInTheDocument();
    });

    it("should handle session deletion with analytics update", async () => {
      const user = userEvent.setup();

      renderWithProviders(<JournalView />, { user: mockUser });

      // Find a session to delete
      const deleteButton = screen.getAllByRole("button", {
        name: /delete/i,
      })[0];
      await user.click(deleteButton);

      // Confirm deletion
      const confirmButton = screen.getByRole("button", { name: /confirm/i });
      await user.click(confirmButton);

      await waitFor(() => {
        const { deleteSession } = require("@/actions/session-actions");
        expect(deleteSession).toHaveBeenCalledWith("session-1", mockUser.id);
      });

      // Should show success message
      const { toast } = require("sonner");
      expect(toast.success).toHaveBeenCalledWith(
        expect.stringContaining("Session deleted")
      );

      // Should refresh data
      const { getUserSessions } = require("@/actions/session-actions");
      expect(getUserSessions).toHaveBeenCalled();
    });
  });

  describe("Session Analytics Component Integration", () => {
    it("should display comprehensive analytics with interactive charts", async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <SessionAnalytics
          analytics={mockAnalytics}
          sessions={mockSessionsData}
          onRefresh={jest.fn()}
        />,
        { user: mockUser }
      );

      // Should display key metrics
      expect(screen.getByText(/3.*completed sessions/i)).toBeInTheDocument();
      expect(screen.getByText(/6h.*time surfed/i)).toBeInTheDocument();
      expect(screen.getByText(/4\.0.*avg rating/i)).toBeInTheDocument();
      expect(screen.getByText(/4ft.*avg waves/i)).toBeInTheDocument();

      // Should display favorite beach
      expect(screen.getByText(/test beach/i)).toBeInTheDocument();

      // Should display frequent boards
      expect(screen.getByText(/longboard.*2 sessions/i)).toBeInTheDocument();
      expect(screen.getByText(/shortboard.*1 session/i)).toBeInTheDocument();

      // Test chart switching
      const conditionsRadarButton = screen.getByRole("button", {
        name: /conditions radar/i,
      });
      await user.click(conditionsRadarButton);

      // Should show conditions chart
      await waitFor(() => {
        expect(screen.getByText(/wave quality.*4\.0/i)).toBeInTheDocument();
        expect(screen.getByText(/water temp.*65/i)).toBeInTheDocument();
        expect(screen.getByText(/crowd level.*3\.0/i)).toBeInTheDocument();
      });

      // Test frequency chart
      const frequencyButton = screen.getByRole("button", {
        name: /session frequency/i,
      });
      await user.click(frequencyButton);

      // Should show monthly frequency chart
      await waitFor(() => {
        expect(screen.getByText(/january.*3 sessions/i)).toBeInTheDocument();
        expect(screen.getByText(/december.*2 sessions/i)).toBeInTheDocument();
      });
    });

    it("should handle analytics refresh", async () => {
      const user = userEvent.setup();
      const mockRefresh = jest.fn();

      renderWithProviders(
        <SessionAnalytics
          analytics={mockAnalytics}
          sessions={mockSessionsData}
          onRefresh={mockRefresh}
        />,
        { user: mockUser }
      );

      // Click refresh button
      const refreshButton = screen.getByRole("button", { name: /refresh/i });
      await user.click(refreshButton);

      expect(mockRefresh).toHaveBeenCalled();
    });

    it("should display session highlights", async () => {
      renderWithProviders(
        <SessionAnalytics
          analytics={mockAnalytics}
          sessions={mockSessionsData}
          onRefresh={jest.fn()}
        />,
        { user: mockUser }
      );

      // Should show best rated session
      await waitFor(() => {
        expect(screen.getByText(/best rated session/i)).toBeInTheDocument();
        expect(screen.getByText(/5 stars/i)).toBeInTheDocument();
      });

      // Should show longest session
      expect(screen.getByText(/longest session/i)).toBeInTheDocument();
      expect(screen.getByText(/2\.5h/i)).toBeInTheDocument();
    });
  });

  describe("Calendar Heatmap Integration", () => {
    it("should display activity heatmap with session data", async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <CalendarHeatmap data={mockHeatmapData} onDateClick={jest.fn()} />,
        { user: mockUser }
      );

      // Should display calendar grid
      await waitFor(() => {
        expect(screen.getByTestId("calendar-heatmap")).toBeInTheDocument();
      });

      // Should show activity for session dates
      const sessionDates = screen.getAllByTestId(/calendar-day/);
      expect(sessionDates.length).toBeGreaterThan(0);

      // Click on a session date
      const sessionDay = screen.getByTestId("calendar-day-2024-01-15");
      await user.click(sessionDay);

      // Should show session details
      await waitFor(() => {
        expect(screen.getByText(/1 session/i)).toBeInTheDocument();
        expect(screen.getByText(/jan 15/i)).toBeInTheDocument();
      });
    });

    it("should handle different activity levels with color coding", async () => {
      const intensiveHeatmapData = [
        { date: "2024-01-15", count: 1 }, // light activity
        { date: "2024-01-16", count: 2 }, // moderate activity
        { date: "2024-01-17", count: 3 }, // high activity
        { date: "2024-01-18", count: 0 }, // no activity
      ];

      renderWithProviders(
        <CalendarHeatmap data={intensiveHeatmapData} onDateClick={jest.fn()} />,
        { user: mockUser }
      );

      // Should display different intensity levels
      const lightActivity = screen.getByTestId("calendar-day-2024-01-15");
      const moderateActivity = screen.getByTestId("calendar-day-2024-01-16");
      const highActivity = screen.getByTestId("calendar-day-2024-01-17");
      const noActivity = screen.getByTestId("calendar-day-2024-01-18");

      expect(lightActivity).toHaveClass("activity-light");
      expect(moderateActivity).toHaveClass("activity-moderate");
      expect(highActivity).toHaveClass("activity-high");
      expect(noActivity).toHaveClass("activity-none");
    });

    it("should show activity tooltips on hover", async () => {
      const user = userEvent.setup();

      renderWithProviders(
        <CalendarHeatmap data={mockHeatmapData} onDateClick={jest.fn()} />,
        { user: mockUser }
      );

      // Hover over a session date
      const sessionDay = screen.getByTestId("calendar-day-2024-01-15");
      await user.hover(sessionDay);

      // Should show tooltip with session details
      await waitFor(() => {
        expect(screen.getByRole("tooltip")).toBeInTheDocument();
        expect(screen.getByText(/jan 15, 2024/i)).toBeInTheDocument();
        expect(screen.getByText(/1 session/i)).toBeInTheDocument();
      });
    });
  });

  describe("Export and Data Management", () => {
    it("should handle journal export", async () => {
      const user = userEvent.setup();

      // Mock successful export
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        blob: () =>
          Promise.resolve(new Blob(["mock csv data"], { type: "text/csv" })),
      });

      renderWithProviders(<JournalView />, { user: mockUser });

      // Open export modal
      const exportButton = screen.getByRole("button", { name: /export/i });
      await user.click(exportButton);

      // Select export format
      const csvOption = screen.getByRole("radio", { name: /csv/i });
      await user.click(csvOption);

      // Select date range
      const allTimeOption = screen.getByRole("radio", { name: /all time/i });
      await user.click(allTimeOption);

      // Export data
      const downloadButton = screen.getByRole("button", { name: /download/i });
      await user.click(downloadButton);

      // Should call export API
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining("/api/journal/export"),
          expect.objectContaining({
            method: "POST",
          })
        );
      });

      // Should show success message
      const { toast } = require("sonner");
      expect(toast.success).toHaveBeenCalledWith(
        expect.stringContaining("Export completed")
      );
    });

    it("should handle empty state when no sessions exist", async () => {
      // Mock empty sessions
      const { useDataFetcher } = require("@/hooks/use-data-fetcher");
      useDataFetcher.mockReturnValue({
        data: [],
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      const { useSessionAnalytics } = require("@/hooks/use-session-analytics");
      useSessionAnalytics.mockReturnValue({
        analytics: null,
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      renderWithProviders(<JournalView />, { user: mockUser });

      // Should show empty state
      await waitFor(() => {
        expect(screen.getByText(/no sessions logged yet/i)).toBeInTheDocument();
        expect(screen.getByText(/start logging sessions/i)).toBeInTheDocument();
      });

      // Should provide action to log first session
      expect(
        screen.getByRole("button", { name: /log your first session/i })
      ).toBeInTheDocument();
    });

    it("should handle analytics calculation for large datasets", async () => {
      // Mock large dataset
      const largeSessionsData = Array.from({ length: 100 }, (_, index) => ({
        ...mockSession,
        id: `session-${index}`,
        arrival_time: new Date(2024, 0, 1 + (index % 30)).toISOString(),
        rating: Math.floor(Math.random() * 5) + 1,
        wave_quality: Math.floor(Math.random() * 5) + 1,
        duration_minutes: 60 + Math.floor(Math.random() * 120),
      }));

      const { useDataFetcher } = require("@/hooks/use-data-fetcher");
      useDataFetcher.mockReturnValue({
        data: largeSessionsData,
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      renderWithProviders(<JournalView />, { user: mockUser });

      // Should handle large dataset without performance issues
      await waitFor(() => {
        expect(screen.getByText(/100.*sessions/i)).toBeInTheDocument();
      });

      // Should calculate analytics correctly
      expect(screen.getByText(/total hours/i)).toBeInTheDocument();
      expect(screen.getByText(/avg rating/i)).toBeInTheDocument();
    });
  });

  describe("Error Handling and Edge Cases", () => {
    it("should handle analytics loading errors", async () => {
      // Mock analytics error
      const { useSessionAnalytics } = require("@/hooks/use-session-analytics");
      useSessionAnalytics.mockReturnValue({
        analytics: null,
        loading: false,
        error: "Failed to load analytics",
        refetch: jest.fn(),
      });

      renderWithProviders(<JournalView />, { user: mockUser });

      // Should show error message
      await waitFor(() => {
        expect(
          screen.getByText(/failed to load analytics/i)
        ).toBeInTheDocument();
      });

      // Should provide retry option
      expect(
        screen.getByRole("button", { name: /try again/i })
      ).toBeInTheDocument();
    });

    it("should handle partial data gracefully", async () => {
      // Mock sessions with missing data
      const incompleteSessionsData = [
        {
          ...mockSession,
          rating: null,
          wave_quality: null,
          water_temp: null,
          notes: null,
        },
      ];

      const { useDataFetcher } = require("@/hooks/use-data-fetcher");
      useDataFetcher.mockReturnValue({
        data: incompleteSessionsData,
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      renderWithProviders(<JournalView />, { user: mockUser });

      // Should display session even with missing data
      await waitFor(() => {
        expect(screen.getByText(/1.*session/i)).toBeInTheDocument();
      });

      // Should handle missing analytics gracefully
      expect(screen.getByText(/no rating/i)).toBeInTheDocument();
      expect(screen.getByText(/no notes/i)).toBeInTheDocument();
    });
  });
});
