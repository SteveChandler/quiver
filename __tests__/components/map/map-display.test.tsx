import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MapDisplay } from "@/components/map/map-display";
import * as mapUtils from "@/lib/map-utils";

// Mock dependencies
jest.mock("@/lib/map-utils");
jest.mock("@/components/map-image", () => ({
  MapImage: ({ src, alt, latitude, longitude, fill, className }: any) => (
    <div
      data-testid="map-image"
      data-src={src}
      data-alt={alt}
      data-latitude={latitude}
      data-longitude={longitude}
      data-fill={fill}
      className={className}
    >
      Map Image: {alt}
    </div>
  ),
}));

const mockGetStaticMapImageUrl = jest.mocked(mapUtils.getStaticMapImageUrl);

const mockBeach = {
  id: "beach-1",
  name: "Test Beach",
  latitude: 32.7841,
  longitude: -117.2527,
  location: "San Diego, CA",
};

const defaultProps = {
  isLoading: false,
  locationError: null,
  usingDefaultLocation: false,
  selectedBeach: null,
  userLocation: { lat: 32.7841, lng: -117.2527 },
  filteredBeaches: [mockBeach],
  searchQuery: "",
  onRetryLocation: jest.fn(),
};

describe("MapDisplay", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetStaticMapImageUrl.mockReturnValue("https://example.com/map.jpg");
  });

  describe("Map rendering", () => {
    it("should render MapImage with correct reduced dimensions", () => {
      render(<MapDisplay {...defaultProps} />);

      const mapImage = screen.getByTestId("map-image");
      expect(mapImage).toBeInTheDocument();
      expect(mapImage).toHaveAttribute("data-fill", "true");
      expect(mapImage).toHaveAttribute("className", "object-cover");

      // Verify the getStaticMapImageUrl was called with correct reduced height
      expect(mockGetStaticMapImageUrl).toHaveBeenCalledWith(
        32.7841,
        -117.2527,
        { width: 800, height: 400, zoom: 12 } // Reduced from 600 to 400
      );
    });

    it("should use user location when no beach is selected", () => {
      render(<MapDisplay {...defaultProps} />);

      expect(mockGetStaticMapImageUrl).toHaveBeenCalledWith(
        32.7841,
        -117.2527,
        { width: 800, height: 400, zoom: 12 }
      );
    });

    it("should use selected beach location when beach is selected", () => {
      const propsWithSelectedBeach = {
        ...defaultProps,
        selectedBeach: mockBeach,
      };

      render(<MapDisplay {...propsWithSelectedBeach} />);

      expect(mockGetStaticMapImageUrl).toHaveBeenCalledWith(
        32.7841,
        -117.2527,
        { width: 800, height: 400, zoom: 12 }
      );
    });

    it("should use default Ocean Beach coordinates when no location is available", () => {
      const propsWithoutLocation = {
        ...defaultProps,
        userLocation: null,
        selectedBeach: null,
      };

      render(<MapDisplay {...propsWithoutLocation} />);

      expect(mockGetStaticMapImageUrl).toHaveBeenCalledWith(
        32.7503, // Ocean Beach default latitude
        -117.2534, // Ocean Beach default longitude
        { width: 800, height: 400, zoom: 12 }
      );
    });

    it("should prioritize selected beach over user location", () => {
      const propsWithBoth = {
        ...defaultProps,
        selectedBeach: mockBeach,
        userLocation: { lat: 33.0, lng: -118.0 }, // Different location
      };

      render(<MapDisplay {...propsWithBoth} />);

      // Should use beach coordinates, not user location
      expect(mockGetStaticMapImageUrl).toHaveBeenCalledWith(
        32.7841, // Beach coordinates
        -117.2527,
        { width: 800, height: 400, zoom: 12 }
      );
    });
  });

  describe("Map overlay information", () => {
    it("should display correct beach count when beaches are found", () => {
      const propsWithBeaches = {
        ...defaultProps,
        filteredBeaches: [
          mockBeach,
          { ...mockBeach, id: "beach-2", name: "Beach 2" },
        ],
      };

      render(<MapDisplay {...propsWithBeaches} />);

      expect(
        screen.getByText("Found 2 beaches near your location")
      ).toBeInTheDocument();
    });

    it("should display search results when searching", () => {
      const propsWithSearch = {
        ...defaultProps,
        searchQuery: "test beach",
        filteredBeaches: [mockBeach],
      };

      render(<MapDisplay {...propsWithSearch} />);

      expect(
        screen.getByText('Found 1 beach for "test beach"')
      ).toBeInTheDocument();
    });

    it("should display no results message when no beaches found", () => {
      const propsWithNoResults = {
        ...defaultProps,
        searchQuery: "nonexistent beach",
        filteredBeaches: [],
      };

      render(<MapDisplay {...propsWithNoResults} />);

      expect(
        screen.getByText('No beaches found for "nonexistent beach"')
      ).toBeInTheDocument();
    });

    it("should display default location message when using Ocean Beach", () => {
      const propsWithDefaultLocation = {
        ...defaultProps,
        usingDefaultLocation: true,
        userLocation: { lat: 32.7503, lng: -117.2534 },
      };

      render(<MapDisplay {...propsWithDefaultLocation} />);

      expect(
        screen.getByText("Showing beaches near Ocean Beach, San Diego")
      ).toBeInTheDocument();
    });

    it("should display appropriate help text", () => {
      render(<MapDisplay {...defaultProps} />);

      expect(
        screen.getByText("Tap a beach card below to see it on the map")
      ).toBeInTheDocument();
    });

    it("should display search help text when no results", () => {
      const propsWithNoResults = {
        ...defaultProps,
        searchQuery: "nonexistent",
        filteredBeaches: [],
      };

      render(<MapDisplay {...propsWithNoResults} />);

      expect(
        screen.getByText("Try a different search term or clear your search")
      ).toBeInTheDocument();
    });

    it("should display location expansion suggestion", () => {
      const propsWithNoResults = {
        ...defaultProps,
        userLocation: { lat: 32.7841, lng: -117.2527 },
        usingDefaultLocation: false,
        searchQuery: "",
        filteredBeaches: [],
      };

      render(<MapDisplay {...propsWithNoResults} />);

      expect(
        screen.getByText(
          "Try searching for a specific beach or expand your search area"
        )
      ).toBeInTheDocument();
    });
  });

  describe("Location controls", () => {
    it("should show location button when using default location", () => {
      const propsWithDefaultLocation = {
        ...defaultProps,
        usingDefaultLocation: true,
      };

      render(<MapDisplay {...propsWithDefaultLocation} />);

      const locationButton = screen.getByRole("button", {
        name: /Use My Actual Location/i,
      });
      expect(locationButton).toBeInTheDocument();
    });

    it("should show location button when no user location", () => {
      const propsWithoutLocation = {
        ...defaultProps,
        userLocation: null,
      };

      render(<MapDisplay {...propsWithoutLocation} />);

      const locationButton = screen.getByRole("button", {
        name: /Use My Location/i,
      });
      expect(locationButton).toBeInTheDocument();
    });

    it("should not show location button when user has actual location", () => {
      render(<MapDisplay {...defaultProps} />);

      expect(
        screen.queryByRole("button", { name: /Use My Location/i })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /Use My Actual Location/i })
      ).not.toBeInTheDocument();
    });

    it("should call onRetryLocation when location button is clicked", async () => {
      const user = userEvent.setup();
      const mockOnRetryLocation = jest.fn();

      const propsWithoutLocation = {
        ...defaultProps,
        userLocation: null,
        onRetryLocation: mockOnRetryLocation,
      };

      render(<MapDisplay {...propsWithoutLocation} />);

      const locationButton = screen.getByRole("button", {
        name: /Use My Location/i,
      });
      await user.click(locationButton);

      expect(mockOnRetryLocation).toHaveBeenCalled();
    });
  });

  describe("Loading states", () => {
    it("should show loading spinner when loading", () => {
      const loadingProps = {
        ...defaultProps,
        isLoading: true,
      };

      render(<MapDisplay {...loadingProps} />);

      expect(screen.getByRole("status")).toBeInTheDocument(); // Loader2 has role="status"
    });

    it("should center loading spinner", () => {
      const loadingProps = {
        ...defaultProps,
        isLoading: true,
      };

      render(<MapDisplay {...loadingProps} />);

      const loadingContainer = document.querySelector(
        ".absolute.inset-0.flex.items-center.justify-center"
      );
      expect(loadingContainer).toBeInTheDocument();
    });

    it("should not show map content when loading", () => {
      const loadingProps = {
        ...defaultProps,
        isLoading: true,
      };

      render(<MapDisplay {...loadingProps} />);

      expect(screen.queryByTestId("map-image")).not.toBeInTheDocument();
    });
  });

  describe("Error handling", () => {
    it("should show error message when location error occurs", () => {
      const errorProps = {
        ...defaultProps,
        locationError: "Location access denied",
        usingDefaultLocation: false,
      };

      render(<MapDisplay {...errorProps} />);

      expect(screen.getByText("Location access denied")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Try Again" })
      ).toBeInTheDocument();
    });

    it("should center error message", () => {
      const errorProps = {
        ...defaultProps,
        locationError: "Location access denied",
        usingDefaultLocation: false,
      };

      render(<MapDisplay {...errorProps} />);

      const errorContainer = document.querySelector(
        ".absolute.inset-0.flex.items-center.justify-center"
      );
      expect(errorContainer).toBeInTheDocument();
    });

    it("should call onRetryLocation when Try Again is clicked", async () => {
      const user = userEvent.setup();
      const mockOnRetryLocation = jest.fn();

      const errorProps = {
        ...defaultProps,
        locationError: "Location access denied",
        usingDefaultLocation: false,
        onRetryLocation: mockOnRetryLocation,
      };

      render(<MapDisplay {...errorProps} />);

      const tryAgainButton = screen.getByRole("button", { name: "Try Again" });
      await user.click(tryAgainButton);

      expect(mockOnRetryLocation).toHaveBeenCalled();
    });

    it("should show map content when using default location after error", () => {
      const errorWithDefaultProps = {
        ...defaultProps,
        locationError: "Location access denied",
        usingDefaultLocation: true,
      };

      render(<MapDisplay {...errorWithDefaultProps} />);

      // Should show map content, not error message
      expect(screen.getByTestId("map-image")).toBeInTheDocument();
      expect(
        screen.queryByText("Location access denied")
      ).not.toBeInTheDocument();
    });
  });

  describe("Container structure", () => {
    it("should have correct container structure", () => {
      render(<MapDisplay {...defaultProps} />);

      // Check for the main container
      const mainContainer = document.querySelector(
        ".absolute.inset-0.flex.flex-col"
      );
      expect(mainContainer).toBeInTheDocument();

      // Check for the map container
      const mapContainer = document.querySelector(
        ".flex-1.relative.overflow-hidden"
      );
      expect(mapContainer).toBeInTheDocument();
    });

    it("should have properly positioned overlay", () => {
      render(<MapDisplay {...defaultProps} />);

      // Check for overlay with correct positioning
      const overlay = document.querySelector(".absolute.top-4.left-4");
      expect(overlay).toBeInTheDocument();
      expect(overlay).toHaveClass(
        "bg-white/90",
        "backdrop-blur-sm",
        "rounded-lg",
        "p-3",
        "shadow-md"
      );
    });

    it("should have properly positioned location controls", () => {
      const propsWithoutLocation = {
        ...defaultProps,
        userLocation: null,
      };

      render(<MapDisplay {...propsWithoutLocation} />);

      // Check for location button with correct positioning
      const locationControls = document.querySelector(
        ".absolute.top-4.right-4"
      );
      expect(locationControls).toBeInTheDocument();
    });
  });

  describe("Map image attributes", () => {
    it("should pass correct props to MapImage", () => {
      render(<MapDisplay {...defaultProps} />);

      const mapImage = screen.getByTestId("map-image");
      expect(mapImage).toHaveAttribute("data-alt", "Beach locations map");
      expect(mapImage).toHaveAttribute("data-latitude", "32.7841");
      expect(mapImage).toHaveAttribute("data-longitude", "-117.2527");
      expect(mapImage).toHaveAttribute("data-fill", "true");
      expect(mapImage).toHaveAttribute("className", "object-cover");
    });

    it("should use beach coordinates in MapImage when beach is selected", () => {
      const propsWithSelectedBeach = {
        ...defaultProps,
        selectedBeach: mockBeach,
      };

      render(<MapDisplay {...propsWithSelectedBeach} />);

      const mapImage = screen.getByTestId("map-image");
      expect(mapImage).toHaveAttribute("data-latitude", "32.7841");
      expect(mapImage).toHaveAttribute("data-longitude", "-117.2527");
    });

    it("should use default coordinates in MapImage when no location", () => {
      const propsWithoutLocation = {
        ...defaultProps,
        userLocation: null,
        selectedBeach: null,
      };

      render(<MapDisplay {...propsWithoutLocation} />);

      const mapImage = screen.getByTestId("map-image");
      expect(mapImage).toHaveAttribute("data-latitude", "32.7503");
      expect(mapImage).toHaveAttribute("data-longitude", "-117.2534");
    });
  });
});
