/**
 * Shared utilities for beach sub-pages (tides, water-temp)
 * Eliminates duplication across route files by providing consistent rendering
 * and metadata generation for specialized beach detail pages.
 */

import { BeachPageStructuredData } from "@/components/seo/structured-data";
import { BreadcrumbStructuredData } from "@/components/seo/breadcrumb-schema";
import { BeachFAQSchema, TideFAQSchema, WaterTempFAQSchema } from "@/components/seo/faq-schema";
import { TideDatasetSchema } from "@/components/seo/tide-dataset-schema";
import { WaterTempDatasetSchema } from "@/components/seo/water-temp-dataset-schema";

import { BeachDetailClient } from "@/app/beach/[slug]/beach-detail-client";
import { NearbyBeachesEnriched } from "@/components/beach-detail/nearby-spots-enriched";
import { AlertCaptureCta } from "@/components/seo/alert-capture-cta";
import { SeoFunnelNextSteps } from "@/components/seo/seo-funnel-next-steps";
import { StickySignupBar } from "@/components/ui/sticky-signup-bar";
import { TideSummaryHero } from "@/components/beach-detail/tide-summary-hero";
import { WaterTempSummaryHero } from "@/components/beach-detail/water-temp-summary-hero";
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

const SUB_PAGE_CTA_CONFIGS: Record<SubPageType, {
  ctaText: string;
  supportingText: (beachName: string) => string;
  inlineTitle: (beachName: string) => string;
  inlineDescription: (beachName: string) => string;
  sourcePrefix: string;
}> = {
  tides: {
    ctaText: "Get Alerts",
    supportingText: (beachName) => `Tide alerts for ${beachName}`,
    inlineTitle: (beachName) => `Tide Alerts for ${beachName}`,
    inlineDescription: (beachName) =>
      `Get notified when optimal tide windows open at ${beachName}. Know the best times to paddle out without checking charts.`,
    sourcePrefix: "tides",
  },
  "water-temp": {
    ctaText: "Get Alerts",
    supportingText: (beachName) => `Water temp alerts for ${beachName}`,
    inlineTitle: (beachName) => `Water Temp Alerts for ${beachName}`,
    inlineDescription: (beachName) =>
      `Track water temperatures at ${beachName} and get wetsuit recommendations so you always suit up right.`,
    sourcePrefix: "water-temp",
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
  const ctaConfig = SUB_PAGE_CTA_CONFIGS[pageType];
  const ctaSource = `${ctaConfig.sourcePrefix}-${beachSlug}`;
  const subPagePath = `${beachPath}/${pageType}`;

  // Fetch dataset schema data in parallel with nearby beaches — uses React cache()
  // so no extra DB queries when generateBeachSubPageMetadata already called these.
  const [nearbyBeachesRaw, tideMeta, waterTempMeta] = await Promise.all([
    (async (): Promise<Beach[]> => {
      try {
        if (beach.lat && beach.lon) {
          const result = await getNearbyBeaches(beach.lat, beach.lon, 25);
          if (result?.success && result.data) {
            return result.data
              .filter((b) => b.id !== beach.id && b.slug !== beach.slug)
              .slice(0, 4);
          }
        }
      } catch {
        // Gracefully degrade — nearby beaches are not critical
      }
      return [];
    })(),
    pageType === "tides" ? getTideMetaData(beach.id) : Promise.resolve(null),
    pageType === "water-temp" ? getWaterTempMetaData(beach.id) : Promise.resolve(null),
  ]);

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

      {pageType === "tides" ? (
        <TideFAQSchema beachName={beach.name} />
      ) : pageType === "water-temp" ? (
        <WaterTempFAQSchema beachName={beach.name} />
      ) : (
        <BeachFAQSchema beachName={beach.name} />
      )}

      {pageType === "tides" && (
        <TideDatasetSchema
          cityOrBeachName={beach.name}
          state={beach.state || undefined}
          url={`${baseUrl}${subPagePath}`}
          latitude={beach.lat ?? undefined}
          longitude={beach.lon ?? undefined}
          nextHighTime={tideMeta?.nextHighTime ?? null}
          nextHighHeight={tideMeta?.nextHighHeight ?? null}
          nextLowTime={tideMeta?.nextLowTime ?? null}
          nextLowHeight={tideMeta?.nextLowHeight ?? null}
        />
      )}

      {pageType === "water-temp" && (
        <WaterTempDatasetSchema
          cityOrBeachName={beach.name}
          state={beach.state || undefined}
          url={`${baseUrl}${subPagePath}`}
          latitude={beach.lat ?? undefined}
          longitude={beach.lon ?? undefined}
          tempF={waterTempMeta?.tempF ?? null}
          wetsuitRec={waterTempMeta?.wetsuitRec ?? null}
        />
      )}

      {pageType === "tides" && tideMeta && (
        <TideSummaryHero beachName={beach.name} tideData={tideMeta} />
      )}
      {pageType === "water-temp" && waterTempMeta && (
        <WaterTempSummaryHero
          beachName={beach.name}
          waterTempData={waterTempMeta}
        />
      )}

      <BeachDetailClient
        beach={beach}
        slug={beachSlug}
        beachTimezone={beachTimezone}
        defaultTab={config.defaultTab}
        defaultSubTab={config.defaultSubTab}
      />

      <div className="container mx-auto px-4 py-8">
        <AlertCaptureCta
          pageContext={pageType}
          beachId={beach.id}
          beachName={beach.name}
          source={`${ctaSource}-inline`}
        />
      </div>

      <div className="container mx-auto px-4 pb-8">
        <SeoFunnelNextSteps
          title={`Keep planning ${beach.name}`}
          description={`Use this ${config.breadcrumbLabel.toLowerCase()} page as one signal, then check the full forecast, nearby breaks, and the companion condition page.`}
          steps={[
            {
              label: `Open the full ${beach.name} forecast`,
              href: beachPath,
              description: "Return to the full spot page for forecast, reviews, intel, and sessions.",
            },
            {
              label: pageType === "tides" ? "Check water temperature" : "Watch the tide window",
              href: pageType === "tides" ? `${beachPath}/water-temp` : `${beachPath}/tides`,
              description:
                pageType === "tides"
                  ? "Pair the tide call with gear and water-temperature context."
                  : "Pair water temperature with the next useful tide shift.",
            },
            {
              label: "Compare nearby surf spots",
              href: "/map",
              description: "Use the map when this spot is not the right call.",
            },
          ]}
        />
      </div>

      <div className="container mx-auto px-4 pb-8">
        <NearbyBeachesEnriched
          beaches={nearbyBeaches}
          sourceBeachName={beach.name}
          sourceBeachLat={beach.lat}
          sourceBeachLon={beach.lon}
        />
      </div>

      <StickySignupBar
        source={ctaSource}
        ctaText={ctaConfig.ctaText}
        supportingText={ctaConfig.supportingText(beach.name)}
        searchReferralCta={
          pageType === "tides"
            ? {
                ctaText: "Get Tide Alerts",
                supportingText: `Know when the tide is right at ${beach.name}`,
              }
            : {
                ctaText: "Wetsuit Alert",
                supportingText: `Get gear recs for ${beach.name}`,
              }
        }
      />
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

    const meta = buildPageMetadata({
      title,
      description,
      path: subPagePath,
      image: `/api/og/beach?slug=${beachSlug}`,
    });
    return { ...meta, title: { absolute: title } };
  }

  const meta = buildPageMetadata({
    title: config.fallbackMetadata.title,
    description: config.fallbackMetadata.description,
    path: subPagePath,
  });
  return { ...meta, title: { absolute: config.fallbackMetadata.title } };
}
