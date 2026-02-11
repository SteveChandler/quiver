/**
 * @jest-environment node
 */

import GenericBeachDetailPage from "@/app/[intent]/[city]/[beachSlug]/page";
import { getBeachesBySlug } from "@/actions/beach/beach-query-actions";
import type { Beach } from "@/types/database";
import { notFound } from "next/navigation";

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
}));

// Mock dependencies used during page rendering
jest.mock("@/actions/spot/spot-surf-report-actions", () => ({
  getSpotSurfReport: jest.fn().mockResolvedValue({
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

function makeBeach(overrides: Partial<Beach>) {
  return {
    id: overrides.id ?? "beach-1",
    name: overrides.name ?? "Test Beach",
    slug: overrides.slug ?? "lowers-trestles",
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
        params: Promise.resolve({ intent: "ca", city: "dana-point", beachSlug: "lowers-trestles" }),
      })
    ).resolves.toBeTruthy();

    expect(notFound).not.toHaveBeenCalled();
  });
});


