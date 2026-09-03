/**
 * Tests for AboutAccordion Component
 *
 * Tests the about accordion component that displays city surf information.
 * Priority 3 test coverage for San Diego page redesign.
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { AboutAccordion } from "@/components/city/about-accordion";

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

describe("AboutAccordion Component", () => {
  const defaultProps = {
    cityName: "San Diego",
    citySlug: "san-diego",
    description: [
      "San Diego is home to some of California's most consistent surf.",
      "From the mellow waves of La Jolla to the powerful breaks at Blacks Beach.",
    ],
    topSpotSlug: "la-jolla-shores",
    topSpotName: "La Jolla Shores",
  };

  describe("Rendering", () => {
    it("should render accordion trigger with city name", () => {
      render(<AboutAccordion {...defaultProps} />);

      expect(screen.getByText("About San Diego Surf")).toBeInTheDocument();
    });

    it("should render as collapsible by default (content not immediately visible)", () => {
      render(<AboutAccordion {...defaultProps} />);

      // With Radix accordion, content might not be in DOM at all when collapsed
      // or might be hidden via CSS/aria. The trigger should be visible.
      const trigger = screen.getByText("About San Diego Surf");
      expect(trigger).toBeInTheDocument();

      // Accordion should be collapsed by default (aria-expanded=false)
      const button = trigger.closest("button");
      expect(button).toHaveAttribute("aria-expanded", "false");
    });

    it("should expand when trigger is clicked", () => {
      render(<AboutAccordion {...defaultProps} />);

      const trigger = screen.getByText("About San Diego Surf");
      fireEvent.click(trigger);

      expect(
        screen.getByText(/California's most consistent surf/)
      ).toBeVisible();
    });

    it("should render all description paragraphs when expanded", () => {
      render(<AboutAccordion {...defaultProps} />);

      const trigger = screen.getByText("About San Diego Surf");
      fireEvent.click(trigger);

      expect(
        screen.getByText(/California's most consistent surf/)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/mellow waves of La Jolla/)
      ).toBeInTheDocument();
    });
  });

  describe("Dynamic Links", () => {
    it("should render top spot link when provided", () => {
      render(<AboutAccordion {...defaultProps} />);

      const trigger = screen.getByText("About San Diego Surf");
      fireEvent.click(trigger);

      const spotLink = screen.getByText("La Jolla Shores");
      expect(spotLink).toBeInTheDocument();
      expect(spotLink.closest("a")).toHaveAttribute(
        "href",
        "/spots/la-jolla-shores"
      );
    });

    it("should render 'the top spot' text when no spot provided", () => {
      render(
        <AboutAccordion
          {...defaultProps}
          topSpotSlug={undefined}
          topSpotName={undefined}
        />
      );

      const trigger = screen.getByText("About San Diego Surf");
      fireEvent.click(trigger);

      expect(screen.getByText(/the top spot/)).toBeInTheDocument();
    });

    it("should render less-crowded guide link", () => {
      render(<AboutAccordion {...defaultProps} />);

      const trigger = screen.getByText("About San Diego Surf");
      fireEvent.click(trigger);

      const crowdedLink = screen.getByText("less-crowded guide");
      expect(crowdedLink).toBeInTheDocument();
      expect(crowdedLink.closest("a")).toHaveAttribute(
        "href",
        "/least-crowded/san-diego"
      );
    });
  });

  describe("Empty State", () => {
    it("should return null when description is empty", () => {
      const { container } = render(
        <AboutAccordion {...defaultProps} description={[]} />
      );

      expect(container.firstChild).toBeNull();
    });

    it("should return null when description is undefined", () => {
      const { container } = render(
        <AboutAccordion {...defaultProps} description={undefined as any} />
      );

      expect(container.firstChild).toBeNull();
    });
  });

  describe("Different Cities", () => {
    it("should render with Orange County props", () => {
      render(
        <AboutAccordion
          cityName="Orange County"
          citySlug="orange-county"
          description={["Orange County has world-class point breaks."]}
          topSpotSlug="trestles"
          topSpotName="Trestles"
        />
      );

      expect(screen.getByText("About Orange County Surf")).toBeInTheDocument();
    });

    it("should use state-level URL for county slugs when stateSlug provided", () => {
      render(
        <AboutAccordion
          cityName="Orange County"
          citySlug="orange-county"
          stateSlug="ca"
          description={["Test description."]}
        />
      );

      const trigger = screen.getByText("About Orange County Surf");
      fireEvent.click(trigger);

      const crowdedLink = screen.getByText("less-crowded guide");
      // County slugs should use state-level URLs to avoid 404s
      expect(crowdedLink.closest("a")).toHaveAttribute(
        "href",
        "/least-crowded/ca"
      );
    });

    it("should fallback to citySlug when stateSlug not provided for county", () => {
      render(
        <AboutAccordion
          cityName="Orange County"
          citySlug="orange-county"
          description={["Test description."]}
        />
      );

      const trigger = screen.getByText("About Orange County Surf");
      fireEvent.click(trigger);

      const crowdedLink = screen.getByText("less-crowded guide");
      // Without stateSlug, falls back to citySlug (legacy behavior)
      expect(crowdedLink.closest("a")).toHaveAttribute(
        "href",
        "/least-crowded/orange-county"
      );
    });

    it("should use citySlug for regular cities even with stateSlug", () => {
      render(
        <AboutAccordion
          cityName="San Diego"
          citySlug="san-diego"
          stateSlug="ca"
          description={["Test description."]}
        />
      );

      const trigger = screen.getByText("About San Diego Surf");
      fireEvent.click(trigger);

      const crowdedLink = screen.getByText("less-crowded guide");
      // Regular city slugs should NOT change to state-level URLs
      expect(crowdedLink.closest("a")).toHaveAttribute(
        "href",
        "/least-crowded/san-diego"
      );
    });
  });

  describe("Single Paragraph", () => {
    it("should render correctly with single description paragraph", () => {
      render(
        <AboutAccordion
          {...defaultProps}
          description={["Single paragraph description."]}
        />
      );

      const trigger = screen.getByText("About San Diego Surf");
      fireEvent.click(trigger);

      expect(screen.getByText("Single paragraph description.")).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("should have accessible accordion trigger", () => {
      render(<AboutAccordion {...defaultProps} />);

      const trigger = screen.getByText("About San Diego Surf");
      expect(trigger.closest("button")).toBeInTheDocument();
    });

    it("should toggle aria-expanded on click", () => {
      render(<AboutAccordion {...defaultProps} />);

      const trigger = screen.getByText("About San Diego Surf").closest("button");

      // Initially collapsed
      expect(trigger).toHaveAttribute("aria-expanded", "false");

      // Click to expand
      if (trigger) fireEvent.click(trigger);
      expect(trigger).toHaveAttribute("aria-expanded", "true");
    });
  });

  describe("Styling", () => {
    it("should apply rounded border styling", () => {
      const { container } = render(<AboutAccordion {...defaultProps} />);

      // Lifted off the paper page: tinted panel, ink border, offset shadow.
      const accordionItem = container.querySelector("[class*='bg-[#FBF6E8]']");
      expect(accordionItem).toBeInTheDocument();
    });

    it("should render links as anchor elements", () => {
      render(<AboutAccordion {...defaultProps} />);

      const trigger = screen.getByText("About San Diego Surf");
      fireEvent.click(trigger);

      // Check that spot link and less-crowded link are rendered as anchors
      const spotLink = screen.getByText("La Jolla Shores");
      expect(spotLink.tagName).toBe("A");

      const crowdedLink = screen.getByText("less-crowded guide");
      expect(crowdedLink.tagName).toBe("A");
    });
  });
});
