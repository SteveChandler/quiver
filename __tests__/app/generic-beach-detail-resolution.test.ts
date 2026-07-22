/**
 * @jest-environment node
 */

import GenericBeachDetailPage, {
  generateMetadata,
} from "@/app/[intent]/[city]/[beachSlug]/page";
import { getBeachesBySlug } from "@/actions/beach/beach-query-actions";
import { getNearbyBeaches } from "@/actions/beach/beach-location-actions";
import { expectConsoleWarnings } from "@/__tests__/setup/test-utils";
import type { Beach } from "@/types/database";
import { notFound, redirect } from "next/navigation";
import { renderToStaticMarkup } from "react-dom/server";

// Mock React's cache function for server components
jest.mock("react", () => ({
  ...jest.requireActual("react"),
  cache: (fn: Function) => fn, // cache is just a pass-through for testing
}));

jest.mock("@/actions/beach/beach-query-actions", () => ({
  getBeachesBySlug: jest.fn(),
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
jest.mock("@/actions/spot/spot-surf-report-actions", () => ({
  getSpotSurfReport: jest.fn().mockResolvedValue({
    report: null,
    isTomorrow: false,
  }),
  getSpotSurfReportPublic: jest.fn().mockResolvedValue({
    report: null,
    isTomorrow: false,
  }),
}));

jest.mock("@/lib/utils/timezone-utils.server", () => ({
  getTimezoneFromCoords: jest.fn().mockReturnValue("America/Los_Angeles"),
}));

// Mock the child components to avoid rendering issues in node environment
jest.mock("@/app/beach/[slug]/beach-detail-client", () => ({
  BeachDetailClient: () => null,
}));

jest.mock("@/components/spots/spot-surf-report", () => ({
  SpotSurfReportStream: () => null,
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

jest.mock("@/components/seo/review-schema", () => ({
  ReviewSchema: () => null,
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

jest.mock("@/components/beach-detail/beach-prose-summary", () => ({
  BeachProseSummary: () =>
    jest.requireActual("react").createElement(
      "section",
      { "data-testid": "beach-prose-summary" },
      "Surf report snapshot",
    ),
}));

jest.mock("@/components/beach-detail/optimal-conditions-section", () => ({
  OptimalConditionsSection: () => null,
}));

jest.mock("@/components/ui/sticky-signup-bar", () => ({
  StickySignupBar: () => null,
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

jest.mock("@/actions/beach-review-actions", () => ({
  getBeachReviews: jest.fn().mockResolvedValue({
    success: true,
    data: [],
  }),
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

jest.mock("@/lib/utils/best-time-to-surf-utils", () => ({
  getBestTimeToSurfUrl: jest.fn().mockResolvedValue(undefined),
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

type BeachTestOverrides = Partial<Beach> & {
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
    lat: overrides.lat ?? 33.3827,
    lon: overrides.lon ?? -117.5922,
    created_at: overrides.created_at ?? "2026-01-01T00:00:00Z",
    review_count: overrides.review_count ?? 0,
    center_lat: overrides.lat ?? 33.3827,
    center_lng: overrides.lon ?? -117.5922,
    // other Beach fields unused by this page are intentionally omitted for test brevity
  } as unknown as Beach;
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
    expect(getNearbyBeaches).not.toHaveBeenCalled();
  });

  it("removes the Doheny snapshot while preserving its supporting guide links", async () => {
    (getBeachesBySlug as jest.Mock).mockResolvedValue({
      success: true,
      data: [
        makeBeach({
          id: "doheny",
          name: "Doheny Beach",
          slug: "doheny",
          city: "Dana Point",
        }),
      ],
    });

    const page = await GenericBeachDetailPage({
      params: Promise.resolve({
        intent: "ca",
        city: "dana-point",
        beachSlug: "doheny",
      }),
    });
    const html = renderToStaticMarkup(page);

    expect(html).not.toContain("Surf report snapshot");
    expect(html).toContain("Doheny Beach tide chart");
    expect(html).toContain("Doheny Beach water temperature");
  });

  it("keeps the snapshot on other beach pages", async () => {
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

    expect(renderToStaticMarkup(page)).toContain("Surf report snapshot");
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

    const metadata = await generateMetadata({
      params: Promise.resolve({ intent: "ca", city: "dana-point", beachSlug: "lower-trestles" }),
    });

    expect(metadata.alternates?.canonical).toContain("/ca/dana-point/lower-trestles");
    expect((metadata.robots as { index?: boolean } | undefined)?.index).not.toBe(false);
  });
});
