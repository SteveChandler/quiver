import { render, screen } from "@testing-library/react";

import { BeachConditionsGrid } from "@/components/forecast/beach-conditions-grid";
import type { BeachConditionSummary } from "@/lib/utils/regional-forecast-utils";

jest.mock("@/components/ui/scroll-reveal", () => ({
  ScrollReveal: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock("@/components/ui/animated-counter", () => ({
  AnimatedCounter: ({ value, suffix = "" }: { value: number; suffix?: string }) => (
    <span>{value}{suffix}</span>
  ),
}));

jest.mock("@/components/zine", () => ({
  QuiverSticker: () => null,
}));

const beach: BeachConditionSummary = {
  beachId: "beach-1",
  beachName: "Imperial Beach",
  beachSlug: "imperial-beach",
  state: "CA",
  city: "Imperial Beach",
  country: "USA",
  currentScore: 83,
  currentWaveHeight: 4.2,
  trend: "steady",
  bestDay: "Wednesday",
  bestDayScore: 91,
};

describe("BeachConditionsGrid", () => {
  it("shows guests a login CTA without score numbers or rating labels", () => {
    render(
      <BeachConditionsGrid
        beaches={[beach]}
        regionSlug="san-diego"
        showScores={false}
        variant="zine"
      />
    );

    const loginLinks = screen.getAllByRole("link", {
      name: "Log in to see scores",
    });
    expect(loginLinks).toHaveLength(2);
    for (const link of loginLinks) {
      expect(link).toHaveAttribute(
        "href",
        "/auth/sign-in?redirectTo=/forecast/san-diego"
      );
    }
    expect(screen.queryByText("83")).not.toBeInTheDocument();
    expect(screen.queryByText("91")).not.toBeInTheDocument();
    expect(screen.queryByText("EPIC")).not.toBeInTheDocument();
  });

  it("shows authenticated users scores without action-phrase subtext", () => {
    render(
      <BeachConditionsGrid
        beaches={[beach]}
        regionSlug="san-diego"
        showScores
        variant="zine"
      />
    );

    expect(screen.getAllByText("83")).toHaveLength(2);
    expect(screen.getAllByText("EPIC")).toHaveLength(2);
    expect(screen.queryByText("Go now!")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Log in to see scores" })
    ).not.toBeInTheDocument();
  });
});
