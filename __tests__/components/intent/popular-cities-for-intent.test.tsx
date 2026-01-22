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
});
