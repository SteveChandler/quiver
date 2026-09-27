/**
 * @jest-environment node
 */

import GenericBeachDetailPage, {
  generateMetadata,
} from "@/app/[intent]/[city]/[beachSlug]/page";
import { getBeachesBySlug } from "@/actions/beach/beach-query-actions";
import { getSpotSurfReportPublic } from "@/lib/services/spot-surf-report-service";
import {
  getForecastIndexabilityForBeaches,
  type ForecastIndexabilitySnapshot,
} from "@/lib/seo/forecast-indexability";
import { getNearbyBeaches } from "@/actions/beach/beach-location-actions";
import { expectConsoleWarnings } from "@/__tests__/setup/test-utils";
import type { Beach } from "@/types/database";
import { notFound, redirect } from "next/navigation";
import { renderToStaticMarkup } from "react-dom/server";
import { CHRONICALLY_IMPACTED_WATER_QUALITY_BEACH_IDS } from "@/lib/recommendations/major-event-hold/water-quality";
import { BeachDetailClient } from "@/app/beach/[slug]/beach-detail-client";
import { getTimezoneFromCoords } from "@/lib/utils/timezone-utils.server";
import { DEFAULT_TIMEZONE } from "@/lib/utils/timezone-constants";
import { getTideMetaData } from "@/lib/seo/tide-meta-data";
import { rowToSwellPartition } from "@/lib/domains/conditions/map-forecast";

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
  useSearchParams: () => new URLSearchParams(),
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
// shell, so the stub must render visualTop/beforeTabsContent/afterTabsContent too.
// Dropping them would let this suite pass while the crawlable answer block
// silently vanished from the initial HTML — the exact thing it guards.
// Like BeachDetail, the visual layout renders visualTop in place of the zine hero.
jest.mock("@/app/beach/[slug]/beach-detail-client", () => ({
  BeachDetailClient: jest.fn(({
    beach,
    heroHeadingLevel = "h1",
    layout = "zine",
    visualTop,
    beforeTabsContent,
    afterTabsContent,
    heroForecastSlot,
  }: {
    beach: Beach;
    heroHeadingLevel?: "h1" | "h2";
    layout?: "zine" | "visual";
    visualTop?: React.ReactNode;
    beforeTabsContent?: React.ReactNode;
    afterTabsContent?: React.ReactNode;
    heroForecastSlot?: React.ReactNode;
  }) => {
    const React = jest.requireActual("react");
    const top =
      layout === "visual"
        ? [visualTop ?? null]
        : [
            React.createElement(heroHeadingLevel, { key: "hero" }, beach.name),
            heroForecastSlot ?? null,
          ];
    return React.createElement(
      "div",
      null,
      ...top,
      beforeTabsContent ?? null,
      afterTabsContent ?? null,
    );
  }),
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

// Robots come from the cached coverage snapshot, not the live surf report.
// The default (empty map) means "no coverage" so every test that expects an
// indexable page opts in with freshSnapshotMap() explicitly.
jest.mock("@/lib/seo/forecast-indexability", () => ({
  ...jest.requireActual("@/lib/seo/forecast-indexability"),
  getForecastIndexabilityForBeaches: jest.fn().mockResolvedValue(new Map()),
  isBeachSubPageIndexable: jest.fn().mockReturnValue(false),
}));

jest.mock("next/cache", () => ({
  unstable_cache: jest.fn((fn: unknown) => fn),
}));

jest.mock("@/lib/seo/water-temp-meta-data", () => ({
  getWaterTempMetaData: jest.fn().mockResolvedValue({ tempF: 65, wetsuitRec: "3/2mm fullsuit" }),
}));

// Marker stub so a test can count rip-current banners (the hero owns the only one).
jest.mock("@/components/beach-detail/rip-current-warning", () => ({
  RipCurrentWarning: () => {
    const React = jest.requireActual("react");
    return React.createElement("div", { "data-testid": "rip-current-warning" });
  },
}));

// Spy (real implementation) so a test can check which hour the hero's swell field draws.
jest.mock("@/lib/domains/conditions/map-forecast", () => {
  const actual = jest.requireActual("@/lib/domains/conditions/map-forecast");
  return { ...actual, rowToSwellPartition: jest.fn(actual.rowToSwellPartition) };
});

jest.mock("@/lib/seo/tide-meta-data", () => ({
  getTideMetaData: jest.fn().mockResolvedValue({ nextHighTime: null, nextLowTime: null }),
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

function freshSnapshotMap(
  overrides: Partial<ForecastIndexabilitySnapshot> = {},
  beachId = "beach-1",
): Map<string, ForecastIndexabilitySnapshot> {
  return new Map([
    [
      beachId,
      {
        forecastAvailable: true,
        selectedStateComplete: true,
        forecastFresh: true,
        forecastValidAt: new Date().toISOString(),
        sourceDataUpdatedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        primaryDataSource: "NOAA_NWS",
        isStale: false,
        ...overrides,
      },
    ],
  ]);
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
    (getForecastIndexabilityForBeaches as jest.Mock).mockResolvedValue(new Map());
  });

  it.each([true, false])("server-renders editorial tips only when present: %s", async (present) => {
    const tips = {
      wave_tips: "Watch the northern peak before paddling out.",
      crowd_tips: "Give the inside learners extra room.",
      parking_tips: "Use the signed public lot.",
      access_tips: "Follow the marked path to the sand.",
    };
    (getBeachesBySlug as jest.Mock).mockResolvedValue({ success: true, data: [makeBeach(present ? tips : {})] });
    const html = renderToStaticMarkup(await GenericBeachDetailPage({
      params: Promise.resolve({ intent: "ca", city: "dana-point", beachSlug: "lower-trestles" }),
    }));
    for (const tip of Object.values(tips)) expect(html.includes(tip)).toBe(present);
    expect(html.includes("LOCAL KNOWLEDGE")).toBe(present);
    expect(html).not.toContain("No local notes yet");
  });

  it.each([
    ["2026-09-28T03:00:00Z", "8:00 PM", true],
    ["2026-09-28T11:00:00Z", "Tomorrow 4:00 AM", false],
  ])("limits the hero's low fact to today: %s", async (nextInteriorLowAt, nextInteriorLowTime, isToday) => {
    jest.useFakeTimers().setSystemTime(new Date("2026-09-28T02:05:00Z"));
    try {
      (getBeachesBySlug as jest.Mock).mockResolvedValue({ success: true, data: [makeBeach({})] });
      (getTideMetaData as jest.Mock).mockResolvedValueOnce({ nextInteriorLowAt, nextInteriorLowTime });
      const html = renderToStaticMarkup(await GenericBeachDetailPage({
        params: Promise.resolve({ intent: "ca", city: "dana-point", beachSlug: "lower-trestles" }),
      }));
      const hero = html.split('data-testid="beach-visual-hero"')[1].split("</section>")[0];
      expect(hero).toContain("Beach day today");
      expect(hero.includes(`Low ${nextInteriorLowTime}`)).toBe(isToday);
      expect(hero.includes("Low ")).toBe(isToday);
      expect(html).toContain(nextInteriorLowTime);
    } finally {
      jest.useRealTimers();
    }
  });

  it.each([false, true])("shares the default timezone with the week (coordinates: %s)", async (hasCoords) => {
    jest.useFakeTimers().setSystemTime(new Date("2026-09-28T02:05:00Z"));
    try {
      (getBeachesBySlug as jest.Mock).mockResolvedValue({ success: true, data: [{
        ...makeBeach({ lat: hasCoords ? 33 : null, lon: hasCoords ? -117 : null }), timezone: null,
      }] });
      (getTimezoneFromCoords as jest.Mock).mockReturnValueOnce(null);
      (getSpotSurfReportPublic as jest.Mock).mockResolvedValueOnce({ report: null, isTomorrow: false });
      const html = renderToStaticMarkup(await GenericBeachDetailPage({
        params: Promise.resolve({ intent: "ca", city: "dana-point", beachSlug: "lower-trestles" }),
      }));
      expect(html).toContain("Surfing today");
      expect((BeachDetailClient as jest.Mock).mock.calls.at(-1)[0]).toMatchObject({
        beachTimezone: DEFAULT_TIMEZONE, weekCall: { localDate: "2026-09-27" },
      });
    } finally {
      (getTimezoneFromCoords as jest.Mock).mockReset().mockReturnValue("America/Los_Angeles");
      jest.useRealTimers();
    }
  });

  it.each([
    { report: { bestWindowStart: "2026-09-28T15:00:00Z" }, forecastContext: null },
    { report: null, forecastContext: { localDate: "2026-09-28" } },
  ])("anchors the call date to its report across local midnight: %p", async (reportFields) => {
    jest.useFakeTimers().setSystemTime(new Date("2026-09-28T07:01:00Z"));
    try {
      (getBeachesBySlug as jest.Mock).mockResolvedValue({ success: true, data: [makeBeach({})] });
      (getSpotSurfReportPublic as jest.Mock).mockResolvedValueOnce({ ...reportFields, isTomorrow: true });
      renderToStaticMarkup(await GenericBeachDetailPage({
        params: Promise.resolve({ intent: "ca", city: "dana-point", beachSlug: "lower-trestles" }),
      }));
      expect((BeachDetailClient as jest.Mock).mock.calls.at(-1)[0].weekCall.localDate).toBe("2026-09-28");
    } finally {
      jest.useRealTimers();
    }
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
    forecastResult.forecastContext.displayWindowStart = "2026-09-07T15:00:00.000Z";
    forecastResult.forecastContext.displayWindowEnd = "2026-09-07T17:30:00.000Z";
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
    expect(getHeadingTexts(html, 2)).toContain("About Del Mar");
    expect(getHeadingTexts(html, 2)).toContain("Forecast details");
    expect(getHeadingTexts(html, 2)).toContain("Del Mar Hourly Surf Forecast");
    expect(getHeadingTexts(html, 2)).toContain("Surf, hour by hour");
    expect(html).toContain('data-testid="beach-hourly-chart"');
    // The visual page has no Forecast tab: "Explore forecast" goes to the chart.
    expect(html).toContain('id="beach-hourly"');
    expect(html).toMatch(/href="#beach-hourly"[^>]*>Explore forecast</);
    expect(html).not.toContain("tab=forecast");
    expect((html.match(/data-testid="rip-current-warning"/g) ?? [])).toHaveLength(1);
    expect(html).toContain('data-testid="public-forecast-hourly"');
    expect((html.match(/data-testid="public-forecast-hour"/g) ?? [])).toHaveLength(3);
    expect(html).not.toContain("84/100");
    expect(html).not.toMatch(/>\s*(?:YES|MAYBE|NO)\s*</);
    expect(html).not.toContain(forecastResult.report.bestWindowStart);
    expect(html).not.toContain(forecastResult.report.bestWindowEnd);
    expect(html).not.toContain("Sign in to reveal");
    expect(html).toContain("Best window");
    expect(html).toContain("8:00 AM–10:30 AM");
    expect(html).toContain("Nearby spots");
    expect(html).toContain('href="/ca/encinitas/swamis"');
    expect(html).toContain('href="/ca/san-diego/ocean-beach"');
    expect(html).toContain('href="/hi/haleiwa/pipeline"');
    expect(html).not.toContain('href="/ca/malibu/malibu"');
    expect(html.indexOf('data-testid="public-forecast-answer"')).toBeLessThan(
      html.indexOf("Nearby spots"),
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
    expect(getHeadingTexts(html, 2)).toContain("About Del Mar");
    expect(getHeadingTexts(html, 2)).toContain("Forecast details");
    // origin/main asserted this positively; a beach with no forecast must still
    // explain itself rather than render an empty section.
    expect(html).toContain("Current forecast details are temporarily unavailable");
    // No hourly rows: no chart, no chart heading, and no link to it.
    expect(getHeadingTexts(html, 2)).not.toContain("Surf, hour by hour");
    expect(html).not.toContain("Explore forecast");
    expect(html).not.toContain("tab=forecast");
    expect(html).not.toContain("Full hourly table");
    expect(html).not.toContain("Best window");
    expect(html).not.toContain("Nearby spots");
  });

  // The hero's swell and wind facts come from the forecast context's selected
  // row, so the swell field under them must draw that same hour.
  it("draws the hero swell field from the hour the hero's swell facts describe", async () => {
    (getBeachesBySlug as jest.Mock).mockResolvedValue({
      success: true,
      data: [makeBeach({ name: "Del Mar", slug: "del-mar", city: "Del Mar" })],
    });
    const forecastResult = freshForecastResult();
    (getSpotSurfReportPublic as jest.Mock).mockResolvedValueOnce(forecastResult);

    await GenericBeachDetailPage({
      params: Promise.resolve({ intent: "ca", city: "del-mar", beachSlug: "del-mar" }),
    });

    expect(rowToSwellPartition).toHaveBeenCalledTimes(1);
    expect(rowToSwellPartition).toHaveBeenCalledWith(
      expect.objectContaining({ forecast_at: forecastResult.forecastContext.selectedRowTime }),
    );
  });

  it("draws no hero swell field when the hero's hour is not in the hourly table", async () => {
    (getBeachesBySlug as jest.Mock).mockResolvedValue({
      success: true,
      data: [makeBeach({ name: "Del Mar", slug: "del-mar", city: "Del Mar" })],
    });
    // Tomorrow's call while the hourly table still shows today's rows.
    const forecastResult = freshForecastResult();
    forecastResult.isTomorrow = true;
    forecastResult.forecastContext.selectedRowTime = new Date(Date.now() + 26 * 60 * 60 * 1000).toISOString();
    (getSpotSurfReportPublic as jest.Mock).mockResolvedValueOnce(forecastResult);

    await GenericBeachDetailPage({
      params: Promise.resolve({ intent: "ca", city: "del-mar", beachSlug: "del-mar" }),
    });

    expect(rowToSwellPartition).not.toHaveBeenCalled();
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
    expect(renderToStaticMarkup(page)).not.toContain("Nearby spots");
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
    (getForecastIndexabilityForBeaches as jest.Mock).mockResolvedValue(freshSnapshotMap());

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

  it("derives robots from the cached coverage snapshot, not the live surf report", async () => {
    (getBeachesBySlug as jest.Mock).mockResolvedValue({
      success: true,
      data: [makeBeach({ name: "Test Beach" })],
    });

    // Live report is fresh but the shared snapshot says stale: the sitemap
    // would not list this URL, so the page must not claim index either.
    (getSpotSurfReportPublic as jest.Mock).mockResolvedValueOnce(freshForecastResult());
    (getForecastIndexabilityForBeaches as jest.Mock).mockResolvedValueOnce(
      freshSnapshotMap({ forecastFresh: false, isStale: true }),
    );
    const staleSide = await generateMetadata({
      params: Promise.resolve({ intent: "ca", city: "dana-point", beachSlug: "lower-trestles" }),
    });
    expect(staleSide.title).toBe("Test Beach: 2-3 ft Surf Report & Forecast | CA");
    expect((staleSide.robots as { index?: boolean }).index).toBe(false);

    // Live report is missing but the shared snapshot is fresh: the sitemap
    // lists this URL, so the page answers index with the fallback title.
    (getSpotSurfReportPublic as jest.Mock).mockResolvedValueOnce({
      report: null,
      isTomorrow: false,
      forecastContext: null,
    });
    (getForecastIndexabilityForBeaches as jest.Mock).mockResolvedValueOnce(freshSnapshotMap());
    const freshSide = await generateMetadata({
      params: Promise.resolve({ intent: "ca", city: "dana-point", beachSlug: "lower-trestles" }),
    });
    expect(freshSide.title).toBe("Test Beach Surf Report & Forecast | Dana Point");
    expect((freshSide.robots as { index?: boolean }).index).toBe(true);

    expect(getForecastIndexabilityForBeaches).toHaveBeenCalledWith([
      { id: "beach-1", timezone: "America/Los_Angeles" },
    ]);
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
    (getForecastIndexabilityForBeaches as jest.Mock).mockResolvedValue(freshSnapshotMap());

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
    (getForecastIndexabilityForBeaches as jest.Mock).mockResolvedValue(freshSnapshotMap());

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
    (getForecastIndexabilityForBeaches as jest.Mock).mockResolvedValue(freshSnapshotMap());

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
