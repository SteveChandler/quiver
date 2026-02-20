/**
 * Unit Tests for QuickStats component
 *
 * Tests formatSkillLevel() consistency with SurfSpotCard:
 * - Standard values (beginner, intermediate, advanced, expert)
 * - Compound hyphenated values (intermediate-advanced)
 * - Underscore format normalization
 * - Null/undefined fallback to "All Levels"
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { QuickStats } from "@/components/beach-detail/quick-stats";

describe("QuickStats", () => {
  describe("skill level formatting", () => {
    it("renders 'All Levels' when skillLevel is undefined", () => {
      render(<QuickStats />);
      expect(screen.getByText("All Levels")).toBeInTheDocument();
    });

    it("renders 'Advanced' for skillLevel='advanced'", () => {
      render(<QuickStats skillLevel="advanced" />);
      expect(screen.getByText("Advanced")).toBeInTheDocument();
    });

    it("renders 'Beginner' for skillLevel='beginner'", () => {
      render(<QuickStats skillLevel="beginner" />);
      expect(screen.getByText("Beginner")).toBeInTheDocument();
    });

    it("renders 'Intermediate' for skillLevel='intermediate'", () => {
      render(<QuickStats skillLevel="intermediate" />);
      expect(screen.getByText("Intermediate")).toBeInTheDocument();
    });

    it("renders 'Expert' for skillLevel='expert'", () => {
      render(<QuickStats skillLevel="expert" />);
      expect(screen.getByText("Expert")).toBeInTheDocument();
    });

    it("renders compound hyphenated values with both words capitalized", () => {
      render(<QuickStats skillLevel="intermediate-advanced" />);
      expect(screen.getByText("Intermediate-Advanced")).toBeInTheDocument();
    });

    it("renders beginner-intermediate with both words capitalized", () => {
      render(<QuickStats skillLevel="beginner-intermediate" />);
      expect(screen.getByText("Beginner-Intermediate")).toBeInTheDocument();
    });

    it("normalizes underscore format to title case with spaces", () => {
      render(<QuickStats skillLevel="intermediate_to_advanced" />);
      expect(
        screen.getByText("Intermediate To Advanced")
      ).toBeInTheDocument();
    });
  });
});
