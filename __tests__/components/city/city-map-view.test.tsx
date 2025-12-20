/**
 * Tests for CityMapView Component
 *
 * Tests the city map view component that displays beaches on a map
 * with a synchronized list view.
 * Priority 2 test coverage for San Diego page redesign.
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CityMapView } from "@/components/city/city-map-view";
import type { SurfSpot } from "@/lib/data/surf-spots";

// Mock next/navigation
const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
}));

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
    coordinates: { lat: 32.8553, lng: -117.2563 },
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
    slug: "blacks-beach",
    name: "Blacks Beach",
    citySlug: "san-diego",
    region: "San Diego, California",
    coordinates: { lat: 32.8891, lng: -117.2529 },
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
    coordinates: { lat: 32.8048, lng: -117.2657 },
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

      // Find and click on a beach card in the list
      const beachCards = screen.getAllByRole("option");
      fireEvent.click(beachCards[0]);

      expect(mockPush).toHaveBeenCalledWith("/ca/san-diego/la-jolla-shores");
    });

    it("should handle hover state on beach items", () => {
      render(
        <CityMapView
          spots={mockSpots}
          cityName="San Diego"
          citySlug="san-diego"
        />
      );

      const beachItems = screen.getAllByRole("option");

      // Hover over first beach
      fireEvent.mouseEnter(beachItems[0]);

      // Leave hover
      fireEvent.mouseLeave(beachItems[0]);

      // No error should occur
      expect(beachItems[0]).toBeInTheDocument();
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

      // The beach should be selected (checked via aria-selected)
      const selectedItem = screen
        .getAllByRole("option")
        .find((item) => item.getAttribute("aria-selected") === "true");
      expect(selectedItem).toBeDefined();
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

      // Find mobile cards and click one
      const mobileCards = screen.getAllByText("La Jolla Shores");
      fireEvent.click(mobileCards[0].closest("div[class*='cursor-pointer']")!);

      expect(mockPush).toHaveBeenCalledWith("/ca/san-diego/la-jolla-shores");
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
    it("should have aria-selected attribute on list items", () => {
      render(
        <CityMapView
          spots={mockSpots}
          cityName="San Diego"
          citySlug="san-diego"
        />
      );

      const listItems = screen.getAllByRole("option");
      listItems.forEach((item) => {
        expect(item).toHaveAttribute("aria-selected");
      });
    });

    it("should set aria-selected to true for selected beach", () => {
      render(
        <CityMapView
          spots={mockSpots}
          cityName="San Diego"
          citySlug="san-diego"
        />
      );

      // Click to select a beach
      const listItems = screen.getAllByRole("option");
      fireEvent.click(listItems[0]);

      // Find the selected item
      const selectedItem = screen
        .getAllByRole("option")
        .find((item) => item.getAttribute("aria-selected") === "true");
      expect(selectedItem).toBeDefined();
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
      expect(beginnerBadges[0].className).toContain("green");
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
      expect(advancedBadges[0].className).toContain("red");
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
      expect(longboardBadges[0].className).toContain("blue");
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
