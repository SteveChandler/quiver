/**
 * Tests for GuidesByIntentGrid Component
 *
 * Tests the guides by intent grid component that displays intent-based guides.
 * Priority 3 test coverage for San Diego page redesign.
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { GuidesByIntentGrid } from "@/components/city/guides-by-intent-grid";
import type { BeachWithMetrics } from "@/types/location";

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

// Mock SURF_INTENTS
jest.mock("@/lib/data/surf-spots", () => ({
  SURF_INTENTS: {
    beginner: {
      slug: "beginner",
      label: "Beginner Friendly",
      heading: ({ cityName }: { cityName: string }) =>
        `${cityName} beginner surf guide`,
      intro: ({ cityName }: { cityName: string }) =>
        `${cityName} has great spots for new surfers.`,
    },
    "least-crowded": {
      slug: "least-crowded",
      label: "Less Crowded",
      heading: ({ cityName }: { cityName: string }) =>
        `Where to surf in ${cityName} when the crowd packs the peak`,
      intro: ({ cityName }: { cityName: string }) =>
        `Find quieter spots in ${cityName}.`,
    },
    tide: {
      slug: "tide",
      label: "Tide Guide",
      heading: ({ cityName }: { cityName: string }) =>
        `${cityName} tide timing guide`,
      intro: ({ cityName }: { cityName: string }) =>
        `Optimize your ${cityName} sessions with tide windows.`,
    },
    "water-temp": {
      slug: "water-temp",
      label: "Water Temperature",
      heading: ({ cityName }: { cityName: string }) =>
        `${cityName} water temperature guide`,
      intro: ({ cityName }: { cityName: string }) =>
        `What to wear for ${cityName} surf conditions.`,
    },
  },
}));

describe("GuidesByIntentGrid Component", () => {
  const mockBeaches: BeachWithMetrics[] = [
    {
      id: "1",
      name: "La Jolla Shores",
      slug: "la-jolla-shores",
      skill_level: "Beginner friendly",
      crowd_level: "Moderate",
    } as BeachWithMetrics,
    {
      id: "2",
      name: "Tourmaline",
      slug: "tourmaline",
      skill_level: "Longboard friendly",
      crowd_level: "Light",
    } as BeachWithMetrics,
    {
      id: "3",
      name: "Blacks Beach",
      slug: "blacks",
      skill_level: "Advanced",
      crowd_level: "Low",
    } as BeachWithMetrics,
    {
      id: "4",
      name: "Scripps",
      slug: "scripps",
      skill_level: "Intermediate",
      crowd_level: "Heavy",
    } as BeachWithMetrics,
  ];

  const defaultProps = {
    cityName: "San Diego",
    citySlug: "san-diego",
    featuredIntents: ["beginner", "least-crowded"],
    beaches: mockBeaches,
  };

  describe("Rendering", () => {
    it("should render section heading", () => {
      render(<GuidesByIntentGrid {...defaultProps} />);

      expect(screen.getByText("Guides by Intent")).toBeInTheDocument();
    });

    it("should render section description", () => {
      render(<GuidesByIntentGrid {...defaultProps} />);

      expect(
        screen.getByText(/Choose the objective that matches your session/)
      ).toBeInTheDocument();
    });

    it("should render intent cards for featured intents", () => {
      render(<GuidesByIntentGrid {...defaultProps} />);

      expect(
        screen.getByText("San Diego beginner surf guide")
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Where to surf in San Diego when the crowd packs/)
      ).toBeInTheDocument();
    });

    it("should render intent intro text", () => {
      render(<GuidesByIntentGrid {...defaultProps} />);

      expect(
        screen.getByText(/San Diego has great spots for new surfers/)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Find quieter spots in San Diego/)
      ).toBeInTheDocument();
    });

    it("should render 2-column grid on desktop", () => {
      const { container } = render(<GuidesByIntentGrid {...defaultProps} />);

      const grid = container.querySelector("[class*='md:grid-cols-2']");
      expect(grid).toBeInTheDocument();
    });
  });

  describe("Beach Filtering", () => {
    it("should filter beginner beaches correctly", () => {
      render(<GuidesByIntentGrid {...defaultProps} />);

      // La Jolla Shores (Beginner friendly) and Tourmaline (Longboard friendly) should appear
      expect(screen.getByText("La Jolla Shores")).toBeInTheDocument();
      // Tourmaline appears in both beginner (longboard) and least-crowded (light) sections
      const tourmalineLinks = screen.getAllByText("Tourmaline");
      expect(tourmalineLinks.length).toBeGreaterThanOrEqual(1);
    });

    it("should filter least-crowded beaches correctly", () => {
      render(<GuidesByIntentGrid {...defaultProps} />);

      // Tourmaline (Light) and Blacks Beach (Low) should appear under least-crowded
      const tourmalineLinks = screen.getAllByText("Tourmaline");
      expect(tourmalineLinks.length).toBeGreaterThan(0);
      expect(screen.getByText("Blacks Beach")).toBeInTheDocument();
    });

    it("should limit beaches to 4 per intent", () => {
      const manyBeaches: BeachWithMetrics[] = Array.from({ length: 10 }, (_, i) => ({
        id: `${i}`,
        name: `Beach ${i}`,
        slug: `beach-${i}`,
        skill_level: "Beginner",
        crowd_level: "Light",
      })) as BeachWithMetrics[];

      render(
        <GuidesByIntentGrid {...defaultProps} beaches={manyBeaches} />
      );

      // Should only show max 4 beaches per intent
      const beachLinks = screen.getAllByText(/Beach \d/);
      // 2 intents * 4 beaches max = up to 8 links shown
      expect(beachLinks.length).toBeLessThanOrEqual(8);
    });
  });

  describe("Beach Links", () => {
    it("should link beaches to intent playbook with anchor", () => {
      render(<GuidesByIntentGrid {...defaultProps} />);

      const laJollaLink = screen.getByText("La Jolla Shores").closest("a");
      expect(laJollaLink).toHaveAttribute(
        "href",
        "/beginner/san-diego#la-jolla-shores"
      );
    });

    it("should render full playbook link for each intent", () => {
      render(<GuidesByIntentGrid {...defaultProps} />);

      const beginnerPlaybook = screen.getByText(
        /View the full beginner friendly playbook/i
      );
      expect(beginnerPlaybook).toBeInTheDocument();
      expect(beginnerPlaybook.closest("a")).toHaveAttribute(
        "href",
        "/beginner/san-diego"
      );
    });
  });

  describe("Empty State", () => {
    it("should return null when featuredIntents is empty", () => {
      const { container } = render(
        <GuidesByIntentGrid {...defaultProps} featuredIntents={[]} />
      );

      expect(container.firstChild).toBeNull();
    });

    it("should return null when featuredIntents is undefined", () => {
      const { container } = render(
        <GuidesByIntentGrid {...defaultProps} featuredIntents={undefined as any} />
      );

      expect(container.firstChild).toBeNull();
    });

    it("should return null when all intents are invalid", () => {
      const { container } = render(
        <GuidesByIntentGrid
          {...defaultProps}
          featuredIntents={["invalid-intent", "another-invalid"]}
        />
      );

      expect(container.firstChild).toBeNull();
    });
  });

  describe("Intent Validation", () => {
    it("should filter out invalid intent slugs", () => {
      render(
        <GuidesByIntentGrid
          {...defaultProps}
          featuredIntents={["beginner", "invalid-intent", "least-crowded"]}
        />
      );

      // Should still render the valid intents
      expect(
        screen.getByText("San Diego beginner surf guide")
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Where to surf in San Diego/)
      ).toBeInTheDocument();
    });
  });

  describe("All Intents", () => {
    it("should render tide intent with all beaches", () => {
      render(
        <GuidesByIntentGrid
          {...defaultProps}
          featuredIntents={["tide"]}
        />
      );

      expect(
        screen.getByText("San Diego tide timing guide")
      ).toBeInTheDocument();
      // All beaches should be shown for tide intent
      expect(screen.getByText("La Jolla Shores")).toBeInTheDocument();
    });

    it("should render water-temp intent with all beaches", () => {
      render(
        <GuidesByIntentGrid
          {...defaultProps}
          featuredIntents={["water-temp"]}
        />
      );

      expect(
        screen.getByText("San Diego water temperature guide")
      ).toBeInTheDocument();
    });
  });

  describe("Different Cities", () => {
    it("should use correct city name in headings", () => {
      render(
        <GuidesByIntentGrid
          cityName="Orange County"
          citySlug="orange-county"
          featuredIntents={["beginner"]}
          beaches={mockBeaches}
        />
      );

      expect(
        screen.getByText("Orange County beginner surf guide")
      ).toBeInTheDocument();
    });

    it("should use state-level URL for county slugs when stateSlug provided", () => {
      render(
        <GuidesByIntentGrid
          cityName="Orange County"
          citySlug="orange-county"
          stateSlug="ca"
          featuredIntents={["beginner"]}
          beaches={mockBeaches}
        />
      );

      const playbook = screen.getByText(/View the full beginner friendly playbook/i);
      // County slugs should use state-level URLs to avoid 404s
      expect(playbook.closest("a")).toHaveAttribute(
        "href",
        "/beginner/ca"
      );
    });

    it("should fallback to citySlug when stateSlug not provided for county", () => {
      render(
        <GuidesByIntentGrid
          cityName="Orange County"
          citySlug="orange-county"
          featuredIntents={["beginner"]}
          beaches={mockBeaches}
        />
      );

      const playbook = screen.getByText(/View the full beginner friendly playbook/i);
      // Without stateSlug, falls back to citySlug (legacy behavior)
      expect(playbook.closest("a")).toHaveAttribute(
        "href",
        "/beginner/orange-county"
      );
    });

    it("should use citySlug for regular cities even with stateSlug", () => {
      render(
        <GuidesByIntentGrid
          cityName="San Diego"
          citySlug="san-diego"
          stateSlug="ca"
          featuredIntents={["beginner"]}
          beaches={mockBeaches}
        />
      );

      const playbook = screen.getByText(/View the full beginner friendly playbook/i);
      // Regular city slugs should NOT change to state-level URLs
      expect(playbook.closest("a")).toHaveAttribute(
        "href",
        "/beginner/san-diego"
      );
    });
  });

  describe("Empty Beaches for Intent", () => {
    it("should render card without beach list if no beaches match", () => {
      const advancedOnlyBeaches: BeachWithMetrics[] = [
        {
          id: "1",
          name: "Pro Break",
          slug: "pro-break",
          skill_level: "Advanced",
          crowd_level: "Heavy",
        } as BeachWithMetrics,
      ];

      render(
        <GuidesByIntentGrid
          {...defaultProps}
          featuredIntents={["beginner"]}
          beaches={advancedOnlyBeaches}
        />
      );

      // Should still render the card with heading
      expect(
        screen.getByText("San Diego beginner surf guide")
      ).toBeInTheDocument();
      // But no beach list should appear (Pro Break doesn't match beginner)
      expect(screen.queryByText("Pro Break")).not.toBeInTheDocument();
    });
  });

  describe("Heading Levels", () => {
    it("should use h2 for section heading", () => {
      render(<GuidesByIntentGrid {...defaultProps} />);

      const heading = screen.getByRole("heading", { name: "Guides by Intent" });
      expect(heading.tagName).toBe("H2");
    });

    it("should use h3 for intent card headings", () => {
      render(<GuidesByIntentGrid {...defaultProps} />);

      const cardHeading = screen.getByRole("heading", {
        name: "San Diego beginner surf guide",
      });
      expect(cardHeading.tagName).toBe("H3");
    });
  });
});
