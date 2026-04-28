import { render, screen } from "@testing-library/react";
import { ConditionsOverview } from "@/components/forecast/conditions-overview/conditions-overview";
import type { DaySummary } from "@/lib/utils/horizon-strip-utils";
import type { EnrichedDaySummary } from "@/lib/utils/enriched-day-summary";
import type { EnhancedForecastEntity } from "@/types/forecast";
import type { Beach } from "@/types/database";

// Mock child components
jest.mock("@/components/forecast/conditions-overview/best-day-hero", () => ({
  BestDayHero: ({ bestDay, otherGoodDays }: any) => (
    <div data-testid="best-day-hero">
      <div data-testid="best-day-score">{bestDay.score}</div>
      <div data-testid="best-day-date">{bestDay.fullDate}</div>
      <div data-testid="other-good-days-count">{otherGoodDays.length}</div>
    </div>
  ),
}));

jest.mock("@/components/forecast/conditions-overview/explore-more-links", () => ({
  ExploreMoreLinks: ({ beach }: any) => (
    <div data-testid="explore-more-links">
      Explore links for {beach.name}
    </div>
  ),
}));

// Mock next/dynamic to return a simple component
jest.mock("next/dynamic", () => ({
  __esModule: true,
  default: (fn: any) => {
    const Component = ({ days }: any) => (
      <div data-testid="outlook-bar-chart">
        Chart with {days.length} days
      </div>
    );
    Component.displayName = "OutlookBarChart";
    return Component;
  },
}));

// Mock enrichDaySummaries utility
const mockEnrichDaySummaries = jest.fn();
jest.mock("@/lib/utils/enriched-day-summary", () => ({
  enrichDaySummaries: (days: DaySummary[], forecasts: EnhancedForecastEntity[], windOffshoreDeg?: number | null) =>
    mockEnrichDaySummaries(days, forecasts, windOffshoreDeg),
}));

function createMockDay(overrides: Partial<EnrichedDaySummary> = {}): EnrichedDaySummary {
  return {
    fullDate: "2026-02-10",
    dayName: "Mon",
    date: "Feb 10",
    score: 70,
    tier: "good",
    minHeight: 3,
    maxHeight: 5,
    period: 12,
    bestTime: "08:00",
    windConditions: "offshore",
    bestTimeSlot: "morning",
    windSpeed: "5 mph",
    isToday: false,
    ...overrides,
  };
}

function createMockBeach(overrides: Partial<Beach> = {}): Beach {
  return {
    id: "beach-1",
    name: "Blacks Beach",
    state: "CA",
    city: "San Diego",
    center_lat: 32.8868,
    center_lng: -117.2509,
    ...overrides,
  } as Beach;
}

const mockForecasts: EnhancedForecastEntity[] = [];

describe("ConditionsOverview", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders empty state when no forecast data available", () => {
    mockEnrichDaySummaries.mockReturnValue([]);

    const beach = createMockBeach();
    render(
      <ConditionsOverview
        horizonDaySummaries={[]}
        forecasts={mockForecasts}
        beach={beach}
      />
    );

    expect(screen.getByText("No forecast data available")).toBeInTheDocument();
    expect(screen.queryByTestId("best-day-hero")).not.toBeInTheDocument();
  });

  it("selects best day with highest score in normal mode", () => {
    const enrichedDays = [
      createMockDay({ fullDate: "2026-02-10", score: 70 }),
      createMockDay({ fullDate: "2026-02-11", score: 85 }),
      createMockDay({ fullDate: "2026-02-12", score: 60 }),
    ];
    mockEnrichDaySummaries.mockReturnValue(enrichedDays);

    const beach = createMockBeach();
    render(
      <ConditionsOverview
        horizonDaySummaries={[]}
        forecasts={mockForecasts}
        beach={beach}
      />
    );

    expect(screen.getByTestId("best-day-score")).toHaveTextContent("85");
    expect(screen.getByTestId("best-day-date")).toHaveTextContent("2026-02-11");
  });

  it("filters otherGoodDays to only include days with score >= 60", () => {
    const enrichedDays = [
      createMockDay({ fullDate: "2026-02-10", score: 85 }), // best
      createMockDay({ fullDate: "2026-02-11", score: 70 }), // good
      createMockDay({ fullDate: "2026-02-12", score: 65 }), // good
      createMockDay({ fullDate: "2026-02-13", score: 50 }), // excluded
      createMockDay({ fullDate: "2026-02-14", score: 40 }), // excluded
    ];
    mockEnrichDaySummaries.mockReturnValue(enrichedDays);

    const beach = createMockBeach();
    render(
      <ConditionsOverview
        horizonDaySummaries={[]}
        forecasts={mockForecasts}
        beach={beach}
      />
    );

    // otherGoodDays should have 2 days (70 and 65)
    expect(screen.getByTestId("other-good-days-count")).toHaveTextContent("2");
  });

  it("limits otherGoodDays to maximum of 4 days", () => {
    const enrichedDays = [
      createMockDay({ fullDate: "2026-02-10", score: 90 }), // best
      createMockDay({ fullDate: "2026-02-11", score: 85 }),
      createMockDay({ fullDate: "2026-02-12", score: 80 }),
      createMockDay({ fullDate: "2026-02-13", score: 75 }),
      createMockDay({ fullDate: "2026-02-14", score: 70 }),
      createMockDay({ fullDate: "2026-02-15", score: 65 }),
      createMockDay({ fullDate: "2026-02-16", score: 60 }),
    ];
    mockEnrichDaySummaries.mockReturnValue(enrichedDays);

    const beach = createMockBeach();
    render(
      <ConditionsOverview
        horizonDaySummaries={[]}
        forecasts={mockForecasts}
        beach={beach}
      />
    );

    // Should limit to top 4 (scores 85, 80, 75, 70)
    expect(screen.getByTestId("other-good-days-count")).toHaveTextContent("4");
  });

  it("returns top 3 days when all scores are below 60", () => {
    const enrichedDays = [
      createMockDay({ fullDate: "2026-02-10", score: 55 }), // best
      createMockDay({ fullDate: "2026-02-11", score: 50 }),
      createMockDay({ fullDate: "2026-02-12", score: 45 }),
      createMockDay({ fullDate: "2026-02-13", score: 40 }),
      createMockDay({ fullDate: "2026-02-14", score: 35 }),
    ];
    mockEnrichDaySummaries.mockReturnValue(enrichedDays);

    const beach = createMockBeach();
    render(
      <ConditionsOverview
        horizonDaySummaries={[]}
        forecasts={mockForecasts}
        beach={beach}
      />
    );

    // When all below 60, take top 3 (scores 50, 45, 40)
    expect(screen.getByTestId("other-good-days-count")).toHaveTextContent("3");
  });

  it("renders OutlookBarChart for every viewer (no gate)", () => {
    const enrichedDays = [
      createMockDay({ fullDate: "2026-02-10", score: 70 }),
      createMockDay({ fullDate: "2026-02-11", score: 80 }),
    ];
    mockEnrichDaySummaries.mockReturnValue(enrichedDays);

    const beach = createMockBeach();
    render(
      <ConditionsOverview
        horizonDaySummaries={[]}
        forecasts={mockForecasts}
        beach={beach}
      />
    );

    expect(screen.getByTestId("outlook-bar-chart")).toBeInTheDocument();
  });

  it("always renders ExploreMoreLinks", () => {
    const enrichedDays = [createMockDay({ fullDate: "2026-02-10", score: 70 })];
    mockEnrichDaySummaries.mockReturnValue(enrichedDays);

    const beach = createMockBeach({ name: "Blacks Beach" });
    render(
      <ConditionsOverview
        horizonDaySummaries={[]}
        forecasts={mockForecasts}
        beach={beach}
      />
    );

    expect(screen.getByTestId("explore-more-links")).toBeInTheDocument();
    expect(screen.getByText(/Blacks Beach/)).toBeInTheDocument();
  });

  it("renders chart with correct number of days", () => {
    const enrichedDays = [
      createMockDay({ fullDate: "2026-02-10", score: 70 }),
      createMockDay({ fullDate: "2026-02-11", score: 75 }),
      createMockDay({ fullDate: "2026-02-12", score: 80 }),
    ];
    mockEnrichDaySummaries.mockReturnValue(enrichedDays);

    const beach = createMockBeach();
    render(
      <ConditionsOverview
        horizonDaySummaries={[]}
        forecasts={mockForecasts}
        beach={beach}
      />
    );

    expect(screen.getByTestId("outlook-bar-chart")).toHaveTextContent(
      "Chart with 3 days"
    );
  });
});
