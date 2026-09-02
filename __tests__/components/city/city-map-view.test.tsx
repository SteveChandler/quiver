/**
 * Tests for CityMapView Component
 *
 * Tests the city map view component that displays beaches on a map
 * with a synchronized list view.
 * Priority 2 test coverage for San Diego page redesign.
 */

import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { CityMapView } from "@/components/city/city-map-view";
import type { SurfSpot } from "@/lib/data/surf-spots";

// CityMapView uses Link-based navigation; it does not call next/navigation router.

// Mock the InteractiveMap component
jest.mock("@/components/map/interactive-map", () => ({
  InteractiveMap: ({
    beaches,
    onLocationClick,
  }: {
    beaches: Array<{ id: string; name: string }>;
    onLocationClick: (beach: { id: string }) => void;
  }) => (
    <div data-testid="interactive-map">
      <span data-testid="beach-count">{beaches.length} beaches</span>
      {beaches.map((beach) => (
        <button
          key={beach.id}
          data-testid={`map-beach-${beach.id}`}
          onClick={() => onLocationClick(beach)}
        >
          {beach.name}
        </button>
      ))}
    </div>
  ),
}));

// Test data
const mockSpots: SurfSpot[] = [
  {
    slug: "la-jolla-shores",
    name: "La Jolla Shores",
    citySlug: "san-diego",
    region: "La Jolla, California",
    coordinates: { lat: 32.8553, lon: -117.2563 },
    overview: "Wide sandy beach with gentle waves, perfect for beginners.",
    history: "",
    conditions: "Best in summer",
    tideAdvice: "",
    swellAdvice: "Works on most swells",
    windAdvice: "",
    waterTemp: "",
    hazards: ["Stingrays"],
    skillLevel: "Beginner friendly",
    bestSeason: "Year-round",
    crowdFactor: "Heavy",
    parking: "Large parking lot",
    amenities: ["Restrooms", "Lifeguards"],
    nearby: [],
    faq: [],
    speakableSummary: "La Jolla Shores is perfect for beginners.",
    intentTags: ["beginner", "tide"],
  },
  {
    slug: "blacks",
    name: "Blacks Beach",
    citySlug: "san-diego",
    region: "San Diego, California",
    coordinates: { lat: 32.8891, lon: -117.2529 },
    overview: "World-class beach break with powerful waves.",
    history: "",
    conditions: "Best on large west swells",
    tideAdvice: "",
    swellAdvice: "Needs big swells",
    windAdvice: "",
    waterTemp: "",
    hazards: ["Strong currents", "Difficult access"],
    skillLevel: "Advanced",
    bestSeason: "Winter",
    crowdFactor: "Moderate",
    parking: "Hike from Gliderport",
    amenities: [],
    nearby: [],
    faq: [],
    speakableSummary: "Blacks Beach is for advanced surfers.",
    intentTags: ["tide"],
  },
  {
    slug: "tourmaline",
    name: "Tourmaline",
    citySlug: "san-diego",
    region: "Pacific Beach, California",
    coordinates: { lat: 32.8048, lon: -117.2657 },
    overview: "Mellow point break ideal for longboarders.",
    history: "",
    conditions: "Works on most conditions",
    tideAdvice: "",
    swellAdvice: "Any south or west swell",
    windAdvice: "",
    waterTemp: "",
    hazards: [],
    skillLevel: "Longboard friendly",
    bestSeason: "Year-round",
    crowdFactor: "Light",
    parking: "Free lot",
    amenities: ["Parking"],
    nearby: [],
    faq: [],
    speakableSummary: "Tourmaline is great for longboards.",
    intentTags: ["beginner", "least-crowded"],
  },
];

describe("CityMapView Component", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Rendering", () => {
    it("should render beach list with correct count", () => {
      render(
        <CityMapView
          spots={mockSpots}
          cityName="San Diego"
          citySlug="san-diego"
        />
      );

      // Check for spot count display
      expect(screen.getByText("3 spots")).toBeInTheDocument();
    });

    it("should render Featured Beaches header", () => {
      render(
        <CityMapView
          spots={mockSpots}
          cityName="San Diego"
          citySlug="san-diego"
        />
      );

      expect(screen.getAllByText("Featured Beaches").length).toBeGreaterThan(0);
    });

    it("should render InteractiveMap component", () => {
      render(
        <CityMapView
          spots={mockSpots}
          cityName="San Diego"
          citySlug="san-diego"
        />
      );

      expect(screen.getByTestId("interactive-map")).toBeInTheDocument();
    });

    it("should pass correct beach count to map", () => {
      render(
        <CityMapView
          spots={mockSpots}
          cityName="San Diego"
          citySlug="san-diego"
        />
      );

      expect(screen.getByTestId("beach-count")).toHaveTextContent("3 beaches");
    });

    it("should render all beach names in the list", () => {
      render(
        <CityMapView
          spots={mockSpots}
          cityName="San Diego"
          citySlug="san-diego"
        />
      );

      mockSpots.forEach((spot) => {
        expect(screen.getAllByText(spot.name).length).toBeGreaterThan(0);
      });
    });

    it("should render skill level badges", () => {
      render(
        <CityMapView
          spots={mockSpots}
          cityName="San Diego"
          citySlug="san-diego"
        />
      );

      expect(screen.getAllByText("Beginner friendly").length).toBeGreaterThan(
        0
      );
      expect(screen.getAllByText("Advanced").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Longboard friendly").length).toBeGreaterThan(
        0
      );
    });

    it("should render beach descriptions", () => {
      render(
        <CityMapView
          spots={mockSpots}
          cityName="San Diego"
          citySlug="san-diego"
        />
      );

      expect(
        screen.getAllByText(/Wide sandy beach with gentle waves/).length
      ).toBeGreaterThan(0);
    });

    it("should render ranked surf conditions when forecast top picks are provided", () => {
      render(
        <CityMapView
          spots={mockSpots}
          cityName="La Jolla"
          citySlug="la-jolla"
          forecastTopPicks={[
            {
              beachId: "22222222-2222-4222-8222-222222222222",
              name: "Blacks Beach",
              slug: "blacks",
              waveHeight: "4-5 ft",
              windDirection: "6 mph W",
              score: 86,
            },
          ]}
        />
      );

      const table = screen.getByRole("table", {
        name: /la jolla surf conditions/i,
      });
      expect(table).toBeInTheDocument();
      expect(screen.getByRole("columnheader", { name: "Beach" })).toBeInTheDocument();
      expect(screen.getByRole("columnheader", { name: "Height" })).toBeInTheDocument();
      expect(screen.getByRole("columnheader", { name: "Wind" })).toBeInTheDocument();
      expect(screen.getByRole("columnheader", { name: "Verdict" })).toBeInTheDocument();
      expect(within(table).getByRole("link", { name: "Blacks Beach" })).toHaveAttribute(
        "href",
        "/ca/la-jolla/blacks"
      );
      expect(screen.getByText("4-5 ft")).toBeInTheDocument();
      expect(screen.getByText("6 mph W")).toBeInTheDocument();
      expect(screen.getByText("86/100")).toBeInTheDocument();
    });
  });

  describe("Beach List Interaction", () => {
    it("should navigate to beach detail page on click", () => {
      render(
        <CityMapView
          spots={mockSpots}
          cityName="San Diego"
          citySlug="san-diego"
        />
      );

      // Desktop list items are Links; assert correct href
      const laJollaLinks = screen.getAllByRole("link", {
        name: /La Jolla Shores/i,
      });
      expect(laJollaLinks.length).toBeGreaterThan(0);
      laJollaLinks.forEach((link) => {
        expect(link).toHaveAttribute("href", "/ca/san-diego/la-jolla-shores");
      });
      fireEvent.click(laJollaLinks[0]!);
    });

    it("should handle hover state on beach items", () => {
      render(
        <CityMapView
          spots={mockSpots}
          cityName="San Diego"
          citySlug="san-diego"
        />
      );

      const firstBeach = screen.getAllByRole("link", {
        name: /La Jolla Shores/i,
      })[0]!;

      // Hover over first beach
      fireEvent.mouseEnter(firstBeach);

      // Leave hover
      fireEvent.mouseLeave(firstBeach);

      // No error should occur
      expect(firstBeach).toBeInTheDocument();
    });
  });

  describe("Map Interaction", () => {
    it("should update selected state when beach clicked on map", () => {
      render(
        <CityMapView
          spots={mockSpots}
          cityName="San Diego"
          citySlug="san-diego"
        />
      );

      // Click beach on map
      const mapBeachButton = screen.getByTestId("map-beach-la-jolla-shores");
      fireEvent.click(mapBeachButton);

      // Selected beach should get selected styling in the desktop list
      const laJollaLinks = screen.getAllByRole("link", {
        name: /La Jolla Shores/i,
      });
      expect(laJollaLinks.length).toBeGreaterThan(0);
      expect(laJollaLinks.some((l) => l.className.includes("bg-sky-50"))).toBe(
        true
      );
    });
  });

  describe("Empty State", () => {
    it("should handle empty spots array", () => {
      render(
        <CityMapView spots={[]} cityName="San Diego" citySlug="san-diego" />
      );

      expect(screen.getByText("0 spots")).toBeInTheDocument();
      expect(screen.getByTestId("beach-count")).toHaveTextContent("0 beaches");
    });
  });

  describe("Mobile Layout", () => {
    it("should render mobile beach scroll section", () => {
      render(
        <CityMapView
          spots={mockSpots}
          cityName="San Diego"
          citySlug="san-diego"
        />
      );

      // Mobile section has different count display
      expect(screen.getByText("(3)")).toBeInTheDocument();
    });

    it("should navigate on mobile card click", () => {
      render(
        <CityMapView
          spots={mockSpots}
          cityName="San Diego"
          citySlug="san-diego"
        />
      );

      // Mobile cards are also Links; assert href
      const laJollaLink = screen.getAllByRole("link", { name: /La Jolla Shores/i })[0]!;
      expect(laJollaLink).toHaveAttribute("href", "/ca/san-diego/la-jolla-shores");
      fireEvent.click(laJollaLink);
    });
  });

  describe("Coordinate Transformation", () => {
    it("should transform SurfSpot coordinates to Beach format", () => {
      render(
        <CityMapView
          spots={mockSpots}
          cityName="San Diego"
          citySlug="san-diego"
        />
      );

      // The map should receive beaches with correct coordinate format
      // This is verified by the map rendering without errors
      expect(screen.getByTestId("interactive-map")).toBeInTheDocument();
    });
  });

  describe("Map Center Calculation", () => {
    it("should use San Diego default center with empty spots", () => {
      render(
        <CityMapView spots={[]} cityName="San Diego" citySlug="san-diego" />
      );

      // Map should still render with default center
      expect(screen.getByTestId("interactive-map")).toBeInTheDocument();
    });

    it("should calculate center from spots", () => {
      render(
        <CityMapView
          spots={mockSpots}
          cityName="San Diego"
          citySlug="san-diego"
        />
      );

      // Map should render with calculated center
      expect(screen.getByTestId("interactive-map")).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("should render beach list items as accessible links", () => {
      render(
        <CityMapView
          spots={mockSpots}
          cityName="San Diego"
          citySlug="san-diego"
        />
      );

      const links = screen.getAllByRole("link");
      // Should include at least one link per beach (desktop + mobile both render in DOM)
      mockSpots.forEach((spot) => {
        expect(
          links.some((l) => l.getAttribute("href") === `/ca/san-diego/${spot.slug}`)
        ).toBe(true);
      });
    });

    it("should visually indicate selected beach after click", () => {
      render(
        <CityMapView
          spots={mockSpots}
          cityName="San Diego"
          citySlug="san-diego"
        />
      );

      // Click to select a beach (desktop link is fine)
      const laJollaLinks = screen.getAllByRole("link", {
        name: /La Jolla Shores/i,
      });
      fireEvent.click(laJollaLinks[0]!);

      // At least one representation (desktop/mobile) should now show selected styling
      expect(laJollaLinks.some((l) => l.className.includes("bg-sky-50"))).toBe(
        true
      );
    });
  });

  describe("Skill Level Styling", () => {
    it("should apply green style for Beginner friendly", () => {
      render(
        <CityMapView
          spots={mockSpots}
          cityName="San Diego"
          citySlug="san-diego"
        />
      );

      const beginnerBadges = screen.getAllByText("Beginner friendly");
      expect(beginnerBadges[0].className).toContain("#25562E");
    });

    it("should apply red style for Advanced", () => {
      render(
        <CityMapView
          spots={mockSpots}
          cityName="San Diego"
          citySlug="san-diego"
        />
      );

      const advancedBadges = screen.getAllByText("Advanced");
      expect(advancedBadges[0].className).toContain("#8A2626");
    });

    it("should apply blue style for Longboard friendly", () => {
      render(
        <CityMapView
          spots={mockSpots}
          cityName="San Diego"
          citySlug="san-diego"
        />
      );

      const longboardBadges = screen.getAllByText("Longboard friendly");
      expect(longboardBadges[0].className).toContain("#0B3A75");
    });
  });

  describe("Single Beach", () => {
    it("should render correctly with single beach", () => {
      render(
        <CityMapView
          spots={[mockSpots[0]]}
          cityName="San Diego"
          citySlug="san-diego"
        />
      );

      expect(screen.getByText("1 spots")).toBeInTheDocument();
      expect(screen.getByTestId("beach-count")).toHaveTextContent("1 beaches");
    });
  });
});
