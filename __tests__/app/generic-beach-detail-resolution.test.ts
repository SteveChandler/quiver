/**
 * @jest-environment node
 */

import GenericBeachDetailPage, {
  generateMetadata,
} from "@/app/[intent]/[city]/[beachSlug]/page";
import { getBeachesBySlug } from "@/actions/beach/beach-query-actions";
import { getSpotSurfReportPublic } from "@/lib/services/spot-surf-report-service";
import { getNearbyBeaches } from "@/actions/beach/beach-location-actions";
import { expectConsoleWarnings } from "@/__tests__/setup/test-utils";
import type { Beach } from "@/types/database";
import { notFound, redirect } from "next/navigation";
import { renderToStaticMarkup } from "react-dom/server";
import { CHRONICALLY_IMPACTED_WATER_QUALITY_BEACH_IDS } from "@/lib/recommendations/major-event-hold/water-quality";

// Mock React's cache function for server components
jest.mock("react", () => ({
  ...jest.requireActual("react"),
  cache: (fn: Function) => fn, // cache is just a pass-through for testing
}));

jest.mock("@/actions/beach/beach-query-actions", () => ({
  getBeachesBySlug: jest.fn(),
}));

// The page reads the user agent to decide whether the iPhone Safari banner owns
// the install ask (app/[intent]/[city]/[beachSlug]/page.tsx, added in #497).
// Without this mock `headers()` throws "called outside a request scope" and every
// case in this suite fails before reaching its assertion.
jest.mock("next/headers", () => ({
  headers: jest.fn(async () => new Headers()),
}));

jest.mock("next/navigation", () => ({
  notFound: jest.fn(() => {
    const err = new Error("NEXT_NOT_FOUND");
    (err as any).digest = "NEXT_NOT_FOUND";
    throw err;
  }),
  redirect: jest.fn((url: string) => {
    const err = new Error("NEXT_REDIRECT");
    (err as any).digest = `NEXT_REDIRECT;replace;${url};307;`;
    throw err;
  }),
}));

// Mock dependencies used during page rendering
jest.mock("@/lib/services/spot-surf-report-service", () => ({
  getSpotSurfReportPublic: jest.fn().mockResolvedValue({
    report: null,
    isTomorrow: false,
  }),
}));

jest.mock("@/actions/spot/spot-data-actions", () => ({
  getSpotFeaturedPhoto: jest.fn().mockResolvedValue(null),
}));

jest.mock("@/lib/utils/timezone-utils.server", () => ({
  getTimezoneFromCoords: jest.fn().mockReturnValue("America/Los_Angeles"),
}));

// Mock the child components to avoid rendering issues in node environment
// The real client component server-renders whatever the page passes into its
// zine shell, so the stub must render beforeTabsContent/afterTabsContent too.
// Dropping them would let this suite pass while the crawlable answer block
// silently vanished from the initial HTML — the exact thing it guards.
jest.mock("@/app/beach/[slug]/beach-detail-client", () => ({
  BeachDetailClient: ({
    beach,
    heroHeadingLevel = "h1",
    beforeTabsContent,
    afterTabsContent,
    heroForecastSlot,
  }: {
    beach: Beach;
    heroHeadingLevel?: "h1" | "h2";
    beforeTabsContent?: React.ReactNode;
    afterTabsContent?: React.ReactNode;
    heroForecastSlot?: React.ReactNode;
  }) => {
    const React = jest.requireActual("react");
    return React.createElement(
      "div",
      null,
      React.createElement(heroHeadingLevel, { key: "hero" }, beach.name),
      heroForecastSlot ?? null,
      beforeTabsContent ?? null,
      afterTabsContent ?? null,
    );
  },
}));

// Client CTAs inside afterTabsContent; they call useRouter/useState.
jest.mock("@/components/app-store/install-app-cta-section", () => ({
  InstallAppCtaSection: () => null,
}));

// Client CTA that calls useRouter; it now renders through beforeTabsContent.
jest.mock("@/components/app-store/content-page-app-handoff-cta", () => ({
  ContentPageAppHandoffCta: ({ eyebrow }: { eyebrow?: string }) => {
    const React = jest.requireActual("react");
    return React.createElement("div", { "data-testid": "handoff-cta" }, eyebrow);
  },
}));

jest.mock("@/components/seo/structured-data", () => ({
  BeachPageStructuredData: () => null,
}));

jest.mock("@/components/seo/breadcrumb-schema", () => ({
  BreadcrumbStructuredData: () => null,
}));

jest.mock("@/components/seo/faq-schema", () => ({
  FAQSchema: () => null,
}));

jest.mock("@/components/seo/web-page-schema", () => ({
  WebPageSchema: () => null,
}));

jest.mock("@/components/seo/live-cam-schema", () => ({
  LiveCamSchema: () => null,
}));

jest.mock("@/components/beach-detail/nearby-spots-enriched", () => ({
  NearbyBeachesEnriched: () => null,
}));

jest.mock("@/components/beach-detail/related-guides-section", () => ({
  RelatedGuidesSection: () => null,
}));

jest.mock("@/lib/seo/forecast-indexability", () => ({
  getForecastIndexabilityForBeaches: jest.fn().mockResolvedValue(new Map()),
  isBeachSubPageIndexable: jest.fn().mockReturnValue(false),
}));

jest.mock("@/lib/seo/water-temp-meta-data", () => ({
  getWaterTempMetaData: jest.fn().mockResolvedValue({ tempF: 65, wetsuitRec: "3/2mm fullsuit" }),
}));

jest.mock("@/components/ui/sticky-signup-bar", () => ({
  StickySignupBar: () => null,
}));

jest.mock("@/components/app-store/content-page-app-handoff-cta", () => ({
  ContentPageAppHandoffCta: () => null,
}));

jest.mock("@/lib/utils/beach-faq-utils", () => ({
  generateBeachFAQ: jest.fn().mockReturnValue([]),
}));

jest.mock("@/actions/beach/beach-location-actions", () => ({
  getNearbyBeaches: jest.fn().mockResolvedValue({
    success: true,
    data: [],
  }),
  getAllCitiesWithBeachSkills: jest.fn(),
}));

// Prevent real Supabase client creation in CI (no env vars)
jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: jest.fn().mockResolvedValue({
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    }),
  }),
  createSupabaseServiceRoleClient: jest.fn().mockReturnValue({}),
  createPublicReadClient: jest.fn().mockReturnValue({
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(),
      or: jest.fn().mockReturnThis(),
      ilike: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    }),
  }),
}));

jest.mock("@/actions/beach/cam-actions", () => ({
  getBeachCameraUrl: jest.fn().mockResolvedValue(null),
}));

jest.mock("@/actions/forecast-actions", () => ({
  getBeachForecastPreview: jest.fn().mockResolvedValue({ success: true, data: null }),
}));

jest.mock("@/lib/utils/nearby-beach-enrichment", () => ({
  enrichBeachesWithConditions: jest.fn().mockResolvedValue([]),
}));

type BeachTestOverrides = Omit<Partial<Beach>, "lat" | "lon"> & {
  lat?: number | null;
  lon?: number | null;
  seo_indexable?: boolean;
  editorial_reviewed_at?: string;
  editorial_sources?: Array<{ url: string; publisher: string; retrievedAt: string }>;
};

function makeBeach(overrides: BeachTestOverrides) {
  return {
    ...overrides,
    id: overrides.id ?? "beach-1",
    name: overrides.name ?? "Test Beach",
    slug: overrides.slug ?? "lower-trestles",
    city: overrides.city ?? "Dana Point",
    state: overrides.state ?? "CA",
    country: overrides.country ?? "USA",
    timezone: overrides.timezone ?? "America/Los_Angeles",
    lat: overrides.lat === undefined ? 33.3827 : overrides.lat,
    lon: overrides.lon === undefined ? -117.5922 : overrides.lon,
    created_at: overrides.created_at ?? "2026-01-01T00:00:00Z",
    review_count: overrides.review_count ?? 0,
    center_lat: overrides.lat ?? 33.3827,
    center_lng: overrides.lon ?? -117.5922,
    // other Beach fields unused by this page are intentionally omitted for test brevity
  } as unknown as Beach;
}

function freshForecastResult() {
  const now = Date.now();
  const selectedRowTime = new Date(now).toISOString();
  const windowStart = new Date(now - 60 * 60 * 1000).toISOString();
  const windowEnd = new Date(now + 60 * 60 * 1000).toISOString();
  return {
    report: {
      waveHeight: "2-3 ft",
      updatedAt: new Date(now - 60 * 60 * 1000).toISOString(),
      bestWindowStart: windowStart,
      bestWindowEnd: windowEnd,
      verdict: "YES",
      score: 84,
      forecastConfidence: 92,
    },
    isTomorrow: false,
    forecastContext: {
      selectedRowTime,
      waveHeight: "2-3 ft",
      sourceDataUpdatedAt: new Date(now - 60 * 60 * 1000).toISOString(),
      primaryDataSource: "NOAA_NWS",
      displayWindowStart: windowStart,
      displayWindowEnd: windowEnd,
      timezone: "America/Los_Angeles",
    },
    hourlyForecasts: [
      {
        forecast_at: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
        wave_height: "2 ft",
        swell_1_height: "2 ft",
        swell_1_period: "17s",
        swell_1_direction: "SW",
        swell_2_height: null,
        swell_2_period: null,
        swell_2_direction: null,
        wind_speed: "4 mph",
        wind_direction: "N",
        tide_height: "3.0 ft",
        tide_status: "Rising",
        confidence_score: 91,
      },
      {
        forecast_at: selectedRowTime,
        wave_height: "3 ft",
        swell_1_height: "2 ft",
        swell_1_period: "17s",
        swell_1_direction: "SW",
        swell_2_height: null,
        swell_2_period: null,
        swell_2_direction: null,
        wind_speed: "4 mph",
        wind_direction: "N",
        tide_height: "3.2 ft",
        tide_status: "Rising",
        confidence_score: 92,
      },
      {
        forecast_at: new Date(now + 2 * 60 * 60 * 1000).toISOString(),
        wave_height: "2-3 ft",
        swell_1_height: "2 ft",
        swell_1_period: "16s",
        swell_1_direction: "SW",
        swell_2_height: null,
        swell_2_period: null,
        swell_2_direction: null,
        wind_speed: "6 mph",
        wind_direction: "W",
        tide_height: "3.4 ft",
        tide_status: "Rising",
        confidence_score: 90,
      },
    ],
    hourlyForecastDay: "today" as const,
  };
}

function getHeadingTexts(html: string, level: 1 | 2): string[] {
  const pattern = new RegExp(`<h${level}\\b[^>]*>([\\s\\S]*?)<\\/h${level}>`, "gi");
  return Array.from(html.matchAll(pattern), (match) =>
    match[1].replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(),
  ).filter(Boolean);
}

describe("GenericBeachDetailPage slug resolution", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns a true 404 (NEXT_NOT_FOUND) when no beaches match the slug", async () => {
    (getBeachesBySlug as jest.Mock).mockResolvedValue({
      success: true,
      data: [],
    });

    await expect(
      GenericBeachDetailPage({
        params: Promise.resolve({ intent: "ca", city: "orange-county", beachSlug: "nope" }),
      })
    ).rejects.toMatchObject({ digest: "NEXT_NOT_FOUND" });

    expect(notFound).toHaveBeenCalled();
  });

  it("chooses the candidate that matches URL state+city when duplicates exist", async () => {
    (getBeachesBySlug as jest.Mock).mockResolvedValue({
      success: true,
      data: [
        makeBeach({
          id: "wrong-state",
          state: "HI",
          city: "Oahu",
          created_at: "2026-01-03T00:00:00Z",
        }),
        makeBeach({
          id: "right-match",
          state: "CA",
          city: "Dana Point", // Match the actual city where Lowers Trestles is
          created_at: "2025-12-01T00:00:00Z",
        }),
      ],
    });

    // If the resolver selects the correct match, it should proceed far enough to try rendering.
    // We don't assert on JSX output here; we just assert it does NOT trigger `notFound()`.
    await expect(
      GenericBeachDetailPage({
        params: Promise.resolve({ intent: "ca", city: "dana-point", beachSlug: "lower-trestles" }),
      })
    ).resolves.toBeTruthy();

    expect(notFound).not.toHaveBeenCalled();
    expect(getNearbyBeaches).toHaveBeenCalledWith(33.3827, -117.5922, 25);
  });

  it("omits the removed conditions summary from beach pages", async () => {
    (getBeachesBySlug as jest.Mock).mockResolvedValue({
      success: true,
      data: [
        makeBeach({
          id: "lower-trestles",
          name: "Lower Trestles",
          slug: "lower-trestles",
          city: "San Clemente",
        }),
      ],
    });
    const page = await GenericBeachDetailPage({
      params: Promise.resolve({
        intent: "ca",
        city: "san-clemente",
        beachSlug: "lower-trestles",
      }),
    });
    const html = renderToStaticMarkup(page);

    expect(html).not.toContain("Surf report snapshot");
    expect(html).not.toContain("current conditions and local guidance");
    expect(html).not.toContain("Lower Trestles tide chart");
  });

  it("renders a held beach page with its forecast intact", async () => {
    const heldBeachId = CHRONICALLY_IMPACTED_WATER_QUALITY_BEACH_IDS[2];
    (getBeachesBySlug as jest.Mock).mockResolvedValue({
      success: true,
      data: [
        makeBeach({
          id: heldBeachId,
          name: "Silver Strand State Beach",
          slug: "silver-strand-state-beach",
          city: "Coronado",
        }),
      ],
    });
    (getSpotSurfReportPublic as jest.Mock).mockResolvedValueOnce(freshForecastResult());

    const page = await GenericBeachDetailPage({
      params: Promise.resolve({
        intent: "ca",
        city: "coronado",
        beachSlug: "silver-strand-state-beach",
      }),
    });

    expect(notFound).not.toHaveBeenCalled();
    expect(getSpotSurfReportPublic).toHaveBeenCalledWith(
      expect.objectContaining({ id: heldBeachId }),
    );
    expect(renderToStaticMarkup(page)).toContain("2-3 ft");
  });

  it("renders the forecast answer and hourly rows in initial HTML", async () => {
    (getBeachesBySlug as jest.Mock).mockResolvedValue({
      success: true,
      data: [
        makeBeach({
          name: "Del Mar",
          slug: "del-mar",
          city: "Del Mar",
        }),
      ],
    });
    const forecastResult = freshForecastResult();
    (getSpotSurfReportPublic as jest.Mock).mockResolvedValueOnce(forecastResult);
    (getNearbyBeaches as jest.Mock).mockResolvedValueOnce({
      success: true,
      data: [
        makeBeach({ id: "backup-1", name: "Swami's", slug: "swamis", city: "Encinitas" }),
        makeBeach({ id: "backup-2", name: "Ocean Beach", slug: "ocean-beach", city: "San Diego" }),
        makeBeach({ id: "backup-3", name: "Pipeline", slug: "pipeline", city: "Haleiwa", state: "HI" }),
        makeBeach({ id: "backup-4", name: "Malibu", slug: "malibu", city: "Malibu" }),
      ],
    });

    const page = await GenericBeachDetailPage({
      params: Promise.resolve({
        intent: "ca",
        city: "del-mar",
        beachSlug: "del-mar",
      }),
    });
    const html = renderToStaticMarkup(page);

    expect(getHeadingTexts(html, 1)).toEqual(["Del Mar Surf Forecast"]);
    expect(getHeadingTexts(html, 2)).toContain("Del Mar");
    expect(getHeadingTexts(html, 2)).toContain("Del Mar Hourly Surf Forecast");
    expect(html).toContain('data-testid="public-forecast-hourly"');
    expect((html.match(/data-testid="public-forecast-hour"/g) ?? [])).toHaveLength(3);
    expect(html).not.toContain("84/100");
    expect(html).not.toMatch(/>\s*(?:YES|MAYBE|NO)\s*</);
    expect(html).not.toContain(forecastResult.report.bestWindowStart);
    expect(html).not.toContain(forecastResult.report.bestWindowEnd);
    expect(html).not.toContain("Sign in to reveal");
    expect(html).toContain("Best window");
    expect(html).toContain("Nearby backups");
    expect(html).toContain('href="/ca/encinitas/swamis"');
    expect(html).toContain('href="/ca/san-diego/ocean-beach"');
    expect(html).toContain('href="/hi/haleiwa/pipeline"');
    expect(html).not.toContain('href="/ca/malibu/malibu"');
    expect(html.indexOf('data-testid="public-forecast-answer"')).toBeLessThan(
      html.indexOf("Nearby backups"),
    );
    expect(html).toContain("17s SW");
    expect(html).toContain("3.2 ft · Rising");
    expect(html).toContain("92%");
  });

  it("keeps the surf-forecast H1 when live forecast details are unavailable", async () => {
    (getBeachesBySlug as jest.Mock).mockResolvedValue({
      success: true,
      data: [makeBeach({ name: "Del Mar", slug: "del-mar", city: "Del Mar" })],
    });

    const page = await GenericBeachDetailPage({
      params: Promise.resolve({
        intent: "ca",
        city: "del-mar",
        beachSlug: "del-mar",
      }),
    });
    const html = renderToStaticMarkup(page);

    expect(getHeadingTexts(html, 1)).toEqual(["Del Mar Surf Forecast"]);
    expect(getHeadingTexts(html, 2)).toContain("Del Mar");
    // origin/main asserted this positively; a beach with no forecast must still
    // explain itself rather than render an empty section.
    expect(html).toContain("Current forecast details are temporarily unavailable");
    expect(html).not.toContain("Best window");
    expect(html).not.toContain("Nearby backups");
  });

  it("omits nearby backups without coordinates and skips the nearby lookup", async () => {
    (getBeachesBySlug as jest.Mock).mockResolvedValue({
      success: true,
      data: [makeBeach({ lat: null, lon: null })],
    });

    const page = await GenericBeachDetailPage({
      params: Promise.resolve({
        intent: "ca",
        city: "dana-point",
        beachSlug: "lower-trestles",
      }),
    });

    expect(getNearbyBeaches).not.toHaveBeenCalled();
    expect(renderToStaticMarkup(page)).not.toContain("Nearby backups");
  });

  it.each([
    [
      false,
      "Test Beach: 2-3 ft Surf Report & Forecast | CA",
      "Current 2-3 ft wave height at Test Beach. See the today surf report & forecast, wind, tide, crowd intel, and 7-day forecast.",
    ],
    [
      true,
      "Test Beach: 2-3 ft Surf Report & Forecast | CA",
      "Tomorrow's 2-3 ft wave height at Test Beach. See the tomorrow surf report & forecast, wind, tide, crowd intel, and 7-day forecast.",
    ],
  ])("preserves exact metadata and robots when isTomorrow=%s", async (isTomorrow, title, description) => {
    (getBeachesBySlug as jest.Mock).mockResolvedValue({
      success: true,
      data: [makeBeach({ name: "Test Beach" })],
    });
    (getSpotSurfReportPublic as jest.Mock).mockResolvedValueOnce({
      ...freshForecastResult(),
      isTomorrow,
    });

    const metadata = await generateMetadata({
      params: Promise.resolve({ intent: "ca", city: "dana-point", beachSlug: "lower-trestles" }),
    });

    expect(metadata.title).toBe(title);
    expect(metadata.description).toBe(description);
    expect(metadata.alternates?.canonical).toBe("http://localhost:3000/ca/dana-point/lower-trestles");
    expect(metadata.robots).toEqual({
      index: true,
      follow: true,
      googleBot: { index: true, follow: true },
    });
  });

  it("preserves exact no-forecast metadata and noindex robots", async () => {
    (getBeachesBySlug as jest.Mock).mockResolvedValue({
      success: true,
      data: [makeBeach({ name: "Test Beach" })],
    });
    (getSpotSurfReportPublic as jest.Mock).mockResolvedValueOnce({
      report: null,
      isTomorrow: false,
      forecastContext: null,
    });

    const metadata = await generateMetadata({
      params: Promise.resolve({ intent: "ca", city: "dana-point", beachSlug: "lower-trestles" }),
    });

    expect(metadata.title).toBe("Test Beach Surf Report & Forecast | Dana Point");
    expect(metadata.description).toBe(
      "Today's surf report & forecast for Test Beach in Dana Point, CA: wave height, wind, tide, crowd intel, and 7-day forecast.",
    );
    expect(metadata.alternates?.canonical).toBe("http://localhost:3000/ca/dana-point/lower-trestles");
    expect(metadata.robots).toEqual({
      index: false,
      follow: true,
      googleBot: { index: false, follow: true },
    });
  });

  it("redirects stale city slugs to the canonical beach URL", async () => {
    (getBeachesBySlug as jest.Mock).mockResolvedValue({
      success: true,
      data: [
        makeBeach({
          id: "right-state-wrong-city-url",
          state: "CA",
          city: "Dana Point",
          created_at: "2026-01-03T00:00:00Z",
        }),
      ],
    });

    await expect(
      GenericBeachDetailPage({
        params: Promise.resolve({
          intent: "ca",
          city: "orange-county",
          beachSlug: "lower-trestles",
        }),
      })
    ).rejects.toMatchObject({
      digest: expect.stringContaining("NEXT_REDIRECT"),
    });

    expectConsoleWarnings([/\[GenericBeachDetailPage\] City slug mismatch/]);
    expect(redirect).toHaveBeenCalledWith("/ca/dana-point/lower-trestles");
    expect(notFound).not.toHaveBeenCalled();
    expect(getNearbyBeaches).not.toHaveBeenCalled();
  });

  it("noindexes a canonical beach URL until its local editorial evidence is approved", async () => {
    (getBeachesBySlug as jest.Mock).mockResolvedValue({
      success: true,
      data: [makeBeach({
        description: "A local surf break with a defined takeoff zone.",
        wave_tips: "Watch the peak before paddling out.",
      })],
    });

    const metadata = await generateMetadata({
      params: Promise.resolve({ intent: "ca", city: "dana-point", beachSlug: "lower-trestles" }),
    });

    expect(metadata.alternates?.canonical).toContain("/ca/dana-point/lower-trestles");
    expect((metadata.robots as { index?: boolean })?.index).toBe(false);
    expect((metadata.robots as { follow?: boolean })?.follow).toBe(true);
  });

  it("indexes a canonical beach URL after approved local editorial evidence is present", async () => {
    (getBeachesBySlug as jest.Mock).mockResolvedValue({
      success: true,
      data: [makeBeach({
        description: "A local surf break with a defined takeoff zone.",
        wave_tips: "Watch the peak before paddling out.",
        seo_indexable: true,
        editorial_reviewed_at: "2026-07-13T00:00:00.000Z",
        editorial_sources: [{
          url: "https://www.noaa.gov/example",
          publisher: "NOAA",
          retrievedAt: "2026-07-13T00:00:00.000Z",
        }],
      })],
    });
    (getSpotSurfReportPublic as jest.Mock).mockResolvedValue(freshForecastResult());

    const metadata = await generateMetadata({
      params: Promise.resolve({ intent: "ca", city: "dana-point", beachSlug: "lower-trestles" }),
    });

    expect(metadata.alternates?.canonical).toContain("/ca/dana-point/lower-trestles");
    expect((metadata.robots as { index?: boolean } | undefined)?.index).not.toBe(false);
  });

  it("indexes a substantive unreviewed beach with checked-in GSC protection", async () => {
    (getBeachesBySlug as jest.Mock).mockResolvedValue({
      success: true,
      data: [makeBeach({
        slug: "georges",
        city: "Cardiff-by-the-Sea",
        description: "A local reef break with a defined takeoff zone.",
        wave_tips: "Watch the reef peak before paddling out.",
      })],
    });
    (getSpotSurfReportPublic as jest.Mock).mockResolvedValue(freshForecastResult());

    const metadata = await generateMetadata({
      params: Promise.resolve({
        intent: "ca",
        city: "cardiff-by-the-sea",
        beachSlug: "georges",
      }),
    });

    expect(metadata.alternates?.canonical).toContain(
      "/ca/cardiff-by-the-sea/georges",
    );
    expect((metadata.robots as { index?: boolean } | undefined)?.index).not.toBe(
      false,
    );
  });

  it("does not let editorial rejection take a current forecast page down", async () => {
    (getBeachesBySlug as jest.Mock).mockResolvedValue({
      success: true,
      data: [makeBeach({
        slug: "georges",
        city: "Cardiff-by-the-Sea",
        description: "A local reef break with a defined takeoff zone.",
        wave_tips: "Watch the reef peak before paddling out.",
        seo_indexable: false,
        editorial_reviewed_at: "2026-07-13T00:00:00.000Z",
      })],
    });
    (getSpotSurfReportPublic as jest.Mock).mockResolvedValue(freshForecastResult());

    const metadata = await generateMetadata({
      params: Promise.resolve({
        intent: "ca",
        city: "cardiff-by-the-sea",
        beachSlug: "georges",
      }),
    });

    expect((metadata.robots as { index?: boolean } | undefined)?.index).not.toBe(false);
  });
});
