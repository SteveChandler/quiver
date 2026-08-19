/**
 * Component-level tests for analytics wiring in BestDaysSection
 *
 * Covers three behaviours flagged by code review:
 *   1. IntersectionObserver fires `trackBestConditionsViewed` when the section
 *      scrolls into view (threshold 0.3), and only fires once.
 *   2. Clicking the hero card fires `trackBestConditionsClick` with
 *      (regionName, 1, bestDay.score).
 *   3. Clicking secondary day cards fires `trackBestConditionsClick` with
 *      (regionName, index + 2, day.score).
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { BestDaysSection } from "@/components/forecast/best-days-section";
import type { DaySummary } from "@/lib/utils/regional-forecast-utils";

// ---------------------------------------------------------------------------
// Mock analytics module
// ---------------------------------------------------------------------------

jest.mock("@/lib/analytics/engagement-tracking", () => ({
  trackBestConditionsViewed: jest.fn(),
  trackBestConditionsClick: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Mock heavy sub-components so rendering stays fast and predictable
// ---------------------------------------------------------------------------

jest.mock("@/components/forecast/animated-score-gauge", () => ({
  AnimatedScoreGauge: ({ score }: { score: number }) => (
    <div data-testid="animated-score-gauge">{score}</div>
  ),
}));

jest.mock("@/components/forecast/score-badge", () => ({
  ScoreBadge: ({ score, className }: { score: number; className?: string }) => (
    <div data-testid="score-badge" className={className}>
      {score}
    </div>
  ),
}));

jest.mock("@/components/ui/ocean-background", () => ({
  WaveBackground: () => <div data-testid="wave-background" />,
}));

// ScrollReveal must render children so click targets are accessible
jest.mock("@/components/ui/scroll-reveal", () => ({
  ScrollReveal: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="scroll-reveal">{children}</div>
  ),
}));

jest.mock("@/components/ui/animated-counter", () => ({
  AnimatedCounter: ({ value }: { value: number }) => <span>{value}</span>,
}));

jest.mock("@/components/ui/card", () => ({
  Card: ({
    children,
    onClick,
    className,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    className?: string;
  }) => (
    <div data-testid="card" className={className} onClick={onClick}>
      {children}
    </div>
  ),
  CardContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="card-content">{children}</div>
  ),
}));

jest.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => (
    <span data-testid="badge">{children}</span>
  ),
}));

jest.mock("@/lib/utils/wave-formatters", () => ({
  formatWaveRange: (range: [number, number]) => `${range[0]}-${range[1]} ft`,
}));

jest.mock("@/lib/utils/score-color-utils", () => ({
  getScoreColorClasses: () => ({
    border: "border-blue-500",
    paperBadge: "bg-[#11100D] text-[#F4EBD8]",
  }),
  SCORE_THRESHOLDS: { EPIC: 90 },
}));

jest.mock("lucide-react", () => ({
  Sun: () => <span data-testid="sun-icon" />,
  Wind: () => <span data-testid="wind-icon" />,
  CloudSun: () => <span data-testid="cloud-sun-icon" />,
  Cloud: () => <span data-testid="cloud-icon" />,
  Sunrise: () => <span data-testid="sunrise-icon" />,
  Clock: () => <span data-testid="clock-icon" />,
  Waves: () => <span data-testid="waves-icon" />,
  Trophy: () => <span data-testid="trophy-icon" />,
}));

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function makeDaySummary(overrides: Partial<DaySummary> = {}): DaySummary {
  return {
    date: new Date("2026-03-10T12:00:00Z"),
    dateString: "2026-03-10",
    dayOfWeek: "Tuesday",
    score: 70,
    avgWaveHeight: 4,
    waveRange: [3, 5],
    dominantWindDirection: "NW",
    windConditions: "offshore",
    bestTimeSlot: "dawn-patrol",
    topBeaches: [],
    beachesWithGoodConditions: 3,
    ...overrides,
  };
}

const BEST_DAY = makeDaySummary({
  dateString: "2026-03-10",
  dayOfWeek: "Tuesday",
  score: 85,
});

const SECONDARY_DAYS: DaySummary[] = [
  makeDaySummary({ dateString: "2026-03-11", dayOfWeek: "Wednesday", score: 72 }),
  makeDaySummary({ dateString: "2026-03-12", dayOfWeek: "Thursday", score: 65 }),
  makeDaySummary({ dateString: "2026-03-13", dayOfWeek: "Friday", score: 60 }),
];

const ALL_DAYS: DaySummary[] = [BEST_DAY, ...SECONDARY_DAYS];

const REGION_NAME = "San Diego";

// ---------------------------------------------------------------------------
// Helper: build a controllable IntersectionObserver mock
//
// Returns a `triggerIntersection` function that exercises the latest observer
// callback captured by the mock constructor.
// ---------------------------------------------------------------------------

function setupControllableIntersectionObserver() {
  let lastCallback: IntersectionObserverCallback | null = null;

  const mockDisconnect = jest.fn();
  const mockObserve = jest.fn();

  global.IntersectionObserver = jest.fn((callback: IntersectionObserverCallback) => {
    lastCallback = callback;
    return {
      observe: mockObserve,
      disconnect: mockDisconnect,
      unobserve: jest.fn(),
      takeRecords: () => [],
      root: null,
      rootMargin: "",
      thresholds: [0.3],
    };
  }) as unknown as typeof IntersectionObserver;

  function triggerIntersection(isIntersecting: boolean) {
    if (!lastCallback) throw new Error("No IntersectionObserver callback registered yet");
    lastCallback(
      [{ isIntersecting } as IntersectionObserverEntry],
      {} as IntersectionObserver
    );
  }

  return { triggerIntersection, mockDisconnect, mockObserve };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("BestDaysSection — analytics wiring", () => {
  let trackBestConditionsViewed: jest.Mock;
  let trackBestConditionsClick: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    const tracking = require("@/lib/analytics/engagement-tracking");
    trackBestConditionsViewed = tracking.trackBestConditionsViewed;
    trackBestConditionsClick = tracking.trackBestConditionsClick;
  });

  it("does not render immediate-action copy for a future weekly best day", () => {
    const futureBestDay = makeDaySummary({ score: 97 });

    render(
      <BestDaysSection
        days={[futureBestDay]}
        bestDay={futureBestDay}
        regionName={REGION_NAME}
        variant="zine"
      />
    );

    expect(screen.getByTestId("zine-best-day-card")).toBeInTheDocument();
    expect(screen.queryByText("Go now!")).not.toBeInTheDocument();
  });

  // -------------------------------------------------------------------------
  // 1. IntersectionObserver — viewed tracking
  // -------------------------------------------------------------------------

  describe("IntersectionObserver viewed tracking", () => {
    it("fires trackBestConditionsViewed when the section enters the viewport", () => {
      const { triggerIntersection } = setupControllableIntersectionObserver();

      render(
        <BestDaysSection days={ALL_DAYS} bestDay={BEST_DAY} regionName={REGION_NAME} />
      );

      triggerIntersection(true);

      expect(trackBestConditionsViewed).toHaveBeenCalledTimes(1);
      expect(trackBestConditionsViewed).toHaveBeenCalledWith(ALL_DAYS.length, false);
    });

    it("passes the correct day count to trackBestConditionsViewed", () => {
      const { triggerIntersection } = setupControllableIntersectionObserver();

      const twodays = [BEST_DAY, SECONDARY_DAYS[0]];
      render(
        <BestDaysSection days={twodays} bestDay={BEST_DAY} regionName={REGION_NAME} />
      );

      triggerIntersection(true);

      expect(trackBestConditionsViewed).toHaveBeenCalledWith(2, false);
    });

    it("does NOT fire trackBestConditionsViewed when the section leaves the viewport", () => {
      const { triggerIntersection } = setupControllableIntersectionObserver();

      render(
        <BestDaysSection days={ALL_DAYS} bestDay={BEST_DAY} regionName={REGION_NAME} />
      );

      triggerIntersection(false);

      expect(trackBestConditionsViewed).not.toHaveBeenCalled();
    });

    it("fires trackBestConditionsViewed only once even if intersection triggers multiple times", () => {
      const { triggerIntersection } = setupControllableIntersectionObserver();

      render(
        <BestDaysSection days={ALL_DAYS} bestDay={BEST_DAY} regionName={REGION_NAME} />
      );

      triggerIntersection(true);
      // Simulate the element leaving and re-entering view (e.g. user scrolls away and back)
      triggerIntersection(false);
      triggerIntersection(true);
      triggerIntersection(true);

      expect(trackBestConditionsViewed).toHaveBeenCalledTimes(1);
    });

    it("disconnects the observer after firing the view event", () => {
      const { triggerIntersection, mockDisconnect } = setupControllableIntersectionObserver();

      render(
        <BestDaysSection days={ALL_DAYS} bestDay={BEST_DAY} regionName={REGION_NAME} />
      );

      triggerIntersection(true);

      expect(mockDisconnect).toHaveBeenCalled();
    });

    it("does NOT fire trackBestConditionsViewed when days array is empty", () => {
      // When days is empty the useEffect returns early before constructing an
      // IntersectionObserver, so there is no callback to trigger — assert that
      // the observer is never created and tracking is never called.
      setupControllableIntersectionObserver();

      render(
        <BestDaysSection days={[]} bestDay={BEST_DAY} regionName={REGION_NAME} />
      );

      const ioConstructor = global.IntersectionObserver as jest.Mock;
      expect(ioConstructor).not.toHaveBeenCalled();
      expect(trackBestConditionsViewed).not.toHaveBeenCalled();
    });

    it("creates the IntersectionObserver with threshold 0.3", () => {
      setupControllableIntersectionObserver();

      render(
        <BestDaysSection days={ALL_DAYS} bestDay={BEST_DAY} regionName={REGION_NAME} />
      );

      const ioConstructor = global.IntersectionObserver as jest.Mock;
      expect(ioConstructor).toHaveBeenCalledWith(
        expect.any(Function),
        { threshold: 0.3 }
      );
    });
  });

  // -------------------------------------------------------------------------
  // 2. Hero card click tracking
  // -------------------------------------------------------------------------

  describe("hero card click tracking", () => {
    it("fires trackBestConditionsClick with (regionName, 1, bestDay.score) when hero card is clicked", () => {
      render(
        <BestDaysSection days={ALL_DAYS} bestDay={BEST_DAY} regionName={REGION_NAME} />
      );

      // The hero card is rendered without ScrollReveal wrapping (directly inside a ScrollReveal).
      // All clickable Cards have data-testid="card". The first one is the hero.
      const cards = screen.getAllByTestId("card");
      fireEvent.click(cards[0]);

      expect(trackBestConditionsClick).toHaveBeenCalledTimes(1);
      expect(trackBestConditionsClick).toHaveBeenCalledWith(REGION_NAME, 1, BEST_DAY.score);
    });

    it("uses the correct regionName as the first argument for the hero click", () => {
      const customRegion = "Santa Cruz";
      render(
        <BestDaysSection days={ALL_DAYS} bestDay={BEST_DAY} regionName={customRegion} />
      );

      const cards = screen.getAllByTestId("card");
      fireEvent.click(cards[0]);

      expect(trackBestConditionsClick).toHaveBeenCalledWith(customRegion, 1, BEST_DAY.score);
    });

    it("always passes rank 1 for the hero card regardless of score", () => {
      const highScoreDay = makeDaySummary({ dateString: "2026-03-10", score: 97 });
      const days = [highScoreDay, ...SECONDARY_DAYS];

      render(
        <BestDaysSection days={days} bestDay={highScoreDay} regionName={REGION_NAME} />
      );

      const cards = screen.getAllByTestId("card");
      fireEvent.click(cards[0]);

      expect(trackBestConditionsClick).toHaveBeenCalledWith(REGION_NAME, 1, 97);
    });

    it("does not fire trackBestConditionsViewed when the hero card is clicked", () => {
      render(
        <BestDaysSection days={ALL_DAYS} bestDay={BEST_DAY} regionName={REGION_NAME} />
      );

      const cards = screen.getAllByTestId("card");
      fireEvent.click(cards[0]);

      expect(trackBestConditionsViewed).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // 3. Secondary day card click tracking
  // -------------------------------------------------------------------------

  describe("secondary day card click tracking", () => {
    it("fires trackBestConditionsClick with rank 2 for the first secondary card", () => {
      render(
        <BestDaysSection days={ALL_DAYS} bestDay={BEST_DAY} regionName={REGION_NAME} />
      );

      // Cards: index 0 = hero, index 1 = first secondary day (rank 2)
      const cards = screen.getAllByTestId("card");
      fireEvent.click(cards[1]);

      // Secondary days are sorted by score descending — highest score is SECONDARY_DAYS[0] (72)
      const expectedDay = [...SECONDARY_DAYS].sort((a, b) => b.score - a.score)[0];
      expect(trackBestConditionsClick).toHaveBeenCalledWith(REGION_NAME, 2, expectedDay.score);
    });

    it("fires trackBestConditionsClick with rank 3 for the second secondary card", () => {
      render(
        <BestDaysSection days={ALL_DAYS} bestDay={BEST_DAY} regionName={REGION_NAME} />
      );

      const cards = screen.getAllByTestId("card");
      fireEvent.click(cards[2]);

      const sortedSecondary = [...SECONDARY_DAYS].sort((a, b) => b.score - a.score);
      expect(trackBestConditionsClick).toHaveBeenCalledWith(
        REGION_NAME,
        3,
        sortedSecondary[1].score
      );
    });

    it("fires trackBestConditionsClick with rank 4 for the third secondary card", () => {
      render(
        <BestDaysSection days={ALL_DAYS} bestDay={BEST_DAY} regionName={REGION_NAME} />
      );

      const cards = screen.getAllByTestId("card");
      fireEvent.click(cards[3]);

      const sortedSecondary = [...SECONDARY_DAYS].sort((a, b) => b.score - a.score);
      expect(trackBestConditionsClick).toHaveBeenCalledWith(
        REGION_NAME,
        4,
        sortedSecondary[2].score
      );
    });

    it("passes the correct day score (not hero score) for each secondary card", () => {
      const secondaryWithDistinctScores: DaySummary[] = [
        makeDaySummary({ dateString: "2026-03-11", score: 80 }),
        makeDaySummary({ dateString: "2026-03-12", score: 55 }),
      ];
      const days = [BEST_DAY, ...secondaryWithDistinctScores];

      render(
        <BestDaysSection days={days} bestDay={BEST_DAY} regionName={REGION_NAME} />
      );

      const cards = screen.getAllByTestId("card");

      fireEvent.click(cards[1]);
      expect(trackBestConditionsClick).toHaveBeenLastCalledWith(REGION_NAME, 2, 80);

      fireEvent.click(cards[2]);
      expect(trackBestConditionsClick).toHaveBeenLastCalledWith(REGION_NAME, 3, 55);
    });

    it("uses regionName (not a beach name) for secondary card clicks", () => {
      const customRegion = "Malibu";
      render(
        <BestDaysSection days={ALL_DAYS} bestDay={BEST_DAY} regionName={customRegion} />
      );

      const cards = screen.getAllByTestId("card");
      fireEvent.click(cards[1]);

      expect(trackBestConditionsClick).toHaveBeenCalledWith(
        customRegion,
        expect.any(Number),
        expect.any(Number)
      );
    });

    it("renders at most 4 secondary cards (top 4 non-best days)", () => {
      // Build 6 days total — bestDay + 5 others — component should cap at 4 secondary cards
      const manyDays: DaySummary[] = [
        BEST_DAY,
        makeDaySummary({ dateString: "2026-03-11", score: 79 }),
        makeDaySummary({ dateString: "2026-03-12", score: 75 }),
        makeDaySummary({ dateString: "2026-03-13", score: 68 }),
        makeDaySummary({ dateString: "2026-03-14", score: 62 }),
        makeDaySummary({ dateString: "2026-03-15", score: 55 }),
      ];

      render(
        <BestDaysSection days={manyDays} bestDay={BEST_DAY} regionName={REGION_NAME} />
      );

      // 1 hero + 4 secondary = 5 cards maximum
      const cards = screen.getAllByTestId("card");
      expect(cards).toHaveLength(5);
    });

    it("does not render any secondary cards when only the best day is provided", () => {
      render(
        <BestDaysSection days={[BEST_DAY]} bestDay={BEST_DAY} regionName={REGION_NAME} />
      );

      // Only the hero card should exist
      const cards = screen.getAllByTestId("card");
      expect(cards).toHaveLength(1);
    });

    it("excludes bestDay from secondary cards by dateString", () => {
      // bestDay has dateString "2026-03-10"; it must not appear as a secondary card
      render(
        <BestDaysSection days={ALL_DAYS} bestDay={BEST_DAY} regionName={REGION_NAME} />
      );

      // Click each secondary card and confirm none fires rank=1
      const cards = screen.getAllByTestId("card");
      for (let i = 1; i < cards.length; i++) {
        fireEvent.click(cards[i]);
      }

      const calls = trackBestConditionsClick.mock.calls;
      const ranks = calls.map((c) => c[1]);
      expect(ranks).not.toContain(1);
    });
  });

  // -------------------------------------------------------------------------
  // 4. Independent click calls (no cross-contamination between events)
  // -------------------------------------------------------------------------

  describe("click tracking isolation", () => {
    it("each card click fires exactly one trackBestConditionsClick call", () => {
      render(
        <BestDaysSection days={ALL_DAYS} bestDay={BEST_DAY} regionName={REGION_NAME} />
      );

      const cards = screen.getAllByTestId("card");

      fireEvent.click(cards[0]);
      expect(trackBestConditionsClick).toHaveBeenCalledTimes(1);

      fireEvent.click(cards[1]);
      expect(trackBestConditionsClick).toHaveBeenCalledTimes(2);
    });

    it("clicking a secondary card does not re-trigger trackBestConditionsViewed", () => {
      const { triggerIntersection } = setupControllableIntersectionObserver();

      render(
        <BestDaysSection days={ALL_DAYS} bestDay={BEST_DAY} regionName={REGION_NAME} />
      );

      triggerIntersection(true);
      expect(trackBestConditionsViewed).toHaveBeenCalledTimes(1);

      const cards = screen.getAllByTestId("card");
      fireEvent.click(cards[1]);

      // Still only one view event
      expect(trackBestConditionsViewed).toHaveBeenCalledTimes(1);
    });
  });
});

describe("BestDaysSection — paper score treatment", () => {
  it("uses the shared ink badge and keeps interactive day cards free of torn masks", () => {
    render(
      <BestDaysSection
        days={ALL_DAYS}
        bestDay={BEST_DAY}
        regionName={REGION_NAME}
        variant="zine"
      />
    );

    expect(screen.getAllByTestId("score-badge")).toHaveLength(3);
    for (const badge of screen.getAllByTestId("score-badge")) {
      expect(badge).toHaveClass("bg-[#11100D]", "text-[#F4EBD8]");
      expect(badge).not.toHaveClass("text-white");
    }

    for (const card of screen.getAllByRole("button")) {
      expect(card).not.toHaveClass("torn", "torn-tb");
    }
  });
});
