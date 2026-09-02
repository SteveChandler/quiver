import { render, screen } from "@testing-library/react";

import { ReviewedCityEditorialSection } from "@/components/seo/reviewed-city-editorial-section";
import type { CityEditorialContent } from "@/types/editorial-content";

const editorial = {
  seo_intro: "Trinidad surf forecasts, tide context, and access notes for the Moonstone-to-College Cove coastline.",
  seo_local_guidance: "Treat posted closures as authoritative. College Cove is not a current surf option.",
  editorial_sources: [
    { publisher: "Humboldt County", url: "https://humboldtgov.org/" },
    { publisher: "California State Parks", url: "https://www.parks.ca.gov/?page_id=418" },
    { publisher: "California State Parks", url: "https://www.parks.ca.gov/?page_id=419" },
    { publisher: "  ", url: "https://example.com/blank" },
  ],
} as unknown as CityEditorialContent;

describe("ReviewedCityEditorialSection", () => {
  it("renders nothing without both the intro and the guidance", () => {
    const { container } = render(
      <ReviewedCityEditorialSection editorial={{ ...editorial, seo_local_guidance: null }} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("uses the paper palette instead of the dark card tokens", () => {
    render(<ReviewedCityEditorialSection editorial={editorial} />);
    const section = screen.getByTestId("reviewed-city-editorial");
    // .seo-paper-page never overrides these; on it they resolve to navy + brown.
    expect(section.className).not.toMatch(/\bbg-card\b|text-muted-foreground|border-border/);
    expect(section.className).toContain("bg-[#FBF6E8]");
    expect(screen.getByRole("heading", { level: 2, name: "Local planning guidance" })).toBeInTheDocument();
  });

  it("no longer prints the reviewed-sources line", () => {
    render(<ReviewedCityEditorialSection editorial={editorial} />);
    expect(screen.queryByText(/reviewed sources/i)).toBeNull();
    expect(screen.queryByRole("link", { name: "California State Parks" })).toBeNull();
    expect(screen.queryByTestId("reviewed-city-editorial-photo")).toBeNull();
  });

  it("gives the actionable guidance the strongest emphasis", () => {
    render(<ReviewedCityEditorialSection editorial={editorial} />);
    const guidance = screen.getByText(/Treat posted closures as authoritative/);
    expect(guidance.className).toContain("font-medium");
    expect(guidance.className).toContain("text-[#11100D]");
  });
});
