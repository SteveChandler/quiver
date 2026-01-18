import { render, screen } from "@testing-library/react";
import { HeroRecommendation } from "@/components/home-screen/hero-recommendation";

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
