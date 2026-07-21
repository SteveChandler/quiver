import { render, screen, waitFor } from "@testing-library/react";

import { HeroMatchDemo } from "@/components/landing-page/hero-match-demo";
import { getTopBeachesNow } from "@/actions/forecast/get-top-beaches-now";
import { getEnhancedBeachForecasts } from "@/actions/forecast-actions";

jest.mock("@/actions/forecast/get-top-beaches-now", () => ({
  getTopBeachesNow: jest.fn(),
}));
jest.mock("@/actions/forecast-actions", () => ({
  getEnhancedBeachForecasts: jest.fn(),
}));
jest.mock("@/context/location-context", () => ({
  useLocationSafe: jest.fn(() => ({ location: { coordinates: null } })),
}));
jest.mock("@/components/landing-page/match-score-ring", () => ({
  MatchScoreRing: ({ score }: { score: number }) => (
    <div data-testid="match-score">{score}</div>
  ),
}));

describe("HeroMatchDemo recommendation boundary", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("does not replace an explicit empty top-beach result with a synthetic positive", async () => {
    (getTopBeachesNow as jest.Mock).mockResolvedValue([]);

    render(<HeroMatchDemo />);

    await waitFor(() => {
      expect(screen.getByText("Check the latest forecast")).toBeInTheDocument();
    });
    expect(screen.queryByText(/best match now/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/blacks beach/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId("match-score")).not.toBeInTheDocument();
    expect(screen.queryByText(/offshore wind|chest-high|rising tide/i)).not.toBeInTheDocument();
    expect(getEnhancedBeachForecasts).not.toHaveBeenCalled();
  });

  it("renders a server-selected beach without inventing missing condition chips", async () => {
    (getTopBeachesNow as jest.Mock).mockResolvedValue([
      {
        beachId: "11111111-1111-4111-8111-111111111111",
        beachName: "Server Beach",
        city: "San Diego",
        state: "CA",
        score: 82,
        waveHeight: null,
      },
    ]);
    (getEnhancedBeachForecasts as jest.Mock).mockResolvedValue({
      success: false,
      data: null,
    });

    render(<HeroMatchDemo />);

    await waitFor(() => {
      expect(screen.getByText("Server Beach")).toBeInTheDocument();
    });
    expect(screen.getByText("Best match now")).toBeInTheDocument();
    expect(screen.getByTestId("match-score")).toHaveTextContent("82");
    expect(screen.queryByText(/offshore wind|chest-high|rising tide/i)).not.toBeInTheDocument();
  });
});
