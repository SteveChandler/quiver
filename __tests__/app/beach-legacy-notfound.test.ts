/**
 * @jest-environment node
 */

// Mock React.cache before importing the page component
jest.mock("react", () => {
  const originalReact = jest.requireActual("react");
  return {
    ...originalReact,
    cache: <T extends (...args: any[]) => any>(fn: T) => fn,
  };
});

import BeachDetailBySlugPage, { generateMetadata } from "@/app/beach/[slug]/page";
import { notFound } from "next/navigation";

jest.mock("@/lib/services/beach-query-service", () => ({
  getBeachesBySlugFromDb: jest.fn(),
  getBeachByIdFromDb: jest.fn(),
}));

jest.mock("@/actions/forecast-actions", () => ({
  getBeachForecastPreview: jest.fn().mockResolvedValue({ success: true, data: null }),
}));

import {
  getBeachesBySlugFromDb,
  getBeachByIdFromDb,
} from "@/lib/services/beach-query-service";
import { getBeachForecastPreview } from "@/actions/forecast-actions";

jest.mock("next/navigation", () => ({
  notFound: jest.fn(() => {
    const err = new Error("NEXT_NOT_FOUND");
    (err as any).digest = "NEXT_NOT_FOUND";
    throw err;
  }),
  permanentRedirect: jest.fn(),
}));

jest.mock("@/lib/utils/timezone-utils.server", () => ({
  getTimezoneFromCoords: jest.fn().mockReturnValue("America/Los_Angeles"),
}));

jest.mock("@/actions/beach/beach-location-actions", () => ({
  getNearbyBeaches: jest.fn().mockResolvedValue({
    success: true,
    data: [],
  }),
}));

jest.mock("@/components/seo/structured-data", () => ({
  BeachPageStructuredData: () => null,
}));

jest.mock("@/components/seo/breadcrumb-schema", () => ({
  BreadcrumbStructuredData: () => null,
}));

jest.mock("@/components/seo/faq-schema", () => ({
  BeachFAQSchema: () => null,
}));

jest.mock("@/app/beach/[slug]/beach-detail-client", () => ({
  BeachDetailClient: () => null,
}));

jest.mock("@/components/beach-detail/nearby-spots-enriched", () => ({
  NearbyBeachesEnriched: () => null,
}));

jest.mock("@/components/beach-detail/related-guides-section", () => ({
  RelatedGuidesSection: () => null,
}));

jest.mock("@/components/seo/inline-signup-cta", () => ({
  InlineSignupCta: () => null,
}));

describe("legacy /beach/[slug] route", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (getBeachesBySlugFromDb as jest.Mock).mockResolvedValue({
      success: false,
      data: null,
    });
    (getBeachByIdFromDb as jest.Mock).mockResolvedValue({
      success: false,
      data: null,
    });
  });

  it("returns a true 404 (NEXT_NOT_FOUND) when a beach cannot be resolved", async () => {
    await expect(
      BeachDetailBySlugPage({ params: Promise.resolve({ slug: "does-not-exist" }) })
    ).rejects.toMatchObject({ digest: "NEXT_NOT_FOUND" });

    expect(notFound).toHaveBeenCalled();
  });

  it("generateMetadata skips forecast-preview when the slug will permanent-redirect", async () => {
    // Resolved beach has city + state + slug, so canonical = /ca/san-diego/ocean-beach
    // and request slug "ocean-beach" -> /beach/ocean-beach != canonical -> redirects.
    (getBeachesBySlugFromDb as jest.Mock).mockResolvedValue({
      success: true,
      data: [
        {
          id: "beach-id-1",
          slug: "ocean-beach",
          name: "Ocean Beach",
          city: "San Diego",
          state: "CA",
          country: "USA",
          lat: 32.75,
          lon: -117.25,
        },
      ],
    });

    await generateMetadata({ params: Promise.resolve({ slug: "ocean-beach" }) });

    expect(getBeachForecastPreview).not.toHaveBeenCalled();
  });
});


