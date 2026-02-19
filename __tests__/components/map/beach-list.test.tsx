import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BeachList } from "@/components/map/beach-list";
import type { Beach } from "@/types/database";

// Mock dependencies
jest.mock("@/hooks/use-beach-reviews", () => ({
  useMultipleBeachReviews: () => ({
    reviewStats: {},
    loading: false,
  }),
}));

jest.mock("@/lib/utils/beach-card-utils", () => ({
  prepareMultipleBeachCardData: (
    beaches: Beach[],
    _userLocation: unknown,
    _reviewStats: unknown,
    _context: string
  ) =>
    beaches.map((b) => ({
      id: b.id,
      name: b.name,
      distance: "1.0 mi",
      rating: 4.0,
      reviewCount: 10,
      mapImageUrl: "",
      latitude: b.lat,
      longitude: b.lon,
      slug: b.slug,
      city: "San Diego",
      state: "CA",
    })),
  getBeachLocation: (beach: Beach) => beach.city || "Unknown",
}));

jest.mock("@/components/beach-card", () => ({
  BeachCard: (props: { name: string; id: string }) => (
    <div data-testid={`beach-card-${props.id}`}>{props.name}</div>
  ),
}));

jest.mock("@/components/skeletons/beach-card-skeleton", () => ({
  BeachCardListSkeleton: ({ count }: { count: number }) => (
    <div data-testid="beach-card-skeleton">Loading {count} items</div>
  ),
}));

jest.mock("framer-motion", () => {
  const React = require("react");
  const createMotionComponent = (tag: string) =>
    React.forwardRef((props: Record<string, unknown>, ref: unknown) => {
      const {
        initial,
        animate,
        exit,
        transition,
        variants,
        whileHover,
        whileTap,
        layout,
        ...rest
      } = props;
      return React.createElement(tag, { ...rest, ref });
    });
  return {
    motion: {
      div: createMotionComponent("div"),
      button: createMotionComponent("button"),
    },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  };
});

const makeFakeBeach = (id: string, name: string): Beach =>
  ({
    id,
    name,
    slug: name.toLowerCase().replace(/\s/g, "-"),
    center_lat: 32.8,
    center_lng: -117.2,
    city_name: "San Diego",
  }) as unknown as Beach;

const defaultProps = {
  filteredBeaches: [
    makeFakeBeach("1", "Blacks Beach"),
    makeFakeBeach("2", "La Jolla Shores"),
  ],
  searchQuery: "",
  userLocation: { lat: 32.8, lon: -117.2 },
  usingDefaultLocation: false,
  loading: false,
  onBeachSelect: jest.fn(),
  onClearSearch: jest.fn(),
  onGetUserLocation: jest.fn(),
  onLoadBeaches: jest.fn(),
  getDistanceFromUser: jest.fn(() => "1.0 mi"),
};

describe("BeachList", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Bug 7: Filter clear button touch target", () => {
    it("should show clear button when filter has text", async () => {
      const user = userEvent.setup();
      render(<BeachList {...defaultProps} />);

      const filterInput = screen.getByTestId("filter-input");
      await user.type(filterInput, "Black");

      const clearButton = screen.getByLabelText("Clear filter");
      expect(clearButton).toBeInTheDocument();
    });

    it("should have minimum 44px touch target on clear button", async () => {
      const user = userEvent.setup();
      render(<BeachList {...defaultProps} />);

      const filterInput = screen.getByTestId("filter-input");
      await user.type(filterInput, "Black");

      const clearButton = screen.getByLabelText("Clear filter");
      expect(clearButton).toHaveClass("min-w-[44px]");
      expect(clearButton).toHaveClass("min-h-[44px]");
    });

    it("should center the clear icon within the touch target", async () => {
      const user = userEvent.setup();
      render(<BeachList {...defaultProps} />);

      const filterInput = screen.getByTestId("filter-input");
      await user.type(filterInput, "Black");

      const clearButton = screen.getByLabelText("Clear filter");
      expect(clearButton).toHaveClass("flex");
      expect(clearButton).toHaveClass("items-center");
      expect(clearButton).toHaveClass("justify-center");
    });

    it("should clear the filter when clear button is clicked", async () => {
      const user = userEvent.setup();
      render(<BeachList {...defaultProps} />);

      const filterInput = screen.getByTestId("filter-input");
      await user.type(filterInput, "Black");

      expect(filterInput).toHaveValue("Black");

      const clearButton = screen.getByLabelText("Clear filter");
      await user.click(clearButton);

      expect(filterInput).toHaveValue("");
    });
  });

  describe("Loading state", () => {
    it("should show skeleton when loading", () => {
      render(<BeachList {...defaultProps} loading={true} />);

      expect(screen.getByTestId("beach-card-skeleton")).toBeInTheDocument();
    });
  });
});
