import { render, screen } from "@testing-library/react";

import { BeachConditionsGrid } from "@/components/forecast/beach-conditions-grid";
import type { BeachConditionSummary } from "@/lib/utils/regional-forecast-utils";

// AnimatedCounter is deliberately NOT mocked here: the "view all" label must read
// correctly even when the counter's scroll observer never fires.
jest.mock("@/components/ui/scroll-reveal", () => ({
  ScrollReveal: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock("@/components/zine", () => ({
  QuiverSticker: () => null,
}));

function makeBeaches(count: number): BeachConditionSummary[] {
  return Array.from({ length: count }, (_, i) => ({
    beachId: `beach-${i}`,
    beachName: `Beach ${i}`,
    beachSlug: `beach-${i}`,
    state: "CA",
    city: "San Diego",
    country: "USA",
    currentScore: 90 - i,
    currentWaveHeight: 4.2,
    trend: "steady" as const,
    bestDay: "Wednesday",
    bestDayScore: 91,
  }));
}

describe("BeachConditionsGrid view-all link", () => {
  it("names the full region beach count with a space before 'beaches'", () => {
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
      expect(link).toHaveTextContent("View all 35 beaches");
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

    expect(
      screen.queryByRole("link", { name: /view all/i })
    ).not.toBeInTheDocument();
  });
});
