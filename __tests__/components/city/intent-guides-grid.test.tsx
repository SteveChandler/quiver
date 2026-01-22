/**
 * Tests for IntentGuidesGrid Component
 *
 * Tests the primary internal linking component for hub-centric SEO architecture.
 * This component displays all 7 intent links on every city hub page to ensure
 * no intent pages are orphaned.
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { IntentGuidesGrid } from "@/components/city/intent-guides-grid";

// Mock next/link
jest.mock("next/link", () => {
  return {
    __esModule: true,
    default: ({
      children,
      href,
      ...props
    }: {
      children: React.ReactNode;
      href: string;
      [key: string]: unknown;
    }) => (
      <a href={href} {...props}>
        {children}
      </a>
    ),
  };
});

describe("IntentGuidesGrid", () => {
  const defaultProps = {
    citySlug: "san-diego",
    cityName: "San Diego",
    stateAbbrev: "CA",
  };

  describe("Intent Links", () => {
    it("should render all 7 intent links", () => {
      render(<IntentGuidesGrid {...defaultProps} />);

      // Check for all intent labels
      expect(screen.getByText("Dawn Patrol")).toBeInTheDocument();
      expect(screen.getByText("Sunset Sessions")).toBeInTheDocument();
      expect(screen.getByText("Tide Windows")).toBeInTheDocument();
      expect(screen.getByText("Beginner Spots")).toBeInTheDocument();
      expect(screen.getByText("Longboard Spots")).toBeInTheDocument();
      expect(screen.getByText("Less Crowded")).toBeInTheDocument();
      expect(screen.getByText("Water Temperature")).toBeInTheDocument();
    });

    it("should render exactly 7 intent link cards", () => {
      render(<IntentGuidesGrid {...defaultProps} />);

      // Count all links that match the intent URL pattern
      const allLinks = screen.getAllByRole("link");
      const intentLinks = allLinks.filter((link) =>
        link.getAttribute("href")?.match(/^\/(dawn-patrol|sunset|tide|beginner|longboard|least-crowded|water-temp)\//)
      );
      expect(intentLinks).toHaveLength(7);
    });
  });

  describe("Section Headings", () => {
    it("should render section headings", () => {
      render(<IntentGuidesGrid {...defaultProps} />);

      expect(screen.getByText("Session")).toBeInTheDocument();
      expect(screen.getByText("Style")).toBeInTheDocument();
    });

    it("should use h3 for group headings", () => {
      render(<IntentGuidesGrid {...defaultProps} />);

      const sessionHeading = screen.getByText("Session");
      expect(sessionHeading.tagName).toBe("H3");
    });
  });

  describe("URL Building", () => {
    it("should build correct URLs with city slug only", () => {
      render(<IntentGuidesGrid {...defaultProps} />);

      const beginnerLink = screen.getByRole("link", {
        name: /beginner spots surf guide/i,
      });
      expect(beginnerLink).toHaveAttribute("href", "/beginner/san-diego");
    });

    it("should build correct URLs for all intents", () => {
      render(<IntentGuidesGrid {...defaultProps} />);

      // Verify URL format for each intent
      const dawnLink = screen.getByRole("link", { name: /dawn patrol surf guide/i });
      expect(dawnLink).toHaveAttribute("href", "/dawn-patrol/san-diego");

      const sunsetLink = screen.getByRole("link", { name: /sunset sessions surf guide/i });
      expect(sunsetLink).toHaveAttribute("href", "/sunset/san-diego");

      const tideLink = screen.getByRole("link", { name: /tide windows surf guide/i });
      expect(tideLink).toHaveAttribute("href", "/tide/san-diego");

      const longboardLink = screen.getByRole("link", { name: /longboard spots surf guide/i });
      expect(longboardLink).toHaveAttribute("href", "/longboard/san-diego");

      const crowdedLink = screen.getByRole("link", { name: /less crowded surf guide/i });
      expect(crowdedLink).toHaveAttribute("href", "/least-crowded/san-diego");

      const tempLink = screen.getByRole("link", { name: /water temperature surf guide/i });
      expect(tempLink).toHaveAttribute("href", "/water-temp/san-diego");
    });
  });

  describe("City Display", () => {
    it("should display city name with state abbreviation", () => {
      render(<IntentGuidesGrid {...defaultProps} />);

      expect(
        screen.getByText("Surf Guides for San Diego, CA")
      ).toBeInTheDocument();
    });

    it("should display just city name when no state abbreviation", () => {
      render(
        <IntentGuidesGrid
          citySlug="san-diego"
          cityName="San Diego"
        />
      );

      expect(screen.getByText("Surf Guides for San Diego")).toBeInTheDocument();
    });
  });

  describe("Heading Levels", () => {
    it("should use h2 for main section heading", () => {
      render(<IntentGuidesGrid {...defaultProps} />);

      const heading = screen.getByRole("heading", {
        name: /Surf Guides for San Diego/,
      });
      expect(heading.tagName).toBe("H2");
    });
  });

  describe("Different Cities", () => {
    it("should work with different city props", () => {
      render(
        <IntentGuidesGrid
          citySlug="huntington-beach"
          cityName="Huntington Beach"
          stateAbbrev="CA"
        />
      );

      expect(
        screen.getByText("Surf Guides for Huntington Beach, CA")
      ).toBeInTheDocument();

      const beginnerLink = screen.getByRole("link", {
        name: /beginner spots surf guide/i,
      });
      expect(beginnerLink).toHaveAttribute(
        "href",
        "/beginner/huntington-beach"
      );
    });

    it("should work with different state", () => {
      render(
        <IntentGuidesGrid
          citySlug="newport"
          cityName="Newport"
          stateAbbrev="OR"
        />
      );

      expect(
        screen.getByText("Surf Guides for Newport, OR")
      ).toBeInTheDocument();

      const beginnerLink = screen.getByRole("link", {
        name: /beginner spots surf guide/i,
      });
      expect(beginnerLink).toHaveAttribute("href", "/beginner/newport");
    });
  });

  describe("Accessibility", () => {
    it("should have descriptive aria-labels for all links", () => {
      render(<IntentGuidesGrid {...defaultProps} />);

      // Each link should have an aria-label describing what it links to
      const beginnerLink = screen.getByRole("link", {
        name: /beginner spots surf guide for san-diego/i,
      });
      expect(beginnerLink).toBeInTheDocument();
    });

    it("should render as a semantic section element", () => {
      const { container } = render(<IntentGuidesGrid {...defaultProps} />);

      const section = container.querySelector("section");
      expect(section).toBeInTheDocument();
    });
  });

  describe("Intent Descriptions", () => {
    it("should show descriptions for each intent", () => {
      render(<IntentGuidesGrid {...defaultProps} />);

      expect(screen.getByText("Best early morning sessions")).toBeInTheDocument();
      expect(screen.getByText("Evening golden hour spots")).toBeInTheDocument();
      expect(screen.getByText("Optimal tidal conditions")).toBeInTheDocument();
      expect(screen.getByText("Gentle waves for learning")).toBeInTheDocument();
      expect(screen.getByText("Mellow waves for logging")).toBeInTheDocument();
      expect(screen.getByText("Quieter lineups & backups")).toBeInTheDocument();
      expect(screen.getByText("Conditions & wetsuit guide")).toBeInTheDocument();
    });
  });
});
