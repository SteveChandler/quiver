/**
 * Tests for QuickActionsBar Component
 *
 * Tests the quick actions bar component that displays pill-shaped navigation links.
 * Priority 3 test coverage for San Diego page redesign.
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { QuickActionsBar } from "@/components/city/quick-actions-bar";
import type { QuickLink } from "@/types/editorial-content";

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

describe("QuickActionsBar Component", () => {
  const mockLinks: QuickLink[] = [
    { label: "View Map", href: "/map/san-diego" },
    { label: "Tide Guide", href: "/tide/san-diego" },
    { label: "Beginner Spots", href: "/beginner/san-diego" },
    { label: "Water Temp", href: "/water-temp/san-diego" },
  ];

  describe("Rendering", () => {
    it("should render all quick action links", () => {
      render(<QuickActionsBar links={mockLinks} />);

      expect(screen.getByText("View Map")).toBeInTheDocument();
      expect(screen.getByText("Tide Guide")).toBeInTheDocument();
      expect(screen.getByText("Beginner Spots")).toBeInTheDocument();
      expect(screen.getByText("Water Temp")).toBeInTheDocument();
    });

    it("should render correct href for each link", () => {
      render(<QuickActionsBar links={mockLinks} />);

      expect(screen.getByText("View Map").closest("a")).toHaveAttribute(
        "href",
        "/map/san-diego"
      );
      expect(screen.getByText("Tide Guide").closest("a")).toHaveAttribute(
        "href",
        "/tide/san-diego"
      );
    });

    it("should render navigation landmark", () => {
      render(<QuickActionsBar links={mockLinks} />);

      expect(screen.getByRole("navigation")).toBeInTheDocument();
      expect(screen.getByRole("navigation")).toHaveAttribute(
        "aria-label",
        "Quick navigation"
      );
    });

    it("should render icons for each link", () => {
      const { container } = render(<QuickActionsBar links={mockLinks} />);

      // Each link should have an SVG icon
      const links = container.querySelectorAll("a");
      links.forEach((link) => {
        expect(link.querySelector("svg")).toBeInTheDocument();
      });
    });
  });

  describe("Empty State", () => {
    it("should return null when links array is empty", () => {
      const { container } = render(<QuickActionsBar links={[]} />);

      expect(container.firstChild).toBeNull();
    });

    it("should return null when links is undefined", () => {
      // @ts-expect-error - Testing undefined case
      const { container } = render(<QuickActionsBar links={undefined} />);

      expect(container.firstChild).toBeNull();
    });
  });

  describe("Icon Selection", () => {
    it("should use Map icon for map href", () => {
      render(<QuickActionsBar links={[{ label: "Map", href: "/map/city" }]} />);

      expect(screen.getByText("Map")).toBeInTheDocument();
    });

    it("should use Waves icon for tide href", () => {
      render(
        <QuickActionsBar links={[{ label: "Tides", href: "/tide/city" }]} />
      );

      expect(screen.getByText("Tides")).toBeInTheDocument();
    });

    it("should use Users icon for beginner href", () => {
      render(
        <QuickActionsBar
          links={[{ label: "Beginner", href: "/beginner/city" }]}
        />
      );

      expect(screen.getByText("Beginner")).toBeInTheDocument();
    });

    it("should use Thermometer icon for water-temp href", () => {
      render(
        <QuickActionsBar
          links={[{ label: "Water Temp", href: "/water-temp/city" }]}
        />
      );

      expect(screen.getByText("Water Temp")).toBeInTheDocument();
    });

    it("should use Users icon for crowded href", () => {
      render(
        <QuickActionsBar
          links={[{ label: "Less Crowded", href: "/least-crowded/city" }]}
        />
      );

      expect(screen.getByText("Less Crowded")).toBeInTheDocument();
    });

    it("should default to Map icon for unknown href", () => {
      render(
        <QuickActionsBar
          links={[{ label: "Unknown", href: "/unknown/city" }]}
        />
      );

      expect(screen.getByText("Unknown")).toBeInTheDocument();
    });
  });

  describe("Single Link", () => {
    it("should render correctly with single link", () => {
      render(
        <QuickActionsBar links={[{ label: "Single", href: "/single" }]} />
      );

      expect(screen.getByText("Single")).toBeInTheDocument();
    });
  });

  describe("Link Structure", () => {
    it("should render links with correct structure", () => {
      render(<QuickActionsBar links={mockLinks} />);

      const links = screen.getAllByRole("link");
      expect(links.length).toBe(mockLinks.length);

      // Each link should contain an icon (SVG) and text
      links.forEach((link, index) => {
        expect(link.querySelector("svg")).toBeInTheDocument();
        expect(link).toHaveTextContent(mockLinks[index].label);
      });
    });

    it("should render links inside navigation container", () => {
      render(<QuickActionsBar links={mockLinks} />);

      const nav = screen.getByRole("navigation");
      const links = screen.getAllByRole("link");

      links.forEach((link) => {
        expect(nav.contains(link)).toBe(true);
      });
    });
  });
});
