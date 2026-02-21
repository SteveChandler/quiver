/**
 * Unit Tests for NearbyBeachesEnriched component
 *
 * Tests skill_level prop pass-through to SurfSpotCard:
 * - Real skill levels render correctly in both desktop and mobile layouts
 * - Null skill_level falls back to "All levels"
 * - Mixed skill levels across multiple cards
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { NearbyBeachesEnriched } from "@/components/beach-detail/nearby-spots-enriched";
import type { EnrichedNearbyBeach } from "@/lib/utils/nearby-beach-enrichment";

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
}));

// Mock next/link
jest.mock("next/link", () => ({
  __esModule: true,
  default: ({
    children,
    href,
    ...rest
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// Mock analytics
jest.mock("@/lib/analytics/engagement-tracking", () => ({
  trackNearbyBeachClick: jest.fn(),
  trackNearbyBeachesViewed: jest.fn(),
}));

// Mock blur placeholders
jest.mock("@/lib/constants/blur-placeholders", () => ({
  getBlurPlaceholder: () => undefined,
}));

// Mock beach URL utils
jest.mock("@/lib/utils/beach-url-utils", () => ({
  getBeachHrefSafe: (beach: { slug?: string }) =>
    `/ca/san-diego/${beach.slug || "test"}`,
}));

// Mock IntersectionObserver
beforeAll(() => {
  global.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof IntersectionObserver;
});

function createMockEnrichedBeach(
  overrides: Partial<EnrichedNearbyBeach> = {}
): EnrichedNearbyBeach {
  return {
    id: "beach-1",
    name: "Test Beach",
    slug: "test-beach",
    city: "San Diego",
    state: "CA",
    center_lat: 32.8,
    center_lng: -117.2,
    created_at: "2024-01-01T00:00:00Z",
    score: 7.5,
    waveHeight: 4.2,
    photoUrl: null,
    ...overrides,
  } as EnrichedNearbyBeach;
}

describe("NearbyBeachesEnriched", () => {
  const defaultProps = {
    sourceBeachName: "Blacks",
    sourceBeachLat: 32.88,
    sourceBeachLon: -117.25,
  };

  it("renders nothing when beaches array is empty", () => {
    const { container } = render(
      <NearbyBeachesEnriched {...defaultProps} beaches={[]} />
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders Nearby Surf Spots heading", () => {
    const beaches = [createMockEnrichedBeach()];
    render(<NearbyBeachesEnriched {...defaultProps} beaches={beaches} />);
    expect(
      screen.getByRole("heading", { name: /nearby surf spots/i })
    ).toBeInTheDocument();
  });

  describe("skill level pass-through", () => {
    it("renders real skill level from beach data", () => {
      const beaches = [
        createMockEnrichedBeach({
          id: "b1",
          name: "Advanced Reef",
          skill_level: "advanced",
        }),
      ];
      render(<NearbyBeachesEnriched {...defaultProps} beaches={beaches} />);
      expect(screen.getAllByText("Advanced").length).toBeGreaterThan(0);
    });

    it("renders compound skill level correctly", () => {
      const beaches = [
        createMockEnrichedBeach({
          id: "b1",
          name: "Mid Break",
          skill_level: "intermediate-advanced",
        }),
      ];
      render(<NearbyBeachesEnriched {...defaultProps} beaches={beaches} />);
      expect(
        screen.getAllByText("Intermediate-Advanced").length
      ).toBeGreaterThan(0);
    });

    it("renders 'All levels' when skill_level is null", () => {
      const beaches = [
        createMockEnrichedBeach({
          id: "b1",
          name: "Unknown Level",
          skill_level: null,
        }),
      ];
      render(<NearbyBeachesEnriched {...defaultProps} beaches={beaches} />);
      expect(screen.getAllByText("All levels").length).toBeGreaterThan(0);
    });

    it("renders mixed skill levels across multiple cards", () => {
      const beaches = [
        createMockEnrichedBeach({
          id: "b1",
          name: "Beach A",
          skill_level: "advanced",
        }),
        createMockEnrichedBeach({
          id: "b2",
          name: "Beach B",
          skill_level: "beginner-intermediate",
        }),
        createMockEnrichedBeach({
          id: "b3",
          name: "Beach C",
          skill_level: null,
        }),
      ];
      render(<NearbyBeachesEnriched {...defaultProps} beaches={beaches} />);

      // Each skill level should appear (desktop + mobile = 2 instances each)
      expect(screen.getAllByText("Advanced").length).toBeGreaterThan(0);
      expect(
        screen.getAllByText("Beginner-Intermediate").length
      ).toBeGreaterThan(0);
      expect(screen.getAllByText("All levels").length).toBeGreaterThan(0);
    });
  });
});
