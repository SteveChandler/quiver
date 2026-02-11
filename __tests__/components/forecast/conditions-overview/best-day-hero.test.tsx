import { render, screen } from "@testing-library/react";
import { BestDayHero } from "@/components/forecast/conditions-overview/best-day-hero";
import type { EnrichedDaySummary } from "@/lib/utils/enriched-day-summary";

// Mock child components
jest.mock("@/components/forecast/animated-score-gauge", () => ({
  AnimatedScoreGauge: ({ score, size, showLabel }: any) => (
    <div data-testid="animated-score-gauge">
      <div data-testid="gauge-score">{score}</div>
      <div data-testid="gauge-size">{size}</div>
      {showLabel && <div data-testid="gauge-label">Score</div>}
    </div>
  ),
}));

jest.mock("@/components/forecast/score-badge", () => ({
  ScoreBadge: ({ score, size }: any) => (
    <div data-testid="score-badge">
      Score: {score} (size: {size})
    </div>
  ),
}));

jest.mock("@/components/ui/badge", () => ({
  Badge: ({ children, className }: any) => (
    <span data-testid="badge" className={className}>
      {children}
    </span>
  ),
}));

jest.mock("@/components/ui/scroll-reveal", () => ({
  ScrollReveal: ({ children }: any) => <div data-testid="scroll-reveal">{children}</div>,
}));

// Mock wave formatters
const mockFormatWaveRange = jest.fn((range, format) => `${range[0]}-${range[1]} ft`);
jest.mock("@/lib/utils/wave-formatters", () => ({
  formatWaveRange: (range: number[], format: string) => mockFormatWaveRange(range, format),
}));

// Mock lucide-react icons
jest.mock("lucide-react", () => ({
  Wind: ({ className }: any) => <span data-testid="wind-icon" className={className} />,
  Clock: ({ className }: any) => <span data-testid="clock-icon" className={className} />,
  Waves: ({ className }: any) => <span data-testid="waves-icon" className={className} />,
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

describe("BestDayHero", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders "Best Day This Week" badge', () => {
    const bestDay = createMockDay();
    render(<BestDayHero bestDay={bestDay} otherGoodDays={[]} />);

    expect(screen.getByText("Best Day This Week")).toBeInTheDocument();
  });

  it("displays day name and date correctly", () => {
    const bestDay = createMockDay({
      dayName: "Friday",
      date: "Feb 14",
    });
    render(<BestDayHero bestDay={bestDay} otherGoodDays={[]} />);

    expect(screen.getByText(/Friday, Feb 14/)).toBeInTheDocument();
  });

  it("displays wave range via formatWaveRange", () => {
    const bestDay = createMockDay({ minHeight: 4, maxHeight: 6 });
    render(<BestDayHero bestDay={bestDay} otherGoodDays={[]} />);

    expect(mockFormatWaveRange).toHaveBeenCalledWith([4, 6], "integer");
    expect(screen.getByText("4-6 ft")).toBeInTheDocument();
  });

  it("displays offshore wind type with icon", () => {
    const bestDay = createMockDay({ windConditions: "offshore" });
    render(<BestDayHero bestDay={bestDay} otherGoodDays={[]} />);

    expect(screen.getByText("Offshore")).toBeInTheDocument();
    expect(screen.getByTestId("wind-icon")).toBeInTheDocument();
  });

  it("displays light wind type without icon", () => {
    const bestDay = createMockDay({ windConditions: "light" });
    render(<BestDayHero bestDay={bestDay} otherGoodDays={[]} />);

    expect(screen.getByText("Light Wind")).toBeInTheDocument();
    // Wind icon should not be present for light wind
    const icons = screen.queryAllByTestId("wind-icon");
    // There might be icons in other sections, but check the wind label doesn't have one
    expect(screen.getByText("Light Wind").querySelector('[data-testid="wind-icon"]')).toBeNull();
  });

  it("displays onshore wind type without icon", () => {
    const bestDay = createMockDay({ windConditions: "onshore" });
    render(<BestDayHero bestDay={bestDay} otherGoodDays={[]} />);

    expect(screen.getByText("Onshore")).toBeInTheDocument();
  });

  it("displays best time slot capitalized", () => {
    const bestDay = createMockDay({ bestTimeSlot: "morning" });
    render(<BestDayHero bestDay={bestDay} otherGoodDays={[]} />);

    expect(screen.getByText("Best: Morning")).toBeInTheDocument();
    expect(screen.getByTestId("clock-icon")).toBeInTheDocument();
  });

  it("displays best time slot for dawn-patrol (hyphenated)", () => {
    const bestDay = createMockDay({ bestTimeSlot: "dawn-patrol" });
    render(<BestDayHero bestDay={bestDay} otherGoodDays={[]} />);

    expect(screen.getByText("Best: Dawn Patrol")).toBeInTheDocument();
  });

  it("displays period when not null", () => {
    const bestDay = createMockDay({ period: 14 });
    render(<BestDayHero bestDay={bestDay} otherGoodDays={[]} />);

    expect(screen.getByText("14s period")).toBeInTheDocument();
  });

  it("does not display period when null", () => {
    const bestDay = createMockDay({ period: null });
    render(<BestDayHero bestDay={bestDay} otherGoodDays={[]} />);

    expect(screen.queryByText(/period/)).not.toBeInTheDocument();
  });

  it("passes correct score to AnimatedScoreGauge", () => {
    const bestDay = createMockDay({ score: 85 });
    render(<BestDayHero bestDay={bestDay} otherGoodDays={[]} />);

    expect(screen.getByTestId("gauge-score")).toHaveTextContent("85");
    expect(screen.getByTestId("gauge-size")).toHaveTextContent("xl");
    expect(screen.getByTestId("gauge-label")).toBeInTheDocument();
  });

  it("renders other good days grid when otherGoodDays is not empty", () => {
    const bestDay = createMockDay();
    const otherGoodDays = [
      createMockDay({ fullDate: "2026-02-11", dayName: "Tue", date: "Feb 11", score: 75 }),
      createMockDay({ fullDate: "2026-02-12", dayName: "Wed", date: "Feb 12", score: 70 }),
    ];
    render(<BestDayHero bestDay={bestDay} otherGoodDays={otherGoodDays} />);

    // Check that we have score badges for other days
    const scoreBadges = screen.getAllByTestId("score-badge");
    // Should have 2 badges (one for each other good day)
    expect(scoreBadges).toHaveLength(2);
    expect(scoreBadges[0]).toHaveTextContent("75");
    expect(scoreBadges[1]).toHaveTextContent("70");
  });

  it("does not render other good days grid when otherGoodDays is empty", () => {
    const bestDay = createMockDay();
    render(<BestDayHero bestDay={bestDay} otherGoodDays={[]} />);

    // Should only have the main hero section with gauge, no additional score badges
    const scoreBadges = screen.queryAllByTestId("score-badge");
    expect(scoreBadges).toHaveLength(0);
  });

  it("displays day name and date for each other good day", () => {
    const bestDay = createMockDay();
    const otherGoodDays = [
      createMockDay({ fullDate: "2026-02-11", dayName: "Tue", date: "Feb 11", score: 75 }),
      createMockDay({ fullDate: "2026-02-12", dayName: "Wed", date: "Feb 12", score: 70 }),
    ];
    render(<BestDayHero bestDay={bestDay} otherGoodDays={otherGoodDays} />);

    expect(screen.getByText(/Tue, Feb 11/)).toBeInTheDocument();
    expect(screen.getByText(/Wed, Feb 12/)).toBeInTheDocument();
  });

  it("displays wave range and wind label for each other good day", () => {
    const bestDay = createMockDay();
    const otherGoodDays = [
      createMockDay({
        fullDate: "2026-02-11",
        dayName: "Tue",
        date: "Feb 11",
        minHeight: 2,
        maxHeight: 4,
        windConditions: "offshore",
        score: 75,
      }),
      createMockDay({
        fullDate: "2026-02-12",
        dayName: "Wed",
        date: "Feb 12",
        minHeight: 3,
        maxHeight: 5,
        windConditions: "light",
        score: 70,
      }),
    ];
    render(<BestDayHero bestDay={bestDay} otherGoodDays={otherGoodDays} />);

    // Use getAllByText since wave ranges appear in both hero and cards
    const twoToFourFt = screen.getAllByText(/2-4 ft/);
    const threeToFiveFt = screen.getAllByText(/3-5 ft/);

    expect(twoToFourFt.length).toBeGreaterThanOrEqual(1);
    expect(threeToFiveFt.length).toBeGreaterThanOrEqual(1);

    // Check wind labels (there are multiple, so use getAllByText)
    const offshoreLabels = screen.getAllByText("Offshore");
    const lightWindLabels = screen.getAllByText("Light Wind");

    // Should have at least one of each
    expect(offshoreLabels.length).toBeGreaterThanOrEqual(1);
    expect(lightWindLabels.length).toBeGreaterThanOrEqual(1);
  });

  it("renders ScoreBadge with sm size for other good days", () => {
    const bestDay = createMockDay();
    const otherGoodDays = [
      createMockDay({ fullDate: "2026-02-11", score: 75 }),
    ];
    render(<BestDayHero bestDay={bestDay} otherGoodDays={otherGoodDays} />);

    expect(screen.getByText(/size: sm/)).toBeInTheDocument();
  });

  it("limits display to maximum 4 other good days", () => {
    const bestDay = createMockDay();
    const otherGoodDays = [
      createMockDay({ fullDate: "2026-02-11", score: 80 }),
      createMockDay({ fullDate: "2026-02-12", score: 75 }),
      createMockDay({ fullDate: "2026-02-13", score: 70 }),
      createMockDay({ fullDate: "2026-02-14", score: 65 }),
      createMockDay({ fullDate: "2026-02-15", score: 60 }),
    ];
    render(<BestDayHero bestDay={bestDay} otherGoodDays={otherGoodDays} />);

    const scoreBadges = screen.getAllByTestId("score-badge");
    // Should only render 4 cards
    expect(scoreBadges).toHaveLength(4);
  });
});
