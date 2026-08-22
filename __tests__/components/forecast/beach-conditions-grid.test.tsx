import { render, screen } from "@testing-library/react";

import { BeachConditionsGrid } from "@/components/forecast/beach-conditions-grid";
import type { BeachConditionSummary } from "@/lib/utils/regional-forecast-utils";

jest.mock("@/components/ui/scroll-reveal", () => ({
  ScrollReveal: ({ children }: { children: React.ReactNode }) => children,
}));

// Do NOT mock @/components/ui/animated-counter here. It renders the true value
// on the server, resets to 0 on hydration, and only counts up once its
// IntersectionObserver fires — which jest.setup.js stubs to never fire. Running
// it for real is what keeps a counter from creeping back into label text and
// rendering a permanent 0, as it did in the "View all N beaches" link.
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

function makeBeaches(count: number): BeachConditionSummary[] {
  return Array.from({ length: count }, (_, i) => ({
    ...beach,
    beachId: `beach-${i}`,
    beachName: `Beach ${i}`,
    beachSlug: `beach-${i}`,
    currentScore: 90 - i,
  }));
}

describe("BeachConditionsGrid view-all link", () => {
  // The component renders the label twice — once in the section header, once
  // after the mobile card list. jsdom applies no CSS, so both are always in the
  // tree; asserting on every match keeps either surface from regressing alone.
  it("names the full region beach count, not the truncated grid count", () => {
    render(
      <BeachConditionsGrid
        beaches={makeBeaches(35)}
        regionSlug="san-diego"
        maxBeaches={12}
        showViewAll
        variant="zine"
      />
    );

    const links = screen.getAllByRole("link", { name: /view all/i });
    expect(links).toHaveLength(2);
    for (const link of links) {
      // Exact equality, not toHaveTextContent: that collapses whitespace and
      // matches substrings, so it would pass with a missing arrow or a double
      // space. The single space before "beaches" is the regression under test.
      expect(link.textContent).toBe("View all 35 beaches →");
      expect(link).toHaveAttribute("href", "/guides/surfing-san-diego");
    }
  });

  it("is hidden when every beach already fits in the grid", () => {
    render(
      <BeachConditionsGrid
        beaches={makeBeaches(12)}
        regionSlug="san-diego"
        maxBeaches={12}
        showViewAll
        variant="zine"
      />
    );

    expect(screen.queryAllByRole("link", { name: /view all/i })).toHaveLength(0);
  });

  it("is hidden when showViewAll is false", () => {
    render(
      <BeachConditionsGrid
        beaches={makeBeaches(35)}
        regionSlug="san-diego"
        maxBeaches={12}
        showViewAll={false}
        variant="zine"
      />
    );

    expect(screen.queryAllByRole("link", { name: /view all/i })).toHaveLength(0);
  });
});

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
