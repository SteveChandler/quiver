import { render, screen } from "@testing-library/react";
import { BestRightNow } from "@/components/forecast/best-right-now";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import type { TopBeachEntry } from "@/lib/utils/forecast-hub-utils";

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

// Mock useDataFetcher hook
jest.mock("@/hooks/use-data-fetcher", () => ({
  useDataFetcher: jest.fn(),
}));

// Mock score-color-utils
jest.mock("@/lib/utils/score-color-utils", () => ({
  getScoreColorClasses: jest.fn((score: number) => {
    if (score >= 8) {
      return { bg: "bg-green-500", label: "Excellent" };
    } else if (score >= 6) {
      return { bg: "bg-blue-500", label: "Good" };
    } else if (score >= 4) {
      return { bg: "bg-yellow-500", label: "Fair" };
    } else {
      return { bg: "bg-gray-400", label: "Poor" };
    }
  }),
}));

// Mock lucide-react icons
jest.mock("lucide-react", () => ({
  Waves: ({ className }: { className?: string }) => (
    <svg data-testid="waves-icon" className={className} />
  ),
  Trophy: ({ className }: { className?: string }) => (
    <svg data-testid="trophy-icon" className={className} />
  ),
}));

describe("BestRightNow", () => {
  const mockTopBeaches: TopBeachEntry[] = [
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
      imageUrl: null,
      averageRating: null,
      skillLevel: null,
    },
    {
      beachId: "beach-2",
      beachName: "Trestles",
      score: 8,
      waveHeight: 4.2,
      regionName: "Orange County",
      href: "/ca/orange-county/trestles",
      slug: "trestles",
      city: "Orange County",
      state: "CA",
      imageUrl: null,
      averageRating: null,
      skillLevel: null,
    },
    {
      beachId: "beach-3",
      beachName: "Rincon",
      score: 7,
      waveHeight: 5.8,
      regionName: "Santa Barbara",
      href: "/ca/santa-barbara/rincon",
      slug: "rincon",
      city: "Santa Barbara",
      state: "CA",
      imageUrl: null,
      averageRating: null,
      skillLevel: null,
    },
    {
      beachId: "beach-4",
      beachName: "Ocean Beach",
      score: 6,
      waveHeight: 3.1,
      regionName: "San Francisco",
      href: "/ca/san-francisco/ocean-beach",
      slug: "ocean-beach",
      city: "San Francisco",
      state: "CA",
      imageUrl: null,
      averageRating: null,
      skillLevel: null,
    },
    {
      beachId: "beach-5",
      beachName: "Huntington Beach",
      score: 5,
      waveHeight: 2.9,
      regionName: "Orange County",
      href: null, // Test beach without href
      slug: null,
      city: null,
      state: null,
      imageUrl: null,
      averageRating: null,
      skillLevel: null,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Loading State", () => {
    it("renders skeleton when loading", () => {
      (useDataFetcher as jest.Mock).mockReturnValue({
        data: null,
        loading: true,
        error: null,
      });

      render(<BestRightNow />);

      expect(screen.getByTestId("best-right-now-skeleton")).toBeInTheDocument();
      expect(screen.getByText("Best Right Now")).toBeInTheDocument();
    });

    it("renders 5 skeleton rows", () => {
      (useDataFetcher as jest.Mock).mockReturnValue({
        data: null,
        loading: true,
        error: null,
      });

      const { container } = render(<BestRightNow />);

      const skeletonRows = container.querySelectorAll(
        "[data-testid='best-right-now-skeleton'] > div"
      );
      expect(skeletonRows).toHaveLength(5);
    });

    it("skeleton rows have animate-pulse class", () => {
      (useDataFetcher as jest.Mock).mockReturnValue({
        data: null,
        loading: true,
        error: null,
      });

      const { container } = render(<BestRightNow />);

      const skeletonRows = container.querySelectorAll(
        "[data-testid='best-right-now-skeleton'] > div"
      );
      skeletonRows.forEach((row) => {
        expect(row).toHaveClass("animate-pulse");
      });
    });
  });

  describe("Empty Data", () => {
    it("returns null when data is empty array", () => {
      (useDataFetcher as jest.Mock).mockReturnValue({
        data: [],
        loading: false,
        error: null,
      });

      const { container } = render(<BestRightNow />);
      expect(container.firstChild).toBeNull();
    });

    it("returns null when data is null", () => {
      (useDataFetcher as jest.Mock).mockReturnValue({
        data: null,
        loading: false,
        error: null,
      });

      const { container } = render(<BestRightNow />);
      expect(container.firstChild).toBeNull();
    });

    it("returns null when data is undefined", () => {
      (useDataFetcher as jest.Mock).mockReturnValue({
        data: undefined,
        loading: false,
        error: null,
      });

      const { container } = render(<BestRightNow />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe("Data Rendering", () => {
    it("renders all beach names", () => {
      (useDataFetcher as jest.Mock).mockReturnValue({
        data: mockTopBeaches,
        loading: false,
        error: null,
      });

      render(<BestRightNow />);

      expect(screen.getByText("Blacks Beach")).toBeInTheDocument();
      expect(screen.getByText("Trestles")).toBeInTheDocument();
      expect(screen.getByText("Rincon")).toBeInTheDocument();
      expect(screen.getByText("Ocean Beach")).toBeInTheDocument();
      expect(screen.getByText("Huntington Beach")).toBeInTheDocument();
    });

    it("renders region names for each beach", () => {
      (useDataFetcher as jest.Mock).mockReturnValue({
        data: mockTopBeaches,
        loading: false,
        error: null,
      });

      render(<BestRightNow />);

      expect(screen.getByText("San Diego")).toBeInTheDocument();
      expect(screen.getAllByText("Orange County")).toHaveLength(2);
      expect(screen.getByText("Santa Barbara")).toBeInTheDocument();
      expect(screen.getByText("San Francisco")).toBeInTheDocument();
    });

    it("renders scores for each beach", () => {
      (useDataFetcher as jest.Mock).mockReturnValue({
        data: mockTopBeaches,
        loading: false,
        error: null,
      });

      const { container } = render(<BestRightNow />);

      // Find score badges specifically (not rank badges)
      const scoreBadges = container.querySelectorAll(".rounded-full.text-xs.font-bold.text-white");
      expect(scoreBadges.length).toBe(5);

      // Verify scores appear in the badges
      expect(Array.from(scoreBadges).some(badge => badge.textContent === "9")).toBe(true);
      expect(Array.from(scoreBadges).some(badge => badge.textContent === "8")).toBe(true);
      expect(Array.from(scoreBadges).some(badge => badge.textContent === "7")).toBe(true);
      expect(Array.from(scoreBadges).some(badge => badge.textContent === "6")).toBe(true);
      expect(Array.from(scoreBadges).some(badge => badge.textContent === "5")).toBe(true);
    });

    it("renders rounded wave heights with ft suffix", () => {
      (useDataFetcher as jest.Mock).mockReturnValue({
        data: mockTopBeaches,
        loading: false,
        error: null,
      });

      render(<BestRightNow />);

      // Wave heights: 6.5 -> 7ft, 4.2 -> 4ft, 5.8 -> 6ft, 3.1 -> 3ft, 2.9 -> 3ft
      expect(screen.getByText("7ft")).toBeInTheDocument();
      expect(screen.getByText("4ft")).toBeInTheDocument();
      expect(screen.getByText("6ft")).toBeInTheDocument();
      expect(screen.getAllByText("3ft")).toHaveLength(2);
    });

    it("renders wave icons", () => {
      (useDataFetcher as jest.Mock).mockReturnValue({
        data: mockTopBeaches,
        loading: false,
        error: null,
      });

      render(<BestRightNow />);

      const waveIcons = screen.getAllByTestId("waves-icon");
      expect(waveIcons).toHaveLength(5);
    });
  });

  describe("Rank Badges", () => {
    it("renders trophy icon for rank #1", () => {
      (useDataFetcher as jest.Mock).mockReturnValue({
        data: mockTopBeaches,
        loading: false,
        error: null,
      });

      render(<BestRightNow />);

      expect(screen.getByTestId("trophy-icon")).toBeInTheDocument();
    });

    it("renders only one trophy icon", () => {
      (useDataFetcher as jest.Mock).mockReturnValue({
        data: mockTopBeaches,
        loading: false,
        error: null,
      });

      render(<BestRightNow />);

      const trophyIcons = screen.getAllByTestId("trophy-icon");
      expect(trophyIcons).toHaveLength(1);
    });

    it("renders numbers for ranks 2-5", () => {
      (useDataFetcher as jest.Mock).mockReturnValue({
        data: mockTopBeaches,
        loading: false,
        error: null,
      });

      const { container } = render(<BestRightNow />);

      // Check for rank badges with numbers (not trophy)
      const rankBadges = container.querySelectorAll(".text-gray-500");
      // Should have badges for ranks 2, 3, 4, 5 (4 total)
      expect(rankBadges.length).toBeGreaterThanOrEqual(4);
    });

    it("trophy badge has amber styling", () => {
      (useDataFetcher as jest.Mock).mockReturnValue({
        data: mockTopBeaches,
        loading: false,
        error: null,
      });

      const { container } = render(<BestRightNow />);

      const trophyBadge = container.querySelector(".bg-amber-100");
      expect(trophyBadge).toBeInTheDocument();
      expect(trophyBadge).toHaveClass("text-amber-700");
    });

    it("number badges have gray styling", () => {
      (useDataFetcher as jest.Mock).mockReturnValue({
        data: mockTopBeaches,
        loading: false,
        error: null,
      });

      const { container } = render(<BestRightNow />);

      const grayBadges = container.querySelectorAll(".bg-gray-100");
      expect(grayBadges.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe("Links", () => {
    it("renders beaches with href as links", () => {
      (useDataFetcher as jest.Mock).mockReturnValue({
        data: mockTopBeaches,
        loading: false,
        error: null,
      });

      render(<BestRightNow />);

      const links = screen.getAllByRole("link");

      // 4 beach links + 1 "See All Forecasts" link = 5 total
      expect(links.length).toBeGreaterThanOrEqual(4);

      // Check href attributes for beach links
      const blacksBeachLink = screen
        .getByText("Blacks Beach")
        .closest("a") as HTMLAnchorElement;
      expect(blacksBeachLink).toHaveAttribute("href", "/ca/san-diego/blacks");
    });

    it("renders beaches without href as divs", () => {
      (useDataFetcher as jest.Mock).mockReturnValue({
        data: mockTopBeaches,
        loading: false,
        error: null,
      });

      const { container } = render(<BestRightNow />);

      // Huntington Beach has no href, should be in a div
      const huntingtonBeach = screen.getByText("Huntington Beach");
      const parent = huntingtonBeach.closest("a");
      expect(parent).toBeNull(); // Should not be in an <a> tag
    });

    it("all beach links have hover transition classes", () => {
      (useDataFetcher as jest.Mock).mockReturnValue({
        data: mockTopBeaches.slice(0, 2), // Use beaches with hrefs
        loading: false,
        error: null,
      });

      const { container } = render(<BestRightNow />);

      const beachLinks = container.querySelectorAll(
        'a[href^="/ca"]'
      ) as NodeListOf<HTMLAnchorElement>;
      beachLinks.forEach((link) => {
        expect(link.className).toMatch(/hover:bg-gray-50/);
        expect(link.className).toMatch(/transition-colors/);
      });
    });
  });

  describe("Score Colors", () => {
    it("applies correct color classes based on score", () => {
      (useDataFetcher as jest.Mock).mockReturnValue({
        data: mockTopBeaches,
        loading: false,
        error: null,
      });

      const { container } = render(<BestRightNow />);

      // Find score badges specifically (not rank badges)
      const scoreBadges = container.querySelectorAll(".rounded-full.text-xs.font-bold.text-white");

      // Convert to array and check colors
      const badgesArray = Array.from(scoreBadges);

      // Score 9 should have green background
      const score9Badge = badgesArray.find(badge => badge.textContent === "9");
      expect(score9Badge?.className).toMatch(/bg-green-500/);

      // Score 8 should have green background
      const score8Badge = badgesArray.find(badge => badge.textContent === "8");
      expect(score8Badge?.className).toMatch(/bg-green-500/);

      // Score 7 should have blue background
      const score7Badge = badgesArray.find(badge => badge.textContent === "7");
      expect(score7Badge?.className).toMatch(/bg-blue-500/);

      // Score 6 should have blue background
      const score6Badge = badgesArray.find(badge => badge.textContent === "6");
      expect(score6Badge?.className).toMatch(/bg-blue-500/);

      // Score 5 should have yellow background
      const score5Badge = badgesArray.find(badge => badge.textContent === "5");
      expect(score5Badge?.className).toMatch(/bg-yellow-500/);
    });

    it("all score badges have white text", () => {
      (useDataFetcher as jest.Mock).mockReturnValue({
        data: mockTopBeaches,
        loading: false,
        error: null,
      });

      const { container } = render(<BestRightNow />);

      const scoreBadges = container.querySelectorAll(
        '[class*="rounded-full text-xs font-bold text-white"]'
      );
      expect(scoreBadges.length).toBe(5);
    });

    it("score badges have rounded-full shape", () => {
      (useDataFetcher as jest.Mock).mockReturnValue({
        data: mockTopBeaches.slice(0, 1),
        loading: false,
        error: null,
      });

      const { container } = render(<BestRightNow />);

      const scoreBadge = screen.getByText("9");
      expect(scoreBadge).toHaveClass("rounded-full");
    });
  });

  describe("CTA", () => {
    it("renders See All Forecasts link", () => {
      (useDataFetcher as jest.Mock).mockReturnValue({
        data: mockTopBeaches,
        loading: false,
        error: null,
      });

      render(<BestRightNow />);

      const ctaLink = screen.getByText(/See All Forecasts/i);
      expect(ctaLink).toBeInTheDocument();
    });

    it("See All Forecasts links to /forecast", () => {
      (useDataFetcher as jest.Mock).mockReturnValue({
        data: mockTopBeaches,
        loading: false,
        error: null,
      });

      render(<BestRightNow />);

      const ctaLink = screen.getByText(/See All Forecasts/i)
        .closest("a") as HTMLAnchorElement;
      expect(ctaLink).toHaveAttribute("href", "/forecast");
    });

    it("CTA link has hover styles", () => {
      (useDataFetcher as jest.Mock).mockReturnValue({
        data: mockTopBeaches,
        loading: false,
        error: null,
      });

      render(<BestRightNow />);

      const ctaLink = screen.getByText(/See All Forecasts/i);
      expect(ctaLink.className).toMatch(/hover:text-sky-700/);
      expect(ctaLink.className).toMatch(/hover:underline/);
    });
  });

  describe("Section Structure", () => {
    it("has data-testid for section wrapper", () => {
      (useDataFetcher as jest.Mock).mockReturnValue({
        data: mockTopBeaches,
        loading: false,
        error: null,
      });

      render(<BestRightNow />);

      expect(screen.getByTestId("best-right-now")).toBeInTheDocument();
    });

    it("renders section heading", () => {
      (useDataFetcher as jest.Mock).mockReturnValue({
        data: mockTopBeaches,
        loading: false,
        error: null,
      });

      render(<BestRightNow />);

      const heading = screen.getByText("Best Right Now");
      expect(heading.tagName).toBe("H2");
    });

    it("heading has correct styling classes", () => {
      (useDataFetcher as jest.Mock).mockReturnValue({
        data: mockTopBeaches,
        loading: false,
        error: null,
      });

      render(<BestRightNow />);

      const heading = screen.getByText("Best Right Now");
      expect(heading).toHaveClass("text-sm");
      expect(heading).toHaveClass("font-semibold");
      expect(heading).toHaveClass("text-sky-700");
      expect(heading).toHaveClass("uppercase");
    });

    it("beach list has proper styling", () => {
      (useDataFetcher as jest.Mock).mockReturnValue({
        data: mockTopBeaches,
        loading: false,
        error: null,
      });

      const { container } = render(<BestRightNow />);

      const beachList = container.querySelector(".rounded-xl.border");
      expect(beachList).toBeInTheDocument();
      expect(beachList).toHaveClass("bg-white");
      expect(beachList).toHaveClass("divide-y");
    });
  });

  describe("Edge Cases", () => {
    it("handles single beach", () => {
      (useDataFetcher as jest.Mock).mockReturnValue({
        data: [mockTopBeaches[0]],
        loading: false,
        error: null,
      });

      render(<BestRightNow />);

      expect(screen.getByText("Blacks Beach")).toBeInTheDocument();
      expect(screen.getByTestId("trophy-icon")).toBeInTheDocument();
      expect(screen.getByText("San Diego")).toBeInTheDocument();
    });

    it("handles exactly 5 beaches", () => {
      (useDataFetcher as jest.Mock).mockReturnValue({
        data: mockTopBeaches,
        loading: false,
        error: null,
      });

      render(<BestRightNow />);

      const beachNames = [
        "Blacks Beach",
        "Trestles",
        "Rincon",
        "Ocean Beach",
        "Huntington Beach",
      ];

      beachNames.forEach((name) => {
        expect(screen.getByText(name)).toBeInTheDocument();
      });
    });

    it("handles wave height of 0.4 rounding to 0ft", () => {
      const lowWaveBeach: TopBeachEntry = {
        beachId: "beach-6",
        beachName: "Flat Beach",
        score: 3,
        waveHeight: 0.4,
        regionName: "San Diego",
        href: "/ca/san-diego/flat-beach",
        slug: "flat-beach",
        city: "San Diego",
        state: "CA",
        imageUrl: null,
        averageRating: null,
        skillLevel: null,
      };

      (useDataFetcher as jest.Mock).mockReturnValue({
        data: [lowWaveBeach],
        loading: false,
        error: null,
      });

      render(<BestRightNow />);

      expect(screen.getByText("0ft")).toBeInTheDocument();
    });

    it("handles wave height of 10.7 rounding to 11ft", () => {
      const bigWaveBeach: TopBeachEntry = {
        beachId: "beach-7",
        beachName: "Big Wave Beach",
        score: 9,
        waveHeight: 10.7,
        regionName: "San Diego",
        href: "/ca/san-diego/big-wave-beach",
        slug: "big-wave-beach",
        city: "San Diego",
        state: "CA",
        imageUrl: null,
        averageRating: null,
        skillLevel: null,
      };

      (useDataFetcher as jest.Mock).mockReturnValue({
        data: [bigWaveBeach],
        loading: false,
        error: null,
      });

      render(<BestRightNow />);

      expect(screen.getByText("11ft")).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("has semantic section element", () => {
      (useDataFetcher as jest.Mock).mockReturnValue({
        data: mockTopBeaches,
        loading: false,
        error: null,
      });

      const { container } = render(<BestRightNow />);

      const section = container.querySelector("section");
      expect(section).toBeInTheDocument();
    });

    it("has proper heading hierarchy", () => {
      (useDataFetcher as jest.Mock).mockReturnValue({
        data: mockTopBeaches,
        loading: false,
        error: null,
      });

      render(<BestRightNow />);

      const heading = screen.getByRole("heading", { level: 2 });
      expect(heading).toHaveTextContent("Best Right Now");
    });

    it("beach links are keyboard accessible", () => {
      (useDataFetcher as jest.Mock).mockReturnValue({
        data: mockTopBeaches.slice(0, 2),
        loading: false,
        error: null,
      });

      render(<BestRightNow />);

      const links = screen.getAllByRole("link");
      links.forEach((link) => {
        expect(link).toBeInstanceOf(HTMLAnchorElement);
      });
    });
  });
});
