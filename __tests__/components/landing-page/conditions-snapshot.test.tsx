import { render, screen } from "@testing-library/react";
import { ConditionsSnapshot } from "@/components/landing-page/conditions-snapshot";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import type { BestConditionsData } from "@/actions/forecast/get-best-conditions-today";

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
  MapPin: ({ className }: { className?: string }) => (
    <svg data-testid="map-pin-icon" className={className} />
  ),
  Wind: ({ className }: { className?: string }) => (
    <svg data-testid="wind-icon" className={className} />
  ),
  Waves: ({ className }: { className?: string }) => (
    <svg data-testid="waves-icon" className={className} />
  ),
  TrendingUp: ({ className }: { className?: string }) => (
    <svg data-testid="trending-up-icon" className={className} />
  ),
}));

describe("ConditionsSnapshot", () => {
  const mockConditionsData: BestConditionsData = {
    regionName: "San Diego",
    regionSlug: "san-diego",
    score: 8,
    avgWaveHeight: 5.2,
    waveRange: [4, 6],
    windConditions: "offshore",
    topBeachName: "Blacks Beach",
    swellDescription: "NW swell building",
  };

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

      render(<ConditionsSnapshot />);

      expect(
        screen.getByTestId("conditions-snapshot-skeleton")
      ).toBeInTheDocument();
    });

    it("skeleton has animate-pulse class", () => {
      (useDataFetcher as jest.Mock).mockReturnValue({
        data: null,
        loading: true,
        error: null,
      });

      const { container } = render(<ConditionsSnapshot />);

      const skeleton = container.querySelector(".animate-pulse");
      expect(skeleton).toBeInTheDocument();
    });

    it("skeleton has gradient background", () => {
      (useDataFetcher as jest.Mock).mockReturnValue({
        data: null,
        loading: true,
        error: null,
      });

      const { container } = render(<ConditionsSnapshot />);

      const skeleton = container.querySelector(".bg-gradient-to-br");
      expect(skeleton).toBeInTheDocument();
    });
  });

  describe("No Data", () => {
    it("returns null when data is null", () => {
      (useDataFetcher as jest.Mock).mockReturnValue({
        data: null,
        loading: false,
        error: null,
      });

      const { container } = render(<ConditionsSnapshot />);
      expect(container.firstChild).toBeNull();
    });

    it("returns null when data is undefined", () => {
      (useDataFetcher as jest.Mock).mockReturnValue({
        data: undefined,
        loading: false,
        error: null,
      });

      const { container } = render(<ConditionsSnapshot />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe("Data Rendering", () => {
    it("renders region name", () => {
      (useDataFetcher as jest.Mock).mockReturnValue({
        data: mockConditionsData,
        loading: false,
        error: null,
      });

      render(<ConditionsSnapshot />);

      expect(screen.getByText("San Diego")).toBeInTheDocument();
    });

    it("renders score in circle badge", () => {
      (useDataFetcher as jest.Mock).mockReturnValue({
        data: mockConditionsData,
        loading: false,
        error: null,
      });

      render(<ConditionsSnapshot />);

      const scoreBadges = screen.getAllByText("8");
      expect(scoreBadges.length).toBeGreaterThanOrEqual(1);
    });

    it("renders score label", () => {
      (useDataFetcher as jest.Mock).mockReturnValue({
        data: mockConditionsData,
        loading: false,
        error: null,
      });

      render(<ConditionsSnapshot />);

      expect(screen.getByText("Excellent")).toBeInTheDocument();
    });

    it("renders wave height range when min and max differ", () => {
      (useDataFetcher as jest.Mock).mockReturnValue({
        data: mockConditionsData,
        loading: false,
        error: null,
      });

      render(<ConditionsSnapshot />);

      expect(screen.getByText("4-6ft")).toBeInTheDocument();
    });

    it("renders single wave height when min equals max", () => {
      const sameWaveData: BestConditionsData = {
        ...mockConditionsData,
        waveRange: [5, 5],
      };

      (useDataFetcher as jest.Mock).mockReturnValue({
        data: sameWaveData,
        loading: false,
        error: null,
      });

      render(<ConditionsSnapshot />);

      expect(screen.getByText("5ft")).toBeInTheDocument();
    });

    it("rounds wave heights correctly", () => {
      const decimalWaveData: BestConditionsData = {
        ...mockConditionsData,
        waveRange: [3.7, 6.2],
      };

      (useDataFetcher as jest.Mock).mockReturnValue({
        data: decimalWaveData,
        loading: false,
        error: null,
      });

      render(<ConditionsSnapshot />);

      expect(screen.getByText("4-6ft")).toBeInTheDocument();
    });

    it("renders wind conditions - offshore", () => {
      (useDataFetcher as jest.Mock).mockReturnValue({
        data: mockConditionsData,
        loading: false,
        error: null,
      });

      render(<ConditionsSnapshot />);

      expect(screen.getByText("Offshore")).toBeInTheDocument();
    });

    it("renders wind conditions - light", () => {
      const lightWindData: BestConditionsData = {
        ...mockConditionsData,
        windConditions: "light",
      };

      (useDataFetcher as jest.Mock).mockReturnValue({
        data: lightWindData,
        loading: false,
        error: null,
      });

      render(<ConditionsSnapshot />);

      expect(screen.getByText("Light winds")).toBeInTheDocument();
    });

    it("renders wind conditions - onshore", () => {
      const onshoreWindData: BestConditionsData = {
        ...mockConditionsData,
        windConditions: "onshore",
      };

      (useDataFetcher as jest.Mock).mockReturnValue({
        data: onshoreWindData,
        loading: false,
        error: null,
      });

      render(<ConditionsSnapshot />);

      expect(screen.getByText("Onshore")).toBeInTheDocument();
    });

    it("renders top spot name when present", () => {
      (useDataFetcher as jest.Mock).mockReturnValue({
        data: mockConditionsData,
        loading: false,
        error: null,
      });

      render(<ConditionsSnapshot />);

      expect(screen.getByText(/Top spot: Blacks Beach/i)).toBeInTheDocument();
    });

    it("does not render top spot section when topBeachName is null", () => {
      const noTopBeachData: BestConditionsData = {
        ...mockConditionsData,
        topBeachName: null,
      };

      (useDataFetcher as jest.Mock).mockReturnValue({
        data: noTopBeachData,
        loading: false,
        error: null,
      });

      render(<ConditionsSnapshot />);

      expect(screen.queryByText(/Top spot:/i)).not.toBeInTheDocument();
    });

    it("renders all relevant icons", () => {
      (useDataFetcher as jest.Mock).mockReturnValue({
        data: mockConditionsData,
        loading: false,
        error: null,
      });

      render(<ConditionsSnapshot />);

      expect(screen.getByTestId("map-pin-icon")).toBeInTheDocument();
      expect(screen.getByTestId("waves-icon")).toBeInTheDocument();
      expect(screen.getByTestId("wind-icon")).toBeInTheDocument();
      expect(screen.getByTestId("trending-up-icon")).toBeInTheDocument();
    });
  });

  describe("Link", () => {
    it("links to correct forecast region page", () => {
      (useDataFetcher as jest.Mock).mockReturnValue({
        data: mockConditionsData,
        loading: false,
        error: null,
      });

      render(<ConditionsSnapshot />);

      const link = screen.getByText("San Diego").closest("a") as HTMLAnchorElement;
      expect(link).toHaveAttribute("href", "/forecast/san-diego");
    });

    it("entire card is a clickable link", () => {
      (useDataFetcher as jest.Mock).mockReturnValue({
        data: mockConditionsData,
        loading: false,
        error: null,
      });

      render(<ConditionsSnapshot />);

      const link = screen.getByRole("link");
      expect(link).toBeInTheDocument();

      // Check that the link contains the region name
      expect(link).toHaveTextContent("San Diego");

      // Check that the link contains the score
      expect(link).toHaveTextContent("8");
    });

    it("link has hover effect classes", () => {
      (useDataFetcher as jest.Mock).mockReturnValue({
        data: mockConditionsData,
        loading: false,
        error: null,
      });

      const { container } = render(<ConditionsSnapshot />);

      const link = container.querySelector("a");
      expect(link?.className).toMatch(/hover:shadow-md/);
    });
  });

  describe("CTA", () => {
    it("renders View Full Forecast CTA", () => {
      (useDataFetcher as jest.Mock).mockReturnValue({
        data: mockConditionsData,
        loading: false,
        error: null,
      });

      render(<ConditionsSnapshot />);

      expect(screen.getByText("View Full Forecast")).toBeInTheDocument();
    });

    it("CTA has hover underline effect", () => {
      (useDataFetcher as jest.Mock).mockReturnValue({
        data: mockConditionsData,
        loading: false,
        error: null,
      });

      render(<ConditionsSnapshot />);

      const cta = screen.getByText("View Full Forecast");
      expect(cta.className).toMatch(/group-hover:underline/);
    });

    it("CTA includes TrendingUp icon", () => {
      (useDataFetcher as jest.Mock).mockReturnValue({
        data: mockConditionsData,
        loading: false,
        error: null,
      });

      render(<ConditionsSnapshot />);

      const cta = screen.getByText("View Full Forecast");
      const parent = cta.parentElement;
      expect(parent?.querySelector('[data-testid="trending-up-icon"]')).toBeInTheDocument();
    });
  });

  describe("Score Colors", () => {
    it("applies green background for excellent score (8+)", () => {
      (useDataFetcher as jest.Mock).mockReturnValue({
        data: mockConditionsData, // score = 8
        loading: false,
        error: null,
      });

      const { container } = render(<ConditionsSnapshot />);

      const scoreCircle = container.querySelector(".bg-green-500");
      expect(scoreCircle).toBeInTheDocument();
    });

    it("applies blue background for good score (6-7)", () => {
      const goodScoreData: BestConditionsData = {
        ...mockConditionsData,
        score: 7,
      };

      (useDataFetcher as jest.Mock).mockReturnValue({
        data: goodScoreData,
        loading: false,
        error: null,
      });

      const { container } = render(<ConditionsSnapshot />);

      const scoreCircle = container.querySelector(".bg-blue-500");
      expect(scoreCircle).toBeInTheDocument();
    });

    it("applies yellow background for fair score (4-5)", () => {
      const fairScoreData: BestConditionsData = {
        ...mockConditionsData,
        score: 5,
      };

      (useDataFetcher as jest.Mock).mockReturnValue({
        data: fairScoreData,
        loading: false,
        error: null,
      });

      const { container } = render(<ConditionsSnapshot />);

      const scoreCircle = container.querySelector(".bg-yellow-500");
      expect(scoreCircle).toBeInTheDocument();
    });

    it("applies gray background for poor score (< 4)", () => {
      const poorScoreData: BestConditionsData = {
        ...mockConditionsData,
        score: 3,
      };

      (useDataFetcher as jest.Mock).mockReturnValue({
        data: poorScoreData,
        loading: false,
        error: null,
      });

      const { container } = render(<ConditionsSnapshot />);

      const scoreCircle = container.querySelector(".bg-gray-400");
      expect(scoreCircle).toBeInTheDocument();
    });

    it("score circle has white text", () => {
      (useDataFetcher as jest.Mock).mockReturnValue({
        data: mockConditionsData,
        loading: false,
        error: null,
      });

      const { container } = render(<ConditionsSnapshot />);

      const scoreCircle = container.querySelector(".text-white.font-bold.text-xl");
      expect(scoreCircle).toBeInTheDocument();
    });

    it("score circle is rounded-full", () => {
      (useDataFetcher as jest.Mock).mockReturnValue({
        data: mockConditionsData,
        loading: false,
        error: null,
      });

      const { container } = render(<ConditionsSnapshot />);

      const scoreCircle = container.querySelector(".rounded-full.h-14.w-14");
      expect(scoreCircle).toBeInTheDocument();
    });

    it("score label has correct color class", () => {
      (useDataFetcher as jest.Mock).mockReturnValue({
        data: mockConditionsData,
        loading: false,
        error: null,
      });

      render(<ConditionsSnapshot />);

      const label = screen.getByText("Excellent");
      expect(label).toHaveClass("text-white");
      expect(label.className).toMatch(/bg-green-500/);
    });
  });

  describe("Section Structure", () => {
    it("has data-testid for section wrapper", () => {
      (useDataFetcher as jest.Mock).mockReturnValue({
        data: mockConditionsData,
        loading: false,
        error: null,
      });

      render(<ConditionsSnapshot />);

      expect(screen.getByTestId("conditions-snapshot")).toBeInTheDocument();
    });

    it("renders section heading", () => {
      (useDataFetcher as jest.Mock).mockReturnValue({
        data: mockConditionsData,
        loading: false,
        error: null,
      });

      render(<ConditionsSnapshot />);

      expect(screen.getByText("Best Conditions Today")).toBeInTheDocument();
    });

    it("heading has correct styling classes", () => {
      (useDataFetcher as jest.Mock).mockReturnValue({
        data: mockConditionsData,
        loading: false,
        error: null,
      });

      render(<ConditionsSnapshot />);

      const heading = screen.getByText("Best Conditions Today");
      expect(heading).toHaveClass("text-sm");
      expect(heading).toHaveClass("font-semibold");
      expect(heading).toHaveClass("text-sky-700");
      expect(heading).toHaveClass("uppercase");
    });

    it("card has gradient background", () => {
      (useDataFetcher as jest.Mock).mockReturnValue({
        data: mockConditionsData,
        loading: false,
        error: null,
      });

      const { container } = render(<ConditionsSnapshot />);

      const card = container.querySelector(".bg-gradient-to-br.from-sky-50");
      expect(card).toBeInTheDocument();
    });

    it("card has rounded corners", () => {
      (useDataFetcher as jest.Mock).mockReturnValue({
        data: mockConditionsData,
        loading: false,
        error: null,
      });

      const { container } = render(<ConditionsSnapshot />);

      const card = container.querySelector(".rounded-xl");
      expect(card).toBeInTheDocument();
    });

    it("card has border", () => {
      (useDataFetcher as jest.Mock).mockReturnValue({
        data: mockConditionsData,
        loading: false,
        error: null,
      });

      const { container } = render(<ConditionsSnapshot />);

      const card = container.querySelector(".border.border-sky-200");
      expect(card).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("handles zero wave height", () => {
      const zeroWaveData: BestConditionsData = {
        ...mockConditionsData,
        waveRange: [0, 0],
      };

      (useDataFetcher as jest.Mock).mockReturnValue({
        data: zeroWaveData,
        loading: false,
        error: null,
      });

      render(<ConditionsSnapshot />);

      expect(screen.getByText("0ft")).toBeInTheDocument();
    });

    it("handles large wave heights", () => {
      const largeWaveData: BestConditionsData = {
        ...mockConditionsData,
        waveRange: [15.3, 18.7],
      };

      (useDataFetcher as jest.Mock).mockReturnValue({
        data: largeWaveData,
        loading: false,
        error: null,
      });

      render(<ConditionsSnapshot />);

      expect(screen.getByText("15-19ft")).toBeInTheDocument();
    });

    it("handles score of 10", () => {
      const perfectScoreData: BestConditionsData = {
        ...mockConditionsData,
        score: 10,
      };

      (useDataFetcher as jest.Mock).mockReturnValue({
        data: perfectScoreData,
        loading: false,
        error: null,
      });

      render(<ConditionsSnapshot />);

      expect(screen.getByText("10")).toBeInTheDocument();
    });

    it("handles score of 0", () => {
      const zeroScoreData: BestConditionsData = {
        ...mockConditionsData,
        score: 0,
      };

      (useDataFetcher as jest.Mock).mockReturnValue({
        data: zeroScoreData,
        loading: false,
        error: null,
      });

      render(<ConditionsSnapshot />);

      expect(screen.getByText("0")).toBeInTheDocument();
    });

    it("handles long region name", () => {
      const longNameData: BestConditionsData = {
        ...mockConditionsData,
        regionName: "Southern California Orange County Coast",
        regionSlug: "southern-california-orange-county-coast",
      };

      (useDataFetcher as jest.Mock).mockReturnValue({
        data: longNameData,
        loading: false,
        error: null,
      });

      render(<ConditionsSnapshot />);

      expect(
        screen.getByText("Southern California Orange County Coast")
      ).toBeInTheDocument();
    });

    it("handles long beach name in top spot", () => {
      const longBeachNameData: BestConditionsData = {
        ...mockConditionsData,
        topBeachName: "La Jolla Shores Beach and Coastal Park",
      };

      (useDataFetcher as jest.Mock).mockReturnValue({
        data: longBeachNameData,
        loading: false,
        error: null,
      });

      render(<ConditionsSnapshot />);

      expect(
        screen.getByText(/La Jolla Shores Beach and Coastal Park/i)
      ).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("has semantic section element", () => {
      (useDataFetcher as jest.Mock).mockReturnValue({
        data: mockConditionsData,
        loading: false,
        error: null,
      });

      const { container } = render(<ConditionsSnapshot />);

      const section = container.querySelector("section");
      expect(section).toBeInTheDocument();
    });

    it("has proper heading hierarchy", () => {
      (useDataFetcher as jest.Mock).mockReturnValue({
        data: mockConditionsData,
        loading: false,
        error: null,
      });

      render(<ConditionsSnapshot />);

      const heading = screen.getByRole("heading", { level: 2 });
      expect(heading).toHaveTextContent("Best Conditions Today");
    });

    it("main link is keyboard accessible", () => {
      (useDataFetcher as jest.Mock).mockReturnValue({
        data: mockConditionsData,
        loading: false,
        error: null,
      });

      render(<ConditionsSnapshot />);

      const link = screen.getByRole("link");
      expect(link).toBeInstanceOf(HTMLAnchorElement);
      expect(link).toHaveAttribute("href", "/forecast/san-diego");
    });

    it("has meaningful link text", () => {
      (useDataFetcher as jest.Mock).mockReturnValue({
        data: mockConditionsData,
        loading: false,
        error: null,
      });

      render(<ConditionsSnapshot />);

      const link = screen.getByRole("link");
      expect(link).toHaveTextContent("San Diego");
    });
  });

  describe("Responsive Behavior", () => {
    it("top spot is hidden on mobile (sm:inline)", () => {
      (useDataFetcher as jest.Mock).mockReturnValue({
        data: mockConditionsData,
        loading: false,
        error: null,
      });

      render(<ConditionsSnapshot />);

      const topSpot = screen.getByText(/Top spot: Blacks Beach/i);
      expect(topSpot.className).toMatch(/hidden.*sm:inline/);
    });

    it("renders all content in correct flex layout", () => {
      (useDataFetcher as jest.Mock).mockReturnValue({
        data: mockConditionsData,
        loading: false,
        error: null,
      });

      const { container } = render(<ConditionsSnapshot />);

      const contentContainer = container.querySelector(".flex.items-center.gap-5");
      expect(contentContainer).toBeInTheDocument();
    });
  });
});
