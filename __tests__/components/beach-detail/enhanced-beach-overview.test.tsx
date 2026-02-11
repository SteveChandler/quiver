import React from "react";
import { render, screen } from "@testing-library/react";
import { EnhancedBeachOverview } from "@/components/beach-detail/enhanced-beach-overview";
import type { Beach } from "@/types/database";
import { createBeachWithDefaults } from "@/lib/utils/beach-defaults";

// Mock child components
jest.mock("@/components/beach-detail/feature-grid", () => ({
  FeatureGrid: (props: any) => <div data-testid="feature-grid" />,
}));

jest.mock("@/components/beach-detail/practical-tips-section", () => ({
  PracticalTipsSection: (props: any) => <div data-testid="practical-tips" />,
}));

jest.mock("@/components/beach-detail/quick-stats", () => ({
  QuickStats: (props: any) => <div data-testid="quick-stats" />,
}));

// Mock utility functions
jest.mock("@/lib/utils/text-utils", () => ({
  sanitizeBeachDescription: jest.fn((desc) => desc),
  stripMarkdownEmphasis: jest.fn((text) => text),
}));

jest.mock("@/lib/seo/beach-content-utils", () => ({
  buildEnrichedBeachContent: jest.fn(() => null),
  isBeachDescriptionThin: jest.fn(() => false),
}));

// Mock UI components
jest.mock("@/components/ui/card", () => ({
  Card: ({ children, className }: any) => (
    <div className={className} data-testid="card">
      {children}
    </div>
  ),
  CardContent: ({ children, className }: any) => (
    <div className={className}>{children}</div>
  ),
}));

describe("EnhancedBeachOverview", () => {
  const createMockBeach = (overrides = {}) => createBeachWithDefaults({
    id: "test-beach-id",
    name: "Test Beach",
    slug: "test-beach",
    lat: 32.7157,
    lon: -117.1611,
    city: "San Diego",
    state: "CA",
    average_rating: 0,
    review_count: 0,
    ...overrides,
  }) as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Null State", () => {
    it("returns null when beach has no content", () => {
      const beach = createMockBeach();
      const { container } = render(<EnhancedBeachOverview beach={beach} />);

      expect(container.firstChild).toBeNull();
    });

    it("returns null when all content fields are empty arrays or null strings", () => {
      const beach = createMockBeach({
        features: [],
        warnings: [],
        description: "",
        parking_tips: "",
        access_tips: "",
        wave_tips: "",
        crowd_tips: "",
        best_conditions_prose: "",
        local_etiquette: "",
      });
      const { container } = render(<EnhancedBeachOverview beach={beach} />);

      expect(container.firstChild).toBeNull();
    });
  });

  describe("Content Rendering", () => {
    it("renders with description and shows 'About This Spot' heading", () => {
      const beach = createMockBeach({
        description: "A beautiful beach with great waves and sandy shores.",
      });

      render(<EnhancedBeachOverview beach={beach} />);

      expect(screen.getByText("About This Spot")).toBeInTheDocument();
      expect(
        screen.getByText("A beautiful beach with great waves and sandy shores.")
      ).toBeInTheDocument();
    });

    it("renders QuickStats when content exists", () => {
      const beach = createMockBeach({
        description: "Test description",
        average_rating: 4.5,
        review_count: 10,
      });

      render(<EnhancedBeachOverview beach={beach} />);

      expect(screen.getByTestId("quick-stats")).toBeInTheDocument();
    });

    it("renders FeatureGrid when features exist", () => {
      const beach = createMockBeach({
        features: ["Parking", "Restrooms", "Showers"],
      });

      render(<EnhancedBeachOverview beach={beach} />);

      expect(screen.getByTestId("feature-grid")).toBeInTheDocument();
    });

    it("renders PracticalTipsSection when tips exist", () => {
      const beach = createMockBeach({
        parking_tips: "Free parking on weekdays",
        access_tips: "Easy beach access via stairs",
      });

      render(<EnhancedBeachOverview beach={beach} />);

      expect(screen.getByTestId("practical-tips")).toBeInTheDocument();
    });

    it("renders all sections when full content is available", () => {
      const beach = createMockBeach({
        description: "Test beach description",
        features: ["Parking", "Restrooms"],
        parking_tips: "Free parking",
        access_tips: "Easy access",
        wave_tips: "Good for beginners",
        crowd_tips: "Less crowded on weekdays",
        best_conditions_prose: "Best in the morning",
        warnings: ["Strong currents"],
        local_etiquette: "Respect local surfers",
        average_rating: 4.5,
        review_count: 25,
      });

      render(<EnhancedBeachOverview beach={beach} />);

      expect(screen.getByTestId("quick-stats")).toBeInTheDocument();
      expect(screen.getByTestId("feature-grid")).toBeInTheDocument();
      expect(screen.getByTestId("practical-tips")).toBeInTheDocument();
      expect(screen.getByText("About This Spot")).toBeInTheDocument();
    });
  });

  describe("Local Etiquette", () => {
    it("shows local etiquette section when provided", () => {
      const beach = createMockBeach({
        description: "Test description",
        local_etiquette:
          "Be respectful of locals and follow surf lineup etiquette.",
      });

      render(<EnhancedBeachOverview beach={beach} />);

      expect(screen.getByText("Local Etiquette")).toBeInTheDocument();
      expect(
        screen.getByText(
          "Be respectful of locals and follow surf lineup etiquette."
        )
      ).toBeInTheDocument();
    });

    it("does not show local etiquette section when not provided", () => {
      const beach = createMockBeach({
        description: "Test description",
        local_etiquette: null,
      });

      render(<EnhancedBeachOverview beach={beach} />);

      expect(screen.queryByText("Local Etiquette")).not.toBeInTheDocument();
    });
  });

  describe("Custom Styling", () => {
    it("applies custom className when provided", () => {
      const beach = createMockBeach({
        description: "Test description",
      });

      const { container } = render(
        <EnhancedBeachOverview beach={beach} className="custom-class" />
      );

      const wrapper = container.querySelector(".custom-class");
      expect(wrapper).toBeInTheDocument();
    });

    it("renders without custom className", () => {
      const beach = createMockBeach({
        description: "Test description",
      });

      const { container } = render(<EnhancedBeachOverview beach={beach} />);

      expect(container.firstChild).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("handles description with only whitespace", () => {
      const beach = createMockBeach({
        description: "   ",
      });

      render(<EnhancedBeachOverview beach={beach} />);

      // Component renders but with whitespace in description
      // This is acceptable behavior - component doesn't validate whitespace-only strings
      expect(screen.getByText("About This Spot")).toBeInTheDocument();
    });

    it("handles mixed content availability", () => {
      const beach = createMockBeach({
        description: null,
        features: ["Parking"],
        parking_tips: "Free parking",
        access_tips: null,
        wave_tips: null,
        warnings: [],
      });

      render(<EnhancedBeachOverview beach={beach} />);

      // Should render with partial content
      expect(screen.getByTestId("feature-grid")).toBeInTheDocument();
      expect(screen.getByTestId("practical-tips")).toBeInTheDocument();
    });

    it("handles warnings array with content", () => {
      const beach = createMockBeach({
        description: "Test description",
        warnings: ["Strong currents", "Rocky bottom"],
      });

      render(<EnhancedBeachOverview beach={beach} />);

      // Component should render (warnings are passed to child components)
      expect(screen.getByText("About This Spot")).toBeInTheDocument();
    });
  });
});
