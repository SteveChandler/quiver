import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MapContent } from "@/components/map/map-content";
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

jest.mock("@/components/skeletons/map-skeleton", () => ({
  MapSkeleton: () => <div data-testid="map-skeleton">Loading map...</div>,
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
  loading: false,
  locationError: null,
  usingDefaultLocation: false,
  userLocation: { lat: 32.7841, lng: -117.2527 },
  selectedBeach: null,
  filteredBeaches: [mockBeach],
  searchQuery: "",
  onGetUserLocation: jest.fn(),
  onUseDefaultLocation: jest.fn(),
};

describe("MapContent", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetStaticMapImageUrl.mockReturnValue("https://example.com/map.jpg");
  });

  describe("Map rendering", () => {
    it("should render map container with correct minimum height", () => {
      render(<MapContent {...defaultProps} />);

      const mapContainer = document.querySelector(".min-h-\\[250px\\]");
      expect(mapContainer).toBeInTheDocument();
    });

    it("should render MapImage with correct dimensions", () => {
      render(<MapContent {...defaultProps} />);

      const mapImage = screen.getByTestId("map-image");
      expect(mapImage).toBeInTheDocument();
      expect(mapImage).toHaveAttribute("data-fill", "true");
      expect(mapImage).toHaveAttribute("className", "object-cover");

      // Verify the getStaticMapImageUrl was called with correct reduced height
      expect(mockGetStaticMapImageUrl).toHaveBeenCalledWith(
        32.7841,
        -117.2527,
        {
          width: 800,
          height: 400, // Reduced from 600 to 400
          zoom: 12,
        }
      );
    });

    it("should use user location as map center when no beach is selected", () => {
      render(<MapContent {...defaultProps} />);

      expect(mockGetStaticMapImageUrl).toHaveBeenCalledWith(
        32.7841,
        -117.2527,
        expect.objectContaining({
          width: 800,
          height: 400,
          zoom: 12,
        })
      );
    });

    it("should use selected beach location as map center", () => {
      const propsWithSelectedBeach = {
        ...defaultProps,
        selectedBeach: mockBeach,
      };

      render(<MapContent {...propsWithSelectedBeach} />);

      expect(mockGetStaticMapImageUrl).toHaveBeenCalledWith(
        32.7841,
        -117.2527,
        expect.objectContaining({
          width: 800,
          height: 400,
          zoom: 12,
        })
      );
    });

    it("should use default Ocean Beach coordinates when no location is available", () => {
      const propsWithoutLocation = {
        ...defaultProps,
        userLocation: null,
      };

      render(<MapContent {...propsWithoutLocation} />);

      expect(mockGetStaticMapImageUrl).toHaveBeenCalledWith(
        32.7503, // Ocean Beach default latitude
        -117.2534, // Ocean Beach default longitude
        expect.objectContaining({
          width: 800,
          height: 400,
          zoom: 12,
        })
      );
    });
  });

  describe("Map overlay information", () => {
    it("should display correct beach count when beaches are found", () => {
      const propsWithBeaches = {
        ...defaultProps,
        filteredBeaches: [mockBeach, { ...mockBeach, id: "beach-2" }],
      };

      render(<MapContent {...propsWithBeaches} />);

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

      render(<MapContent {...propsWithSearch} />);

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

      render(<MapContent {...propsWithNoResults} />);

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

      render(<MapContent {...propsWithDefaultLocation} />);

      expect(
        screen.getByText("Showing beaches near Ocean Beach, San Diego")
      ).toBeInTheDocument();
    });

    it("should show selected beach name in overlay", () => {
      const propsWithSelectedBeach = {
        ...defaultProps,
        selectedBeach: mockBeach,
      };

      render(<MapContent {...propsWithSelectedBeach} />);

      expect(screen.getByText("Showing Test Beach")).toBeInTheDocument();
    });
  });

  describe("Location controls", () => {
    it("should show location button when using default location", () => {
      const propsWithDefaultLocation = {
        ...defaultProps,
        usingDefaultLocation: true,
      };

      render(<MapContent {...propsWithDefaultLocation} />);

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

      render(<MapContent {...propsWithoutLocation} />);

      const locationButton = screen.getByRole("button", {
        name: /Use My Location/i,
      });
      expect(locationButton).toBeInTheDocument();
    });

    it("should not show location button when user has actual location", () => {
      render(<MapContent {...defaultProps} />);

      expect(
        screen.queryByRole("button", { name: /Use My Location/i })
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: /Use My Actual Location/i })
      ).not.toBeInTheDocument();
    });

    it("should call onGetUserLocation when location button is clicked", async () => {
      const user = userEvent.setup();
      const mockOnGetUserLocation = jest.fn();

      const propsWithoutLocation = {
        ...defaultProps,
        userLocation: null,
        onGetUserLocation: mockOnGetUserLocation,
      };

      render(<MapContent {...propsWithoutLocation} />);

      const locationButton = screen.getByRole("button", {
        name: /Use My Location/i,
      });
      await user.click(locationButton);

      expect(mockOnGetUserLocation).toHaveBeenCalled();
    });
  });

  describe("Loading states", () => {
    it("should show loading skeleton when loading", () => {
      const loadingProps = {
        ...defaultProps,
        loading: true,
      };

      render(<MapContent {...loadingProps} />);

      expect(screen.getByTestId("map-skeleton")).toBeInTheDocument();
      expect(screen.getByText("Loading map...")).toBeInTheDocument();
    });

    it("should not show map content when loading", () => {
      const loadingProps = {
        ...defaultProps,
        loading: true,
      };

      render(<MapContent {...loadingProps} />);

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

      render(<MapContent {...errorProps} />);

      expect(screen.getByText("Location access denied")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Try Again" })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Use San Diego Location" })
      ).toBeInTheDocument();
    });

    it("should show detailed instructions when location is blocked", () => {
      const blockedProps = {
        ...defaultProps,
        locationError: "Location access blocked by user",
        usingDefaultLocation: false,
      };

      render(<MapContent {...blockedProps} />);

      expect(screen.getByText("To enable location:")).toBeInTheDocument();
      expect(
        screen.getByText("1. Click the 🔒 lock icon next to the URL")
      ).toBeInTheDocument();
      expect(
        screen.getByText('2. Set Location to "Allow"')
      ).toBeInTheDocument();
      expect(screen.getByText("3. Refresh the page")).toBeInTheDocument();
    });

    it("should call onGetUserLocation when Try Again is clicked", async () => {
      const user = userEvent.setup();
      const mockOnGetUserLocation = jest.fn();

      const errorProps = {
        ...defaultProps,
        locationError: "Location access denied",
        usingDefaultLocation: false,
        onGetUserLocation: mockOnGetUserLocation,
      };

      render(<MapContent {...errorProps} />);

      const tryAgainButton = screen.getByRole("button", { name: "Try Again" });
      await user.click(tryAgainButton);

      expect(mockOnGetUserLocation).toHaveBeenCalled();
    });

    it("should call onUseDefaultLocation when Use San Diego Location is clicked", async () => {
      const user = userEvent.setup();
      const mockOnUseDefaultLocation = jest.fn();

      const errorProps = {
        ...defaultProps,
        locationError: "Location access denied",
        usingDefaultLocation: false,
        onUseDefaultLocation: mockOnUseDefaultLocation,
      };

      render(<MapContent {...errorProps} />);

      const useDefaultButton = screen.getByRole("button", {
        name: "Use San Diego Location",
      });
      await user.click(useDefaultButton);

      expect(mockOnUseDefaultLocation).toHaveBeenCalled();
    });

    it("should show map content when using default location after error", () => {
      const errorWithDefaultProps = {
        ...defaultProps,
        locationError: "Location access denied",
        usingDefaultLocation: true,
      };

      render(<MapContent {...errorWithDefaultProps} />);

      // Should show map content, not error message
      expect(screen.getByTestId("map-image")).toBeInTheDocument();
      expect(
        screen.queryByText("Location access denied")
      ).not.toBeInTheDocument();
    });
  });

  describe("Container structure", () => {
    it("should have correct CSS classes for container", () => {
      render(<MapContent {...defaultProps} />);

      // Check for the main container with flex-1 and min-height
      const container = document.querySelector(
        ".flex-1.relative.overflow-hidden.min-h-\\[250px\\]"
      );
      expect(container).toBeInTheDocument();
    });

    it("should have properly positioned overlay", () => {
      render(<MapContent {...defaultProps} />);

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

      render(<MapContent {...propsWithoutLocation} />);

      // Check for location button with correct positioning
      const locationControls = document.querySelector(
        ".absolute.top-4.right-4"
      );
      expect(locationControls).toBeInTheDocument();
    });
  });
});
