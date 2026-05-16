import { render, screen } from "@testing-library/react";

import {
  BeachAccuracyLeaderboard,
  type LeaderboardBeachRow,
} from "@/components/forecast-accuracy/beach-accuracy-leaderboard";

describe("BeachAccuracyLeaderboard", () => {
  it("renders nullable metrics without throwing", () => {
    const beaches: LeaderboardBeachRow[] = [
      {
        beachId: "beach-null",
        beachName: "Null Metrics Beach",
        slug: "null-metrics-beach",
        city: "San Diego",
        state: "CA",
        country: "USA",
        rawMae: null,
        correctedMae: null,
        maeImprovementPct: null,
        predictionsMatched: null,
      },
    ];

    expect(() => render(<BeachAccuracyLeaderboard beaches={beaches} />)).not.toThrow();

    expect(screen.getByText("Null Metrics Beach")).toBeInTheDocument();
    expect(screen.getAllByText("—")).toHaveLength(4);
  });
});
