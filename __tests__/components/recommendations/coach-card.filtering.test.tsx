import React from "react";
import { render, screen } from "@testing-library/react";
import { CoachCard } from "@/components/recommendations/coach-card";

describe("CoachCard filtering", () => {
  it("shows only picks within 30km and with numeric distance", async () => {
    const initial = {
      top_picks: [
        {
          spotId: "near",
          name: "Near Spot",
          distance_km: 10,
          score: 80,
          reasons: [],
        },
        {
          spotId: "far",
          name: "Far Spot",
          distance_km: 35,
          score: 90,
          reasons: [],
        },
        {
          spotId: "unknown",
          name: "Unknown Distance",
          distance_km: null as any,
          score: 95,
          reasons: [],
        },
      ],
      recommendations: [
        {
          spotId: "near",
          name: "Near Spot",
          distance_km: 10,
          score: 80,
          reasons: [],
        },
        {
          spotId: "far",
          name: "Far Spot",
          distance_km: 35,
          score: 90,
          reasons: [],
        },
        {
          spotId: "unknown",
          name: "Unknown Distance",
          distance_km: null as any,
          score: 95,
          reasons: [],
        },
      ],
    };

    render(
      <CoachCard
        beachId="beach-uuid"
        lat={32.7}
        lon={-117.2}
        initialResponse={initial as any}
      />
    );

    // Only the near spot should appear in Top Picks listing
    expect(screen.getByText("Near Spot")).toBeInTheDocument();
    expect(screen.queryByText("Far Spot")).toBeNull();
    expect(screen.queryByText("Unknown Distance")).toBeNull();
  });
});
