/**
 * Tests for PopularCitiesForIntent Component
 *
 * Tests the state-level component that links DOWN to city intent pages,
 * creating the crawl loop: state intent -> city intent -> city hub -> state intent
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { PopularCitiesForIntent } from "@/components/intent/popular-cities-for-intent";

// Mock next/link
jest.mock("next/link", () => {
  return {
    __esModule: true,
    default: ({
      children,
      href,
    }: {
      children: React.ReactNode;
      href: string;
    }) => <a href={href}>{children}</a>,
  };
});

/** Generate N city fixtures */
function makeCities(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    slug: `city-${i + 1}`,
    name: `City ${i + 1}`,
  }));
}

describe("PopularCitiesForIntent", () => {
  const defaultProps = {
    intentKey: "beginner" as const,
    intentLabel: "Beginner Spots",
    stateName: "California",
    cities: [
      { slug: "san-diego", name: "San Diego" },
      { slug: "malibu", name: "Malibu" },
      { slug: "santa-cruz", name: "Santa Cruz" },
    ],
  };

  it("should render heading with intent and state", () => {
    render(<PopularCitiesForIntent {...defaultProps} />);

    expect(
      screen.getByText("Popular cities for Beginner Spots in California")
    ).toBeInTheDocument();
  });

  it("should render all city links", () => {
    render(<PopularCitiesForIntent {...defaultProps} />);

    expect(screen.getByText("San Diego")).toBeInTheDocument();
    expect(screen.getByText("Malibu")).toBeInTheDocument();
    expect(screen.getByText("Santa Cruz")).toBeInTheDocument();
  });

  it("should build correct URLs", () => {
    render(<PopularCitiesForIntent {...defaultProps} />);

    const sanDiegoLink = screen.getByRole("link", { name: /san diego/i });
    expect(sanDiegoLink).toHaveAttribute("href", "/beginner/san-diego");
  });

  it("should return null when no cities", () => {
    const { container } = render(
      <PopularCitiesForIntent {...defaultProps} cities={[]} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  describe("two-tier rendering", () => {
    it("should show only top tier when 8 or fewer cities", () => {
      render(
        <PopularCitiesForIntent {...defaultProps} cities={makeCities(8)} />
      );

      // All 8 cities rendered
      for (let i = 1; i <= 8; i++) {
        expect(screen.getByText(`City ${i}`)).toBeInTheDocument();
      }

      // No separator
      expect(
        screen.queryByText(/More Beginner Spots cities/i)
      ).not.toBeInTheDocument();
    });

    it("should show both tiers when more than 8 cities", () => {
      render(
        <PopularCitiesForIntent {...defaultProps} cities={makeCities(12)} />
      );

      // All 12 cities rendered
      for (let i = 1; i <= 12; i++) {
        expect(screen.getByText(`City ${i}`)).toBeInTheDocument();
      }

      // Separator present
      expect(
        screen.getByText("More Beginner Spots cities in California")
      ).toBeInTheDocument();
    });

    it("should render correct URLs for cities in both tiers", () => {
      render(
        <PopularCitiesForIntent {...defaultProps} cities={makeCities(10)} />
      );

      // Top tier city (city-1)
      const topLink = screen.getByRole("link", { name: "City 1" });
      expect(topLink).toHaveAttribute("href", "/beginner/city-1");

      // Bottom tier city (city-9)
      const bottomLink = screen.getByRole("link", { name: "City 9" });
      expect(bottomLink).toHaveAttribute("href", "/beginner/city-9");
    });
  });
});
