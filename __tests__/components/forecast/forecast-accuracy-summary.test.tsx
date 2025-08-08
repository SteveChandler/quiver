import { render, screen, fireEvent } from "@testing-library/react";
import { ForecastAccuracySummary } from "@/components/forecast/forecast-accuracy-summary";

// Mock UI components
jest.mock("@/components/ui/card", () => ({
  Card: ({ children, className }: any) => (
    <div data-testid="card" className={className}>
      {children}
    </div>
  ),
  CardHeader: ({ children }: any) => (
    <div data-testid="card-header">{children}</div>
  ),
  CardTitle: ({ children }: any) => (
    <div data-testid="card-title">{children}</div>
  ),
  CardContent: ({ children }: any) => (
    <div data-testid="card-content">{children}</div>
  ),
}));

jest.mock("@/components/ui/badge", () => ({
  Badge: ({ children, variant }: any) => (
    <span data-testid="badge" data-variant={variant}>
      {children}
    </span>
  ),
}));

jest.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, variant, size }: any) => (
    <button
      data-testid="button"
      onClick={onClick}
      data-variant={variant}
      data-size={size}
    >
      {children}
    </button>
  ),
}));

jest.mock("@/components/ui/progress", () => ({
  Progress: ({ value }: any) => (
    <div data-testid="progress" data-value={value} />
  ),
}));

// Mock lucide-react icons
jest.mock("lucide-react", () => ({
  BarChart3: () => <div data-testid="bar-chart-icon" />,
  Target: () => <div data-testid="target-icon" />,
  Calendar: () => <div data-testid="calendar-icon" />,
  RefreshCw: () => <div data-testid="refresh-icon" />,
  TrendingUp: () => <div data-testid="trending-up-icon" />,
}));

// Mock utils
jest.mock("@/lib/utils", () => ({
  cn: (...classes: any[]) => classes.filter(Boolean).join(" "),
}));

describe("ForecastAccuracySummary", () => {
  const mockSummaryData = {
    totalSessions: 25,
    avgAccuracy: 85,
    topBeaches: [
      { beachName: "Sunset Cliffs", accuracy: 92, sessionCount: 8 },
      { beachName: "La Jolla Shores", accuracy: 88, sessionCount: 6 },
      { beachName: "Ocean Beach", accuracy: 75, sessionCount: 11 },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders summary card with data correctly", () => {
    render(<ForecastAccuracySummary data={mockSummaryData} />);

    expect(screen.getByTestId("card")).toBeInTheDocument();
    expect(screen.getByTestId("card-title")).toHaveTextContent(
      "Forecast Accuracy"
    );
    expect(screen.getByText("85%")).toBeInTheDocument(); // Average accuracy
    expect(screen.getByText("25")).toBeInTheDocument(); // Total sessions
  });

  it("displays loading state correctly", () => {
    render(<ForecastAccuracySummary data={mockSummaryData} isLoading={true} />);

    expect(screen.getByTestId("refresh-icon")).toBeInTheDocument();
    // Loading skeleton should be present
    const skeletonElements = screen
      .getByTestId("card-content")
      .querySelectorAll(".animate-pulse");
    expect(skeletonElements.length).toBeGreaterThan(0);
  });

  it("displays empty state when no sessions", () => {
    const emptyData = {
      totalSessions: 0,
      avgAccuracy: 0,
      topBeaches: [],
    };

    render(<ForecastAccuracySummary data={emptyData} />);

    expect(
      screen.getByText("No calibration data available")
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Complete some surf sessions to see forecast accuracy statistics"
      )
    ).toBeInTheDocument();
    expect(screen.getByTestId("bar-chart-icon")).toBeInTheDocument();
  });

  it("renders top performing beaches correctly", () => {
    render(<ForecastAccuracySummary data={mockSummaryData} />);

    expect(screen.getByText("Top Performing Spots")).toBeInTheDocument();
    expect(screen.getByText("Sunset Cliffs")).toBeInTheDocument();
    expect(screen.getByText("La Jolla Shores")).toBeInTheDocument();
    expect(screen.getByText("Ocean Beach")).toBeInTheDocument();

    // Check accuracy badges
    expect(screen.getByText("92%")).toBeInTheDocument();
    expect(screen.getByText("88%")).toBeInTheDocument();
    expect(screen.getByText("75%")).toBeInTheDocument();
  });

  it("displays session counts for beaches", () => {
    render(<ForecastAccuracySummary data={mockSummaryData} />);

    expect(screen.getByText("8 sessions")).toBeInTheDocument();
    expect(screen.getByText("6 sessions")).toBeInTheDocument();
    expect(screen.getByText("11 sessions")).toBeInTheDocument();
  });

  it("handles single session correctly", () => {
    const singleSessionData = {
      totalSessions: 1,
      avgAccuracy: 90,
      topBeaches: [{ beachName: "Test Beach", accuracy: 90, sessionCount: 1 }],
    };

    render(<ForecastAccuracySummary data={singleSessionData} />);

    expect(screen.getByText("1 session")).toBeInTheDocument(); // Singular form
  });

  it("shows correct badge variants for different accuracy levels", () => {
    render(<ForecastAccuracySummary data={mockSummaryData} />);

    const badges = screen.getAllByTestId("badge");

    // Find the badges for the top beaches
    const beachBadges = badges.filter(
      (badge) =>
        badge.textContent?.includes("%") &&
        !badge.textContent?.includes("Average Accuracy")
    );

    expect(beachBadges).toHaveLength(3);

    // Check that high accuracy (92%) uses default variant
    const highAccuracyBadge = beachBadges.find(
      (badge) => badge.textContent === "92%"
    );
    expect(highAccuracyBadge).toHaveAttribute("data-variant", "default");

    // Check that medium accuracy (75%) uses appropriate variant
    const mediumAccuracyBadge = beachBadges.find(
      (badge) => badge.textContent === "75%"
    );
    expect(mediumAccuracyBadge).toHaveAttribute("data-variant", "secondary");
  });

  it("renders accuracy guidelines section", () => {
    render(<ForecastAccuracySummary data={mockSummaryData} />);

    expect(screen.getByText("Accuracy Guidelines")).toBeInTheDocument();
    expect(screen.getByText("85%+ Excellent")).toBeInTheDocument();
    expect(screen.getByText("70-84% Good")).toBeInTheDocument();
    expect(screen.getByText("<70% Needs Improvement")).toBeInTheDocument();
    expect(screen.getByText("Highly accurate forecasts")).toBeInTheDocument();
    expect(screen.getByText("Generally reliable")).toBeInTheDocument();
    expect(screen.getByText("Use with caution")).toBeInTheDocument();
  });

  it("displays progress bars with correct values", () => {
    render(<ForecastAccuracySummary data={mockSummaryData} />);

    const progressBar = screen.getByTestId("progress");
    expect(progressBar).toHaveAttribute("data-value", "85"); // Average accuracy
  });

  it("shows ranking indicators for top beaches", () => {
    render(<ForecastAccuracySummary data={mockSummaryData} />);

    // Check for ranking numbers (1, 2, 3)
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("calls onRefresh when refresh button is clicked", () => {
    const mockRefresh = jest.fn();
    render(
      <ForecastAccuracySummary data={mockSummaryData} onRefresh={mockRefresh} />
    );

    const refreshButton = screen.getByTestId("button");
    fireEvent.click(refreshButton);

    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it("does not show refresh button when onRefresh is not provided", () => {
    render(<ForecastAccuracySummary data={mockSummaryData} />);

    expect(screen.queryByTestId("button")).not.toBeInTheDocument();
  });

  it("applies custom className when provided", () => {
    render(
      <ForecastAccuracySummary
        data={mockSummaryData}
        className="custom-class"
      />
    );

    expect(screen.getByTestId("card")).toHaveClass("custom-class");
  });

  it("handles low accuracy data with appropriate styling", () => {
    const lowAccuracyData = {
      totalSessions: 10,
      avgAccuracy: 55,
      topBeaches: [
        { beachName: "Poor Beach", accuracy: 45, sessionCount: 5 },
        { beachName: "Mediocre Beach", accuracy: 65, sessionCount: 5 },
      ],
    };

    render(<ForecastAccuracySummary data={lowAccuracyData} />);

    const badges = screen.getAllByTestId("badge");
    const lowAccuracyBadge = badges.find(
      (badge) => badge.textContent === "45%"
    );
    expect(lowAccuracyBadge).toHaveAttribute("data-variant", "destructive");
  });

  it("displays statistics section with correct icons", () => {
    render(<ForecastAccuracySummary data={mockSummaryData} />);

    expect(screen.getByTestId("trending-up-icon")).toBeInTheDocument();
    expect(screen.getByTestId("calendar-icon")).toBeInTheDocument();
    expect(screen.getByTestId("target-icon")).toBeInTheDocument();
  });

  it("handles empty top beaches array", () => {
    const noBeachesData = {
      totalSessions: 5,
      avgAccuracy: 70,
      topBeaches: [],
    };

    render(<ForecastAccuracySummary data={noBeachesData} />);

    expect(screen.queryByText("Top Performing Spots")).not.toBeInTheDocument();
    expect(screen.getByText("70%")).toBeInTheDocument(); // Still shows overall accuracy
  });

  it("truncates long beach names appropriately", () => {
    const longNameData = {
      totalSessions: 5,
      avgAccuracy: 80,
      topBeaches: [
        {
          beachName:
            "This is a very long beach name that might need truncation",
          accuracy: 85,
          sessionCount: 5,
        },
      ],
    };

    render(<ForecastAccuracySummary data={longNameData} />);

    expect(
      screen.getByText(
        "This is a very long beach name that might need truncation"
      )
    ).toBeInTheDocument();
  });
});
