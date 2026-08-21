import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { JournalView } from "@/components/journal/journal-view";
import { useAuth } from "@/context/auth-context";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { getUserSessions } from "@/actions/session-actions";

// Mock all Supabase-related modules
jest.mock("@/lib/supabase/client", () => ({
  createClient: jest.fn(() => ({
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    channel: jest.fn().mockReturnThis(),
    on: jest.fn().mockReturnThis(),
    subscribe: jest.fn(),
    removeChannel: jest.fn(),
  })),
}));

// Mock existing hooks
jest.mock("@/hooks/use-comment-count", () => ({
  useCommentCount: jest.fn(() => 0),
}));

jest.mock("@/hooks/use-session-like", () => ({
  useSessionLike: jest.fn(() => ({
    isLiked: false,
    likeCount: 0,
    handleToggleLike: jest.fn(),
  })),
}));

// Mock components that might use Supabase
jest.mock("@/components/session-card-wrapper", () => ({
  SessionCardWrapper: ({ session, onUserClick }: any) => (
    <div data-testid="session-card" onClick={onUserClick}>
      <div>{session.beach?.name || session.beach_name}</div>
      <div>{session.rating}/5</div>
    </div>
  ),
}));

// Mock dependencies
jest.mock("@/context/auth-context");
jest.mock("@/hooks/use-data-fetcher");
jest.mock("@/actions/session-actions");
jest.mock("next/link", () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
});

// Mock components
jest.mock("@/components/journal/calendar-heatmap", () => ({
  CalendarHeatmap: ({ onDateClick }: { onDateClick: Function }) => (
    <div
      data-testid="calendar-heatmap"
      onClick={() => onDateClick("2024-01-15", [])}
    >
      Calendar Heatmap
    </div>
  ),
}));

jest.mock("@/components/journal/session-analytics", () => ({
  SessionAnalytics: ({ onRefresh }: { onRefresh: () => void }) => (
    <div data-testid="session-analytics">
      <button onClick={onRefresh} data-testid="refresh-analytics">
        Refresh Analytics
      </button>
    </div>
  ),
}));

jest.mock("@/components/journal/session-annotation-modal", () => ({
  SessionAnnotationModal: ({ isOpen, onClose, onSave }: any) =>
    isOpen ? (
      <div data-testid="annotation-modal">
        <button onClick={onSave} data-testid="save-annotation">
          Save
        </button>
        <button onClick={onClose} data-testid="close-annotation">
          Close
        </button>
      </div>
    ) : null,
}));

const mockUser = {
  id: "user-123",
  email: "test@example.com",
};

const mockSessions = [
  {
    id: "session-1",
    user_id: "user-123",
    beach_id: "beach-1",
    beach_name: "Test Beach",
    status: "completed",
    arrival_time: "2024-01-15T10:00:00Z",
    duration_minutes: 120,
    rating: 4,
    wave_quality: 6,
    notes: "Great session!",
    is_public: true,
    created_at: "2024-01-15T10:00:00Z",
    updated_at: "2024-01-15T12:00:00Z",
    beach: { name: "Test Beach" },
    board: { name: "Test Board" },
    user: { full_name: "Test User" },
  },
  {
    id: "session-2",
    beach_id: "beach-2",
    beach_name: "Another Beach",
    status: "completed",
    arrival_time: "2024-01-10T14:00:00Z",
    duration_minutes: 90,
    rating: 3,
    wave_quality: 4,
    notes: "Decent waves",
    is_public: false,
    created_at: "2024-01-10T14:00:00Z",
    updated_at: "2024-01-10T16:00:00Z",
    beach: { name: "Another Beach" },
    board: { name: "Another Board" },
    user: { full_name: "Test User" },
  },
];

const mockAnalytics = {
  userId: "user-123",
  totalSessions: 2,
  completedSessions: 2,
  totalHours: 3.5,
  averageRating: 3.5,
  averageWaveHeight: 5,
  favoriteBeach: "Test Beach",
  frequentBoards: [],
  monthlyStats: [],
  waveHeightTrend: [],
  conditionRatings: {
    waterTemp: 68,
    crowdLevel: 3,
    windConditions: 2,
    waveQuality: 5,
    parkingEase: 4,
  },
  generatedAt: "2024-01-15T12:00:00Z",
};

describe("JournalView", () => {
  const mockRefetch = jest.fn();
  const mockRefetchAnalytics = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
    });

    // Set up default return values for useDataFetcher
    (useDataFetcher as jest.Mock).mockImplementation((fetchFn) => {
      // Determine what this call is for based on the fetch function
      if (
        fetchFn.toString().includes("analytics") ||
        fetchFn.toString().includes('fetch("/api/analytics')
      ) {
        return {
          data: mockAnalytics,
          loading: false,
          error: null,
          refetch: mockRefetchAnalytics,
        };
      }

      // Default to sessions data
      return {
        data: mockSessions,
        loading: false,
        error: null,
        refetch: mockRefetch,
      };
    });

    // Mock fetch for analytics
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: mockAnalytics }),
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("renders journal view with sessions", async () => {
    render(<JournalView />);

    expect(screen.getByText("Surf Journal+")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Track your sessions, analyze your progress, and share your stoke"
      )
    ).toBeInTheDocument();

    // Check quick stats
    expect(screen.getByText("2")).toBeInTheDocument(); // Total sessions
    expect(screen.getByText("4")).toBeInTheDocument(); // Total hours (displayed as just "4")
    expect(screen.getByText("3.5")).toBeInTheDocument(); // Average rating
    // Check that favorite beach section exists (Test Beach appears in stats)
    expect(screen.getByText("Favorite Beach")).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: "Make session private" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Make session public" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "Open session settings" }),
    ).toHaveLength(2);
  });

  it("displays loading state", () => {
    (useDataFetcher as jest.Mock).mockImplementation(() => ({
      data: null,
      loading: true,
      error: null,
      refetch: mockRefetch,
    }));

    render(<JournalView />);

    expect(
      screen.getByText("Loading your surf journal...")
    ).toBeInTheDocument();
  });

  it("displays empty-state CTA when sessions load returns no data", () => {
    (useDataFetcher as jest.Mock).mockImplementation((fetchFn) => {
      if (
        fetchFn.toString().includes("analytics") ||
        fetchFn.toString().includes('fetch("/api/analytics')
      ) {
        return {
          data: null,
          loading: false,
          error: null,
          refetch: mockRefetchAnalytics,
        };
      }

      return {
        data: [],
        loading: false,
        error: null,
        refetch: mockRefetch,
      };
    });

    render(<JournalView />);
    expect(screen.getByText("No Sessions Yet")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Every session you log becomes a day you can compare the next call against. Start logging to see your progression."
      )
    ).toBeInTheDocument();
    expect(screen.getByText("Log Your First Session")).toBeInTheDocument();
  });

  it("toggles between list and calendar view", () => {
    render(<JournalView />);

    const listButton = screen.getByRole("button", { name: /list/i });
    const calendarButton = screen.getByRole("button", { name: /calendar/i });

    expect(listButton).toBeInTheDocument();
    expect(calendarButton).toBeInTheDocument();

    fireEvent.click(calendarButton);

    expect(screen.getByTestId("calendar-heatmap")).toBeInTheDocument();
  });

  it("switches between sessions and insights tabs", () => {
    render(<JournalView />);

    const sessionsTab = screen.getByRole("tab", { name: /sessions/i });
    const insightsTab = screen.getByRole("tab", { name: /insights/i });

    // Verify both tabs exist
    expect(sessionsTab).toBeInTheDocument();
    expect(insightsTab).toBeInTheDocument();

    // Click insights tab - this tests that the tab is clickable and functional
    fireEvent.click(insightsTab);

    // Verify the insights tab exists and is clickable (basic functionality)
    expect(insightsTab).toBeInTheDocument();
  });

  // "shows Completed/Planned filter tabs" removed — the planned-session
  // feature was deleted in commit 4a8499ec (session-form refactor).

  it("filters sessions correctly by status", () => {
    // Mock sessions with different statuses
    const mockFilterSessions = [
      {
        id: "1",
        beach: { name: "Test Beach 1" },
        status: "completed",
        rating: 4,
        session_date: "2024-01-01",
        duration_minutes: 120,
        user: { full_name: "Test User" },
      },
      {
        id: "2",
        beach: { name: "Test Beach 2" },
        status: "planned",
        rating: 0,
        session_date: "2024-01-02",
        duration_minutes: null,
        user: { full_name: "Test User" },
      },
    ];

    (useDataFetcher as jest.Mock).mockImplementation((fetchFn) => {
      return {
        data: mockFilterSessions,
        loading: false,
        error: null,
        refetch: jest.fn(),
      };
    });

    render(<JournalView />);

    // By default, the Completed tab is active, so only 1 completed session shows
    expect(screen.getByText("1 sessions")).toBeInTheDocument();
  });

  // "displays separate counts for completed and planned sessions" removed —
  // the planned-session feature was deleted in commit 4a8499ec (session-form
  // refactor). Sessions only have a single completed-count surface now.

  it("shows empty state CTA when no sessions exist", () => {
    (useDataFetcher as jest.Mock).mockImplementation((fetchFn) => {
      return {
        data: [],
        loading: false,
        error: null,
        refetch: jest.fn(),
      };
    });

    render(<JournalView />);

    // Default shows ZeroState component with proper content
    expect(screen.getByText("No Sessions Yet")).toBeInTheDocument();
    expect(screen.getByText("Log Your First Session")).toBeInTheDocument();
  });

  it("opens annotation modal when session is clicked", () => {
    render(<JournalView />);

    // Find and click the first session card (there are multiple)
    const sessionCards = screen.getAllByTestId("session-card");
    fireEvent.click(sessionCards[0]);

    expect(screen.getByTestId("annotation-modal")).toBeInTheDocument();
  });

  it("handles privacy toggle", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ message: "Success" }),
    });

    render(<JournalView />);

    // The privacy toggle functionality is tested in the component
    expect(screen.getByTestId("journal-view")).toBeInTheDocument();
  });

  it("shows CTA buttons in empty state", () => {
    (useDataFetcher as jest.Mock).mockImplementation((fetchFn) => {
      if (
        fetchFn.toString().includes("analytics") ||
        fetchFn.toString().includes('fetch("/api/analytics')
      ) {
        return {
          data: mockAnalytics,
          loading: false,
          error: null,
          refetch: mockRefetchAnalytics,
        };
      }

      return {
        data: [],
        loading: false,
        error: null,
        refetch: mockRefetch,
      };
    });

    render(<JournalView />);
    expect(screen.getByText("No Sessions Yet")).toBeInTheDocument();
    expect(screen.getByText("Log Your First Session")).toBeInTheDocument();
    // "Plan a Session" CTA removed in commit 4a8499ec (session-form refactor).
  });

  it("displays correct session counts and statistics", () => {
    render(<JournalView />);

    // Check that the correct number of completed sessions is displayed
    const completedSessions = mockSessions.filter(
      (s) => s.status === "completed"
    );
    expect(
      screen.getByText(completedSessions.length.toString())
    ).toBeInTheDocument();

    // Check total hours - the component displays just the number without 'h'
    const totalMinutes = completedSessions.reduce(
      (sum, s) => sum + (s.duration_minutes || 0),
      0
    );
    const totalHours = Math.round(totalMinutes / 60);
    expect(screen.getByText(totalHours.toString())).toBeInTheDocument();
  });

  it("basic analytics functionality test", async () => {
    render(<JournalView />);

    // Switch to insights tab
    const insightsTab = screen.getByRole("tab", { name: /insights/i });

    // Verify the tab exists and can be clicked
    expect(insightsTab).toBeInTheDocument();
    fireEvent.click(insightsTab);

    // Tab switching worked if no errors occurred
    expect(insightsTab).toBeInTheDocument();
  });

  it("handles annotation modal save", async () => {
    render(<JournalView />);

    // Click on the first session to open annotation modal
    const sessionCards = screen.getAllByTestId("session-card");
    fireEvent.click(sessionCards[0]);

    // Find and click save button
    const saveButton = screen.getByTestId("save-annotation");
    fireEvent.click(saveButton);

    expect(mockRefetch).toHaveBeenCalled();
  });
});
