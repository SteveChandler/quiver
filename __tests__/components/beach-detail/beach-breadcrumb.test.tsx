/**
 * Unit tests for BeachBreadcrumb Component
 * Phase 4: Hero & Breadcrumb - Beach Detail Refactor
 *
 * Tests validate compliance with specifications from:
 * docs/quiver_beach_detail_refactor.md - Phase 4
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { BeachBreadcrumb } from "@/components/beach-detail/beach-breadcrumb";
import type { Beach } from "@/types/database";

// Mock Next.js Link component
jest.mock("next/link", () => {
  return ({ children, href, ...props }: any) => {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  };
});

const mockBeach = {
  id: "test-beach-1",
  name: "Ocean Beach",
  city: "San Francisco",
  state: "CA",
  region: "Northern California",
  lat: 37.7749,
  lon: -122.4194,
  created_at: "2024-01-01",
  updated_at: "2024-01-01",
  enabled: true,
  country: "USA",
} as any;

describe("BeachBreadcrumb Component - Phase 4 Specifications", () => {
  describe("Container Styling", () => {
    it("should render as nav element with breadcrumb aria-label", () => {
      render(<BeachBreadcrumb beach={mockBeach} />);
      const nav = screen.getByRole("navigation", { name: /breadcrumb/i });
      expect(nav).toBeInTheDocument();
    });

    it("should have 14px font-size (text-sm)", () => {
      const { container } = render(<BeachBreadcrumb beach={mockBeach} />);
      const nav = container.querySelector("nav");
      expect(nav).toHaveClass("text-sm");
    });

    it("should have 16px margin-bottom (mb-4)", () => {
      const { container } = render(<BeachBreadcrumb beach={mockBeach} />);
      const nav = container.querySelector("nav");
      expect(nav).toHaveClass("mb-4");
    });

    it("should use flex layout with items-center", () => {
      const { container } = render(<BeachBreadcrumb beach={mockBeach} />);
      const nav = container.querySelector("nav");
      expect(nav).toHaveClass("flex");
      expect(nav).toHaveClass("items-center");
    });
  });

  describe("Home Link", () => {
    it("should render link to /", () => {
      render(<BeachBreadcrumb beach={mockBeach} />);
      const link = screen.getByRole("link", { name: /home/i });
      expect(link).toHaveAttribute("href", "/");
    });

    it("should use ocean-blue color", () => {
      render(<BeachBreadcrumb beach={mockBeach} />);
      const link = screen.getByRole("link", { name: /home/i });
      expect(link).toHaveClass("text-ocean-blue");
    });

    it("should have hover:underline styling", () => {
      render(<BeachBreadcrumb beach={mockBeach} />);
      const link = screen.getByRole("link", { name: /home/i });
      expect(link).toHaveClass("hover:underline");
    });

    it("should display 'Home' as the link text", () => {
      render(<BeachBreadcrumb beach={mockBeach} />);
      const link = screen.getByRole("link", { name: /home/i });
      expect(link).toHaveTextContent("Home");
    });

    it("should NOT include ChevronLeft icon", () => {
      const { container } = render(<BeachBreadcrumb beach={mockBeach} />);
      const chevron = container.querySelector(".lucide-chevron-left");
      expect(chevron).not.toBeInTheDocument();
    });
  });

  describe("Separators - Phase 4 Spec", () => {
    it("should use › character for separators (USA beach has 3 separators)", () => {
      const { container } = render(<BeachBreadcrumb beach={mockBeach} />);

      // USA beaches with state: Home › State › City › Beach = 3 separators
      const separators = Array.from(container.querySelectorAll("span")).filter(
        (span) => span.textContent === "›"
      );
      expect(separators).toHaveLength(3);
    });

    it("should apply gray-400 color to separators", () => {
      const { container } = render(<BeachBreadcrumb beach={mockBeach} />);
      const separators = Array.from(container.querySelectorAll("span")).filter(
        (span) => span.textContent === "›"
      );
      separators.forEach((separator) => {
        expect(separator).toHaveClass("text-gray-400");
      });
    });

    it("should have 8px horizontal margins (mx-2)", () => {
      const { container } = render(<BeachBreadcrumb beach={mockBeach} />);
      const separators = Array.from(container.querySelectorAll("span")).filter(
        (span) => span.textContent === "›"
      );
      separators.forEach((separator) => {
        expect(separator).toHaveClass("mx-2");
      });
    });

    it("should have aria-hidden attribute on separators", () => {
      const { container } = render(<BeachBreadcrumb beach={mockBeach} />);
      const separators = Array.from(container.querySelectorAll("span")).filter(
        (span) => span.textContent === "›"
      );
      separators.forEach((separator) => {
        expect(separator).toHaveAttribute("aria-hidden", "true");
      });
    });

    it("should NOT use ChevronRight icon for separators", () => {
      const { container } = render(<BeachBreadcrumb beach={mockBeach} />);
      // No chevron icons should exist — both left and right replaced by › text
      const chevrons = container.querySelectorAll('[class*="lucide-chevron"]');
      expect(chevrons.length).toBe(0);
    });
  });

  describe("Location Display", () => {
    it("should display beach location", () => {
      render(<BeachBreadcrumb beach={mockBeach} />);
      expect(screen.getByText("San Francisco, CA")).toBeInTheDocument();
    });

    it("should use ocean-blue color for location when it's a link", () => {
      render(<BeachBreadcrumb beach={mockBeach} />);
      const location = screen.getByText("San Francisco, CA");
      // When city/state are available, location is a link with ocean-blue color
      expect(location).toHaveClass("text-ocean-blue");
    });

    it("should fallback to region if city/state not available", () => {
      const beach = { ...mockBeach, city: null, state: null } as Beach;
      render(<BeachBreadcrumb beach={beach} />);
      expect(screen.getByText("Northern California")).toBeInTheDocument();
    });

    it("should use default California if city/state/region unavailable", () => {
      const beach = {
        ...mockBeach,
        city: null,
        state: null,
        region: null,
      } as Beach;
      render(<BeachBreadcrumb beach={beach} />);
      expect(screen.getByText("California")).toBeInTheDocument();
    });
  });

  describe("Location Page Links - Phase 1 Enhancement", () => {
    const beachWithLocationData = {
      ...mockBeach,
      city: "La Jolla",
      state: "CA",
      country: "USA",
    } as Beach;

    it("should render location as clickable link when city and state are available", () => {
      render(<BeachBreadcrumb beach={beachWithLocationData} />);

      const links = screen.getAllByRole("link");
      const locationLink = links.find(
        (link) =>
          link.getAttribute("href")?.includes("/ca/") &&
          !link.getAttribute("href")?.includes("/map")
      );

      expect(locationLink).toBeDefined();
      expect(locationLink).toHaveAttribute("href", "/ca/la-jolla");
    });

    it("should use ocean-blue color for clickable location link", () => {
      render(<BeachBreadcrumb beach={beachWithLocationData} />);

      const links = screen.getAllByRole("link");
      const locationLink = links.find((link) =>
        link.getAttribute("href")?.includes("/ca/")
      );

      expect(locationLink).toHaveClass("text-ocean-blue");
    });

    it("should have hover:underline on clickable location link", () => {
      render(<BeachBreadcrumb beach={beachWithLocationData} />);

      const links = screen.getAllByRole("link");
      const locationLink = links.find((link) =>
        link.getAttribute("href")?.includes("/ca/")
      );

      expect(locationLink).toHaveClass("hover:underline");
    });

    it("should render location as non-clickable text when city is missing", () => {
      const beachWithoutCity = {
        ...beachWithLocationData,
        city: null,
      };

      render(<BeachBreadcrumb beach={beachWithoutCity} />);

      // Should have Home link and State link, but no city-level location page link
      const links = screen.getAllByRole("link");
      const cityLink = links.find(
        (link) =>
          link.getAttribute("href")?.includes("/ca/") &&
          link.getAttribute("href") !== "/beaches/usa/ca"
      );
      expect(cityLink).toBeUndefined();
    });

    it("should render location as non-clickable text when state is missing", () => {
      const beachWithoutState = {
        ...beachWithLocationData,
        state: null,
      };

      render(<BeachBreadcrumb beach={beachWithoutState} />);

      // Should only have the Home link; no state or city page links
      const links = screen.getAllByRole("link");
      expect(links).toHaveLength(1);
    });

    it("should generate correct URL for international locations", () => {
      const internationalBeach: Beach = {
        ...mockBeach,
        city: "Ensenada",
        state: "Baja California",
        country: "Mexico",
      };

      render(<BeachBreadcrumb beach={internationalBeach} />);

      const links = screen.getAllByRole("link");
      const locationLink = links.find((link) =>
        link.getAttribute("href")?.includes("/mexico/")
      );

      expect(locationLink).toBeDefined();
      expect(locationLink).toHaveAttribute(
        "href",
        "/mexico/baja-california/ensenada"
      );
    });

    it("should handle multi-word city names in URLs", () => {
      const multiWordCityBeach: Beach = {
        ...mockBeach,
        city: "Pacific Beach",
        state: "CA",
        country: "USA",
      };

      render(<BeachBreadcrumb beach={multiWordCityBeach} />);

      const links = screen.getAllByRole("link");
      const locationLink = links.find((link) =>
        link.getAttribute("href")?.includes("/ca/")
      );

      expect(locationLink).toHaveAttribute("href", "/ca/pacific-beach");
    });

    it("should handle hyphenated city names in URLs", () => {
      const hyphenatedCityBeach: Beach = {
        ...mockBeach,
        city: "Cardiff-by-the-Sea",
        state: "CA",
        country: "USA",
      };

      render(<BeachBreadcrumb beach={hyphenatedCityBeach} />);

      const links = screen.getAllByRole("link");
      const locationLink = links.find((link) =>
        link.getAttribute("href")?.includes("/ca/")
      );

      expect(locationLink).toHaveAttribute("href", "/ca/cardiff-by-the-sea");
    });

    it("should default to USA when country is null", () => {
      const beachWithoutCountry: Beach = {
        ...mockBeach,
        city: "La Jolla",
        state: "CA",
        country: null,
      };

      render(<BeachBreadcrumb beach={beachWithoutCountry} />);

      const links = screen.getAllByRole("link");
      const locationLink = links.find((link) =>
        link.getAttribute("href")?.includes("/ca/")
      );

      expect(locationLink).toBeDefined();
      expect(locationLink?.getAttribute("href")).toBe("/ca/la-jolla");
    });
  });

  describe("Beach Name Display", () => {
    it("should display beach name", () => {
      render(<BeachBreadcrumb beach={mockBeach} />);
      // Use a more specific selector to avoid matching "Ocean Beach" in other contexts
      const beachName = screen.getByText("Ocean Beach", {
        selector: ".text-gray-900",
      });
      expect(beachName).toBeInTheDocument();
    });

    it("should use gray-900 color for beach name", () => {
      render(<BeachBreadcrumb beach={mockBeach} />);
      const beachName = screen.getByText("Ocean Beach", {
        selector: ".text-gray-900",
      });
      expect(beachName).toHaveClass("text-gray-900");
    });

    it("should have font-medium weight for beach name", () => {
      render(<BeachBreadcrumb beach={mockBeach} />);
      const beachName = screen.getByText("Ocean Beach", {
        selector: ".font-medium",
      });
      expect(beachName).toHaveClass("font-medium");
    });

    it("should truncate long beach names on mobile", () => {
      render(<BeachBreadcrumb beach={mockBeach} />);
      const beachName = screen.getByText("Ocean Beach", {
        selector: ".truncate",
      });
      expect(beachName).toHaveClass("truncate");
      expect(beachName).toHaveClass("max-w-[200px]");
    });

    it("should not truncate beach names on desktop", () => {
      render(<BeachBreadcrumb beach={mockBeach} />);
      const beachName = screen.getByText("Ocean Beach", {
        selector: ".sm\\:max-w-none",
      });
      expect(beachName).toHaveClass("sm:max-w-none");
    });

    it("should NOT be a link (current page)", () => {
      render(<BeachBreadcrumb beach={mockBeach} />);
      const beachName = screen.getByText("Ocean Beach", {
        selector: ".text-gray-900",
      });
      expect(beachName.tagName).not.toBe("A");
      expect(beachName.tagName).toBe("SPAN");
    });
  });

  describe("Breadcrumb Structure", () => {
    it("should render breadcrumb items in correct order", () => {
      const { container } = render(<BeachBreadcrumb beach={mockBeach} />);
      const nav = container.querySelector("nav");
      const textContent = nav?.textContent || "";

      // Check order: Home › State › City › Beach Name
      expect(textContent).toMatch(
        /Home.*›.*California.*›.*San Francisco, CA.*›.*Ocean Beach/
      );
    });

    it("should have exactly 3 separator characters for USA beaches with state", () => {
      const { container } = render(<BeachBreadcrumb beach={mockBeach} />);
      const separators = Array.from(container.querySelectorAll("span")).filter(
        (span) => span.textContent === "›"
      );
      expect(separators).toHaveLength(3);
    });

    it("should have exactly 2 separator characters for international beaches", () => {
      const internationalBeach: Beach = {
        ...mockBeach,
        city: "Ensenada",
        state: "Baja California",
        country: "Mexico",
      };

      const { container } = render(
        <BeachBreadcrumb beach={internationalBeach} />
      );
      const separators = Array.from(container.querySelectorAll("span")).filter(
        (span) => span.textContent === "›"
      );
      // International: Home › City › Beach = 2 separators (no state breadcrumb)
      expect(separators).toHaveLength(2);
    });
  });

  describe("Accessibility", () => {
    it("should have proper navigation landmark", () => {
      render(<BeachBreadcrumb beach={mockBeach} />);
      const nav = screen.getByRole("navigation");
      expect(nav).toHaveAttribute("aria-label", "Breadcrumb");
    });

    it("should have aria-hidden on decorative separators", () => {
      const { container } = render(<BeachBreadcrumb beach={mockBeach} />);
      const separators = Array.from(container.querySelectorAll("span")).filter(
        (span) => span.textContent === "›"
      );
      separators.forEach((sep) => {
        expect(sep).toHaveAttribute("aria-hidden", "true");
      });
    });

    it("should have accessible link text", () => {
      render(<BeachBreadcrumb beach={mockBeach} />);
      const links = screen.getAllByRole("link");
      // Should have at least the Home link, and possibly state/location links
      expect(links.length).toBeGreaterThanOrEqual(1);
      links.forEach((link) => {
        expect(link).toHaveAccessibleName();
      });
    });
  });

  describe("Custom className prop", () => {
    it("should apply custom className to nav element", () => {
      const { container } = render(
        <BeachBreadcrumb beach={mockBeach} className="custom-breadcrumb" />
      );
      const nav = container.querySelector("nav");
      expect(nav).toHaveClass("custom-breadcrumb");
    });

    it("should preserve default classes when custom className is added", () => {
      const { container } = render(
        <BeachBreadcrumb beach={mockBeach} className="custom-breadcrumb" />
      );
      const nav = container.querySelector("nav");
      expect(nav).toHaveClass("flex");
      expect(nav).toHaveClass("text-sm");
      expect(nav).toHaveClass("custom-breadcrumb");
    });
  });

  describe("Responsive Behavior", () => {
    it("should show 'Home' as the first breadcrumb link text", () => {
      render(<BeachBreadcrumb beach={mockBeach} />);
      expect(screen.getByRole("link", { name: /home/i })).toBeInTheDocument();
    });

    it("should handle very long beach names with truncation", () => {
      const longNameBeach = {
        ...mockBeach,
        name: "This Is A Very Long Beach Name That Should Be Truncated",
      };
      render(<BeachBreadcrumb beach={longNameBeach} />);
      const beachName = screen.getByText(longNameBeach.name);
      expect(beachName).toHaveClass("truncate");
    });
  });
});
