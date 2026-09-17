/**
 * @jest-environment node
 */

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import MexicoBeachDetailPage from "@/app/mexico/[region]/[city]/[beachSlug]/page";
import { getBeachBySlugOrId } from "@/lib/utils/beach-lookup-utils";
import { getSpotSurfReportPublic } from "@/lib/services/spot-surf-report-service";
import { getSpotFeaturedPhoto } from "@/actions/spot/spot-data-actions";
import { getNearbyBeaches } from "@/actions/beach/beach-location-actions";
import { expectConsoleWarnings } from "@/__tests__/setup/test-utils";

let mockBeachDetailProps: Record<string, unknown> | undefined;

jest.mock("@/lib/utils/beach-lookup-utils", () => ({
  getBeachBySlugOrId: jest.fn(),
}));
jest.mock("@/lib/services/spot-surf-report-service", () => ({
  getSpotSurfReportPublic: jest.fn(),
}));
jest.mock("@/actions/spot/spot-data-actions", () => ({
  getSpotFeaturedPhoto: jest.fn(),
}));
jest.mock("@/actions/beach/beach-location-actions", () => ({
  getNearbyBeaches: jest.fn(),
}));
jest.mock("@/lib/utils/timezone-utils.server", () => ({
  getTimezoneFromCoords: jest.fn().mockReturnValue("America/Tijuana"),
}));
jest.mock("@/lib/utils/nearby-beach-enrichment", () => ({
  enrichBeachesWithConditions: jest.fn().mockResolvedValue([]),
}));
jest.mock("@/lib/flags/free-growth-phase", () => ({
  isFreeGrowthPhaseEnabled: jest.fn().mockReturnValue(false),
}));
jest.mock("@/app/beach/[slug]/beach-detail-client", () => ({
  BeachDetailClient: (props: Record<string, unknown>) => {
    mockBeachDetailProps = props;
    return null;
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
jest.mock("@/components/beach-detail/beach-prose-summary", () => ({
  BeachProseSummary: () => null,
}));
jest.mock("@/components/beach-detail/nearby-spots-enriched", () => ({
  NearbyBeachesEnriched: () => null,
}));
jest.mock("@/components/beach-detail/related-guides-section", () => ({
  RelatedGuidesSection: () => null,
}));
jest.mock("next/navigation", () => ({
  notFound: jest.fn(() => {
    const error = new Error("NEXT_NOT_FOUND");
    (error as { digest?: string }).digest = "NEXT_NOT_FOUND";
    throw error;
  }),
}));

const beach = {
  id: "beach-1",
  name: "K-38",
  slug: "k-38",
  city: "Rosarito",
  state: "Baja California",
  country: "Mexico",
  lat: 32.25,
  lon: -117.35,
  timezone: "America/Tijuana",
  description: "Local notes mention the Siuslaw River and should be quarantined.",
  wave_tips: "A south swell helps.",
  crowd_tips: null,
  best_conditions_prose: null,
  parking_tips: null,
  access_tips: null,
  local_etiquette: null,
  hazards: null,
  editorial_sources: [],
};

describe("Mexico beach detail page wiring", () => {
  beforeEach(() => {
    mockBeachDetailProps = undefined;
    jest.clearAllMocks();
    (getBeachBySlugOrId as jest.Mock).mockResolvedValue(beach);
    (getSpotSurfReportPublic as jest.Mock).mockResolvedValue({
      report: null,
      isTomorrow: false,
    });
    (getSpotFeaturedPhoto as jest.Mock).mockResolvedValue({
      imageUrl: "/images/beaches/baja/k-38.jpg",
      thumbUrl: "/images/beaches/baja/k-38-thumb.jpg",
      source: "curated",
      creatorName: "Local Photographer",
      attributionHtml: '<a href="https://example.com">Local Photographer</a>',
      attribution: { creator: "Local Photographer", sourceUrl: "https://example.com" },
    });
    (getNearbyBeaches as jest.Mock).mockResolvedValue({ success: true, data: [] });
  });

  it("passes the mapped featured photo and sanitized beach to BeachDetailClient", async () => {
    const page = await MexicoBeachDetailPage({
      params: Promise.resolve({
        region: "baja-california",
        city: "rosarito",
        beachSlug: "k-38",
      }),
    });
    renderToStaticMarkup(page);
    expectConsoleWarnings([/sanitizeBeachEditorialContent/]);

    expect(getSpotFeaturedPhoto).toHaveBeenCalledWith("beach-1");
    expect(mockBeachDetailProps).toMatchObject({
      beach: expect.objectContaining({
        id: "beach-1",
        description: null,
        wave_tips: null,
      }),
      beachPhoto: {
        image_url: "/images/beaches/baja/k-38-thumb.jpg",
        thumb_url: "/images/beaches/baja/k-38-thumb.jpg",
        source: "curated",
        creator_name: "Local Photographer",
        license_code: null,
        attribution_html: '<a href="https://example.com">Local Photographer</a>',
        attribution: { creator: "Local Photographer", sourceUrl: "https://example.com" },
      },
    });
  });
});
