import { render, screen } from "@testing-library/react";
import { ForecastAccuracyCard } from "@/components/forecast/forecast-accuracy-card";
import type { BeachForecastAccuracy } from "@/types/database";

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

jest.mock("@/components/ui/progress", () => ({
  Progress: ({ value }: any) => (
    <div data-testid="progress" data-value={value} />
  ),
}));

jest.mock("@/components/ui/tooltip", () => ({
  TooltipProvider: ({ children }: any) => <div>{children}</div>,
  Tooltip: ({ children }: any) => <div>{children}</div>,
  TooltipTrigger: ({ children }: any) => (
    <div data-testid="tooltip-trigger">{children}</div>
  ),
  TooltipContent: ({ children }: any) => (
    <div data-testid="tooltip-content">{children}</div>
  ),
}));

// Mock lucide-react icons
jest.mock("lucide-react", () => ({
  Info: () => <div data-testid="info-icon" />,
  TrendingUp: () => <div data-testid="trending-up-icon" />,
  TrendingDown: () => <div data-testid="trending-down-icon" />,
  Minus: () => <div data-testid="minus-icon" />,
}));

// Mock utils
jest.mock("@/lib/utils", () => ({
  cn: (...classes: any[]) => classes.filter(Boolean).join(" "),
}));

describe("ForecastAccuracyCard", () => {
  const mockAccuracyData: BeachForecastAccuracy = {
    id: "accuracy-1",
    beach_id: "beach-1",
    avg_wave_height_delta: 0.5,
    avg_wind_speed_delta: 2.1,
    avg_confidence_accuracy: 78.5,
    total_sessions_count: 25,
    last_30_days_count: 8,
    last_7_days_count: 3,
    overall_accuracy_score: 85.5,
    wave_height_accuracy: 88.2,
    wind_accuracy: 82.8,
    calculation_date: "2024-01-15",
    updated_at: "2024-01-15T10:30:00Z",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders accuracy card with high accuracy data", () => {
    render(
      <ForecastAccuracyCard
        accuracy={mockAccuracyData}
        beachName="Test Beach"
      />
    );

    expect(screen.getByTestId("card")).toBeInTheDocument();
    expect(screen.getByTestId("card-title")).toHaveTextContent(
      "Test Beach Accuracy"
    );
    expect(screen.getByText("Overall Accuracy")).toBeInTheDocument();
    expect(screen.getByText("86%")).toBeInTheDocument(); // Rounded overall accuracy
    expect(screen.getByText("25")).toBeInTheDocument(); // Total sessions
  });

  it("renders default title when no beach name provided", () => {
    render(<ForecastAccuracyCard accuracy={mockAccuracyData} />);

    expect(screen.getByTestId("card-title")).toHaveTextContent(
      "Forecast Accuracy"
    );
  });

  it("displays detailed metrics correctly", () => {
    render(<ForecastAccuracyCard accuracy={mockAccuracyData} />);

    expect(screen.getByText("Wave Height")).toBeInTheDocument();
    expect(screen.getByText("Wind Conditions")).toBeInTheDocument();
    expect(screen.getByText("88%")).toBeInTheDocument(); // Wave height accuracy
    expect(screen.getByText("83%")).toBeInTheDocument(); // Wind accuracy
    expect(screen.getByText("8")).toBeInTheDocument(); // Last 30 days count
  });

  it("renders progress bar with correct value", () => {
    render(<ForecastAccuracyCard accuracy={mockAccuracyData} />);

    const progressBar = screen.getByTestId("progress");
    expect(progressBar).toHaveAttribute("data-value", "85.5");
  });

  it("shows correct badge variant for high accuracy", () => {
    render(<ForecastAccuracyCard accuracy={mockAccuracyData} />);

    const badges = screen.getAllByTestId("badge");
    const accuracyBadge = badges.find((badge) =>
      badge.textContent?.includes("86%")
    );
    expect(accuracyBadge).toHaveAttribute("data-variant", "default"); // High accuracy uses default variant
  });

  it("handles medium accuracy data correctly", () => {
    const mediumAccuracyData = {
      ...mockAccuracyData,
      overall_accuracy_score: 75.0,
      wave_height_accuracy: 72.0,
      wind_accuracy: 78.0,
    };

    render(<ForecastAccuracyCard accuracy={mediumAccuracyData} />);

    expect(screen.getByText("75%")).toBeInTheDocument();
    expect(screen.getByText("72%")).toBeInTheDocument();

    const badges = screen.getAllByTestId("badge");
    const accuracyBadge = badges.find((badge) =>
      badge.textContent?.includes("75%")
    );
    expect(accuracyBadge).toHaveAttribute("data-variant", "secondary"); // Medium accuracy
  });

  it("handles low accuracy data correctly", () => {
    const lowAccuracyData = {
      ...mockAccuracyData,
      overall_accuracy_score: 55.0,
      wave_height_accuracy: 50.0,
      wind_accuracy: 60.0,
    };

    render(<ForecastAccuracyCard accuracy={lowAccuracyData} />);

    expect(screen.getByText("55%")).toBeInTheDocument();

    const badges = screen.getAllByTestId("badge");
    const accuracyBadge = badges.find((badge) =>
      badge.textContent?.includes("55%")
    );
    expect(accuracyBadge).toHaveAttribute("data-variant", "destructive"); // Low accuracy
  });

  it("handles null accuracy values gracefully", () => {
    const nullAccuracyData = {
      ...mockAccuracyData,
      overall_accuracy_score: null,
      wave_height_accuracy: null,
      wind_accuracy: null,
      avg_wave_height_delta: null,
      avg_wind_speed_delta: null,
    };

    render(<ForecastAccuracyCard accuracy={nullAccuracyData} />);

    // Should display N/A for missing values (multiple instances)
    expect(screen.getAllByText(/N\/A/).length).toBeGreaterThan(0);

    const badges = screen.getAllByTestId("badge");
    const accuracyBadge = badges.find((badge) =>
      badge.textContent?.includes("N/A")
    );
    expect(accuracyBadge).toHaveAttribute("data-variant", "secondary"); // Null values use secondary
  });

  it("displays data recency information", () => {
    render(<ForecastAccuracyCard accuracy={mockAccuracyData} />);

    expect(screen.getByText(/Updated/)).toBeInTheDocument();
    expect(
      screen.getAllByText(/\d{1,2}\/\d{1,2}\/2024/).length
    ).toBeGreaterThan(0); // At least one date
    expect(screen.getByText("3 sessions this week")).toBeInTheDocument();
  });

  it("shows tooltip triggers for additional information", () => {
    render(<ForecastAccuracyCard accuracy={mockAccuracyData} />);

    const tooltipTriggers = screen.getAllByTestId("tooltip-trigger");
    expect(tooltipTriggers.length).toBeGreaterThan(0);
  });

  it("applies custom className when provided", () => {
    render(
      <ForecastAccuracyCard
        accuracy={mockAccuracyData}
        className="custom-class"
      />
    );

    expect(screen.getByTestId("card")).toHaveClass("custom-class");
  });

  it("shows trend icon when showTrend is enabled", () => {
    render(
      <ForecastAccuracyCard accuracy={mockAccuracyData} showTrend={true} />
    );

    // Should show a trend icon (mocked, exact icon depends on comparison logic)
    expect(
      screen.getByTestId("trending-up-icon") ||
        screen.getByTestId("trending-down-icon") ||
        screen.getByTestId("minus-icon")
    ).toBeInTheDocument();
  });

  it("hides trend icon when showTrend is false", () => {
    render(
      <ForecastAccuracyCard accuracy={mockAccuracyData} showTrend={false} />
    );

    // Should not show any trend icons
    expect(screen.queryByTestId("trending-up-icon")).not.toBeInTheDocument();
    expect(screen.queryByTestId("trending-down-icon")).not.toBeInTheDocument();
    expect(screen.queryByTestId("minus-icon")).not.toBeInTheDocument();
  });

  it("formats delta values correctly in tooltips", () => {
    render(<ForecastAccuracyCard accuracy={mockAccuracyData} />);

    // Should include formatted delta values in tooltip content
    const tooltipContents = screen.getAllByTestId("tooltip-content");

    // Check that at least one tooltip contains delta information
    const hasWaveHeightDelta = tooltipContents.some((element) =>
      element.textContent?.includes("±0.5ft")
    );
    const hasWindSpeedDelta = tooltipContents.some((element) =>
      element.textContent?.includes("±2.1mph")
    );

    expect(hasWaveHeightDelta || hasWindSpeedDelta).toBe(true);
  });

  it("displays session count information", () => {
    render(<ForecastAccuracyCard accuracy={mockAccuracyData} />);

    expect(screen.getByText("Total Sessions")).toBeInTheDocument();
    expect(screen.getByText("Recent (30d)")).toBeInTheDocument();
    expect(screen.getByText("25")).toBeInTheDocument(); // Total sessions
    expect(screen.getByText("8")).toBeInTheDocument(); // Recent sessions
  });
});
