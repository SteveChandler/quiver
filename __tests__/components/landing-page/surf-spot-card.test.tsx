/**
 * Unit Tests for SurfSpotCard component
 *
 * Tests skill level rendering via formatSkillLevel():
 * - Standard values (beginner, intermediate, advanced)
 * - Compound values (intermediate-advanced)
 * - Null/undefined fallback to "All levels"
 * - Underscore format normalization
 *
 * Tests wave height rendering:
 * - String wave heights (raw from forecast API) display rounded, no variance multiplier
 * - Zero/null/undefined wave heights are hidden
 * - Numeric wave heights still use formatWaveHeightRange (backward compat)
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { SurfSpotCard } from "@/components/landing-page/surf-spot-card";

// Mock next/image
jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...props} />;
  },
}));

// Mock next/navigation
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: jest.fn(() => "/"),
  useSearchParams: jest.fn(() => new URLSearchParams()),
}));

// Mock blur placeholders
jest.mock("@/lib/constants/blur-placeholders", () => ({
  getBlurPlaceholder: () => undefined,
}));

// Mock beach URL utils
jest.mock("@/lib/utils/beach-url-utils", () => ({
  getBeachHrefSafe: () => "/ca/san-diego/test-beach",
}));

const defaultProps = {
  id: "test-id",
  name: "Test Beach",
  location: "San Diego, CA",
};

describe("SurfSpotCard", () => {
  describe("skill level rendering", () => {
    it("renders 'All levels' when skillLevel is undefined", () => {
      render(<SurfSpotCard {...defaultProps} />);
      expect(screen.getByText("All levels")).toBeInTheDocument();
    });

    it("renders 'All levels' when skillLevel is null", () => {
      render(<SurfSpotCard {...defaultProps} skillLevel={null} />);
      expect(screen.getByText("All levels")).toBeInTheDocument();
    });

    it("renders 'All levels' when skillLevel is empty string", () => {
      render(<SurfSpotCard {...defaultProps} skillLevel="" />);
      expect(screen.getByText("All levels")).toBeInTheDocument();
    });

    it("renders 'Advanced' for skillLevel='advanced'", () => {
      render(<SurfSpotCard {...defaultProps} skillLevel="advanced" />);
      expect(screen.getByText("Advanced")).toBeInTheDocument();
    });

    it("renders 'Beginner' for skillLevel='beginner'", () => {
      render(<SurfSpotCard {...defaultProps} skillLevel="beginner" />);
      expect(screen.getByText("Beginner")).toBeInTheDocument();
    });

    it("renders 'Intermediate' for skillLevel='intermediate'", () => {
      render(<SurfSpotCard {...defaultProps} skillLevel="intermediate" />);
      expect(screen.getByText("Intermediate")).toBeInTheDocument();
    });

    it("renders compound skill levels with capitalization", () => {
      render(
        <SurfSpotCard {...defaultProps} skillLevel="intermediate-advanced" />
      );
      expect(screen.getByText("Intermediate-Advanced")).toBeInTheDocument();
    });

    it("renders beginner-intermediate correctly", () => {
      render(
        <SurfSpotCard {...defaultProps} skillLevel="beginner-intermediate" />
      );
      expect(screen.getByText("Beginner-Intermediate")).toBeInTheDocument();
    });

    it("normalizes underscore format to title case", () => {
      render(
        <SurfSpotCard
          {...defaultProps}
          skillLevel="intermediate_to_advanced"
        />
      );
      expect(
        screen.getByText("Intermediate To Advanced")
      ).toBeInTheDocument();
    });
  });

  describe("wave height rendering", () => {
    it("renders string wave height as rounded integer with ft suffix", () => {
      render(<SurfSpotCard {...defaultProps} waveHeight="2.8" />);
      expect(screen.getByText("3ft")).toBeInTheDocument();
    });

    it("renders string wave height '5.2' as '5ft'", () => {
      render(<SurfSpotCard {...defaultProps} waveHeight="5.2" />);
      expect(screen.getByText("5ft")).toBeInTheDocument();
    });

    it("does not render wave section for string '0'", () => {
      render(<SurfSpotCard {...defaultProps} waveHeight="0" />);
      expect(screen.queryByText("0ft")).not.toBeInTheDocument();
      expect(screen.queryByText("Flat")).not.toBeInTheDocument();
    });

    it("does not render wave section for string '0.0'", () => {
      render(<SurfSpotCard {...defaultProps} waveHeight="0.0" />);
      expect(screen.queryByText("0ft")).not.toBeInTheDocument();
      expect(screen.queryByText("Flat")).not.toBeInTheDocument();
    });

    it("does not render wave section for null", () => {
      render(<SurfSpotCard {...defaultProps} waveHeight={null} />);
      expect(screen.queryByText(/ft$/)).not.toBeInTheDocument();
    });

    it("does not render wave section for undefined", () => {
      render(<SurfSpotCard {...defaultProps} />);
      expect(screen.queryByText(/ft$/)).not.toBeInTheDocument();
    });

    it("renders numeric wave height via formatWaveHeightRange", () => {
      // Numeric path still uses the formatter (backward compat)
      render(<SurfSpotCard {...defaultProps} waveHeight={3} />);
      // Surfline-parity: floor(3)=3, ceil(3)=3 → "3ft" (no × 1.5 expansion).
      expect(screen.getByText("3ft")).toBeInTheDocument();
    });
  });
});
