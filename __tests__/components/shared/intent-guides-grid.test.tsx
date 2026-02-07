/**
 * Tests for Shared IntentGuidesGrid Component
 *
 * Tests the unified polymorphic component that handles both state and city
 * intent guide grids. This is the primary internal linking component for
 * hub-centric SEO architecture.
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { IntentGuidesGrid } from "@/components/shared/intent-guides-grid";

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

describe("IntentGuidesGrid - State Location Type", () => {
  const stateProps = {
    locationSlug: "ca",
    locationName: "California",
    locationType: "state" as const,
  };

  describe("Rendering", () => {
    it("should render with state location type", () => {
      render(<IntentGuidesGrid {...stateProps} />);

      expect(
        screen.getByText("Surf Guides for California")
      ).toBeInTheDocument();
    });

    it("should render all 7 intent links for state", () => {
      render(<IntentGuidesGrid {...stateProps} />);

      expect(screen.getByText("Dawn Patrol")).toBeInTheDocument();
      expect(screen.getByText("Sunset Sessions")).toBeInTheDocument();
      expect(screen.getByText("Tide Windows")).toBeInTheDocument();
      expect(screen.getByText("Beginner Spots")).toBeInTheDocument();
      expect(screen.getByText("Longboard Spots")).toBeInTheDocument();
      expect(screen.getByText("Less Crowded")).toBeInTheDocument();
      expect(screen.getByText("Water Temperature")).toBeInTheDocument();
    });

    it("should render section headings", () => {
      render(<IntentGuidesGrid {...stateProps} />);

      expect(screen.getByText("Session")).toBeInTheDocument();
      expect(screen.getByText("Style")).toBeInTheDocument();
    });
  });

  describe("URL Building", () => {
    it("should build correct state URLs", () => {
      render(<IntentGuidesGrid {...stateProps} />);

      const beginnerLink = screen.getByRole("link", {
        name: /beginner spots surf guide for California/i,
      });
      expect(beginnerLink).toHaveAttribute("href", "/beginner/ca");
    });

    it("should build correct URLs for all state intents", () => {
      render(<IntentGuidesGrid {...stateProps} />);

      const dawnLink = screen.getByRole("link", {
        name: /dawn patrol surf guide for California/i,
      });
      expect(dawnLink).toHaveAttribute("href", "/dawn-patrol/ca");

      const sunsetLink = screen.getByRole("link", {
        name: /sunset sessions surf guide for California/i,
      });
      expect(sunsetLink).toHaveAttribute("href", "/sunset/ca");

      const tideLink = screen.getByRole("link", {
        name: /tide windows surf guide for California/i,
      });
      expect(tideLink).toHaveAttribute("href", "/tide/ca");

      const longboardLink = screen.getByRole("link", {
        name: /longboard spots surf guide for California/i,
      });
      expect(longboardLink).toHaveAttribute("href", "/longboard/ca");

      const crowdedLink = screen.getByRole("link", {
        name: /less crowded surf guide for California/i,
      });
      expect(crowdedLink).toHaveAttribute("href", "/least-crowded/ca");

      const tempLink = screen.getByRole("link", {
        name: /water temperature surf guide for California/i,
      });
      expect(tempLink).toHaveAttribute("href", "/water-temp/ca");
    });
  });

  describe("Styling", () => {
    it("should apply mt-10 margin for state pages", () => {
      const { container } = render(<IntentGuidesGrid {...stateProps} />);

      const section = container.querySelector("section");
      expect(section).toHaveClass("mt-10");
      expect(section).toHaveClass("space-y-6");
    });

    it("should NOT apply mt-10 margin for city pages", () => {
      const { container } = render(
        <IntentGuidesGrid
          locationSlug="san-diego"
          locationName="San Diego"
          locationType="city"
        />
      );

      const section = container.querySelector("section");
      expect(section).not.toHaveClass("mt-10");
      expect(section).toHaveClass("space-y-6");
    });
  });

  describe("Display Name", () => {
    it("should NOT append state abbreviation for state pages", () => {
      render(
        <IntentGuidesGrid
          locationSlug="ca"
          locationName="California"
          locationType="state"
          stateAbbrev="CA" // Should be ignored for state pages
        />
      );

      expect(
        screen.getByText("Surf Guides for California")
      ).toBeInTheDocument();
      expect(screen.queryByText(/California, CA/)).not.toBeInTheDocument();
    });

    it("should use location name in aria-labels for state pages", () => {
      render(<IntentGuidesGrid {...stateProps} />);

      const beginnerLink = screen.getByRole("link", {
        name: /beginner spots surf guide for California/i,
      });
      expect(beginnerLink).toBeInTheDocument();
    });
  });

  describe("Different States", () => {
    it("should work with Florida", () => {
      render(
        <IntentGuidesGrid
          locationSlug="fl"
          locationName="Florida"
          locationType="state"
        />
      );

      expect(screen.getByText("Surf Guides for Florida")).toBeInTheDocument();

      const beginnerLink = screen.getByRole("link", {
        name: /beginner spots surf guide for Florida/i,
      });
      expect(beginnerLink).toHaveAttribute("href", "/beginner/fl");
    });

    it("should work with Hawaii", () => {
      render(
        <IntentGuidesGrid
          locationSlug="hi"
          locationName="Hawaii"
          locationType="state"
        />
      );

      expect(screen.getByText("Surf Guides for Hawaii")).toBeInTheDocument();

      const sunsetLink = screen.getByRole("link", {
        name: /sunset sessions surf guide for Hawaii/i,
      });
      expect(sunsetLink).toHaveAttribute("href", "/sunset/hi");
    });

    it("should work with Oregon", () => {
      render(
        <IntentGuidesGrid
          locationSlug="or"
          locationName="Oregon"
          locationType="state"
        />
      );

      expect(screen.getByText("Surf Guides for Oregon")).toBeInTheDocument();

      const tideLink = screen.getByRole("link", {
        name: /tide windows surf guide for Oregon/i,
      });
      expect(tideLink).toHaveAttribute("href", "/tide/or");
    });
  });
});

describe("IntentGuidesGrid - City Location Type", () => {
  const cityProps = {
    locationSlug: "san-diego",
    locationName: "San Diego",
    locationType: "city" as const,
    stateAbbrev: "CA",
  };

  describe("Display Name", () => {
    it("should append state abbreviation for city pages", () => {
      render(<IntentGuidesGrid {...cityProps} />);

      expect(
        screen.getByText("Surf Guides for San Diego, CA")
      ).toBeInTheDocument();
    });

    it("should display just city name when no state abbreviation", () => {
      render(
        <IntentGuidesGrid
          locationSlug="san-diego"
          locationName="San Diego"
          locationType="city"
        />
      );

      expect(
        screen.getByText("Surf Guides for San Diego")
      ).toBeInTheDocument();
    });

    it("should use location name in aria-labels for city pages", () => {
      render(<IntentGuidesGrid {...cityProps} />);

      const beginnerLink = screen.getByRole("link", {
        name: /beginner spots surf guide for San Diego/i,
      });
      expect(beginnerLink).toBeInTheDocument();
    });
  });

  describe("URL Building", () => {
    it("should build correct city URLs", () => {
      render(<IntentGuidesGrid {...cityProps} />);

      const beginnerLink = screen.getByRole("link", {
        name: /beginner spots surf guide for San Diego/i,
      });
      expect(beginnerLink).toHaveAttribute("href", "/beginner/san-diego");
    });
  });
});

describe("IntentGuidesGrid - Edge Cases", () => {
  it("should handle empty stateAbbrev for city pages", () => {
    render(
      <IntentGuidesGrid
        locationSlug="san-diego"
        locationName="San Diego"
        locationType="city"
        stateAbbrev=""
      />
    );

    // Empty string should be treated as falsy, so no comma
    expect(screen.getByText("Surf Guides for San Diego")).toBeInTheDocument();
  });

  it("should handle multi-word state names", () => {
    render(
      <IntentGuidesGrid
        locationSlug="new-york"
        locationName="New York"
        locationType="state"
      />
    );

    expect(screen.getByText("Surf Guides for New York")).toBeInTheDocument();
  });

  it("should handle multi-word city names", () => {
    render(
      <IntentGuidesGrid
        locationSlug="santa-monica"
        locationName="Santa Monica"
        locationType="city"
        stateAbbrev="CA"
      />
    );

    expect(
      screen.getByText("Surf Guides for Santa Monica, CA")
    ).toBeInTheDocument();
  });

  it("should handle hyphenated location slugs", () => {
    render(
      <IntentGuidesGrid
        locationSlug="huntington-beach"
        locationName="Huntington Beach"
        locationType="city"
      />
    );

    const beginnerLink = screen.getByRole("link", {
      name: /beginner spots surf guide for Huntington Beach/i,
    });
    expect(beginnerLink).toHaveAttribute("href", "/beginner/huntington-beach");
  });
});

describe("IntentGuidesGrid - Accessibility", () => {
  it("should render as a semantic section element", () => {
    const { container } = render(
      <IntentGuidesGrid
        locationSlug="ca"
        locationName="California"
        locationType="state"
      />
    );

    const section = container.querySelector("section");
    expect(section).toBeInTheDocument();
  });

  it("should use h2 for main heading", () => {
    render(
      <IntentGuidesGrid
        locationSlug="ca"
        locationName="California"
        locationType="state"
      />
    );

    const heading = screen.getByRole("heading", {
      name: /Surf Guides for California/,
    });
    expect(heading.tagName).toBe("H2");
  });

  it("should use h3 for group headings", () => {
    render(
      <IntentGuidesGrid
        locationSlug="ca"
        locationName="California"
        locationType="state"
      />
    );

    const sessionHeading = screen.getByText("Session");
    expect(sessionHeading.tagName).toBe("H3");
  });

  it("should have descriptive aria-labels with human-readable location name", () => {
    render(
      <IntentGuidesGrid
        locationSlug="ca"
        locationName="California"
        locationType="state"
      />
    );

    // Verify aria-label uses "California" not "ca"
    const link = screen.getByRole("link", {
      name: /Dawn Patrol surf guide for California/i,
    });
    expect(link).toHaveAttribute(
      "aria-label",
      "Dawn Patrol surf guide for California"
    );
  });
});
