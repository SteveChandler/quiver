import { render, screen } from "@testing-library/react";
import { ExploreMoreLinks } from "@/components/forecast/conditions-overview/explore-more-links";
import type { Beach } from "@/types/database";

// Mock beach-url-utils
const mockBuildHiCityUrlForBeach = jest.fn(
  (beach: { state: string | null | undefined; city: string | null | undefined }) =>
    `/surf/${beach.state}/${beach.city}`
);
jest.mock("@/lib/utils/beach-url-utils", () => ({
  buildHiCityUrlForBeach: (beach: {
    state: string | null | undefined;
    city: string | null | undefined;
  }) => mockBuildHiCityUrlForBeach(beach),
}));

// Mock Next.js Link
jest.mock("next/link", () => {
  return ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>;
});

// Mock lucide-react icons
jest.mock("lucide-react", () => ({
  Compass: ({ className }: any) => <span data-testid="compass-icon" className={className} />,
  Map: ({ className }: any) => <span data-testid="map-icon" className={className} />,
  ArrowRight: ({ className }: any) => (
    <span data-testid="arrow-right-icon" className={className} />
  ),
}));

function createMockBeach(overrides: Partial<Beach> = {}): Beach {
  return {
    id: "beach-1",
    name: "Blacks Beach",
    state: "CA",
    city: "San Diego",
    center_lat: 32.8868,
    center_lng: -117.2509,
    ...overrides,
  } as Beach;
}

describe("ExploreMoreLinks", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders two links", () => {
    const beach = createMockBeach();
    render(<ExploreMoreLinks beach={beach} />);

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(2);
  });

  it("renders city surf guide link with buildHiCityUrlForBeach", () => {
    const beach = createMockBeach({ state: "CA", city: "San Diego" });
    render(<ExploreMoreLinks beach={beach} />);

    expect(mockBuildHiCityUrlForBeach).toHaveBeenCalledWith(
      expect.objectContaining({ state: "CA", city: "San Diego" })
    );

    const cityLink = screen.getByRole("link", { name: /San Diego Surf Guide/i });
    expect(cityLink).toHaveAttribute("href", "/surf/CA/San Diego");
  });

  it("renders map link pointing to /map", () => {
    const beach = createMockBeach();
    render(<ExploreMoreLinks beach={beach} />);

    const mapLink = screen.getByRole("link", { name: /Nearby Beaches on Map/i });
    expect(mapLink).toHaveAttribute("href", "/map");
  });

  it("displays city name in title", () => {
    const beach = createMockBeach({ city: "La Jolla" });
    render(<ExploreMoreLinks beach={beach} />);

    expect(screen.getByText("La Jolla Surf Guide")).toBeInTheDocument();
  });

  it("falls back to 'Local Surf Guide' when beach.city is null", () => {
    const beach = createMockBeach({ city: null });
    render(<ExploreMoreLinks beach={beach} />);

    expect(screen.getByText("Local Surf Guide")).toBeInTheDocument();
  });

  it("falls back to 'Local Surf Guide' when beach.city is undefined", () => {
    const beach = createMockBeach({ city: undefined });
    render(<ExploreMoreLinks beach={beach} />);

    expect(screen.getByText("Local Surf Guide")).toBeInTheDocument();
  });

  it("renders Compass icon for city surf guide link", () => {
    const beach = createMockBeach();
    render(<ExploreMoreLinks beach={beach} />);

    const compassIcons = screen.getAllByTestId("compass-icon");
    expect(compassIcons).toHaveLength(1);
  });

  it("renders Map icon for map link", () => {
    const beach = createMockBeach();
    render(<ExploreMoreLinks beach={beach} />);

    const mapIcons = screen.getAllByTestId("map-icon");
    expect(mapIcons).toHaveLength(1);
  });

  it("renders arrow icons for both links", () => {
    const beach = createMockBeach();
    render(<ExploreMoreLinks beach={beach} />);

    const arrowIcons = screen.getAllByTestId("arrow-right-icon");
    expect(arrowIcons).toHaveLength(2);
  });

  it("displays correct descriptions for both links", () => {
    const beach = createMockBeach();
    render(<ExploreMoreLinks beach={beach} />);

    expect(screen.getByText("Compare conditions across all local breaks")).toBeInTheDocument();
    expect(screen.getByText("Explore surf spots in the area")).toBeInTheDocument();
  });

  it("renders links with correct structure", () => {
    const beach = createMockBeach({ city: "Oceanside" });
    render(<ExploreMoreLinks beach={beach} />);

    const cityLink = screen.getByRole("link", { name: /Oceanside Surf Guide/i });
    const mapLink = screen.getByRole("link", { name: /Nearby Beaches on Map/i });

    // Both should be anchor elements
    expect(cityLink.tagName).toBe("A");
    expect(mapLink.tagName).toBe("A");

    // City link should contain city name
    expect(cityLink).toHaveTextContent("Oceanside Surf Guide");

    // Map link should contain map text
    expect(mapLink).toHaveTextContent("Nearby Beaches on Map");
  });

  it("passes correct parameters to buildHiCityUrlForBeach with different states", () => {
    const beach = createMockBeach({ state: "HI", city: "Honolulu" });
    render(<ExploreMoreLinks beach={beach} />);

    expect(mockBuildHiCityUrlForBeach).toHaveBeenCalledWith(
      expect.objectContaining({ state: "HI", city: "Honolulu" })
    );
  });
});
