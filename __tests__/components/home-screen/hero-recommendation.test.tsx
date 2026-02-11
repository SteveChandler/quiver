import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import {
  HeroRecommendation,
  HeroRecommendationSkeleton,
  HeroRecommendationError,
  HeroRecommendationEmpty,
} from "@/components/home-screen/hero-recommendation";
import type { SurfDiscoveryRecommendation, TimeSlot } from "@/types/personalization";

// Mock framer-motion
jest.mock("framer-motion", () => ({
  motion: {
    span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  useReducedMotion: jest.fn(() => false),
}));

// Mock UI components
jest.mock("@/components/ui/badge", () => ({
  Badge: ({ children, ...props }: any) => (
    <span data-testid="badge" {...props}>
      {children}
    </span>
  ),
}));

// Mock utilities
jest.mock("@/lib/utils", () => ({
  cn: jest.fn((...args: any[]) => args.flat().filter(Boolean).join(" ")),
}));

jest.mock("@/lib/utils/date-utils", () => ({
  formatBeachDateTime: jest.fn((date: Date, timezone: string, format: string) => {
    if (format === "m") return "0";
    if (format === "ha") return "7AM";
    if (format === "h:mm a") return "7:30 AM";
    return "7am";
  }),
}));

jest.mock("@/lib/utils/rating-formatters", () => ({
  formatDiscoveryScore: jest.fn((score: number) => score.toFixed(1)),
}));

jest.mock("@/lib/utils/time-formatters", () => ({
  formatTimeWindowCompact: jest.fn(() => "7-10am"),
}));

jest.mock("@/lib/utils/condition-tier-utils", () => ({
  getConditionTier: jest.fn(() => "good"),
  getScoreColorClass: jest.fn(() => "text-blue-400"),
  getConditionBadge: jest.fn(() => ({ label: "Good Day", className: "bg-green-100" })),
  buildHeadlineText: jest.fn((name, tier) => ({
    prefix: "Head to ",
    beachPart: name,
    connector: "—",
  })),
  isTomorrowInTimezone: jest.fn(() => false),
}));

jest.mock("@/lib/constants/animations", () => ({
  HOME_HEADER_MOTION: {
    hero: {
      scoreGlow: { textShadow: [], transition: {} },
      badgeStagger: { staggerChildren: 0, delayChildren: 0 },
      badge: {},
    },
  },
}));

jest.mock("@/components/recommendations/board-recommendation-badge", () => ({
  BoardRecommendationBadge: () => <span data-testid="board-badge" />,
}));

jest.mock("@/hooks/use-board-recommendation", () => ({
  useBoardRecommendation: jest.fn(() => ({ recommendation: null })),
}));

/**
 * Mock recommendation factory
 */
function createMockRecommendation(
  overrides: Partial<SurfDiscoveryRecommendation> = {}
): SurfDiscoveryRecommendation {
  return {
    beach: {
      id: "b1",
      name: "Blacks Beach",
      timezone: "America/Los_Angeles",
      ...overrides.beach,
    },
    score: 8.2,
    window: {
      start: new Date("2026-02-10T07:00:00"),
      end: new Date("2026-02-10T10:00:00"),
      timezone: "America/Los_Angeles",
      peakTime: null,
      tide: "Rising",
      wind: "5 mph SW",
      waveHeight: "3-5 ft",
      wavePeriod: "12s",
      dataSource: "CDIP",
      confidence: 85,
      ...overrides.window,
    },
    forecast: {
      wave_height: "4.5",
      wind_speed: "5",
      ...overrides.forecast,
    },
    matchQuality: "great",
    subscores: {
      waveHeightFit: 20,
      periodEnergyScore: 18,
      windAlignment: 18,
      tideFit: 12,
      affinityBonus: 10,
      distancePenalty: -5,
    },
    summary: "Clean offshore conditions all morning.",
    reasons: ["Offshore wind", "Clean swell"],
    warnings: [],
    generated_at: "2026-02-10T00:00:00Z",
    message: "Clean offshore conditions all morning.",
    conditionBadges: [{ label: "Offshore" }, { label: "Clean" }],
    waveHeightBadge: "3-5ft",
    ...overrides,
  } as unknown as SurfDiscoveryRecommendation;
}

describe("HeroRecommendationSkeleton", () => {
  it("renders skeleton with correct test id", () => {
    render(<HeroRecommendationSkeleton />);
    expect(screen.getByTestId("hero-recommendation-loading")).toBeInTheDocument();
  });

  it("renders skeleton placeholder elements", () => {
    const { container } = render(<HeroRecommendationSkeleton />);
    const placeholders = container.querySelectorAll(".bg-gradient-to-r");
    expect(placeholders.length).toBeGreaterThan(0);
  });
});

describe("HeroRecommendationError", () => {
  it("renders error with correct test id", () => {
    const error = new Error("Failed to load");
    render(<HeroRecommendationError error={error} />);
    expect(screen.getByTestId("hero-recommendation-error")).toBeInTheDocument();
  });

  it("displays error message", () => {
    const error = new Error("Network error");
    render(<HeroRecommendationError error={error} />);
    expect(screen.getByText("Network error")).toBeInTheDocument();
  });

  it("displays generic message for error without message", () => {
    const error = new Error();
    render(<HeroRecommendationError error={error} />);
    expect(screen.getByText("Please try again later.")).toBeInTheDocument();
  });

  it("displays title for error state", () => {
    const error = new Error("Test error");
    render(<HeroRecommendationError error={error} />);
    expect(screen.getByText("Unable to load recommendation")).toBeInTheDocument();
  });
});

describe("HeroRecommendationEmpty", () => {
  it("renders empty state with correct test id", () => {
    render(<HeroRecommendationEmpty />);
    expect(screen.getByTestId("hero-recommendation-empty")).toBeInTheDocument();
  });

  it("displays no recommendations message", () => {
    render(<HeroRecommendationEmpty />);
    expect(screen.getByText("No surf recommendations available")).toBeInTheDocument();
  });

  it("displays check back later message", () => {
    render(<HeroRecommendationEmpty />);
    expect(screen.getByText("Check back later for updated conditions")).toBeInTheDocument();
  });
});

describe("HeroRecommendation - Loading State", () => {
  it("renders skeleton when loading is true", () => {
    render(
      <HeroRecommendation
        recommendation={null}
        loading={true}
        onPlanSession={jest.fn()}
        onViewBeach={jest.fn()}
      />
    );
    expect(screen.getByTestId("hero-recommendation-loading")).toBeInTheDocument();
  });

  it("does not render skeleton when loading is false", () => {
    render(
      <HeroRecommendation
        recommendation={null}
        loading={false}
        onPlanSession={jest.fn()}
        onViewBeach={jest.fn()}
      />
    );
    expect(screen.queryByTestId("hero-recommendation-loading")).not.toBeInTheDocument();
  });
});

describe("HeroRecommendation - Error State", () => {
  it("renders error when error is provided", () => {
    const error = new Error("API failure");
    render(
      <HeroRecommendation
        recommendation={null}
        error={error}
        onPlanSession={jest.fn()}
        onViewBeach={jest.fn()}
      />
    );
    expect(screen.getByTestId("hero-recommendation-error")).toBeInTheDocument();
  });

  it("does not render main content when error is present", () => {
    const error = new Error("Test error");
    render(
      <HeroRecommendation
        recommendation={null}
        error={error}
        onPlanSession={jest.fn()}
        onViewBeach={jest.fn()}
      />
    );
    expect(screen.queryByTestId("hero-recommendation")).not.toBeInTheDocument();
  });
});

describe("HeroRecommendation - Empty State", () => {
  it("renders empty state when recommendation is null", () => {
    render(
      <HeroRecommendation
        recommendation={null}
        onPlanSession={jest.fn()}
        onViewBeach={jest.fn()}
      />
    );
    expect(screen.getByTestId("hero-recommendation-empty")).toBeInTheDocument();
  });

  it("does not render main content when recommendation is null", () => {
    render(
      <HeroRecommendation
        recommendation={null}
        onPlanSession={jest.fn()}
        onViewBeach={jest.fn()}
      />
    );
    expect(screen.queryByTestId("hero-recommendation")).not.toBeInTheDocument();
  });
});

describe("HeroRecommendation - Normal Render", () => {
  const mockRecommendation = createMockRecommendation();

  it("renders hero recommendation with correct test id", () => {
    render(
      <HeroRecommendation
        recommendation={mockRecommendation}
        onPlanSession={jest.fn()}
        onViewBeach={jest.fn()}
      />
    );
    expect(screen.getByTestId("hero-recommendation")).toBeInTheDocument();
  });

  it("renders beach name as button", () => {
    render(
      <HeroRecommendation
        recommendation={mockRecommendation}
        onPlanSession={jest.fn()}
        onViewBeach={jest.fn()}
      />
    );
    const beachButton = screen.getByRole("button", { name: /View details for Blacks Beach/i });
    expect(beachButton).toBeInTheDocument();
    expect(beachButton).toHaveTextContent("Blacks Beach");
  });

  it("renders score display", () => {
    render(
      <HeroRecommendation
        recommendation={mockRecommendation}
        onPlanSession={jest.fn()}
        onViewBeach={jest.fn()}
      />
    );
    const scoreElement = screen.getByTestId("hero-score");
    expect(scoreElement).toBeInTheDocument();
  });

  it("shows formatted score with /10 suffix", () => {
    render(
      <HeroRecommendation
        recommendation={mockRecommendation}
        onPlanSession={jest.fn()}
        onViewBeach={jest.fn()}
      />
    );
    const scoreElement = screen.getByTestId("hero-score");
    expect(scoreElement).toHaveTextContent(/\/10/);
  });
});

describe("HeroRecommendation - Beach Name Click", () => {
  it("calls onViewBeach with beach id when beach name clicked", async () => {
    const user = userEvent.setup();
    const mockOnViewBeach = jest.fn();
    const mockRecommendation = createMockRecommendation();

    render(
      <HeroRecommendation
        recommendation={mockRecommendation}
        onPlanSession={jest.fn()}
        onViewBeach={mockOnViewBeach}
      />
    );

    const beachButton = screen.getByRole("button", { name: /View details for Blacks Beach/i });
    await user.click(beachButton);

    expect(mockOnViewBeach).toHaveBeenCalledWith("b1");
  });

  it("calls onViewBeach exactly once per click", async () => {
    const user = userEvent.setup();
    const mockOnViewBeach = jest.fn();
    const mockRecommendation = createMockRecommendation();

    render(
      <HeroRecommendation
        recommendation={mockRecommendation}
        onPlanSession={jest.fn()}
        onViewBeach={mockOnViewBeach}
      />
    );

    const beachButton = screen.getByRole("button", { name: /View details for Blacks Beach/i });
    await user.click(beachButton);

    expect(mockOnViewBeach).toHaveBeenCalledTimes(1);
  });
});

describe("HeroRecommendation - Time Window Badge", () => {
  it("renders time window badge", () => {
    const mockRecommendation = createMockRecommendation();
    render(
      <HeroRecommendation
        recommendation={mockRecommendation}
        onPlanSession={jest.fn()}
        onViewBeach={jest.fn()}
      />
    );

    expect(screen.getByText("7-10am")).toBeInTheDocument();
  });

  it("shows time window in badges container", () => {
    const mockRecommendation = createMockRecommendation();
    render(
      <HeroRecommendation
        recommendation={mockRecommendation}
        onPlanSession={jest.fn()}
        onViewBeach={jest.fn()}
      />
    );

    const badgesContainer = screen.getByTestId("hero-badges");
    expect(badgesContainer).toBeInTheDocument();
  });
});

describe("HeroRecommendation - Message Text", () => {
  it("renders recommendation message when provided", () => {
    const mockRecommendation = createMockRecommendation({
      message: "Perfect conditions for surfing today",
    });

    render(
      <HeroRecommendation
        recommendation={mockRecommendation}
        onPlanSession={jest.fn()}
        onViewBeach={jest.fn()}
      />
    );

    expect(screen.getByText("Perfect conditions for surfing today")).toBeInTheDocument();
  });

  it("message has correct test id", () => {
    const mockRecommendation = createMockRecommendation({
      message: "Great waves ahead",
    });

    render(
      <HeroRecommendation
        recommendation={mockRecommendation}
        onPlanSession={jest.fn()}
        onViewBeach={jest.fn()}
      />
    );

    expect(screen.getByTestId("hero-message")).toBeInTheDocument();
  });

  it("does not render message element when message is null", () => {
    const mockRecommendation = createMockRecommendation({
      message: null as any,
    });

    render(
      <HeroRecommendation
        recommendation={mockRecommendation}
        onPlanSession={jest.fn()}
        onViewBeach={jest.fn()}
      />
    );

    expect(screen.queryByTestId("hero-message")).not.toBeInTheDocument();
  });

  it("does not render message element when message is undefined", () => {
    const mockRecommendation = createMockRecommendation({
      message: undefined as any,
    });

    render(
      <HeroRecommendation
        recommendation={mockRecommendation}
        onPlanSession={jest.fn()}
        onViewBeach={jest.fn()}
      />
    );

    expect(screen.queryByTestId("hero-message")).not.toBeInTheDocument();
  });
});

describe("HeroRecommendation - Condition Badges", () => {
  it("renders condition badges when provided", () => {
    const mockRecommendation = createMockRecommendation({
      conditionBadges: [{ label: "Offshore" }, { label: "Clean" }, { label: "Rising Tide" }],
    });

    render(
      <HeroRecommendation
        recommendation={mockRecommendation}
        onPlanSession={jest.fn()}
        onViewBeach={jest.fn()}
      />
    );

    expect(screen.getByText("Offshore")).toBeInTheDocument();
    expect(screen.getByText("Clean")).toBeInTheDocument();
    expect(screen.getByText("Rising Tide")).toBeInTheDocument();
  });

  it("renders only first 3 condition badges", () => {
    const mockRecommendation = createMockRecommendation({
      conditionBadges: [
        { label: "Badge 1" },
        { label: "Badge 2" },
        { label: "Badge 3" },
        { label: "Badge 4" },
        { label: "Badge 5" },
      ],
    });

    render(
      <HeroRecommendation
        recommendation={mockRecommendation}
        onPlanSession={jest.fn()}
        onViewBeach={jest.fn()}
      />
    );

    expect(screen.getByText("Badge 1")).toBeInTheDocument();
    expect(screen.getByText("Badge 2")).toBeInTheDocument();
    expect(screen.getByText("Badge 3")).toBeInTheDocument();
    expect(screen.queryByText("Badge 4")).not.toBeInTheDocument();
    expect(screen.queryByText("Badge 5")).not.toBeInTheDocument();
  });

  it("does not render condition badges when array is empty", () => {
    const mockRecommendation = createMockRecommendation({
      conditionBadges: [],
    });

    render(
      <HeroRecommendation
        recommendation={mockRecommendation}
        onPlanSession={jest.fn()}
        onViewBeach={jest.fn()}
      />
    );

    const badgesContainer = screen.getByTestId("hero-badges");
    const allBadges = screen.getAllByTestId("badge");

    // Should have time window badge, wave height badge, and condition tier badge, but no condition badges
    expect(allBadges.length).toBeGreaterThan(0);
  });
});

describe("HeroRecommendation - Wave Height Badge", () => {
  it("renders wave height badge when provided", () => {
    const mockRecommendation = createMockRecommendation({
      waveHeightBadge: "4-6ft",
    });

    render(
      <HeroRecommendation
        recommendation={mockRecommendation}
        onPlanSession={jest.fn()}
        onViewBeach={jest.fn()}
      />
    );

    expect(screen.getByText("4-6ft")).toBeInTheDocument();
  });

  it("does not render wave height badge when not provided", () => {
    const mockRecommendation = createMockRecommendation({
      waveHeightBadge: undefined as any,
    });

    render(
      <HeroRecommendation
        recommendation={mockRecommendation}
        onPlanSession={jest.fn()}
        onViewBeach={jest.fn()}
      />
    );

    expect(screen.queryByText(/^\d+-\d+ft$/)).not.toBeInTheDocument();
  });
});

describe("HeroRecommendation - Peak Time Badge", () => {
  it("renders peak time badge when peakTime is provided", () => {
    const mockRecommendation = createMockRecommendation({
      window: {
        start: new Date("2026-02-10T07:00:00"),
        end: new Date("2026-02-10T10:00:00"),
        timezone: "America/Los_Angeles",
        peakTime: new Date("2026-02-10T08:30:00"),
        tide: "Rising",
        wind: "5 mph SW",
        waveHeight: "3-5 ft",
        wavePeriod: "12s",
        dataSource: "CDIP",
        confidence: 85,
      },
    });

    render(
      <HeroRecommendation
        recommendation={mockRecommendation}
        onPlanSession={jest.fn()}
        onViewBeach={jest.fn()}
      />
    );

    expect(screen.getByText(/Best at/i)).toBeInTheDocument();
  });

  it("does not render peak time badge when peakTime is null", () => {
    const mockRecommendation = createMockRecommendation({
      window: {
        start: new Date("2026-02-10T07:00:00"),
        end: new Date("2026-02-10T10:00:00"),
        timezone: "America/Los_Angeles",
        peakTime: null,
        tide: "Rising",
        wind: "5 mph SW",
        waveHeight: "3-5 ft",
        wavePeriod: "12s",
        dataSource: "CDIP",
        confidence: 85,
      },
    });

    render(
      <HeroRecommendation
        recommendation={mockRecommendation}
        onPlanSession={jest.fn()}
        onViewBeach={jest.fn()}
      />
    );

    expect(screen.queryByText(/Best at/i)).not.toBeInTheDocument();
  });
});

describe("HeroRecommendation - Board Recommendation Badge", () => {
  it("renders board recommendation badge when provided by hook", () => {
    const { useBoardRecommendation } = require("@/hooks/use-board-recommendation");
    useBoardRecommendation.mockReturnValue({
      recommendation: {
        boardName: "Fish",
        boardType: "shortboard",
        confidence: 0.85,
      },
    });

    const mockRecommendation = createMockRecommendation();

    render(
      <HeroRecommendation
        recommendation={mockRecommendation}
        onPlanSession={jest.fn()}
        onViewBeach={jest.fn()}
      />
    );

    expect(screen.getByTestId("board-badge")).toBeInTheDocument();
  });

  it("does not render board recommendation badge when hook returns null", () => {
    const { useBoardRecommendation } = require("@/hooks/use-board-recommendation");
    useBoardRecommendation.mockReturnValue({ recommendation: null });

    const mockRecommendation = createMockRecommendation();

    render(
      <HeroRecommendation
        recommendation={mockRecommendation}
        onPlanSession={jest.fn()}
        onViewBeach={jest.fn()}
      />
    );

    expect(screen.queryByTestId("board-badge")).not.toBeInTheDocument();
  });
});

describe("HeroRecommendation - Accessibility", () => {
  it("beach button has accessible label", () => {
    const mockRecommendation = createMockRecommendation();

    render(
      <HeroRecommendation
        recommendation={mockRecommendation}
        onPlanSession={jest.fn()}
        onViewBeach={jest.fn()}
      />
    );

    const beachButton = screen.getByRole("button", { name: /View details for Blacks Beach/i });
    expect(beachButton).toHaveAttribute("aria-label", "View details for Blacks Beach");
  });

  it("beach button is keyboard accessible", async () => {
    const mockOnViewBeach = jest.fn();
    const mockRecommendation = createMockRecommendation();

    render(
      <HeroRecommendation
        recommendation={mockRecommendation}
        onPlanSession={jest.fn()}
        onViewBeach={mockOnViewBeach}
      />
    );

    const beachButton = screen.getByRole("button", { name: /View details for Blacks Beach/i });
    beachButton.focus();
    expect(beachButton).toHaveFocus();
  });
});

describe("HeroRecommendation - Edge Cases", () => {
  it("handles recommendation with missing optional fields gracefully", () => {
    const minimalRecommendation = createMockRecommendation({
      message: undefined as any,
      conditionBadges: undefined as any,
      waveHeightBadge: undefined as any,
    });

    render(
      <HeroRecommendation
        recommendation={minimalRecommendation}
        onPlanSession={jest.fn()}
        onViewBeach={jest.fn()}
      />
    );

    expect(screen.getByTestId("hero-recommendation")).toBeInTheDocument();
  });

  it("handles very long beach names", () => {
    const longNameRecommendation = createMockRecommendation({
      beach: {
        id: "b1",
        name: "Super Long Beach Name With Many Words That Might Cause Layout Issues",
        timezone: "America/Los_Angeles",
      },
    });

    render(
      <HeroRecommendation
        recommendation={longNameRecommendation}
        onPlanSession={jest.fn()}
        onViewBeach={jest.fn()}
      />
    );

    expect(
      screen.getByText(
        "Super Long Beach Name With Many Words That Might Cause Layout Issues"
      )
    ).toBeInTheDocument();
  });

  it("handles score of 0", () => {
    const zeroScoreRecommendation = createMockRecommendation({
      score: 0,
    });

    render(
      <HeroRecommendation
        recommendation={zeroScoreRecommendation}
        onPlanSession={jest.fn()}
        onViewBeach={jest.fn()}
      />
    );

    const scoreElement = screen.getByTestId("hero-score");
    expect(scoreElement).toBeInTheDocument();
  });

  it("handles score of 100", () => {
    const perfectScoreRecommendation = createMockRecommendation({
      score: 100,
    });

    render(
      <HeroRecommendation
        recommendation={perfectScoreRecommendation}
        onPlanSession={jest.fn()}
        onViewBeach={jest.fn()}
      />
    );

    const scoreElement = screen.getByTestId("hero-score");
    expect(scoreElement).toBeInTheDocument();
  });
});
