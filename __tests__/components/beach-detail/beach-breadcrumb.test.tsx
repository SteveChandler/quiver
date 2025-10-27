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

const mockBeach: Beach = {
  id: "test-beach-1",
  name: "Ocean Beach",
  location: "San Francisco, CA",
  region: "Northern California",
  lat: 37.7749,
  lon: -122.4194,
  created_at: "2024-01-01",
  updated_at: "2024-01-01",
  enabled: true,
  location_name: "San Francisco",
};

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

  describe("Back to Map Link", () => {
    it("should render link to /map", () => {
      render(<BeachBreadcrumb beach={mockBeach} />);
      const link = screen.getByRole("link", { name: /back to map/i });
      expect(link).toHaveAttribute("href", "/map");
    });

    it("should use ocean-blue color", () => {
      render(<BeachBreadcrumb beach={mockBeach} />);
      const link = screen.getByRole("link", { name: /back to map/i });
      expect(link).toHaveClass("text-ocean-blue");
    });

    it("should have hover:underline styling", () => {
      render(<BeachBreadcrumb beach={mockBeach} />);
      const link = screen.getByRole("link", { name: /back to map/i });
      expect(link).toHaveClass("hover:underline");
    });

    it("should display full text on desktop (sm:inline)", () => {
      render(<BeachBreadcrumb beach={mockBeach} />);
      const fullText = screen.getByText("Back to Map");
      expect(fullText).toHaveClass("hidden");
      expect(fullText).toHaveClass("sm:inline");
    });

    it("should display abbreviated text on mobile (sm:hidden)", () => {
      render(<BeachBreadcrumb beach={mockBeach} />);
      const shortText = screen.getByText("Map", { selector: ".sm\\:hidden" });
      expect(shortText).toHaveClass("sm:hidden");
    });

    it("should include ChevronLeft icon", () => {
      const { container } = render(<BeachBreadcrumb beach={mockBeach} />);
      const chevron = container.querySelector(".lucide-chevron-left");
      expect(chevron).toBeInTheDocument();
      expect(chevron).toHaveClass("h-4");
      expect(chevron).toHaveClass("w-4");
    });
  });

  describe("Separators - Phase 4 Spec", () => {
    it("should use › character instead of ChevronRight icon", () => {
      const { container } = render(<BeachBreadcrumb beach={mockBeach} />);

      // Should have 2 › separators
      const separators = Array.from(container.querySelectorAll("span")).filter(
        (span) => span.textContent === "›"
      );
      expect(separators).toHaveLength(2);
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
      // Only one chevron should exist (the ChevronLeft for back button)
      const chevrons = container.querySelectorAll('[class*="lucide-chevron"]');
      expect(chevrons.length).toBe(1); // Only ChevronLeft, no ChevronRight
    });
  });

  describe("Location Display", () => {
    it("should display beach location", () => {
      render(<BeachBreadcrumb beach={mockBeach} />);
      expect(screen.getByText("San Francisco, CA")).toBeInTheDocument();
    });

    it("should use gray-600 color for location", () => {
      render(<BeachBreadcrumb beach={mockBeach} />);
      const location = screen.getByText("San Francisco, CA");
      expect(location).toHaveClass("text-gray-600");
    });

    it("should fallback to region if location not available", () => {
      const beach = { ...mockBeach, location: undefined };
      render(<BeachBreadcrumb beach={beach} />);
      expect(screen.getByText("Northern California")).toBeInTheDocument();
    });

    it("should use default California if both location and region unavailable", () => {
      const beach = { ...mockBeach, location: undefined, region: undefined };
      render(<BeachBreadcrumb beach={beach} />);
      expect(screen.getByText("California")).toBeInTheDocument();
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

      // Check order: Back to Map › Location › Beach Name
      expect(textContent).toMatch(/Map.*›.*San Francisco, CA.*›.*Ocean Beach/);
    });

    it("should have exactly 2 separator characters", () => {
      const { container } = render(<BeachBreadcrumb beach={mockBeach} />);
      const separators = Array.from(container.querySelectorAll("span")).filter(
        (span) => span.textContent === "›"
      );
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
      const link = screen.getByRole("link");
      expect(link).toHaveAccessibleName();
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
    it("should show both full and abbreviated link text", () => {
      render(<BeachBreadcrumb beach={mockBeach} />);
      expect(screen.getByText("Back to Map")).toBeInTheDocument();
      expect(screen.getByText("Map", { selector: ".sm\\:hidden" })).toBeInTheDocument();
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
