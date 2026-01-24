import { render, screen, waitFor } from "@testing-library/react";
import { NearbySpots } from "@/components/beach-detail/nearby-spots";
import { getNearbyBeaches } from "@/actions/beach/beach-location-actions";
import type { Beach } from "@/types/database";

// Mock Next.js Link component
jest.mock("next/link", () => {
  return function MockLink({ children, href, ...props }: any) {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  };
});

// Mock beach-location-actions
jest.mock("@/actions/beach/beach-location-actions", () => ({
  getNearbyBeaches: jest.fn(),
}));

// Mock lucide-react icons
jest.mock("lucide-react", () => ({
  MapPin: ({ className }: { className?: string }) => (
    <svg data-testid="map-pin-icon" className={className} />
  ),
  ChevronRight: ({ className }: { className?: string }) => (
    <svg data-testid="chevron-right-icon" className={className} />
  ),
  Loader2: ({ className }: { className?: string }) => (
    <svg data-testid="loader-icon" className={className} />
  ),
}));

// Mock beach-url-utils
jest.mock("@/lib/utils/beach-url-utils", () => ({
  getBeachUrlSafe: jest.fn(
    (beach: Beach) => `/beach/${beach.slug || beach.id}`
  ),
}));

// Mock distance-utils
jest.mock("@/lib/utils/distance-utils", () => ({
  formatDistanceDisplay: jest.fn((distance: number | undefined, variant: string) => {
    if (distance === undefined || distance === null || distance <= 0) {
      return null;
    }
    if (variant === "compact") {
      return distance < 10
        ? `${distance.toFixed(1)} mi away`
        : `${Math.round(distance)} mi away`;
    }
    return `${Math.round(distance)} miles away`;
  }),
}));

describe("NearbySpots", () => {
  const mockBeach = {
    id: "beach-1",
    name: "Main Beach",
    slug: "main-beach",
    lat: 32.75,
    lon: -117.25,
    city: "San Diego",
    state: "California",
    country: "USA",
    description: "A great beach",
    created_at: "2024-01-01",
    is_private: false,
    cdip_eligible: false,
    access_tips: null,
    aspect_deg: null,
    average_rating: null,
    best_conditions_prose: null,
    best_months: null,
    break_type: null,
    cdip_station: null,
    crowd_level: null,
    crowd_tips: null,
    deleted_at: null,
    features: null,
    geog: null,
    hazards: null,
    local_etiquette: null,
    owner_id: null,
    parking_tips: null,
    preference_model: null,
    preferred_tide_direction: null,
    preferred_tide_ft_max: null,
    preferred_tide_ft_min: null,
    preferred_wind_direction: null,
    secondary_swell_importance: null,
    skill_level: null,
    swell_window_center_deg: null,
    swell_window_halfwidth_deg: null,
    updated_at: null,
    visibility: null,
    wind_cross_shore_ok_kt: null,
    wind_offshore_deg: null,
    wind_onshore_bad_kt: null,
  } as unknown as Beach;

  const mockNearbyBeach1 = {
    ...(mockBeach as any),
    id: "beach-2",
    name: "Pacific Beach",
    slug: "pacific-beach",
    lat: 32.8,
    lon: -117.24,
    city: "San Diego",
    state: "California",
    distance: 3.5,
  } as unknown as Beach & { distance: number };

  const mockNearbyBeach2 = {
    ...(mockBeach as any),
    id: "beach-3",
    name: "Ocean Beach",
    slug: "ocean-beach",
    lat: 32.76,
    lon: -117.26,
    city: "San Diego",
    state: "California",
    distance: 15.2,
  } as unknown as Beach & { distance: number };

  const mockNearbyBeach3 = {
    ...(mockBeach as any),
    id: "beach-4",
    name: "La Jolla Cove",
    slug: "la-jolla-cove",
    lat: 32.85,
    lon: -117.27,
    city: "La Jolla",
    state: "California",
    distance: 8.7,
  } as unknown as Beach & { distance: number };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Loading State", () => {
    it("should display loading state while fetching data", () => {
      (getNearbyBeaches as jest.Mock).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      render(<NearbySpots beach={mockBeach} />);

      expect(screen.getByText("Nearby Surf Spots")).toBeInTheDocument();
      expect(screen.getByTestId("loader-icon")).toBeInTheDocument();
    });

    it("should apply correct loading state classes", () => {
      (getNearbyBeaches as jest.Mock).mockImplementation(
        () => new Promise(() => {})
      );

      render(<NearbySpots beach={mockBeach} />);

      const loader = screen.getByTestId("loader-icon");
      expect(loader).toHaveClass("animate-spin");
    });
  });

  describe("Successful Data Fetching", () => {
    it("should render list of nearby beaches from props", async () => {
      (getNearbyBeaches as jest.Mock).mockResolvedValue({
        success: true,
        data: [mockNearbyBeach1, mockNearbyBeach2, mockNearbyBeach3],
      });

      render(<NearbySpots beach={mockBeach} />);

      await waitFor(() => {
        expect(screen.getByText("Pacific Beach")).toBeInTheDocument();
      });

      expect(screen.getByText("Ocean Beach")).toBeInTheDocument();
      expect(screen.getByText("La Jolla Cove")).toBeInTheDocument();
    });

    it("should display distance formatting correctly for close distances", async () => {
      (getNearbyBeaches as jest.Mock).mockResolvedValue({
        success: true,
        data: [mockNearbyBeach1], // 3.5 miles
      });

      render(<NearbySpots beach={mockBeach} />);

      await waitFor(() => {
        expect(screen.getByText("3.5 mi away")).toBeInTheDocument();
      });
    });

    it("should display distance formatting correctly for far distances", async () => {
      (getNearbyBeaches as jest.Mock).mockResolvedValue({
        success: true,
        data: [mockNearbyBeach2], // 15.2 miles
      });

      render(<NearbySpots beach={mockBeach} />);

      await waitFor(() => {
        expect(screen.getByText("15 mi away")).toBeInTheDocument();
      });
    });

    it("should create links to individual beach pages", async () => {
      (getNearbyBeaches as jest.Mock).mockResolvedValue({
        success: true,
        data: [mockNearbyBeach1, mockNearbyBeach2],
      });

      render(<NearbySpots beach={mockBeach} />);

      await waitFor(() => {
        const links = screen.getAllByRole("link");
        expect(links).toHaveLength(2);
        expect(links[0]).toHaveAttribute("href", "/beach/pacific-beach");
        expect(links[1]).toHaveAttribute("href", "/beach/ocean-beach");
      });
    });

    it("should display city and state for each beach", async () => {
      (getNearbyBeaches as jest.Mock).mockResolvedValue({
        success: true,
        data: [mockNearbyBeach1, mockNearbyBeach3],
      });

      render(<NearbySpots beach={mockBeach} />);

      await waitFor(() => {
        expect(screen.getByText("San Diego, California")).toBeInTheDocument();
      });

      expect(screen.getByText("La Jolla, California")).toBeInTheDocument();
    });

    it("should render MapPin and ChevronRight icons for each beach", async () => {
      (getNearbyBeaches as jest.Mock).mockResolvedValue({
        success: true,
        data: [mockNearbyBeach1, mockNearbyBeach2],
      });

      render(<NearbySpots beach={mockBeach} />);

      await waitFor(() => {
        const mapPinIcons = screen.getAllByTestId("map-pin-icon");
        const chevronIcons = screen.getAllByTestId("chevron-right-icon");
        expect(mapPinIcons).toHaveLength(2);
        expect(chevronIcons).toHaveLength(2);
      });
    });

    it("should respect maxSpots limit", async () => {
      const manyBeaches = Array.from({ length: 10 }, (_, i) => ({
        ...mockBeach,
        id: `beach-${i}`,
        name: `Beach ${i}`,
        slug: `beach-${i}`,
        distance: i + 1,
      }));

      (getNearbyBeaches as jest.Mock).mockResolvedValue({
        success: true,
        data: manyBeaches,
      });

      render(<NearbySpots beach={mockBeach} maxSpots={3} />);

      await waitFor(() => {
        const links = screen.getAllByRole("link");
        expect(links).toHaveLength(3);
      });
    });

    it("should filter out the current beach from results", async () => {
      (getNearbyBeaches as jest.Mock).mockResolvedValue({
        success: true,
        data: [
          mockBeach, // Same beach should be filtered
          mockNearbyBeach1,
          mockNearbyBeach2,
        ],
      });

      render(<NearbySpots beach={mockBeach} />);

      await waitFor(() => {
        expect(screen.getByText("Pacific Beach")).toBeInTheDocument();
      });

      expect(screen.getByText("Ocean Beach")).toBeInTheDocument();
      expect(screen.queryByText("Main Beach")).not.toBeInTheDocument();
    });
  });

  describe("Empty State", () => {
    it("should render nothing when no nearby spots are found", async () => {
      (getNearbyBeaches as jest.Mock).mockResolvedValue({
        success: true,
        data: [],
      });

      const { container } = render(<NearbySpots beach={mockBeach} />);

      await waitFor(() => {
        expect(getNearbyBeaches).toHaveBeenCalled();
      });

      // Component should not render anything for empty state
      expect(container.firstChild).toBeNull();
    });

    it("should render nothing when only the current beach is returned", async () => {
      (getNearbyBeaches as jest.Mock).mockResolvedValue({
        success: true,
        data: [mockBeach],
      });

      const { container } = render(<NearbySpots beach={mockBeach} />);

      await waitFor(() => {
        expect(getNearbyBeaches).toHaveBeenCalled();
      });

      expect(container.firstChild).toBeNull();
    });
  });

  describe("Error Handling", () => {
    it("should fail silently and render nothing on error", async () => {
      (getNearbyBeaches as jest.Mock).mockResolvedValue({
        success: false,
        error: "Failed to fetch beaches",
      });

      const { container } = render(<NearbySpots beach={mockBeach} />);

      await waitFor(() => {
        expect(getNearbyBeaches).toHaveBeenCalled();
      });

      expect(container.firstChild).toBeNull();
    });

    it("should fail silently when API throws exception", async () => {
      (getNearbyBeaches as jest.Mock).mockRejectedValue(
        new Error("Network error")
      );

      const consoleSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const { container } = render(<NearbySpots beach={mockBeach} />);

      await waitFor(() => {
        expect(getNearbyBeaches).toHaveBeenCalled();
      });

      expect(container.firstChild).toBeNull();
      consoleSpy.mockRestore();
    });
  });

  describe("Missing Coordinates", () => {
    it("should render nothing when beach has no lat coordinate", () => {
      const beachWithoutLat = { ...mockBeach, lat: null };

      const { container } = render(<NearbySpots beach={beachWithoutLat} />);

      expect(container.firstChild).toBeNull();
      expect(getNearbyBeaches).not.toHaveBeenCalled();
    });

    it("should render nothing when beach has no lon coordinate", () => {
      const beachWithoutLon = { ...mockBeach, lon: null };

      const { container } = render(<NearbySpots beach={beachWithoutLon} />);

      expect(container.firstChild).toBeNull();
      expect(getNearbyBeaches).not.toHaveBeenCalled();
    });

    it("should render nothing when beach has no coordinates at all", () => {
      const beachWithoutCoords = { ...mockBeach, lat: null, lon: null };

      const { container } = render(<NearbySpots beach={beachWithoutCoords} />);

      expect(container.firstChild).toBeNull();
      expect(getNearbyBeaches).not.toHaveBeenCalled();
    });
  });

  describe("Location Display", () => {
    it("should display city and state when both are present", async () => {
      const beachWithLocation = {
        ...mockNearbyBeach1,
        city: "San Diego",
        state: "California",
      };

      (getNearbyBeaches as jest.Mock).mockResolvedValue({
        success: true,
        data: [beachWithLocation],
      });

      render(<NearbySpots beach={mockBeach} />);

      await waitFor(() => {
        expect(screen.getByText("San Diego, California")).toBeInTheDocument();
      });
    });

    it("should display only city when state is missing", async () => {
      const beachCityOnly = {
        ...mockNearbyBeach1,
        city: "San Diego",
        state: null,
      };

      (getNearbyBeaches as jest.Mock).mockResolvedValue({
        success: true,
        data: [beachCityOnly],
      });

      render(<NearbySpots beach={mockBeach} />);

      await waitFor(() => {
        expect(screen.getByText("San Diego")).toBeInTheDocument();
      });
    });

    it("should display only state when city is missing", async () => {
      const beachStateOnly = {
        ...mockNearbyBeach1,
        city: null,
        state: "California",
      };

      (getNearbyBeaches as jest.Mock).mockResolvedValue({
        success: true,
        data: [beachStateOnly],
      });

      render(<NearbySpots beach={mockBeach} />);

      await waitFor(() => {
        expect(screen.getByText("California")).toBeInTheDocument();
      });
    });

    it("should not display location text when both city and state are missing", async () => {
      const beachNoLocation = {
        ...mockNearbyBeach1,
        city: null,
        state: null,
      };

      (getNearbyBeaches as jest.Mock).mockResolvedValue({
        success: true,
        data: [beachNoLocation],
      });

      render(<NearbySpots beach={mockBeach} />);

      await waitFor(() => {
        expect(screen.getByText("Pacific Beach")).toBeInTheDocument();
      });

      // Should only have beach name, no location paragraph
      const beachCard = screen
        .getByText("Pacific Beach")
        .closest("a") as HTMLElement;
      const paragraphs = beachCard.querySelectorAll("p");
      expect(paragraphs).toHaveLength(1); // Only distance paragraph
    });
  });

  describe("Distance Display", () => {
    it("should handle various distance values - very close", async () => {
      const veryCloseBeach = { ...mockNearbyBeach1, distance: 0.5 };

      (getNearbyBeaches as jest.Mock).mockResolvedValue({
        success: true,
        data: [veryCloseBeach],
      });

      render(<NearbySpots beach={mockBeach} />);

      await waitFor(() => {
        expect(screen.getByText("0.5 mi away")).toBeInTheDocument();
      });
    });

    it("should handle various distance values - moderate", async () => {
      const moderateBeach = { ...mockNearbyBeach1, distance: 5.3 };

      (getNearbyBeaches as jest.Mock).mockResolvedValue({
        success: true,
        data: [moderateBeach],
      });

      render(<NearbySpots beach={mockBeach} />);

      await waitFor(() => {
        expect(screen.getByText("5.3 mi away")).toBeInTheDocument();
      });
    });

    it("should handle various distance values - far", async () => {
      const farBeach = { ...mockNearbyBeach1, distance: 22.8 };

      (getNearbyBeaches as jest.Mock).mockResolvedValue({
        success: true,
        data: [farBeach],
      });

      render(<NearbySpots beach={mockBeach} />);

      await waitFor(() => {
        expect(screen.getByText("23 mi away")).toBeInTheDocument();
      });
    });

    it("should not display distance when distance is undefined", async () => {
      const beachNoDistance = { ...mockNearbyBeach1 };
      delete (beachNoDistance as any).distance;

      (getNearbyBeaches as jest.Mock).mockResolvedValue({
        success: true,
        data: [beachNoDistance],
      });

      render(<NearbySpots beach={mockBeach} />);

      await waitFor(() => {
        expect(screen.getByText("Pacific Beach")).toBeInTheDocument();
      });

      expect(screen.queryByText(/mi away/)).not.toBeInTheDocument();
    });
  });

  describe("Custom Props", () => {
    it("should pass radiusMiles to getNearbyBeaches", async () => {
      (getNearbyBeaches as jest.Mock).mockResolvedValue({
        success: true,
        data: [mockNearbyBeach1],
      });

      render(<NearbySpots beach={mockBeach} radiusMiles={50} />);

      await waitFor(() => {
        expect(getNearbyBeaches).toHaveBeenCalledWith(32.75, -117.25, 50);
      });
    });

    it("should use default radiusMiles of 25 when not provided", async () => {
      (getNearbyBeaches as jest.Mock).mockResolvedValue({
        success: true,
        data: [mockNearbyBeach1],
      });

      render(<NearbySpots beach={mockBeach} />);

      await waitFor(() => {
        expect(getNearbyBeaches).toHaveBeenCalledWith(32.75, -117.25, 25);
      });
    });

    it("should apply custom className", async () => {
      (getNearbyBeaches as jest.Mock).mockResolvedValue({
        success: true,
        data: [mockNearbyBeach1],
      });

      const { container } = render(
        <NearbySpots beach={mockBeach} className="custom-class" />
      );

      await waitFor(() => {
        expect(screen.getByText("Pacific Beach")).toBeInTheDocument();
      });

      const section = container.querySelector("section");
      expect(section).toHaveClass("custom-class");
    });
  });

  describe("Grid Layout", () => {
    it("should use responsive grid layout", async () => {
      (getNearbyBeaches as jest.Mock).mockResolvedValue({
        success: true,
        data: [mockNearbyBeach1, mockNearbyBeach2, mockNearbyBeach3],
      });

      const { container } = render(<NearbySpots beach={mockBeach} />);

      await waitFor(() => {
        expect(screen.getByText("Pacific Beach")).toBeInTheDocument();
      });

      const gridContainer = container.querySelector(".grid");
      expect(gridContainer).toHaveClass("sm:grid-cols-2", "lg:grid-cols-3");
    });
  });

  describe("Accessibility", () => {
    it("should have proper semantic HTML structure", async () => {
      (getNearbyBeaches as jest.Mock).mockResolvedValue({
        success: true,
        data: [mockNearbyBeach1],
      });

      render(<NearbySpots beach={mockBeach} />);

      await waitFor(() => {
        const heading = screen.getByRole("heading", {
          level: 2,
          name: "Nearby Surf Spots",
        });
        expect(heading).toBeInTheDocument();
      });
    });

    it("should have accessible links with text content", async () => {
      (getNearbyBeaches as jest.Mock).mockResolvedValue({
        success: true,
        data: [mockNearbyBeach1],
      });

      render(<NearbySpots beach={mockBeach} />);

      await waitFor(() => {
        const link = screen.getByRole("link");
        expect(link).toHaveTextContent("Pacific Beach");
      });
    });
  });

  describe("Component Interaction", () => {
    it("should call getNearbyBeaches with correct parameters on mount", async () => {
      (getNearbyBeaches as jest.Mock).mockResolvedValue({
        success: true,
        data: [mockNearbyBeach1],
      });

      render(<NearbySpots beach={mockBeach} maxSpots={10} radiusMiles={30} />);

      await waitFor(() => {
        expect(getNearbyBeaches).toHaveBeenCalledTimes(1);
        expect(getNearbyBeaches).toHaveBeenCalledWith(32.75, -117.25, 30);
      });
    });

    it("should refetch when beach coordinates change", async () => {
      (getNearbyBeaches as jest.Mock).mockResolvedValue({
        success: true,
        data: [mockNearbyBeach1],
      });

      const { rerender } = render(<NearbySpots beach={mockBeach} />);

      await waitFor(() => {
        expect(getNearbyBeaches).toHaveBeenCalledTimes(1);
      });

      const updatedBeach = { ...mockBeach, lat: 33.0, lon: -117.0 };
      rerender(<NearbySpots beach={updatedBeach} />);

      await waitFor(() => {
        expect(getNearbyBeaches).toHaveBeenCalledTimes(2);
        expect(getNearbyBeaches).toHaveBeenLastCalledWith(33.0, -117.0, 25);
      });
    });
  });
});
