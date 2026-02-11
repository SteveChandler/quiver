import React from "react";
import { render, screen } from "@testing-library/react";
import { BeachHero } from "@/components/beach-detail/beach-hero";
import type { Beach } from "@/types/database";
import { createBeachWithDefaults } from "@/lib/utils/beach-defaults";

// Mock next/image
jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: any) => {
    // eslint-disable-next-line jsx-a11y/alt-text, @next/next/no-img-element
    return <img {...props} />;
  },
}));

// Mock beach card utils
jest.mock("@/lib/utils/beach-card-utils", () => ({
  getBeachLocation: jest.fn(() => "San Diego, CA"),
}));

// Mock UI components
jest.mock("@/components/ui/card", () => ({
  Card: ({ children, className }: any) => (
    <div className={className} data-testid="hero-card">
      {children}
    </div>
  ),
  CardContent: ({ children, className }: any) => (
    <div className={className}>{children}</div>
  ),
}));

// Mock icons
jest.mock("lucide-react", () => ({
  Star: ({ className, fill }: any) => (
    <svg
      data-testid="star-icon"
      className={className}
      data-fill={fill || "none"}
    />
  ),
  MapPin: ({ className }: any) => (
    <svg data-testid="map-pin-icon" className={className} />
  ),
}));

describe("BeachHero", () => {
  const createMockBeach = (overrides = {}): Beach => createBeachWithDefaults({
    id: "test-beach-id",
    name: "Test Beach",
    slug: "test-beach",
    lat: 32.7157,
    lon: -117.1611,
    city: "San Diego",
    state: "CA",
    average_rating: 0,
    ...overrides,
  });

  const mockMapImageUrl = "https://example.com/map-image.png";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Basic Rendering", () => {
    it("renders beach name in h2", () => {
      const beach = createMockBeach({ name: "Blacks Beach" });

      render(<BeachHero beach={beach} mapImageUrl={mockMapImageUrl} />);

      const heading = screen.getByRole("heading", { level: 2 });
      expect(heading).toHaveTextContent("Blacks Beach");
    });

    it("renders map image with correct src", () => {
      const beach = createMockBeach();

      render(<BeachHero beach={beach} mapImageUrl={mockMapImageUrl} />);

      const image = screen.getByRole("img");
      expect(image).toHaveAttribute("src", mockMapImageUrl);
    });

    it("renders map image with correct alt text", () => {
      const beach = createMockBeach({ name: "La Jolla Shores" });

      render(<BeachHero beach={beach} mapImageUrl={mockMapImageUrl} />);

      const image = screen.getByRole("img");
      expect(image).toHaveAttribute("alt", "Map of La Jolla Shores");
    });
  });

  describe("Location Display", () => {
    it("shows location from getBeachLocation utility", () => {
      const { getBeachLocation } = require("@/lib/utils/beach-card-utils");
      getBeachLocation.mockReturnValue("Encinitas, CA");

      const beach = createMockBeach();

      render(<BeachHero beach={beach} mapImageUrl={mockMapImageUrl} />);

      expect(screen.getByText("Encinitas, CA")).toBeInTheDocument();
      expect(getBeachLocation).toHaveBeenCalledWith(beach);
    });

    it("calls getBeachLocation with beach object", () => {
      const { getBeachLocation } = require("@/lib/utils/beach-card-utils");
      const beach = createMockBeach({ name: "Ocean Beach" });

      render(<BeachHero beach={beach} mapImageUrl={mockMapImageUrl} />);

      expect(getBeachLocation).toHaveBeenCalledTimes(1);
      expect(getBeachLocation).toHaveBeenCalledWith(beach);
    });
  });

  describe("Star Rating Display", () => {
    it("renders 5 star icons when rating exists", () => {
      const beach = createMockBeach({ average_rating: 4 });

      render(<BeachHero beach={beach} mapImageUrl={mockMapImageUrl} />);

      const stars = screen.getAllByTestId("star-icon");
      expect(stars).toHaveLength(5);
    });

    it("fills stars based on average_rating (5 stars)", () => {
      const beach = createMockBeach({ average_rating: 5 });

      render(<BeachHero beach={beach} mapImageUrl={mockMapImageUrl} />);

      const stars = screen.getAllByTestId("star-icon");
      const filledStars = stars.filter((star) =>
        (star.getAttribute("class") || "").includes("fill-yellow-500")
      );
      expect(filledStars).toHaveLength(5);
    });

    it("fills stars based on average_rating (3 stars)", () => {
      const beach = createMockBeach({ average_rating: 3 });

      render(<BeachHero beach={beach} mapImageUrl={mockMapImageUrl} />);

      const stars = screen.getAllByTestId("star-icon");
      const filledStars = stars.filter((star) =>
        (star.getAttribute("class") || "").includes("fill-yellow-500")
      );
      expect(filledStars).toHaveLength(3);
    });

    it("shows rating section with 0 filled stars when average_rating is 0", () => {
      const beach = createMockBeach({ average_rating: 0 });

      render(<BeachHero beach={beach} mapImageUrl={mockMapImageUrl} />);

      const stars = screen.getAllByTestId("star-icon");
      expect(stars).toHaveLength(5);
      const filledStars = stars.filter((star) =>
        (star.getAttribute("class") || "").includes("fill-yellow-500")
      );
      expect(filledStars).toHaveLength(0);
    });

    it("fills stars based on average_rating (4.7 stars - rounds to 5)", () => {
      const beach = createMockBeach({ average_rating: 4.7 });

      render(<BeachHero beach={beach} mapImageUrl={mockMapImageUrl} />);

      const stars = screen.getAllByTestId("star-icon");
      const filledStars = stars.filter((star) =>
        (star.getAttribute("class") || "").includes("fill-yellow-500")
      );
      // Uses Math.round so 4.7 rounds to 5
      expect(filledStars).toHaveLength(5);
    });

    it("fills stars based on average_rating (1.2 stars - rounds to 1)", () => {
      const beach = createMockBeach({ average_rating: 1.2 });

      render(<BeachHero beach={beach} mapImageUrl={mockMapImageUrl} />);

      const stars = screen.getAllByTestId("star-icon");
      const filledStars = stars.filter((star) =>
        (star.getAttribute("class") || "").includes("fill-yellow-500")
      );
      // Uses Math.round so 1.2 rounds to 1
      expect(filledStars).toHaveLength(1);
    });
  });

  describe("Review Count Display", () => {
    it("displays dynamic review count", () => {
      const beach = createMockBeach({
        average_rating: 4.5,
        review_count: 42,
      });

      render(<BeachHero beach={beach} mapImageUrl={mockMapImageUrl} />);

      expect(screen.getByText(/\(42 reviews\)/)).toBeInTheDocument();
    });

    it("shows singular form for 1 review", () => {
      const beach = createMockBeach({
        average_rating: 5,
        review_count: 1,
      });

      render(<BeachHero beach={beach} mapImageUrl={mockMapImageUrl} />);

      expect(screen.getByText(/\(1 review\)/)).toBeInTheDocument();
    });

    it("shows 0 reviews when null but rating exists", () => {
      const beach = createMockBeach({
        average_rating: 4,
        review_count: null,
      });

      render(<BeachHero beach={beach} mapImageUrl={mockMapImageUrl} />);

      expect(screen.getByText(/\(0 reviews\)/)).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("hides rating section when average_rating is undefined", () => {
      const beach = createMockBeach({
        average_rating: undefined as any,
      });

      render(<BeachHero beach={beach} mapImageUrl={mockMapImageUrl} />);

      const stars = screen.queryAllByTestId("star-icon");
      expect(stars).toHaveLength(0);
    });

    it("hides rating section when average_rating is null", () => {
      const beach = createMockBeach({
        average_rating: null as any,
      });

      render(<BeachHero beach={beach} mapImageUrl={mockMapImageUrl} />);

      const stars = screen.queryAllByTestId("star-icon");
      expect(stars).toHaveLength(0);
    });

    it("shows rating section for negative average_rating (edge case)", () => {
      const beach = createMockBeach({
        average_rating: -1,
      });

      render(<BeachHero beach={beach} mapImageUrl={mockMapImageUrl} />);

      const stars = screen.getAllByTestId("star-icon");
      const filledStars = stars.filter((star) =>
        (star.getAttribute("class") || "").includes("fill-yellow-500")
      );
      // Should treat negative as 0 filled stars
      expect(filledStars).toHaveLength(0);
    });

    it("handles average_rating exceeding 5 (edge case)", () => {
      const beach = createMockBeach({
        average_rating: 6,
      });

      render(<BeachHero beach={beach} mapImageUrl={mockMapImageUrl} />);

      const stars = screen.getAllByTestId("star-icon");
      const filledStars = stars.filter((star) =>
        (star.getAttribute("class") || "").includes("fill-yellow-500")
      );
      // Math.round(6) = 6, but only 5 stars exist, so all 5 are filled
      expect(filledStars).toHaveLength(5);
    });

    it("renders with different beach names containing special characters", () => {
      const beach = createMockBeach({
        name: "La Jolla Shores - Scripps Pier",
      });

      render(<BeachHero beach={beach} mapImageUrl={mockMapImageUrl} />);

      expect(
        screen.getByText("La Jolla Shores - Scripps Pier")
      ).toBeInTheDocument();
    });

    it("renders with empty mapImageUrl", () => {
      const beach = createMockBeach();

      const { container } = render(
        <BeachHero beach={beach} mapImageUrl="" />
      );

      // Component renders without crashing even with empty URL
      expect(container.querySelector("img")).toBeInTheDocument();
    });
  });
});
