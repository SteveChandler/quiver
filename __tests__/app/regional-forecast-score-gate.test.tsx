import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";

import ForecastPage from "@/app/forecast/[beachId]/page";
import { getBeaches } from "@/actions/beach/beach-query-actions";
import { getCurrentUser } from "@/lib/auth/admin";
import { getRegionalSummary } from "@/lib/utils/forecast-hub-utils";
import { getBeachesForRegion } from "@/lib/utils/regional-forecast-utils";

jest.mock("@/actions/beach/beach-query-actions", () => ({
  getBeachById: jest.fn(),
  getBeaches: jest.fn(),
}));

jest.mock("@/lib/auth/admin", () => ({
  getCurrentUser: jest.fn(),
}));

jest.mock("@/lib/data/forecast-regions", () => ({
  FORECAST_REGIONS: {},
  getForecastRegion: () => ({
    slug: "san-diego",
    name: "San Diego",
    title: "San Diego Surf Forecast",
    metaDescription: "San Diego regional forecast",
  }),
  getGuideSlugForRegion: () => "san-diego",
  hasHubGuide: () => false,
}));

jest.mock("@/lib/utils/forecast-hub-utils", () => ({
  getRegionalSummary: jest.fn(),
}));

jest.mock("@/lib/utils/regional-forecast-utils", () => ({
  getBeachesForRegion: jest.fn(),
}));

jest.mock("@/lib/map-utils", () => ({
  getStaticMapImageUrl: jest.fn(() => null),
}));

jest.mock("@/lib/utils/date-time", () => ({
  formatFullDateWithYear: () => "August 19, 2026",
}));

jest.mock("@/lib/seo/meta", () => ({
  buildPageMetadata: jest.fn(),
}));

jest.mock("@/components/forecast", () => ({
  TopRankedBeachHero: ({
    regionSlug,
    showScores,
  }: {
    regionSlug: string;
    showScores: boolean;
  }) => (
    <div
      data-testid="top-ranked-beach-hero"
      data-region-slug={regionSlug}
      data-show-scores={String(showScores)}
    />
  ),
  BestDaysSection: ({
    regionSlug,
    showScores,
  }: {
    regionSlug: string;
    showScores: boolean;
  }) => (
    <div
      data-testid="best-days-section"
      data-region-slug={regionSlug}
      data-show-scores={String(showScores)}
    />
  ),
  BeachConditionsGrid: ({ showScores }: { showScores: boolean }) => (
    <div
      data-testid="beach-conditions-grid"
      data-show-scores={String(showScores)}
    />
  ),
  SwellEventList: () => null,
}));

jest.mock("@/components/ui/scroll-reveal", () => ({
  ScrollReveal: ({ children }: { children: ReactNode }) => children,
}));

jest.mock("@/components/ui/animated-counter", () => ({
  AnimatedCounter: ({ value }: { value: number }) => <span>{value}</span>,
}));

jest.mock("@/components/ui/sticky-signup-bar", () => ({
  StickySignupBar: () => null,
}));

jest.mock("@/components/seo/breadcrumb-schema", () => ({
  BreadcrumbStructuredData: () => null,
}));

jest.mock("@/components/seo/web-page-schema", () => ({
  WebPageSchema: () => null,
}));

jest.mock("@/components/zine", () => ({
  ZineSurface: ({ children }: { children: ReactNode }) => children,
  QuiverSticker: () => null,
}));

const beach = {
  id: "beach-1",
  lat: 32.58,
  lon: -117.13,
};

const beachCondition = {
  beachId: "beach-1",
  beachName: "Imperial Beach",
  beachSlug: "imperial-beach",
  state: "CA",
  city: "Imperial Beach",
  country: "USA",
  currentScore: 83,
  currentWaveHeight: 4.2,
  trend: "steady",
  bestDay: "Wednesday",
  bestDayScore: 83,
};

const bestDay = {
  date: new Date("2026-08-19T12:00:00Z"),
  dateString: "2026-08-19",
  dayOfWeek: "Wednesday",
  score: 83,
  avgWaveHeight: 4.2,
  waveRange: [3, 5],
  dominantWindDirection: "W",
  windConditions: "offshore",
  bestTimeSlot: "morning",
  topBeaches: [],
  beachesWithGoodConditions: 1,
};

describe("regional forecast score gate", () => {
  const mockGetCurrentUser = getCurrentUser as jest.MockedFunction<
    typeof getCurrentUser
  >;

  beforeEach(() => {
    jest.clearAllMocks();
    (getBeaches as jest.Mock).mockResolvedValue({
      success: true,
      data: [beach],
    });
    (getBeachesForRegion as jest.Mock).mockReturnValue([beach]);
    (getRegionalSummary as jest.Mock).mockResolvedValue({
      generatedAt: new Date("2026-08-19T12:00:00Z"),
      recommendationAvailability: { state: "unavailable" },
      bestSurfWindows: [],
      beachConditions: [beachCondition],
      days: [bestDay],
      bestDay,
      upcomingSwells: [],
      photoBeachName: null,
      photoUrl: null,
      stats: {
        beachesWithData: 1,
        totalBeaches: 1,
      },
    });
  });

  it.each([
    { viewer: "guest", user: null, expected: "false" },
    { viewer: "authenticated", user: { id: "user-1" }, expected: "true" },
  ])(
    "threads the $viewer score gate to every regional score surface",
    async ({ user, expected }) => {
      mockGetCurrentUser.mockResolvedValue(
        user as Awaited<ReturnType<typeof getCurrentUser>>,
      );

      render(
        await ForecastPage({
          params: Promise.resolve({ beachId: "san-diego" }),
        }),
      );

      expect(screen.getByTestId("top-ranked-beach-hero")).toHaveAttribute(
        "data-show-scores",
        expected,
      );
      expect(screen.getByTestId("best-days-section")).toHaveAttribute(
        "data-show-scores",
        expected,
      );
      expect(screen.getByTestId("beach-conditions-grid")).toHaveAttribute(
        "data-show-scores",
        expected,
      );
      expect(screen.getByTestId("top-ranked-beach-hero")).toHaveAttribute(
        "data-region-slug",
        "san-diego",
      );
      expect(screen.getByTestId("best-days-section")).toHaveAttribute(
        "data-region-slug",
        "san-diego",
      );
    },
  );
});
