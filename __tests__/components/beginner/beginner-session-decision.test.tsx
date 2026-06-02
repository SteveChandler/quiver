import { render, screen, within } from "@testing-library/react";
import { BeginnerSessionDecision } from "@/components/beginner/beginner-session-decision";
import type { RightNowConditions } from "@/types/beginner";

const conditions: RightNowConditions = {
  spotName: "Bolsa Chica",
  spotSlug: "bolsa-chica",
  summary: "Small waves with light wind. Good for practicing basics.",
  lastUpdated: "2026-06-02T12:00:00Z",
  metrics: {
    waveHeight: { value: "1-2 ft", label: "gentle", status: "good" },
    wind: { value: "W 4 mph", label: "light", status: "good" },
    waterTemp: {
      value: "64 F",
      label: "spring suit",
      status: "good",
      icon: "thermometer",
    },
    tide: { value: "Rising", label: "push", status: "good" },
    crowd: { value: "Light", label: "room to learn", status: "good" },
  },
};

describe("BeginnerSessionDecision", () => {
  it("renders a public cautious decision with planning links", () => {
    render(
      <BeginnerSessionDecision
        cityName="Huntington Beach"
        citySlug="huntington-beach"
        stateSlug="ca"
        conditions={conditions}
        bestTimeToSurfUrl="/best-time-to-surf/huntington-beach"
      />
    );

    const region = screen.getByRole("region", {
      name: /beginner session call for huntington beach/i,
    });

    expect(within(region).getByText(/small waves with light wind/i)).toBeVisible();
    expect(within(region).getByText(/check the tide and keep a backup spot/i)).toBeVisible();
    expect(within(region).queryByText(/sign in/i)).not.toBeInTheDocument();
    expect(within(region).getByRole("link", { name: /open live huntington beach spots/i })).toHaveAttribute("href", "/ca/huntington-beach");
    expect(within(region).getByRole("link", { name: /check tide timing/i })).toHaveAttribute("href", "/tide/huntington-beach");
    expect(within(region).getByRole("link", { name: /compare beginner seasons/i })).toHaveAttribute("href", "/best-time-to-surf/huntington-beach");
    expect(within(region).getByAltText("")).toHaveAttribute(
      "src",
      expect.stringContaining("/images/quiver-stickers/surf-wax.png")
    );
  });

  it("renders researched static beginner copy without live conditions", () => {
    render(
      <BeginnerSessionDecision
        cityName="Huntington Beach"
        citySlug="huntington-beach"
        stateSlug="ca"
        referenceSpotName="Bolsa Chica"
        decisionSummary="The local beginner pattern is 1-2 ft surf, light wind, and low-to-mid tide."
      />
    );

    const region = screen.getByRole("region", {
      name: /beginner session call for huntington beach/i,
    });

    expect(
      within(region).getByRole("heading", {
        name: /bolsa chica is the reference spot right now/i,
      })
    ).toBeVisible();
    expect(within(region).getByText(/1-2 ft surf/i)).toBeVisible();
    expect(within(region).getByRole("link", { name: /open live huntington beach spots/i })).toHaveAttribute("href", "/ca/huntington-beach");
  });
});
