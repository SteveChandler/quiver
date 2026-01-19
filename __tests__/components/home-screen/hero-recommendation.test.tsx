import { render, screen } from "@testing-library/react";
import {
  HeroRecommendation,
  getConditionTier,
  getScoreColorClass,
  getConditionBadge,
  type ConditionTier,
} from "@/components/home-screen/hero-recommendation";

// Mock framer-motion
jest.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    h1: ({ children, ...props }: any) => <h1 {...props}>{children}</h1>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
    span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
  },
  AnimatePresence: ({ children }: any) => children,
  useReducedMotion: () => false,
}));

describe("HeroRecommendation", () => {
  const mockRecommendation = {
    beach: { id: "test-beach", name: "Trestles" },
    score: 85,
    window: {
      start: new Date("2026-01-17T07:00:00"),
      end: new Date("2026-01-17T10:00:00"),
      timezone: "America/Los_Angeles",
    },
    matchQuality: "good",
    recommendationLabel: "Great conditions",
    message: "Clean waves with light offshore winds",
    waveHeightBadge: "2-3ft",
    conditionBadges: [
      { label: "Clean" },
      { label: "Offshore" },
    ],
  } as any;

  const defaultProps = {
    recommendation: mockRecommendation,
    onPlanSession: jest.fn(),
    onViewBeach: jest.fn(),
  };

  it("renders the beach name", () => {
    render(<HeroRecommendation {...defaultProps} />);

    expect(screen.getByText("Trestles")).toBeInTheDocument();
  });

  it("renders the score with glow class", () => {
    render(<HeroRecommendation {...defaultProps} />);

    const scoreElement = screen.getByTestId("hero-score");
    expect(scoreElement).toBeInTheDocument();
    expect(scoreElement.className).toMatch(/text-accent-orange/);
  });

  it("renders condition badges", () => {
    render(<HeroRecommendation {...defaultProps} />);

    expect(screen.getByText("Clean")).toBeInTheDocument();
    expect(screen.getByText("Offshore")).toBeInTheDocument();
  });

  it("renders loading skeleton when loading", () => {
    render(<HeroRecommendation {...defaultProps} recommendation={null} loading />);

    expect(screen.getByTestId("hero-recommendation-loading")).toBeInTheDocument();
  });

  it("renders empty state when no recommendation", () => {
    render(<HeroRecommendation {...defaultProps} recommendation={null} />);

    expect(screen.getByTestId("hero-recommendation-empty")).toBeInTheDocument();
  });

  it("has badge container with stagger animation data attribute", () => {
    render(<HeroRecommendation {...defaultProps} />);

    expect(screen.getByTestId("hero-badges")).toBeInTheDocument();
  });

  it("renders wave height badge when provided", () => {
    render(
      <HeroRecommendation
        recommendation={mockRecommendation}
        onPlanSession={jest.fn()}
        onViewBeach={jest.fn()}
      />
    );

    expect(screen.getByText("2-3ft")).toBeInTheDocument();
  });

  it("does not render wave height badge when not provided", () => {
    const recWithoutWaveHeight = {
      ...mockRecommendation,
      waveHeightBadge: undefined,
    };

    render(
      <HeroRecommendation
        recommendation={recWithoutWaveHeight}
        onPlanSession={jest.fn()}
        onViewBeach={jest.fn()}
      />
    );

    expect(screen.queryByText(/^\d+-\d+ft$/)).not.toBeInTheDocument();
  });
});

describe("getConditionTier", () => {
  it("returns 'great' for scores >= 80", () => {
    expect(getConditionTier(80)).toBe("great");
    expect(getConditionTier(85)).toBe("great");
    expect(getConditionTier(100)).toBe("great");
  });

  it("returns 'good' for scores 60-79", () => {
    expect(getConditionTier(60)).toBe("good");
    expect(getConditionTier(70)).toBe("good");
    expect(getConditionTier(79)).toBe("good");
  });

  it("returns 'fair' for scores 40-59", () => {
    expect(getConditionTier(40)).toBe("fair");
    expect(getConditionTier(50)).toBe("fair");
    expect(getConditionTier(59)).toBe("fair");
  });

  it("returns 'marginal' for scores < 40", () => {
    expect(getConditionTier(0)).toBe("marginal");
    expect(getConditionTier(20)).toBe("marginal");
    expect(getConditionTier(39)).toBe("marginal");
  });
});

describe("getScoreColorClass", () => {
  it("returns text-accent-orange for great tier", () => {
    expect(getScoreColorClass("great")).toBe("text-accent-orange");
  });

  it("returns text-accent-orange for good tier", () => {
    expect(getScoreColorClass("good")).toBe("text-accent-orange");
  });

  it("returns text-amber-400 for fair tier", () => {
    expect(getScoreColorClass("fair")).toBe("text-amber-400");
  });

  it("returns text-white/60 for marginal tier", () => {
    expect(getScoreColorClass("marginal")).toBe("text-white/60");
  });
});

describe("getConditionBadge", () => {
  it("returns Great Conditions badge for great tier", () => {
    const badge = getConditionBadge("great");
    expect(badge).toEqual({
      label: "Great Conditions",
      className: "bg-emerald-500/20 text-emerald-300 border-emerald-400/30",
    });
  });

  it("returns null for good tier", () => {
    expect(getConditionBadge("good")).toBeNull();
  });

  it("returns Fair Conditions badge for fair tier", () => {
    const badge = getConditionBadge("fair");
    expect(badge).toEqual({
      label: "Fair Conditions",
      className: "bg-amber-500/20 text-amber-300 border-amber-400/30",
    });
  });

  it("returns Marginal badge for marginal tier", () => {
    const badge = getConditionBadge("marginal");
    expect(badge).toEqual({
      label: "Marginal",
      className: "bg-white/10 text-white/60 border-white/20",
    });
  });
});
