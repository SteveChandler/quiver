import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import { TopSpotsCarousel } from "@/components/home-screen/top-spots-carousel";
import type { SurfDiscoveryRecommendation, TimeSlot } from "@/types/personalization";

// Mock utilities
jest.mock("@/lib/utils", () => ({
  cn: jest.fn((...args: any[]) => args.flat().filter(Boolean).join(" ")),
}));

jest.mock("@/lib/utils/time-formatters", () => ({
  getWindowDayLabel: jest.fn(() => "today"),
}));

// Mock CompactSpotCard component
jest.mock("@/components/home-screen/compact-spot-card", () => ({
  CompactSpotCard: ({ recommendation, onTap, featured }: any) => (
    <div
      data-testid="spot-card"
      data-beach-id={recommendation.beach.id}
      data-featured={featured}
      onClick={() => onTap(recommendation.beach.id)}
      role="button"
    >
      {recommendation.beach.name}
    </div>
  ),
  CompactSpotCardSkeleton: () => <div data-testid="spot-card-skeleton" />,
}));

/**
 * Mock recommendation factory
 */
function createMockRecommendation(
  id: string,
  name: string,
  score: number
): SurfDiscoveryRecommendation {
  return {
    beach: {
      id,
      name,
      timezone: "America/Los_Angeles",
    },
    score,
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
    forecast: {
      wave_height: "4.5",
      wind_speed: "5",
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
    summary: "Great conditions",
    reasons: ["Offshore wind"],
    warnings: [],
    generated_at: "2026-02-10T00:00:00Z",
  } as unknown as SurfDiscoveryRecommendation;
}

describe("TopSpotsCarousel - Loading State", () => {
  it("shows skeleton cards when loading", () => {
    render(
      <TopSpotsCarousel
        spots={[]}
        loading={true}
        onPlanSession={jest.fn()}
        onViewSpot={jest.fn()}
      />
    );

    const skeletons = screen.getAllByTestId("spot-card-skeleton");
    expect(skeletons).toHaveLength(3);
  });

  it("displays section title when loading", () => {
    render(
      <TopSpotsCarousel
        spots={[]}
        loading={true}
        onPlanSession={jest.fn()}
        onViewSpot={jest.fn()}
      />
    );

    expect(screen.getByText("Your Top Spots")).toBeInTheDocument();
  });

  it("does not show real spot cards when loading", () => {
    render(
      <TopSpotsCarousel
        spots={[]}
        loading={true}
        onPlanSession={jest.fn()}
        onViewSpot={jest.fn()}
      />
    );

    expect(screen.queryByTestId("spot-card")).not.toBeInTheDocument();
  });
});

describe("TopSpotsCarousel - Empty State", () => {
  it("shows empty state message when no spots", () => {
    render(
      <TopSpotsCarousel
        spots={[]}
        loading={false}
        onPlanSession={jest.fn()}
        onViewSpot={jest.fn()}
      />
    );

    expect(screen.getByText("No spots found yet")).toBeInTheDocument();
  });

  it("shows check back message in empty state", () => {
    render(
      <TopSpotsCarousel
        spots={[]}
        loading={false}
        onPlanSession={jest.fn()}
        onViewSpot={jest.fn()}
      />
    );

    expect(screen.getByText(/Check back soon for personalized recommendations/i)).toBeInTheDocument();
  });

  it("does not show spot cards in empty state", () => {
    render(
      <TopSpotsCarousel
        spots={[]}
        loading={false}
        onPlanSession={jest.fn()}
        onViewSpot={jest.fn()}
      />
    );

    expect(screen.queryByTestId("spot-card")).not.toBeInTheDocument();
  });

  it("does not show skeleton in empty state", () => {
    render(
      <TopSpotsCarousel
        spots={[]}
        loading={false}
        onPlanSession={jest.fn()}
        onViewSpot={jest.fn()}
      />
    );

    expect(screen.queryByTestId("spot-card-skeleton")).not.toBeInTheDocument();
  });
});

describe("TopSpotsCarousel - Empty State with Location CTA", () => {
  it("shows location CTA message when showLocationCta is true", () => {
    render(
      <TopSpotsCarousel
        spots={[]}
        loading={false}
        onPlanSession={jest.fn()}
        onViewSpot={jest.fn()}
        showLocationCta={true}
      />
    );

    expect(screen.getByText(/Share your location to discover nearby surf spots/i)).toBeInTheDocument();
  });

  it("shows Use My Location button when showLocationCta is true", () => {
    render(
      <TopSpotsCarousel
        spots={[]}
        loading={false}
        onPlanSession={jest.fn()}
        onViewSpot={jest.fn()}
        showLocationCta={true}
        onUseMyLocation={jest.fn()}
      />
    );

    expect(screen.getByRole("button", { name: /Use My Location/i })).toBeInTheDocument();
  });

  it("does not show Use My Location button when showLocationCta is false", () => {
    render(
      <TopSpotsCarousel
        spots={[]}
        loading={false}
        onPlanSession={jest.fn()}
        onViewSpot={jest.fn()}
        showLocationCta={false}
      />
    );

    expect(screen.queryByRole("button", { name: /Use My Location/i })).not.toBeInTheDocument();
  });

  it("does not show Use My Location button when onUseMyLocation is not provided", () => {
    render(
      <TopSpotsCarousel
        spots={[]}
        loading={false}
        onPlanSession={jest.fn()}
        onViewSpot={jest.fn()}
        showLocationCta={true}
      />
    );

    expect(screen.queryByRole("button", { name: /Use My Location/i })).not.toBeInTheDocument();
  });
});

describe("TopSpotsCarousel - Location Button Click", () => {
  it("calls onUseMyLocation when button clicked", async () => {
    const user = userEvent.setup();
    const mockOnUseMyLocation = jest.fn();

    render(
      <TopSpotsCarousel
        spots={[]}
        loading={false}
        onPlanSession={jest.fn()}
        onViewSpot={jest.fn()}
        showLocationCta={true}
        onUseMyLocation={mockOnUseMyLocation}
      />
    );

    const locationButton = screen.getByRole("button", { name: /Use My Location/i });
    await user.click(locationButton);

    expect(mockOnUseMyLocation).toHaveBeenCalled();
  });

  it("calls onUseMyLocation exactly once per click", async () => {
    const user = userEvent.setup();
    const mockOnUseMyLocation = jest.fn();

    render(
      <TopSpotsCarousel
        spots={[]}
        loading={false}
        onPlanSession={jest.fn()}
        onViewSpot={jest.fn()}
        showLocationCta={true}
        onUseMyLocation={mockOnUseMyLocation}
      />
    );

    const locationButton = screen.getByRole("button", { name: /Use My Location/i });
    await user.click(locationButton);

    expect(mockOnUseMyLocation).toHaveBeenCalledTimes(1);
  });
});

describe("TopSpotsCarousel - Location Loading State", () => {
  it("shows Detecting... text when location is loading", () => {
    render(
      <TopSpotsCarousel
        spots={[]}
        loading={false}
        onPlanSession={jest.fn()}
        onViewSpot={jest.fn()}
        showLocationCta={true}
        onUseMyLocation={jest.fn()}
        locationLoading={true}
      />
    );

    expect(screen.getByText("Detecting...")).toBeInTheDocument();
  });

  it("disables button when location is loading", () => {
    render(
      <TopSpotsCarousel
        spots={[]}
        loading={false}
        onPlanSession={jest.fn()}
        onViewSpot={jest.fn()}
        showLocationCta={true}
        onUseMyLocation={jest.fn()}
        locationLoading={true}
      />
    );

    const locationButton = screen.getByRole("button", { name: /Detecting/i });
    expect(locationButton).toBeDisabled();
  });

  it("shows Use My Location text when not loading", () => {
    render(
      <TopSpotsCarousel
        spots={[]}
        loading={false}
        onPlanSession={jest.fn()}
        onViewSpot={jest.fn()}
        showLocationCta={true}
        onUseMyLocation={jest.fn()}
        locationLoading={false}
      />
    );

    expect(screen.getByText("Use My Location")).toBeInTheDocument();
  });

  it("enables button when not loading", () => {
    render(
      <TopSpotsCarousel
        spots={[]}
        loading={false}
        onPlanSession={jest.fn()}
        onViewSpot={jest.fn()}
        showLocationCta={true}
        onUseMyLocation={jest.fn()}
        locationLoading={false}
      />
    );

    const locationButton = screen.getByRole("button", { name: /Use My Location/i });
    expect(locationButton).not.toBeDisabled();
  });
});

describe("TopSpotsCarousel - Normal Render", () => {
  const mockSpots = [
    createMockRecommendation("b1", "Blacks", 8.5),
    createMockRecommendation("b2", "Windansea", 7.8),
    createMockRecommendation("b3", "La Jolla Shores", 7.2),
  ];

  it("renders carousel with correct test id", () => {
    render(
      <TopSpotsCarousel
        spots={mockSpots}
        loading={false}
        onPlanSession={jest.fn()}
        onViewSpot={jest.fn()}
      />
    );

    expect(screen.getByTestId("top-spots-carousel")).toBeInTheDocument();
  });

  it("renders CompactSpotCard for each spot", () => {
    render(
      <TopSpotsCarousel
        spots={mockSpots}
        loading={false}
        onPlanSession={jest.fn()}
        onViewSpot={jest.fn()}
      />
    );

    const spotCards = screen.getAllByTestId("spot-card");
    expect(spotCards).toHaveLength(3);
  });

  it("renders spots in correct order", () => {
    render(
      <TopSpotsCarousel
        spots={mockSpots}
        loading={false}
        onPlanSession={jest.fn()}
        onViewSpot={jest.fn()}
      />
    );

    const spotCards = screen.getAllByTestId("spot-card");
    expect(spotCards[0]).toHaveTextContent("Blacks");
    expect(spotCards[1]).toHaveTextContent("Windansea");
    expect(spotCards[2]).toHaveTextContent("La Jolla Shores");
  });

  it("does not show loading skeleton when spots are loaded", () => {
    render(
      <TopSpotsCarousel
        spots={mockSpots}
        loading={false}
        onPlanSession={jest.fn()}
        onViewSpot={jest.fn()}
      />
    );

    expect(screen.queryByTestId("spot-card-skeleton")).not.toBeInTheDocument();
  });

  it("does not show empty state when spots are loaded", () => {
    render(
      <TopSpotsCarousel
        spots={mockSpots}
        loading={false}
        onPlanSession={jest.fn()}
        onViewSpot={jest.fn()}
      />
    );

    expect(screen.queryByText("No spots found yet")).not.toBeInTheDocument();
  });
});

describe("TopSpotsCarousel - First Card Featured", () => {
  const mockSpots = [
    createMockRecommendation("b1", "Blacks", 8.5),
    createMockRecommendation("b2", "Windansea", 7.8),
  ];

  it("first card has featured attribute set to true", () => {
    render(
      <TopSpotsCarousel
        spots={mockSpots}
        loading={false}
        onPlanSession={jest.fn()}
        onViewSpot={jest.fn()}
      />
    );

    const spotCards = screen.getAllByTestId("spot-card");
    expect(spotCards[0]).toHaveAttribute("data-featured", "true");
  });

  it("second card does not have featured attribute", () => {
    render(
      <TopSpotsCarousel
        spots={mockSpots}
        loading={false}
        onPlanSession={jest.fn()}
        onViewSpot={jest.fn()}
      />
    );

    const spotCards = screen.getAllByTestId("spot-card");
    expect(spotCards[1]).toHaveAttribute("data-featured", "false");
  });

  it("only first card is featured when multiple spots", () => {
    const manySpots = [
      createMockRecommendation("b1", "Spot 1", 8.5),
      createMockRecommendation("b2", "Spot 2", 7.8),
      createMockRecommendation("b3", "Spot 3", 7.2),
      createMockRecommendation("b4", "Spot 4", 6.9),
    ];

    render(
      <TopSpotsCarousel
        spots={manySpots}
        loading={false}
        onPlanSession={jest.fn()}
        onViewSpot={jest.fn()}
      />
    );

    const spotCards = screen.getAllByTestId("spot-card");
    expect(spotCards[0]).toHaveAttribute("data-featured", "true");
    expect(spotCards[1]).toHaveAttribute("data-featured", "false");
    expect(spotCards[2]).toHaveAttribute("data-featured", "false");
    expect(spotCards[3]).toHaveAttribute("data-featured", "false");
  });
});

describe("TopSpotsCarousel - Carousel Title", () => {
  const mockSpots = [createMockRecommendation("b1", "Blacks", 8.5)];

  it("displays default section title", () => {
    render(
      <TopSpotsCarousel
        spots={mockSpots}
        loading={false}
        onPlanSession={jest.fn()}
        onViewSpot={jest.fn()}
      />
    );

    expect(screen.getByText("Your Top Spots")).toBeInTheDocument();
  });

  it("displays dynamic title with day label when heroWindow provided", () => {
    const { getWindowDayLabel } = require("@/lib/utils/time-formatters");
    getWindowDayLabel.mockReturnValue("tomorrow");

    render(
      <TopSpotsCarousel
        spots={mockSpots}
        loading={false}
        onPlanSession={jest.fn()}
        onViewSpot={jest.fn()}
        heroWindow={{
          start: new Date("2026-02-11T07:00:00"),
          end: new Date("2026-02-11T10:00:00"),
          timezone: "America/Los_Angeles",
          peakTime: null,
          tide: "Rising",
          wind: "5 mph SW",
          waveHeight: "3-5 ft",
          wavePeriod: "12s",
          dataSource: "CDIP",
          confidence: 85,
        }}
      />
    );

    expect(screen.getByText("Top spots for tomorrow")).toBeInTheDocument();
  });
});

describe("TopSpotsCarousel - Spot Card Click", () => {
  const mockSpots = [
    createMockRecommendation("b1", "Blacks", 8.5),
    createMockRecommendation("b2", "Windansea", 7.8),
  ];

  it("calls onViewSpot with beach id when card clicked", async () => {
    const user = userEvent.setup();
    const mockOnViewSpot = jest.fn();

    render(
      <TopSpotsCarousel
        spots={mockSpots}
        loading={false}
        onPlanSession={jest.fn()}
        onViewSpot={mockOnViewSpot}
      />
    );

    const firstCard = screen.getByText("Blacks");
    await user.click(firstCard);

    expect(mockOnViewSpot).toHaveBeenCalledWith("b1");
  });

  it("calls onViewSpot with correct beach id for different cards", async () => {
    const user = userEvent.setup();
    const mockOnViewSpot = jest.fn();

    render(
      <TopSpotsCarousel
        spots={mockSpots}
        loading={false}
        onPlanSession={jest.fn()}
        onViewSpot={mockOnViewSpot}
      />
    );

    const secondCard = screen.getByText("Windansea");
    await user.click(secondCard);

    expect(mockOnViewSpot).toHaveBeenCalledWith("b2");
  });

  it("calls onViewSpot exactly once per click", async () => {
    const user = userEvent.setup();
    const mockOnViewSpot = jest.fn();

    render(
      <TopSpotsCarousel
        spots={mockSpots}
        loading={false}
        onPlanSession={jest.fn()}
        onViewSpot={mockOnViewSpot}
      />
    );

    const firstCard = screen.getByText("Blacks");
    await user.click(firstCard);

    expect(mockOnViewSpot).toHaveBeenCalledTimes(1);
  });
});

describe("TopSpotsCarousel - Fade Indicator", () => {
  it("shows fade indicator when more than 2 spots", () => {
    const mockSpots = [
      createMockRecommendation("b1", "Blacks", 8.5),
      createMockRecommendation("b2", "Windansea", 7.8),
      createMockRecommendation("b3", "La Jolla Shores", 7.2),
    ];

    const { container } = render(
      <TopSpotsCarousel
        spots={mockSpots}
        loading={false}
        onPlanSession={jest.fn()}
        onViewSpot={jest.fn()}
      />
    );

    const fadeIndicator = container.querySelector(".bg-gradient-to-l");
    expect(fadeIndicator).toBeInTheDocument();
  });

  it("does not show fade indicator when 2 or fewer spots", () => {
    const mockSpots = [
      createMockRecommendation("b1", "Blacks", 8.5),
      createMockRecommendation("b2", "Windansea", 7.8),
    ];

    const { container } = render(
      <TopSpotsCarousel
        spots={mockSpots}
        loading={false}
        onPlanSession={jest.fn()}
        onViewSpot={jest.fn()}
      />
    );

    const fadeIndicator = container.querySelector(".bg-gradient-to-l");
    expect(fadeIndicator).not.toBeInTheDocument();
  });

  it("does not show fade indicator when only 1 spot", () => {
    const mockSpots = [createMockRecommendation("b1", "Blacks", 8.5)];

    const { container } = render(
      <TopSpotsCarousel
        spots={mockSpots}
        loading={false}
        onPlanSession={jest.fn()}
        onViewSpot={jest.fn()}
      />
    );

    const fadeIndicator = container.querySelector(".bg-gradient-to-l");
    expect(fadeIndicator).not.toBeInTheDocument();
  });
});

describe("TopSpotsCarousel - Time Slot Context", () => {
  const mockSpots = [createMockRecommendation("b1", "Blacks", 8.5)];

  it("shows context chip when timeSlot is dawn-patrol", () => {
    render(
      <TopSpotsCarousel
        spots={mockSpots}
        loading={false}
        onPlanSession={jest.fn()}
        onViewSpot={jest.fn()}
        timeSlot="dawn-patrol"
      />
    );

    expect(screen.getByTestId("top-spots-context")).toBeInTheDocument();
    expect(screen.getByText("Dawn patrol")).toBeInTheDocument();
  });

  it("shows context chip when timeSlot is lunch-session", () => {
    render(
      <TopSpotsCarousel
        spots={mockSpots}
        loading={false}
        onPlanSession={jest.fn()}
        onViewSpot={jest.fn()}
        timeSlot="lunch-session"
      />
    );

    expect(screen.getByTestId("top-spots-context")).toBeInTheDocument();
    expect(screen.getByText("Lunch session")).toBeInTheDocument();
  });

  it("shows context chip when timeSlot is afternoon", () => {
    render(
      <TopSpotsCarousel
        spots={mockSpots}
        loading={false}
        onPlanSession={jest.fn()}
        onViewSpot={jest.fn()}
        timeSlot="afternoon"
      />
    );

    expect(screen.getByTestId("top-spots-context")).toBeInTheDocument();
    expect(screen.getByText("Afternoon")).toBeInTheDocument();
  });

  it("shows context chip when timeSlot is any", () => {
    render(
      <TopSpotsCarousel
        spots={mockSpots}
        loading={false}
        onPlanSession={jest.fn()}
        onViewSpot={jest.fn()}
        timeSlot="any"
      />
    );

    expect(screen.getByTestId("top-spots-context")).toBeInTheDocument();
    expect(screen.getByText("Any time")).toBeInTheDocument();
  });

  it("does not show context chip when timeSlot is not provided", () => {
    render(
      <TopSpotsCarousel
        spots={mockSpots}
        loading={false}
        onPlanSession={jest.fn()}
        onViewSpot={jest.fn()}
      />
    );

    expect(screen.queryByTestId("top-spots-context")).not.toBeInTheDocument();
  });
});

describe("TopSpotsCarousel - Edge Cases", () => {
  it("handles single spot gracefully", () => {
    const singleSpot = [createMockRecommendation("b1", "Blacks", 8.5)];

    render(
      <TopSpotsCarousel
        spots={singleSpot}
        loading={false}
        onPlanSession={jest.fn()}
        onViewSpot={jest.fn()}
      />
    );

    const spotCards = screen.getAllByTestId("spot-card");
    expect(spotCards).toHaveLength(1);
    expect(spotCards[0]).toHaveAttribute("data-featured", "true");
  });

  it("handles many spots (more than 10)", () => {
    const manySpots = Array.from({ length: 15 }, (_, i) =>
      createMockRecommendation(`b${i + 1}`, `Spot ${i + 1}`, 8.5 - i * 0.2)
    );

    render(
      <TopSpotsCarousel
        spots={manySpots}
        loading={false}
        onPlanSession={jest.fn()}
        onViewSpot={jest.fn()}
      />
    );

    const spotCards = screen.getAllByTestId("spot-card");
    expect(spotCards).toHaveLength(15);
  });

  it("handles spots with very long names", () => {
    const longNameSpots = [
      createMockRecommendation(
        "b1",
        "Super Long Beach Name With Many Words That Might Cause Layout Issues",
        8.5
      ),
    ];

    render(
      <TopSpotsCarousel
        spots={longNameSpots}
        loading={false}
        onPlanSession={jest.fn()}
        onViewSpot={jest.fn()}
      />
    );

    expect(
      screen.getByText(
        "Super Long Beach Name With Many Words That Might Cause Layout Issues"
      )
    ).toBeInTheDocument();
  });

  it("handles null spots array as empty", () => {
    render(
      <TopSpotsCarousel
        spots={null as any}
        loading={false}
        onPlanSession={jest.fn()}
        onViewSpot={jest.fn()}
      />
    );

    expect(screen.getByText("No spots found yet")).toBeInTheDocument();
  });

  it("renders correctly when both loading and spots are provided (loading takes precedence)", () => {
    const mockSpots = [createMockRecommendation("b1", "Blacks", 8.5)];

    render(
      <TopSpotsCarousel
        spots={mockSpots}
        loading={true}
        onPlanSession={jest.fn()}
        onViewSpot={jest.fn()}
      />
    );

    // Should show loading state
    expect(screen.getAllByTestId("spot-card-skeleton")).toHaveLength(3);
    expect(screen.queryByTestId("spot-card")).not.toBeInTheDocument();
  });
});

describe("TopSpotsCarousel - Accessibility", () => {
  const mockSpots = [
    createMockRecommendation("b1", "Blacks", 8.5),
    createMockRecommendation("b2", "Windansea", 7.8),
  ];

  it("carousel has correct aria-label", () => {
    render(
      <TopSpotsCarousel
        spots={mockSpots}
        loading={false}
        onPlanSession={jest.fn()}
        onViewSpot={jest.fn()}
      />
    );

    const carousel = screen.getByRole("list", { name: /Top surf spots carousel/i });
    expect(carousel).toBeInTheDocument();
  });

  it("section has correct aria-label", () => {
    render(
      <TopSpotsCarousel
        spots={mockSpots}
        loading={false}
        onPlanSession={jest.fn()}
        onViewSpot={jest.fn()}
      />
    );

    const section = screen.getByRole("region", { name: /Your Top Spots/i });
    expect(section).toBeInTheDocument();
  });

  it("location button has adequate touch target height", () => {
    render(
      <TopSpotsCarousel
        spots={[]}
        loading={false}
        onPlanSession={jest.fn()}
        onViewSpot={jest.fn()}
        showLocationCta={true}
        onUseMyLocation={jest.fn()}
      />
    );

    const locationButton = screen.getByRole("button", { name: /Use My Location/i });
    expect(locationButton).toHaveClass("min-h-[44px]");
  });
});
