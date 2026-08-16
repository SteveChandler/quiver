/**
 * Unit tests for BeachHeroCompact Component
 * Phase 4: Hero & Breadcrumb - Beach Detail Refactor
 *
 * Tests validate compliance with specifications from:
 * docs/quiver_beach_detail_refactor.md - Phase 4
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { useReducedMotion } from "framer-motion";
import { BeachHeroCompact } from "@/components/beach-detail/beach-hero-compact";
import type { Beach } from "@/types/database";

jest.mock("framer-motion", () => {
  const React = require("react");

  return {
    useReducedMotion: jest.fn(() => false),
    motion: {
      div: React.forwardRef(
        (
          { children, ...props }: { children?: React.ReactNode } & Record<
            string,
            unknown
          >,
          ref: React.Ref<HTMLDivElement>
        ) => (
          <div
            ref={ref}
            {...Object.fromEntries(
              Object.entries(props).flatMap(([key, value]) => {
                if (!["initial", "animate", "exit", "transition"].includes(key)) {
                  return [[key, value]];
                }
                if (value === undefined) return [];
                return [[`data-motion-${key}`, JSON.stringify(value)]];
              })
            )}
          >
            {children}
          </div>
        )
      ),
    },
  };
});

const mockUseReducedMotion = useReducedMotion as jest.MockedFunction<
  typeof useReducedMotion
>;

afterEach(() => {
  mockUseReducedMotion.mockReturnValue(false);
});

const mockBeach = {
  id: "test-beach-1",
  name: "Ocean Beach",
  city: "San Francisco",
  state: "CA",
  region: "Northern California",
  lat: 37.7749,
  lon: -122.4194,
  break_type: "Beach Break",
  skill_level: "Intermediate",
  wave_quality_rating: 4.5,
  average_rating: 4.5,
  review_count: 42,
  created_at: "2024-01-01",
  updated_at: "2024-01-01",
  enabled: true,
  country: "USA",
} as any;

describe("BeachHeroCompact Component - Phase 4 Specifications", () => {
  describe("Container Styling", () => {
    it("should render with white background and bottom border", () => {
      const { container } = render(<BeachHeroCompact beach={mockBeach} />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass("bg-white");
      expect(wrapper).toHaveClass("border-b");
      expect(wrapper).toHaveClass("border-gray-200");
    });

    it("should have vertical padding of 24px (py-6)", () => {
      const { container } = render(<BeachHeroCompact beach={mockBeach} />);
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass("py-6");
    });
  });

  describe("Beach Name Typography - Phase 4 Spec", () => {
    it("should render beach name as h1 element", () => {
      render(<BeachHeroCompact beach={mockBeach} />);
      const heading = screen.getByRole("heading", { level: 1 });
      expect(heading).toHaveTextContent("Ocean Beach");
    });

    it("should have text-4xl class (36px font-size)", () => {
      render(<BeachHeroCompact beach={mockBeach} />);
      const heading = screen.getByRole("heading", { level: 1 });
      expect(heading).toHaveClass("text-4xl");
    });

    it("should use heading font family", () => {
      render(<BeachHeroCompact beach={mockBeach} />);
      const heading = screen.getByRole("heading", { level: 1 });
      expect(heading).toHaveClass("font-heading");
    });

    it("should have font-bold (700 weight)", () => {
      render(<BeachHeroCompact beach={mockBeach} />);
      const heading = screen.getByRole("heading", { level: 1 });
      expect(heading).toHaveClass("font-bold");
      expect(heading).not.toHaveClass("font-extrabold");
    });

    it("should have 44px line-height (leading-[44px])", () => {
      render(<BeachHeroCompact beach={mockBeach} />);
      const heading = screen.getByRole("heading", { level: 1 });
      expect(heading).toHaveClass("leading-[44px]");
    });

    it("should have 8px margin-bottom (mb-2)", () => {
      render(<BeachHeroCompact beach={mockBeach} />);
      const heading = screen.getByRole("heading", { level: 1 });
      expect(heading).toHaveClass("mb-2");
    });

    it("should use gray-900 text color", () => {
      render(<BeachHeroCompact beach={mockBeach} />);
      const heading = screen.getByRole("heading", { level: 1 });
      expect(heading).toHaveClass("text-gray-900");
    });
  });

  describe("Rating Component - Phase 4 Spec", () => {
    it("should display rating stars with 20×20px size (h-5 w-5)", () => {
      render(<BeachHeroCompact beach={mockBeach} />);
      const star = document.querySelector(".lucide-star");
      expect(star).toHaveClass("h-5");
      expect(star).toHaveClass("w-5");
    });

    it("should display rating text with 18px size and 600 weight", () => {
      render(<BeachHeroCompact beach={mockBeach} />);
      const ratingText = screen.getByText("4.5");
      expect(ratingText).toHaveClass("text-lg"); // 18px
      expect(ratingText).toHaveClass("font-semibold"); // 600 weight
    });

    it("should display rating text in gray-900", () => {
      render(<BeachHeroCompact beach={mockBeach} />);
      const ratingText = screen.getByText("4.5");
      expect(ratingText).toHaveClass("text-gray-900");
    });

    it("should display review count with 14px size (text-sm)", () => {
      render(<BeachHeroCompact beach={mockBeach} />);
      const reviewCount = screen.getByText(/42 reviews/);
      expect(reviewCount).toHaveClass("text-sm");
    });

    it("should display review count in gray-600", () => {
      render(<BeachHeroCompact beach={mockBeach} />);
      const reviewCount = screen.getByText(/42 reviews/);
      expect(reviewCount).toHaveClass("text-gray-600");
    });

    it("should format review count correctly (singular)", () => {
      const singleReviewBeach = { ...mockBeach, review_count: 1 };
      render(<BeachHeroCompact beach={singleReviewBeach} />);
      expect(screen.getByText("(1 review)")).toBeInTheDocument();
    });

    it("should format review count correctly (plural)", () => {
      render(<BeachHeroCompact beach={mockBeach} />);
      expect(screen.getByText("(42 reviews)")).toBeInTheDocument();
    });

    it("should not display rating when rating is 0", () => {
      const noRatingBeach = {
        ...mockBeach,
        wave_quality_rating: 0,
        average_rating: 0,
      };
      render(<BeachHeroCompact beach={noRatingBeach} />);
      expect(screen.queryByText("0.0")).not.toBeInTheDocument();
      expect(screen.queryByText("0")).not.toBeInTheDocument();
    });

    it("should use average_rating if available", () => {
      render(<BeachHeroCompact beach={mockBeach} />);
      expect(screen.getByText("4.5")).toBeInTheDocument();
    });

    it("should not display rating if average_rating not available", () => {
      const beach = {
        ...mockBeach,
        average_rating: null,
        wave_quality_rating: 3.8,
      } as any;
      render(<BeachHeroCompact beach={beach} />);
      // Component only uses average_rating, not wave_quality_rating as fallback
      expect(screen.queryByText("3.8")).not.toBeInTheDocument();
    });

    it("should not display rating section when average_rating is undefined", () => {
      const beach = {
        ...mockBeach,
        average_rating: undefined,
      } as any;
      render(<BeachHeroCompact beach={beach} />);
      const star = document.querySelector(".lucide-star");
      expect(star).not.toBeInTheDocument();
    });
  });

  describe("Status Badge (Difficulty) - Phase 4 Spec", () => {
    it("should render difficulty badge with pill shape (rounded-full)", () => {
      render(<BeachHeroCompact beach={mockBeach} />);
      const badge = screen.getByText("Intermediate");
      expect(badge).toHaveClass("rounded-full");
    });

    it("should have correct padding (px-3 py-1 = 4px/12px)", () => {
      render(<BeachHeroCompact beach={mockBeach} />);
      const badge = screen.getByText("Intermediate");
      expect(badge).toHaveClass("px-3");
      expect(badge).toHaveClass("py-1");
    });

    it("should have 12px font-size (text-xs)", () => {
      render(<BeachHeroCompact beach={mockBeach} />);
      const badge = screen.getByText("Intermediate");
      expect(badge).toHaveClass("text-xs");
    });

    it("should have 600 font-weight (font-semibold)", () => {
      render(<BeachHeroCompact beach={mockBeach} />);
      const badge = screen.getByText("Intermediate");
      expect(badge).toHaveClass("font-semibold");
    });

    it("should use blue-50/ocean-blue for Beginner difficulty", () => {
      const beginnerBeach = { ...mockBeach, skill_level: "Beginner" };
      render(<BeachHeroCompact beach={beginnerBeach} />);
      const badge = screen.getByText("Beginner");
      expect(badge).toHaveClass("bg-blue-50");
      expect(badge).toHaveClass("text-ocean-blue");
    });

    it("should use blue-50/ocean-blue for Easy difficulty", () => {
      const easyBeach = { ...mockBeach, skill_level: "Easy" };
      render(<BeachHeroCompact beach={easyBeach} />);
      const badge = screen.getByText("Easy");
      expect(badge).toHaveClass("bg-blue-50");
      expect(badge).toHaveClass("text-ocean-blue");
    });

    it("should use orange-50/orange-600 for Intermediate difficulty", () => {
      render(<BeachHeroCompact beach={mockBeach} />);
      const badge = screen.getByText("Intermediate");
      expect(badge).toHaveClass("bg-orange-50");
      expect(badge).toHaveClass("text-orange-600");
    });

    it("should use red-50/red-600 for Advanced difficulty", () => {
      const advancedBeach = { ...mockBeach, skill_level: "Advanced" };
      render(<BeachHeroCompact beach={advancedBeach} />);
      const badge = screen.getByText("Advanced");
      expect(badge).toHaveClass("bg-red-50");
      expect(badge).toHaveClass("text-red-600");
    });

    it("should use red-50/red-600 for Expert difficulty", () => {
      const expertBeach = { ...mockBeach, skill_level: "Expert" };
      render(<BeachHeroCompact beach={expertBeach} />);
      const badge = screen.getByText("Expert");
      expect(badge).toHaveClass("bg-red-50");
      expect(badge).toHaveClass("text-red-600");
    });

    it("should use cyan-50/cyan-600 for unknown difficulty levels", () => {
      const unknownBeach = { ...mockBeach, skill_level: "Unknown Level" };
      render(<BeachHeroCompact beach={unknownBeach} />);
      const badge = screen.getByText("Unknown Level");
      expect(badge).toHaveClass("bg-cyan-50");
      expect(badge).toHaveClass("text-cyan-600");
    });

    it("should have transparent border", () => {
      render(<BeachHeroCompact beach={mockBeach} />);
      const badge = screen.getByText("Intermediate");
      expect(badge).toHaveClass("border-transparent");
    });
  });

  describe("Metadata Row Layout", () => {
    it("should use flex layout with wrap", () => {
      const { container } = render(<BeachHeroCompact beach={mockBeach} />);
      const metadataRow = container.querySelector(".flex.flex-wrap");
      expect(metadataRow).toBeInTheDocument();
    });

    it("should have gap-2 spacing (8px)", () => {
      const { container } = render(<BeachHeroCompact beach={mockBeach} />);
      const metadataRow = container.querySelector(".flex.flex-wrap");
      expect(metadataRow).toHaveClass("gap-2");
    });

    it("should display break type", () => {
      render(<BeachHeroCompact beach={mockBeach} />);
      expect(screen.getByText("Beach Break")).toBeInTheDocument();
    });

    it("should display location", () => {
      render(<BeachHeroCompact beach={mockBeach} />);
      expect(screen.getByText("San Francisco, CA")).toBeInTheDocument();
    });

    it("should fallback to region if city/state not available", () => {
      const beach = { ...mockBeach, city: null, state: null } as any;
      render(<BeachHeroCompact beach={beach} />);
      expect(screen.getByText("Northern California")).toBeInTheDocument();
    });

    it("should use default break type if not specified", () => {
      const beach = { ...mockBeach, break_type: null };
      render(<BeachHeroCompact beach={beach} />);
      expect(screen.getByText("Beach Break")).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("should have proper heading hierarchy", () => {
      render(<BeachHeroCompact beach={mockBeach} />);
      const heading = screen.getByRole("heading", { level: 1 });
      expect(heading).toBeInTheDocument();
    });

    it("skips the forecast teaser entrance animation when reduced motion is requested", () => {
      mockUseReducedMotion.mockReturnValue(true);

      render(<BeachHeroCompact beach={mockBeach} publicMode />);

      const teaser = screen.getByTestId("beach-hero-forecast-teaser");
      const motionContainer = teaser.parentElement as HTMLElement;
      expect(motionContainer).toHaveAttribute("data-motion-initial", "false");
      expect(motionContainer).not.toHaveAttribute("data-motion-animate");
      expect(motionContainer).toHaveAttribute(
        "data-motion-transition",
        JSON.stringify({ duration: 0 })
      );
    });

    it("should maintain semantic HTML structure", () => {
      const { container } = render(<BeachHeroCompact beach={mockBeach} />);
      expect(container.querySelector("h1")).toBeInTheDocument();
    });
  });

  describe("Custom className prop", () => {
    it("should apply custom className to container", () => {
      const { container } = render(
        <BeachHeroCompact beach={mockBeach} className="custom-class" />
      );
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass("custom-class");
    });

    it("should preserve default classes when custom className is added", () => {
      const { container } = render(
        <BeachHeroCompact beach={mockBeach} className="custom-class" />
      );
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass("bg-white");
      expect(wrapper).toHaveClass("custom-class");
    });
  });
});
