import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";

import ForecastPage, {
  generateStaticParams,
  revalidate,
} from "@/app/forecast/[beachId]/page";
import { getCachedRegionalForecastPageData } from "@/lib/utils/forecast-hub-utils";
import { WebPageSchema } from "@/components/seo/web-page-schema";

jest.mock("@/actions/beach/beach-query-actions", () => ({
  getBeachById: jest.fn(),
}));

jest.mock("@/lib/data/forecast-regions", () => ({
  FORECAST_REGIONS: {
    "san-diego": {
      slug: "san-diego",
      name: "San Diego",
      title: "San Diego Surf Forecast",
      metaDescription: "San Diego regional forecast",
    },
  },
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
  getCachedRegionalForecastPageData: jest.fn(),
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
    authAwareScores,
  }: {
    regionSlug: string;
    authAwareScores: boolean;
  }) => (
    <div
      data-testid="top-ranked-beach-hero"
      data-region-slug={regionSlug}
      data-auth-aware-scores={String(authAwareScores)}
    />
  ),
  BestDaysSection: ({
    regionSlug,
    authAwareScores,
  }: {
    regionSlug: string;
    authAwareScores: boolean;
  }) => (
    <div
      data-testid="best-days-section"
      data-region-slug={regionSlug}
      data-auth-aware-scores={String(authAwareScores)}
    />
  ),
  BeachConditionsGrid: ({
    authAwareScores,
  }: {
    authAwareScores: boolean;
  }) => (
    <div
      data-testid="beach-conditions-grid"
      data-auth-aware-scores={String(authAwareScores)}
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
  WebPageSchema: jest.fn(() => null),
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
  beforeEach(() => {
    jest.clearAllMocks();
    (getCachedRegionalForecastPageData as jest.Mock).mockResolvedValue({
      beaches: [beach],
      summary: {
        generatedAt: new Date("2026-08-19T12:00:00Z"),
        sourceDataUpdatedAt: "2026-08-19T11:30:00Z",
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
      },
    });
  });

  it("prebuilds every configured regional path with a 15-minute refresh", () => {
    expect(generateStaticParams()).toEqual([{ beachId: "san-diego" }]);
    expect(revalidate).toBe(900);
  });

  it("propagates data failures instead of caching a successful soft-error page", async () => {
    (getCachedRegionalForecastPageData as jest.Mock).mockRejectedValueOnce(
      new Error("forecast data unavailable"),
    );

    await expect(
      ForecastPage({
        params: Promise.resolve({ beachId: "san-diego" }),
      }),
    ).rejects.toThrow("forecast data unavailable");
  });

  it("defers score visibility to client auth on every regional score surface", async () => {
      render(
        await ForecastPage({
          params: Promise.resolve({ beachId: "san-diego" }),
        }),
      );

      expect(screen.getByTestId("top-ranked-beach-hero")).toHaveAttribute(
        "data-auth-aware-scores",
        "true",
      );
      expect(screen.getByTestId("best-days-section")).toHaveAttribute(
        "data-auth-aware-scores",
        "true",
      );
      expect(screen.getByTestId("beach-conditions-grid")).toHaveAttribute(
        "data-auth-aware-scores",
        "true",
      );
      expect(screen.getByTestId("top-ranked-beach-hero")).toHaveAttribute(
        "data-region-slug",
        "san-diego",
      );
      expect(screen.getByTestId("best-days-section")).toHaveAttribute(
        "data-region-slug",
        "san-diego",
      );
      expect(WebPageSchema).toHaveBeenCalledWith(
        expect.objectContaining({
          dateModified: "2026-08-19T11:30:00Z",
          additionalData: expect.objectContaining({
            datePublished: "2026-02-10",
          }),
        }),
        undefined,
      );
  });
});
