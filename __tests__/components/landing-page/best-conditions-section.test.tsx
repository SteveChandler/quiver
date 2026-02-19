/**
 * Unit Tests for BestConditionsSection Component
 *
 * Tests the "Best conditions right now" homepage section:
 * - Rendering conditional on data availability
 * - Loading skeleton state
 * - SurfSpotCard rendering for each entry
 * - Section title and description
 * - Image URL resolution (proxied images, fallbacks)
 * - Analytics tracking (view, click)
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { BestConditionsSection } from "@/components/landing-page/best-conditions-section";
import type { TopBeachEntry } from "@/lib/utils/forecast-hub-utils";

// Mock dependencies
jest.mock("@/hooks/use-data-fetcher", () => ({
  useDataFetcher: jest.fn(),
}));

jest.mock("@/actions/forecast/get-top-beaches-now", () => ({
  getTopBeachesNow: jest.fn(),
}));

jest.mock("@/lib/analytics/engagement-tracking", () => ({
  trackBestConditionsClick: jest.fn(),
  trackBestConditionsViewed: jest.fn(),
}));

jest.mock("@/lib/utils/image-utils", () => ({
  getProxiedImageUrl: jest.fn((url) => `/api/proxy-image?url=${encodeURIComponent(url)}`),
}));

jest.mock("@/lib/constants/featured-beaches-config", () => ({
  FALLBACK_IMAGE_BY_NAME: {
    "Blacks Beach": "/blacks-fallback.jpg",
    "Pipeline": "/pipeline-fallback.jpg",
  },
}));

jest.mock("@/components/landing-page/surf-spot-card", () => ({
  SurfSpotCard: ({
    id,
    name,
    location,
    slug,
    city,
    state,
    imageUrl,
    score,
    waveHeight,
    averageRating,
    skillLevel,
    delay,
  }: any) => (
    <div data-testid="surf-spot-card" data-beach-id={id} data-delay={delay}>
      <h3>{name}</h3>
      <p>{location}</p>
      <p>
        {city}, {state}
      </p>
      <p>Slug: {slug}</p>
      <img src={imageUrl} alt={name} />
      <p>Score: {score}</p>
      <p>Wave Height: {waveHeight}</p>
      {averageRating && <p>Rating: {averageRating}</p>}
      {skillLevel && <p>Skill: {skillLevel}</p>}
    </div>
  ),
}));

jest.mock("@/components/ui/skeleton", () => ({
  Skeleton: ({ className }: { className?: string }) => (
    <div data-testid="skeleton" className={className} />
  ),
}));

describe("BestConditionsSection", () => {
  const { useDataFetcher } = require("@/hooks/use-data-fetcher");
  const {
    trackBestConditionsClick,
    trackBestConditionsViewed,
  } = require("@/lib/analytics/engagement-tracking");

  const mockEntries: TopBeachEntry[] = [
    {
      beachId: "beach-1",
      beachName: "Blacks Beach",
      score: 9,
      waveHeight: 6.5,
      regionName: "San Diego",
      href: "/ca/san-diego/blacks",
      slug: "blacks",
      city: "San Diego",
      state: "CA",
      imageUrl: "https://example.com/blacks.jpg",
      averageRating: 4.5,
      skillLevel: "Advanced",
    },
    {
      beachId: "beach-2",
      beachName: "Pipeline",
      score: 10,
      waveHeight: 8.0,
      regionName: "North Shore",
      href: "/hi/haleiwa/pipeline",
      slug: "pipeline",
      city: "Haleiwa",
      state: "HI",
      imageUrl: null, // Test fallback
      averageRating: 5.0,
      skillLevel: "Expert",
    },
    {
      beachId: "beach-3",
      beachName: "Trestles",
      score: 8,
      waveHeight: 4.5,
      regionName: "Orange County",
      href: "/ca/san-clemente/trestles",
      slug: "trestles",
      city: "San Clemente",
      state: "CA",
      imageUrl: "https://example.com/trestles.jpg",
      averageRating: null,
      skillLevel: null,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock IntersectionObserver
    global.IntersectionObserver = class IntersectionObserver {
      constructor(
        public callback: IntersectionObserverCallback,
        public options?: IntersectionObserverInit
      ) {}
      observe() {
        // Immediately trigger intersection
        this.callback(
          [{ isIntersecting: true } as IntersectionObserverEntry],
          this as any
        );
      }
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
      root = null;
      rootMargin = "";
      thresholds = [];
    } as any;
  });

  describe("Rendering Conditions", () => {
    it("returns null when no data and not loading", () => {
      useDataFetcher.mockReturnValue({
        data: null,
        loading: false,
      });

      const { container } = render(<BestConditionsSection />);

      expect(container.firstChild).toBeNull();
    });

    it("returns null when data is empty array", () => {
      useDataFetcher.mockReturnValue({
        data: [],
        loading: false,
      });

      const { container } = render(<BestConditionsSection />);

      expect(container.firstChild).toBeNull();
    });

    it("renders when loading is true", () => {
      useDataFetcher.mockReturnValue({
        data: null,
        loading: true,
      });

      render(<BestConditionsSection />);

      expect(screen.getByText("Best conditions right now")).toBeInTheDocument();
    });

    it("renders when data is available", () => {
      useDataFetcher.mockReturnValue({
        data: mockEntries,
        loading: false,
      });

      render(<BestConditionsSection />);

      expect(screen.getByText("Best conditions right now")).toBeInTheDocument();
    });
  });

  describe("Loading State", () => {
    it("shows skeleton loading state", () => {
      useDataFetcher.mockReturnValue({
        data: null,
        loading: true,
      });

      render(<BestConditionsSection />);

      const skeletons = screen.getAllByTestId("skeleton");
      expect(skeletons).toHaveLength(6);
    });

    it("skeletons have correct styling", () => {
      useDataFetcher.mockReturnValue({
        data: null,
        loading: true,
      });

      render(<BestConditionsSection />);

      const skeletons = screen.getAllByTestId("skeleton");
      skeletons.forEach((skeleton) => {
        expect(skeleton).toHaveClass("h-80");
        expect(skeleton).toHaveClass("rounded-2xl");
      });
    });

    it("renders 6 skeleton cards", () => {
      useDataFetcher.mockReturnValue({
        data: null,
        loading: true,
      });

      const { container } = render(<BestConditionsSection />);

      const grid = container.querySelector(".grid");
      const skeletons = grid?.querySelectorAll("[data-testid='skeleton']");
      expect(skeletons).toHaveLength(6);
    });
  });

  describe("Section Title and Description", () => {
    it("renders section title 'Best conditions right now'", () => {
      useDataFetcher.mockReturnValue({
        data: mockEntries,
        loading: false,
      });

      render(<BestConditionsSection />);

      const heading = screen.getByRole("heading", { level: 2 });
      expect(heading).toHaveTextContent("Best conditions right now");
    });

    it("renders description text", () => {
      useDataFetcher.mockReturnValue({
        data: mockEntries,
        loading: false,
      });

      render(<BestConditionsSection />);

      expect(
        screen.getByText(
          "Highest-scored surf spots based on live swell, wind, and tide data"
        )
      ).toBeInTheDocument();
    });

    it("heading has correct styling", () => {
      useDataFetcher.mockReturnValue({
        data: mockEntries,
        loading: false,
      });

      render(<BestConditionsSection />);

      const heading = screen.getByRole("heading", { level: 2 });
      expect(heading).toHaveClass("text-2xl");
      expect(heading).toHaveClass("md:text-3xl");
      expect(heading).toHaveClass("font-roboto");
      expect(heading).toHaveClass("font-semibold");
    });
  });

  describe("SurfSpotCard Rendering", () => {
    it("renders SurfSpotCard for each entry", () => {
      useDataFetcher.mockReturnValue({
        data: mockEntries,
        loading: false,
      });

      render(<BestConditionsSection />);

      const cards = screen.getAllByTestId("surf-spot-card");
      expect(cards).toHaveLength(3);
    });

    it("passes correct props to SurfSpotCard", () => {
      useDataFetcher.mockReturnValue({
        data: [mockEntries[0]],
        loading: false,
      });

      render(<BestConditionsSection />);

      expect(screen.getByText("Blacks Beach")).toBeInTheDocument();
      expect(screen.getByText("San Diego")).toBeInTheDocument();
      expect(screen.getByText("San Diego, CA")).toBeInTheDocument();
      expect(screen.getByText("Slug: blacks")).toBeInTheDocument();
      expect(screen.getByText("Score: 9")).toBeInTheDocument();
      expect(screen.getByText("Wave Height: 6.5")).toBeInTheDocument();
      expect(screen.getByText("Rating: 4.5")).toBeInTheDocument();
      expect(screen.getByText("Skill: Advanced")).toBeInTheDocument();
    });

    it("passes delay prop incrementally", () => {
      useDataFetcher.mockReturnValue({
        data: mockEntries,
        loading: false,
      });

      render(<BestConditionsSection />);

      const cards = screen.getAllByTestId("surf-spot-card");
      expect(cards[0]).toHaveAttribute("data-delay", "0");
      expect(cards[1]).toHaveAttribute("data-delay", "1");
      expect(cards[2]).toHaveAttribute("data-delay", "2");
    });

    it("renders cards with unique beach IDs", () => {
      useDataFetcher.mockReturnValue({
        data: mockEntries,
        loading: false,
      });

      render(<BestConditionsSection />);

      const cards = screen.getAllByTestId("surf-spot-card");
      expect(cards[0]).toHaveAttribute("data-beach-id", "beach-1");
      expect(cards[1]).toHaveAttribute("data-beach-id", "beach-2");
      expect(cards[2]).toHaveAttribute("data-beach-id", "beach-3");
    });
  });

  describe("Image URL Resolution", () => {
    it("proxies image URLs when imageUrl is present", () => {
      useDataFetcher.mockReturnValue({
        data: [mockEntries[0]],
        loading: false,
      });

      render(<BestConditionsSection />);

      const img = screen.getByAltText("Blacks Beach");
      expect(img).toHaveAttribute(
        "src",
        "/api/proxy-image?url=https%3A%2F%2Fexample.com%2Fblacks.jpg"
      );
    });

    it("uses fallback image when imageUrl is null and beach name has fallback", () => {
      useDataFetcher.mockReturnValue({
        data: [mockEntries[1]], // Pipeline with null imageUrl
        loading: false,
      });

      render(<BestConditionsSection />);

      const img = screen.getByAltText("Pipeline");
      expect(img).toHaveAttribute("src", "/pipeline-fallback.jpg");
    });

    it("uses default fallback when imageUrl is null and no name-based fallback", () => {
      const entryWithoutFallback: TopBeachEntry = {
        beachId: "beach-4",
        beachName: "Unknown Beach",
        score: 7,
        waveHeight: 3.0,
        regionName: "California",
        href: "/ca/malibu/unknown-beach",
        slug: "unknown-beach",
        city: "Malibu",
        state: "CA",
        imageUrl: null,
        averageRating: null,
        skillLevel: null,
      };

      useDataFetcher.mockReturnValue({
        data: [entryWithoutFallback],
        loading: false,
      });

      render(<BestConditionsSection />);

      const img = screen.getByAltText("Unknown Beach");
      expect(img).toHaveAttribute("src", "/sunsetBeach.jpg");
    });
  });

  describe("Analytics Tracking", () => {
    it("tracks section view when entries are present", async () => {
      useDataFetcher.mockReturnValue({
        data: mockEntries,
        loading: false,
      });

      render(<BestConditionsSection />);

      await waitFor(() => {
        expect(trackBestConditionsViewed).toHaveBeenCalledWith(3, false);
      });
    });

    it("does not track view when no entries", () => {
      useDataFetcher.mockReturnValue({
        data: [],
        loading: false,
      });

      render(<BestConditionsSection />);

      expect(trackBestConditionsViewed).not.toHaveBeenCalled();
    });

    it("does not track view when still loading", () => {
      useDataFetcher.mockReturnValue({
        data: null,
        loading: true,
      });

      render(<BestConditionsSection />);

      expect(trackBestConditionsViewed).not.toHaveBeenCalled();
    });

    it("tracks view only once", async () => {
      const { rerender } = render(<BestConditionsSection />);

      useDataFetcher.mockReturnValue({
        data: mockEntries,
        loading: false,
      });

      rerender(<BestConditionsSection />);

      await waitFor(() => {
        expect(trackBestConditionsViewed).toHaveBeenCalledTimes(1);
      });
    });

    it("tracks click with correct beach name, rank, and score", () => {
      useDataFetcher.mockReturnValue({
        data: mockEntries,
        loading: false,
      });

      const { container } = render(<BestConditionsSection />);

      const cards = container.querySelectorAll("[data-testid='surf-spot-card']");
      fireEvent.click(cards[1]); // Click Pipeline (index 1)

      expect(trackBestConditionsClick).toHaveBeenCalledWith("Pipeline", 2, 10);
    });

    it("tracks multiple clicks correctly", () => {
      useDataFetcher.mockReturnValue({
        data: mockEntries,
        loading: false,
      });

      const { container } = render(<BestConditionsSection />);

      const cards = container.querySelectorAll("[data-testid='surf-spot-card']");

      fireEvent.click(cards[0]); // Blacks Beach
      expect(trackBestConditionsClick).toHaveBeenCalledWith("Blacks Beach", 1, 9);

      fireEvent.click(cards[2]); // Trestles
      expect(trackBestConditionsClick).toHaveBeenCalledWith("Trestles", 3, 8);

      expect(trackBestConditionsClick).toHaveBeenCalledTimes(2);
    });
  });

  describe("Grid Layout", () => {
    it("uses responsive grid classes", () => {
      useDataFetcher.mockReturnValue({
        data: mockEntries,
        loading: false,
      });

      const { container } = render(<BestConditionsSection />);

      const grid = container.querySelector(".grid");
      expect(grid).toHaveClass("grid-cols-1");
      expect(grid).toHaveClass("sm:grid-cols-2");
      expect(grid).toHaveClass("lg:grid-cols-3");
      expect(grid).toHaveClass("gap-6");
    });
  });

  describe("Section Styling", () => {
    it("has gradient background", () => {
      useDataFetcher.mockReturnValue({
        data: mockEntries,
        loading: false,
      });

      const { container } = render(<BestConditionsSection />);

      const section = container.querySelector("section");
      expect(section).toHaveClass("bg-gradient-to-b");
      expect(section).toHaveClass("from-white");
      expect(section).toHaveClass("to-blue-50/50");
    });

    it("has correct padding", () => {
      useDataFetcher.mockReturnValue({
        data: mockEntries,
        loading: false,
      });

      const { container } = render(<BestConditionsSection />);

      const section = container.querySelector("section");
      expect(section).toHaveClass("py-14");
    });

    it("has max-width container", () => {
      useDataFetcher.mockReturnValue({
        data: mockEntries,
        loading: false,
      });

      const { container } = render(<BestConditionsSection />);

      const innerContainer = container.querySelector(".max-w-7xl");
      expect(innerContainer).toBeInTheDocument();
      expect(innerContainer).toHaveClass("mx-auto");
      expect(innerContainer).toHaveClass("px-6");
    });
  });

  describe("Edge Cases", () => {
    it("handles single entry", () => {
      useDataFetcher.mockReturnValue({
        data: [mockEntries[0]],
        loading: false,
      });

      render(<BestConditionsSection />);

      const cards = screen.getAllByTestId("surf-spot-card");
      expect(cards).toHaveLength(1);
    });

    it("handles 6 entries (full grid)", () => {
      const sixEntries = Array.from({ length: 6 }, (_, i) => ({
        ...mockEntries[0],
        beachId: `beach-${i}`,
        beachName: `Beach ${i}`,
      }));

      useDataFetcher.mockReturnValue({
        data: sixEntries,
        loading: false,
      });

      render(<BestConditionsSection />);

      const cards = screen.getAllByTestId("surf-spot-card");
      expect(cards).toHaveLength(6);
    });

    it("handles more than 6 entries", () => {
      const tenEntries = Array.from({ length: 10 }, (_, i) => ({
        ...mockEntries[0],
        beachId: `beach-${i}`,
        beachName: `Beach ${i}`,
      }));

      useDataFetcher.mockReturnValue({
        data: tenEntries,
        loading: false,
      });

      render(<BestConditionsSection />);

      const cards = screen.getAllByTestId("surf-spot-card");
      expect(cards).toHaveLength(10);
    });

    it("handles entries with null optional fields", () => {
      const entryWithNulls: TopBeachEntry = {
        beachId: "beach-null",
        beachName: "Minimal Beach",
        score: 5,
        waveHeight: 2.0,
        regionName: "Region",
        href: "/ca/city/minimal-beach",
        slug: "minimal-beach",
        city: "City",
        state: "CA",
        imageUrl: null,
        averageRating: null,
        skillLevel: null,
      };

      useDataFetcher.mockReturnValue({
        data: [entryWithNulls],
        loading: false,
      });

      render(<BestConditionsSection />);

      expect(screen.getByText("Minimal Beach")).toBeInTheDocument();
      expect(screen.queryByText(/Rating:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Skill:/)).not.toBeInTheDocument();
    });
  });

  describe("Data Fetcher Integration", () => {
    it("calls getTopBeachesNow with correct limit", async () => {
      const { getTopBeachesNow } = require("@/actions/forecast/get-top-beaches-now");
      getTopBeachesNow.mockResolvedValue(mockEntries);

      useDataFetcher.mockReturnValue({
        data: mockEntries,
        loading: false,
      });

      render(<BestConditionsSection />);

      // Verify useDataFetcher was called with a function
      expect(useDataFetcher).toHaveBeenCalledWith(expect.any(Function));

      // Invoke the captured fetch function to verify it calls getTopBeachesNow(6)
      const fetchFn = useDataFetcher.mock.calls[0][0];
      await fetchFn();
      expect(getTopBeachesNow).toHaveBeenCalledWith(6);
    });
  });
});
