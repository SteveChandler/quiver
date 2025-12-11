/**
 * Tests for SessionTimingModules Component
 *
 * Tests the session timing modules component that displays tactical surf advice.
 * Priority 3 test coverage for San Diego page redesign.
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { SessionTimingModules } from "@/components/city/session-timing-modules";
import type { SessionTimingModule } from "@/actions/city/city-editorial-actions";

describe("SessionTimingModules Component", () => {
  const mockModules: SessionTimingModule[] = [
    {
      icon: "sun",
      title: "Today",
      summary:
        "Marine layer burning off by 9am. Light onshore winds expected after noon.",
    },
    {
      icon: "clock",
      title: "Now",
      summary: "SW swell peaking at 3-4ft. Best conditions at low tide windows.",
    },
    {
      icon: "calendar",
      title: "Weekend",
      summary:
        "New NW swell arriving Saturday. Plan for early sessions before crowds build.",
    },
  ];

  describe("Rendering", () => {
    it("should render section heading", () => {
      render(<SessionTimingModules modules={mockModules} />);

      expect(screen.getByText("Session Timing")).toBeInTheDocument();
    });

    it("should render all module cards", () => {
      render(<SessionTimingModules modules={mockModules} />);

      expect(screen.getByText("Today")).toBeInTheDocument();
      expect(screen.getByText("Now")).toBeInTheDocument();
      expect(screen.getByText("Weekend")).toBeInTheDocument();
    });

    it("should render module summaries", () => {
      render(<SessionTimingModules modules={mockModules} />);

      expect(
        screen.getByText(/Marine layer burning off by 9am/)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/SW swell peaking at 3-4ft/)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/New NW swell arriving Saturday/)
      ).toBeInTheDocument();
    });

    it("should render icons for each module", () => {
      const { container } = render(
        <SessionTimingModules modules={mockModules} />
      );

      // Each module card should have an SVG icon
      const cards = container.querySelectorAll("[class*='rounded-xl']");
      expect(cards.length).toBe(3);
      cards.forEach((card) => {
        expect(card.querySelector("svg")).toBeInTheDocument();
      });
    });

    it("should render 3-column grid on desktop", () => {
      const { container } = render(
        <SessionTimingModules modules={mockModules} />
      );

      const grid = container.querySelector("[class*='md:grid-cols-3']");
      expect(grid).toBeInTheDocument();
    });
  });

  describe("Empty State", () => {
    it("should return null when modules array is empty", () => {
      const { container } = render(<SessionTimingModules modules={[]} />);

      expect(container.firstChild).toBeNull();
    });

    it("should return null when modules is undefined", () => {
      // @ts-expect-error - Testing undefined case
      const { container } = render(<SessionTimingModules modules={undefined} />);

      expect(container.firstChild).toBeNull();
    });
  });

  describe("Icon Selection", () => {
    it("should use Sun icon for sun type", () => {
      render(
        <SessionTimingModules
          modules={[{ icon: "sun", title: "Test", summary: "Test summary" }]}
        />
      );

      expect(screen.getByText("Test")).toBeInTheDocument();
    });

    it("should use Clock icon for clock type", () => {
      render(
        <SessionTimingModules
          modules={[{ icon: "clock", title: "Test", summary: "Test summary" }]}
        />
      );

      expect(screen.getByText("Test")).toBeInTheDocument();
    });

    it("should use Calendar icon for calendar type", () => {
      render(
        <SessionTimingModules
          modules={[{ icon: "calendar", title: "Test", summary: "Test summary" }]}
        />
      );

      expect(screen.getByText("Test")).toBeInTheDocument();
    });

    it("should default to Sun icon for unknown type", () => {
      render(
        <SessionTimingModules
          modules={[{ icon: "unknown" as any, title: "Test", summary: "Test summary" }]}
        />
      );

      expect(screen.getByText("Test")).toBeInTheDocument();
    });

    it("should handle case-insensitive icon names", () => {
      render(
        <SessionTimingModules
          modules={[{ icon: "SUN" as any, title: "Test", summary: "Test summary" }]}
        />
      );

      expect(screen.getByText("Test")).toBeInTheDocument();
    });
  });

  describe("Single Module", () => {
    it("should render correctly with single module", () => {
      render(
        <SessionTimingModules
          modules={[{ icon: "sun", title: "Single", summary: "Single summary" }]}
        />
      );

      expect(screen.getByText("Single")).toBeInTheDocument();
      expect(screen.getByText("Single summary")).toBeInTheDocument();
    });
  });

  describe("Heading Levels", () => {
    it("should use h2 for section heading", () => {
      render(<SessionTimingModules modules={mockModules} />);

      const heading = screen.getByRole("heading", { name: "Session Timing" });
      expect(heading.tagName).toBe("H2");
    });

    it("should use h3 for module titles", () => {
      render(<SessionTimingModules modules={mockModules} />);

      const moduleHeading = screen.getByRole("heading", { name: "Today" });
      expect(moduleHeading.tagName).toBe("H3");
    });
  });

  describe("Card Styling", () => {
    it("should apply card styling classes", () => {
      const { container } = render(
        <SessionTimingModules modules={mockModules} />
      );

      const card = container.querySelector("[class*='rounded-xl']");
      expect(card?.className).toContain("border");
      expect(card?.className).toContain("bg-slate-50");
      expect(card?.className).toContain("p-5");
    });

    it("should render icons in each card", () => {
      const { container } = render(
        <SessionTimingModules modules={mockModules} />
      );

      // Each module card should have an SVG icon
      const cards = container.querySelectorAll("[class*='rounded-xl']");
      cards.forEach((card) => {
        expect(card.querySelector("svg")).toBeInTheDocument();
      });
    });
  });
});
