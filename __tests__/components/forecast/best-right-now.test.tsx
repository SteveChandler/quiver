import { render, screen, act } from "@testing-library/react";
import { BestRightNow } from "@/components/forecast/best-right-now";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import type { TopBeachEntry } from "@/lib/utils/forecast-hub-utils";

jest.mock("next/link", () => {
  return function MockLink({ children, href, ...props }: any) {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  };
});

jest.mock("next/image", () => {
  return function MockImage({ alt, src, ...props }: any) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img alt={alt} src={typeof src === "string" ? src : ""} {...props} />;
  };
});

jest.mock("@/hooks/use-data-fetcher", () => ({
  useDataFetcher: jest.fn(),
}));

jest.mock("@/lib/utils/score-color-utils", () => ({
  getScoreColorClasses: jest.fn((score: number) => {
    if (score >= 8) return { bg: "bg-green-500", label: "Excellent" };
    if (score >= 6) return { bg: "bg-blue-500", label: "Good" };
    if (score >= 4) return { bg: "bg-yellow-500", label: "Fair" };
    return { bg: "bg-gray-400", label: "Poor" };
  }),
}));

jest.mock("lucide-react", () => ({
  Waves: ({ className }: { className?: string }) => (
    <svg data-testid="waves-icon" className={className} />
  ),
  Trophy: ({ className }: { className?: string }) => (
    <svg data-testid="trophy-icon" className={className} />
  ),
}));

jest.mock("@/lib/location/ip-location", () => ({
  getIPLocationCookieName: jest.fn(() => "quiver_ip_region"),
  parseIPLocationCookie: jest.fn((value: string) => {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }),
}));

const baseBeach: Omit<TopBeachEntry, "beachId" | "beachName" | "score" | "waveHeight" | "regionName" | "href" | "slug"> = {
  city: null,
  state: null,
  imageUrl: null,
  averageRating: null,
  skillLevel: null,
};

const mockTopBeaches: TopBeachEntry[] = [
  {
    ...baseBeach,
    beachId: "beach-1",
    beachName: "Blacks Beach",
    score: 9,
    waveHeight: 6.5,
    regionName: "San Diego",
    href: "/ca/san-diego/blacks",
    slug: "blacks",
    imageUrl: "https://example.com/blacks.jpg",
  },
  {
    ...baseBeach,
    beachId: "beach-2",
    beachName: "Trestles",
    score: 8,
    waveHeight: 4.2,
    regionName: "Orange County",
    href: "/ca/orange-county/trestles",
    slug: "trestles",
  },
  {
    ...baseBeach,
    beachId: "beach-3",
    beachName: "Rincon",
    score: 7,
    waveHeight: 5.8,
    regionName: "Santa Barbara",
    href: "/ca/santa-barbara/rincon",
    slug: "rincon",
  },
  {
    ...baseBeach,
    beachId: "beach-4",
    beachName: "Ocean Beach",
    score: 6,
    waveHeight: 3.1,
    regionName: "San Francisco",
    href: "/ca/san-francisco/ocean-beach",
    slug: "ocean-beach",
  },
  {
    ...baseBeach,
    beachId: "beach-5",
    beachName: "Huntington Beach",
    score: 5,
    waveHeight: 2.9,
    regionName: "Orange County",
    href: null,
    slug: null,
  },
];

function mockFetcher(
  data: TopBeachEntry[] | null | undefined,
  loading = false
) {
  (useDataFetcher as jest.Mock).mockReturnValue({ data, loading, error: null });
}

describe("BestRightNow", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    document.cookie =
      "quiver_ip_region=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
  });

  describe("Loading state", () => {
    it("renders skeleton rows when loading", () => {
      mockFetcher(null, true);
      const { container } = render(<BestRightNow />);
      expect(
        screen.getByTestId("best-right-now-skeleton")
      ).toBeInTheDocument();
      const rows = container.querySelectorAll(
        "[data-testid='best-right-now-skeleton'] > div"
      );
      expect(rows).toHaveLength(5);
    });
  });

  describe("Empty data", () => {
    it.each([[[]], [null], [undefined]])(
      "returns null when data is %p",
      (data) => {
        mockFetcher(data as TopBeachEntry[] | null | undefined);
        const { container } = render(<BestRightNow />);
        expect(container.firstChild).toBeNull();
      }
    );
  });

  describe("Heading resolution", () => {
    it("uses 'Best Right Now' when no cookie and no override", () => {
      mockFetcher(mockTopBeaches);
      render(<BestRightNow />);
      expect(
        screen.getByRole("heading", { level: 2, name: /best right now/i })
      ).toBeInTheDocument();
    });

    it("uses 'Best Near You' when cookie provides coords", async () => {
      const ip = JSON.stringify({
        latitude: 32.7157,
        longitude: -117.1611,
      });
      document.cookie = `quiver_ip_region=${encodeURIComponent(ip)}`;
      mockFetcher(mockTopBeaches);
      await act(async () => {
        render(<BestRightNow />);
      });
      expect(
        screen.getByRole("heading", { level: 2, name: /best near you/i })
      ).toBeInTheDocument();
    });

    it("respects headingOverride prop", () => {
      mockFetcher(mockTopBeaches);
      render(
        <BestRightNow headingOverride="Top spots in Southern California" />
      );
      expect(
        screen.getByRole("heading", {
          level: 2,
          name: /top spots in southern california/i,
        })
      ).toBeInTheDocument();
    });

    it("uses userCoordsOverride without consulting the cookie", () => {
      mockFetcher(mockTopBeaches);
      render(
        <BestRightNow
          userCoordsOverride={{ lat: 21.3, lon: -157.8 }}
          headingOverride="Top spots in Hawaii"
        />
      );
      expect(
        screen.getByRole("heading", { level: 2, name: /top spots in hawaii/i })
      ).toBeInTheDocument();
    });
  });

  describe("Rendered rows", () => {
    beforeEach(() => mockFetcher(mockTopBeaches));

    it("renders all beach names, regions, and wave ranges", () => {
      render(<BestRightNow />);
      for (const b of mockTopBeaches) {
        expect(screen.getByText(b.beachName)).toBeInTheDocument();
      }
      expect(screen.getByText("San Diego")).toBeInTheDocument();
      expect(screen.getAllByText("Orange County")).toHaveLength(2);
      expect(screen.getByText("7-10ft")).toBeInTheDocument();
      expect(screen.getByText("4-6ft")).toBeInTheDocument();
    });

    it("renders a trophy for rank #1 only and numeric ranks for the rest", () => {
      const { container } = render(<BestRightNow />);
      expect(screen.getAllByTestId("trophy-icon")).toHaveLength(1);
      // Rank badges are the 7×7 rounded circles rendering the rank number
      // (ranks 2-5). A bare getByText("5") would also match the score badge.
      const rankBadges = container.querySelectorAll(
        ".h-7.w-7.rounded-full"
      );
      const rankTexts = Array.from(rankBadges)
        .map((el) => el.textContent?.trim())
        .filter(Boolean);
      expect(rankTexts).toEqual(expect.arrayContaining(["2", "3", "4", "5"]));
    });

    it("renders a score badge with the beach's color class for each row", () => {
      const { container } = render(<BestRightNow />);
      const scoreBadges = container.querySelectorAll(
        ".rounded-full.text-xs.font-bold.text-white"
      );
      expect(scoreBadges).toHaveLength(5);
      const byText = (text: string) =>
        Array.from(scoreBadges).find((n) => n.textContent === text);
      expect(byText("9")?.className).toMatch(/bg-green-500/);
      expect(byText("7")?.className).toMatch(/bg-blue-500/);
      expect(byText("5")?.className).toMatch(/bg-yellow-500/);
    });

    it("renders a Next Image thumbnail when a beach has imageUrl", () => {
      render(<BestRightNow />);
      const img = screen.getByAltText("Blacks Beach");
      expect(img.tagName).toBe("IMG");
      expect(img).toHaveAttribute("src", "https://example.com/blacks.jpg");
    });

    it("falls back to a Waves glyph when imageUrl is null", () => {
      render(<BestRightNow />);
      // 4 of 5 mock beaches have no imageUrl. Trophy icon + fallback glyphs
      // both render as svg; waves-icon appears in both the wave-range column
      // and each fallback thumb. We expect 5 wave-range icons plus 4 fallback
      // thumbs = 9 total.
      const waves = screen.getAllByTestId("waves-icon");
      expect(waves.length).toBe(9);
    });

    it("renders beaches with href as anchors and beaches without href as plain items", () => {
      render(<BestRightNow />);
      const blacks = screen.getByText("Blacks Beach").closest("a");
      expect(blacks).toHaveAttribute("href", "/ca/san-diego/blacks");
      const huntington = screen.getByText("Huntington Beach").closest("a");
      expect(huntington).toBeNull();
    });
  });

  describe("Structure", () => {
    it("carries the best-right-now testid", () => {
      mockFetcher(mockTopBeaches);
      render(<BestRightNow />);
      expect(screen.getByTestId("best-right-now")).toBeInTheDocument();
    });

    it("exposes the leaderboard as an unordered list", () => {
      mockFetcher(mockTopBeaches);
      const { container } = render(<BestRightNow />);
      const list = container.querySelector("ul");
      expect(list).toBeInTheDocument();
      expect(list?.querySelectorAll("li")).toHaveLength(5);
    });
  });
});
