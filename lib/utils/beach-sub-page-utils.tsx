/**
 * Shared utilities for beach sub-pages (tides, water-temp)
 * Eliminates duplication across route files by providing consistent rendering
 * and metadata generation for specialized beach detail pages.
 */

import { BeachPageStructuredData } from "@/components/seo/structured-data";
import { BreadcrumbStructuredData } from "@/components/seo/breadcrumb-schema";
import { BeachFAQSchema } from "@/components/seo/faq-schema";
import { BeachDetailClient } from "@/app/beach/[slug]/beach-detail-client";
import { NearbyBeachesEnriched } from "@/components/beach-detail/nearby-spots-enriched";
import { enrichBeachesWithConditions } from "@/lib/utils/nearby-beach-enrichment";
import { getNearbyBeaches } from "@/actions/beach/beach-location-actions";
import type { Beach } from "@/types/database";
import type { Metadata } from "next";
import {
  buildPageMetadata,
  buildDynamicTideMetadata,
  buildDynamicWaterTempMetadata,
} from "@/lib/seo/meta";
import { getTideMetaData } from "@/lib/seo/tide-meta-data";
import { getWaterTempMetaData } from "@/lib/seo/water-temp-meta-data";
import { notFound } from "next/navigation";
import { getTimezoneFromCoords } from "@/lib/utils/timezone-utils.server";
import { getBeachBySlugOrId } from "@/lib/utils/beach-lookup-utils";

const baseUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "https://www.quiversurf.app";

export type SubPageType = "tides" | "water-temp";

interface SubPageConfig {
  defaultTab: "overview" | "forecast" | "reviews" | "intel" | "sessions";
  defaultSubTab: "today" | "tides" | "conditions";
  breadcrumbLabel: string;
  structuredDataDescription: (beachName: string) => string;
  fallbackMetadata: { title: string; description: string };
}

const SUB_PAGE_CONFIGS: Record<SubPageType, SubPageConfig> = {
  tides: {
    defaultTab: "forecast",
    defaultSubTab: "tides",
    breadcrumbLabel: "Tide Chart",
    structuredDataDescription: (beachName) =>
      `Tide chart and tide times for ${beachName}. High and low tide predictions updated daily.`,
    fallbackMetadata: {
      title: "Tide Chart",
      description: "Tide times and predictions for this beach.",
    },
  },
  "water-temp": {
    defaultTab: "forecast",
    defaultSubTab: "conditions",
    breadcrumbLabel: "Water Temperature",
    structuredDataDescription: (beachName) =>
      `Current water temperature at ${beachName}. Wetsuit recommendations and seasonal trends.`,
    fallbackMetadata: {
      title: "Water Temperature",
      description: "Current water temperature and conditions for this beach.",
    },
  },
};

interface RenderParams {
  beachSlug: string;
  pageType: SubPageType;
  /** Full path to the beach (e.g., "/ca/san-diego/ocean-beach") */
  beachPath: string;
}

/**
 * Renders a beach sub-page (tides or water-temp) with consistent structure.
 * Use in page components to eliminate duplication.
 */
export async function renderBeachSubPage({
  beachSlug,
  pageType,
  beachPath,
}: RenderParams) {
  const beach = await getBeachBySlugOrId(beachSlug);

  if (!beach) {
    notFound();
  }

  const beachTimezone =
    beach.lat != null && beach.lon != null
      ? getTimezoneFromCoords(beach.lat, beach.lon)
      : null;

  const config = SUB_PAGE_CONFIGS[pageType];
  const subPagePath = `${beachPath}/${pageType}`;

  // Fetch and enrich nearby beaches for internal linking and discovery
  let nearbyBeachesRaw: Beach[] = [];
  try {
    if (beach.lat && beach.lon) {
      const nearbyResult = await getNearbyBeaches(beach.lat, beach.lon, 25);
      if (nearbyResult?.success && nearbyResult.data) {
        nearbyBeachesRaw = nearbyResult.data
          .filter((b) => b.id !== beach.id && b.slug !== beach.slug)
          .slice(0, 4);
      }
    }
  } catch {
    // Gracefully degrade — nearby beaches are not critical
  }
  const nearbyBeaches = await enrichBeachesWithConditions(nearbyBeachesRaw);

  return (
    <>
      <BeachPageStructuredData
        beachName={beach.name}
        description={config.structuredDataDescription(beach.name)}
        latitude={beach.lat || 0}
        longitude={beach.lon || 0}
        rating={(beach as any).average_rating || undefined}
        reviewCount={(beach as any).review_count || undefined}
        city={beach.city || undefined}
        state={beach.state || undefined}
        country={beach.country || undefined}
      />

      <BreadcrumbStructuredData
        items={[
          { name: "Home", url: baseUrl },
          { name: "Surf Spots Map", url: `${baseUrl}/map` },
          { name: beach.name, url: `${baseUrl}${beachPath}` },
          { name: config.breadcrumbLabel, url: `${baseUrl}${subPagePath}` },
        ]}
      />

      <BeachFAQSchema beachName={beach.name} />

      <BeachDetailClient
        beach={beach}
        slug={beachSlug}
        beachTimezone={beachTimezone}
        defaultTab={config.defaultTab}
        defaultSubTab={config.defaultSubTab}
      />

      <div className="container mx-auto px-4 pb-8">
        <NearbyBeachesEnriched
          beaches={nearbyBeaches}
          sourceBeachName={beach.name}
          sourceBeachLat={beach.lat}
          sourceBeachLon={beach.lon}
        />
      </div>
    </>
  );
}

/**
 * Generates metadata for beach sub-pages with dynamic SEO content.
 * Use in generateMetadata exports to eliminate duplication.
 */
export async function generateBeachSubPageMetadata({
  beachSlug,
  pageType,
  beachPath,
}: RenderParams): Promise<Metadata> {
  const beach = await getBeachBySlugOrId(beachSlug);
  const config = SUB_PAGE_CONFIGS[pageType];
  const subPagePath = `${beachPath}/${pageType}`;

  if (beach) {
    // Fetch dynamic data for SEO based on page type
    let title: string;
    let description: string;

    try {
      if (pageType === "tides") {
        const tideMeta = await getTideMetaData(beach.id);
        const result = buildDynamicTideMetadata({
          beach,
          tideData: {
            nextHighTime: tideMeta.nextHighTime,
            nextLowTime: tideMeta.nextLowTime,
            nextHighHeight: tideMeta.nextHighHeight,
            nextLowHeight: tideMeta.nextLowHeight,
          },
        });
        title = result.title;
        description = result.description;
      } else {
        const tempMeta = await getWaterTempMetaData(beach.id);
        const result = buildDynamicWaterTempMetadata({
          beach,
          waterTempData: {
            tempF: tempMeta.tempF,
            wetsuitRec: tempMeta.wetsuitRec,
          },
        });
        title = result.title;
        description = result.description;
      }
    } catch {
      // Gracefully degrade to static metadata on fetch failure
      const result =
        pageType === "tides"
          ? buildDynamicTideMetadata({ beach, tideData: null })
          : buildDynamicWaterTempMetadata({ beach, waterTempData: null });
      title = result.title;
      description = result.description;
    }

    return buildPageMetadata({
      title,
      description,
      path: subPagePath,
      image: `/api/og/beach?slug=${beachSlug}`,
    });
  }

  return buildPageMetadata({
    title: config.fallbackMetadata.title,
    description: config.fallbackMetadata.description,
    path: subPagePath,
  });
}
