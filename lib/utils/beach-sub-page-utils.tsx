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
import Link from "next/link";

import { BeachDetailClient } from "@/app/beach/[slug]/beach-detail-client";
import { BeachSubPageCtaSwitch } from "@/components/app-store/beach-subpage-cta-switch";
import { TideSummaryHero } from "@/components/beach-detail/tide-summary-hero";
import { WaterTempSummaryHero } from "@/components/beach-detail/water-temp-summary-hero";
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
import { isBeachSubPageInstallCtaEnabled } from "@/lib/flags/beach-subpage-install-cta";
import {
  buildBeachSubPageCrawlCopy,
  type BeachSubPageCrawlCopy,
} from "@/lib/utils/beach-sub-page-crawl-copy";
import { cityToSlug, regionToSlug } from "@/lib/utils/beach-url-utils";
import { slugifyAscii } from "@/lib/utils/text-utils";
import { applyIndexabilityToMetadata } from "@/lib/seo/indexability";
import {
  isBeachSubPageIndexable,
} from "@/lib/seo/forecast-indexability";
import { getCachedForecastIndexabilitySnapshots } from "@/lib/seo/forecast-indexability-cache";

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
  sourcePrefix: string;
}> = {
  tides: {
    ctaText: "Get Alerts",
    supportingText: (beachName) => `Tide alerts for ${beachName}`,
    sourcePrefix: "tides",
  },
  "water-temp": {
    ctaText: "Get Alerts",
    supportingText: (beachName) => `Water temp alerts for ${beachName}`,
    sourcePrefix: "water-temp",
  },
};

interface RenderParams {
  beachSlug: string;
  pageType: SubPageType;
  /** Full path to the beach (e.g., "/ca/san-diego/ocean-beach") */
  beachPath: string;
  /** Required for Mexico routes so malformed region/city pairs 404. */
  expectedMexicoLocation?: {
    region: string;
    city: string;
  };
}

function matchesExpectedMexicoLocation(
  beach: Beach,
  expectedLocation: RenderParams["expectedMexicoLocation"],
): boolean {
  if (!expectedLocation) return true;

  return (
    slugifyAscii(beach.country ?? "") === "mexico" &&
    regionToSlug(beach.state) === expectedLocation.region &&
    cityToSlug(beach.city) === expectedLocation.city
  );
}

/**
 * Renders a beach sub-page (tides or water-temp) with consistent structure.
 * Use in page components to eliminate duplication.
 */
export async function renderBeachSubPage({
  beachSlug,
  pageType,
  beachPath,
  expectedMexicoLocation,
}: RenderParams) {
  const beach = await getBeachBySlugOrId(beachSlug);

  if (!beach) {
    notFound();
  }

  if (!matchesExpectedMexicoLocation(beach, expectedMexicoLocation)) {
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
  const installCtaEnabled = isBeachSubPageInstallCtaEnabled();

  // Fetch dataset schema data — uses React cache() so no extra DB queries when
  // generateBeachSubPageMetadata already called these.
  const [tideMeta, waterTempMeta] = await Promise.all([
    pageType === "tides" ? getTideMetaData(beach.id) : Promise.resolve(null),
    pageType === "water-temp" ? getWaterTempMetaData(beach.id) : Promise.resolve(null),
  ]);

  const hasTideHero = pageType === "tides" &&
    Boolean(tideMeta?.nextHighTime || tideMeta?.nextLowTime);
  const hasWaterTempSummary = pageType === "water-temp" &&
    waterTempMeta?.tempF != null;
  // One real figure from data this render already has (React-cached, no extra
  // queries). A number the visitor can check beats a list of claims - but only
  // when it is genuinely available, so this stays null rather than inventing one.
  const installCtaProof =
    pageType === "water-temp" && waterTempMeta?.tempF != null
      ? { value: `${Math.round(waterTempMeta.tempF)}°F`, label: "Water temp now" }
      : pageType === "tides" && tideMeta?.nextHighHeight != null
        ? {
            value: `${tideMeta.nextHighHeight.toFixed(1)} ft`,
            // Carry the time: without it this is a strictly worse duplicate of
            // the tide line further up the page, and a bare "ft" on a surf site
            // reads as swell rather than tide.
            label: tideMeta.nextHighTime
              ? `Next high · ${tideMeta.nextHighTime}`
              : "Next high tide",
          }
        : null;

  const crawlCopy = buildBeachSubPageCrawlCopy({
    beach,
    pageType,
    beachPath,
  });

  return (
    <>
      <BeachPageStructuredData
        beachName={beach.name}
        description={config.structuredDataDescription(beach.name)}
        latitude={beach.lat || 0}
        longitude={beach.lon || 0}
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

      {hasTideHero && tideMeta && (
        <TideSummaryHero beachName={beach.name} tideData={tideMeta} />
      )}
      {!hasTideHero && !hasWaterTempSummary && (
        <BeachSubPageCrawlIntro copy={crawlCopy} />
      )}

      <BeachDetailClient
        beach={beach}
        slug={beachSlug}
        beachTimezone={beachTimezone}
        defaultTab={config.defaultTab}
        defaultSubTab={config.defaultSubTab}
        heroHeadingLevel={hasWaterTempSummary ? "h1" : "h2"}
        heroHeadingSuffix={
          hasWaterTempSummary ? "Water Temp & Wetsuit Guide" : undefined
        }
        heroSummarySlot={
          hasWaterTempSummary && waterTempMeta ? (
            <WaterTempSummaryHero
              beachName={beach.name}
              seasonalTrendsHref={`/water-temp/${cityToSlug(beach.city)}#seasonal-trends`}
              seasonalTrendsLocation={beach.city || "the area"}
              waterTempData={waterTempMeta}
            />
          ) : undefined
        }
      />

      <BeachSubPageCtaSwitch
        beachName={beach.name}
        installCtaEnabled={installCtaEnabled}
        placement={`${pageType}-${beachSlug}`}
        pathname={subPagePath}
        proof={installCtaProof ?? undefined}
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
        source={ctaSource}
        stickyCtaText={ctaConfig.ctaText}
        stickySupportingText={ctaConfig.supportingText(beach.name)}
      />
    </>
  );
}

function BeachSubPageCrawlIntro({ copy }: { copy: BeachSubPageCrawlCopy }) {
  return (
    <section
      className="noise-texture w-full"
      style={{
        background:
          "linear-gradient(180deg, #1E2558 0%, #252D6B 60%, rgba(37,45,107,0) 100%)",
        borderBottom: "1px solid rgba(64, 76, 146, 0.4)",
      }}
    >
      <div className="container mx-auto px-4 py-6 sm:py-8">
        <h1 className="font-heading text-2xl font-bold leading-tight text-high sm:text-3xl">
          {copy.heading}
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-medium sm:text-base">
          {copy.summary}
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {copy.links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="group rounded-lg border border-white/10 bg-white/5 p-4 transition-colors hover:border-sky-500/50 hover:bg-white/10"
            >
              <span className="text-sm font-semibold text-white/90 group-hover:text-white">
                {link.label}
              </span>
              <p className="mt-1 text-xs leading-5 text-white/55">
                {link.description}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </section>
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
  expectedMexicoLocation,
}: RenderParams): Promise<Metadata> {
  const beach = await getBeachBySlugOrId(beachSlug);
  const config = SUB_PAGE_CONFIGS[pageType];
  const subPagePath = `${beachPath}/${pageType}`;

  if (beach) {
    if (!matchesExpectedMexicoLocation(beach, expectedMexicoLocation)) {
      notFound();
    }

    // Fetch dynamic data for SEO based on page type
    let title: string;
    let description: string;
    let tideMetaForIndexing: Awaited<ReturnType<typeof getTideMetaData>> | null = null;
    let tempMetaForIndexing: Awaited<ReturnType<typeof getWaterTempMetaData>> | null = null;

    try {
      if (pageType === "tides") {
        tideMetaForIndexing = await getTideMetaData(beach.id);
        const result = buildDynamicTideMetadata({
          beach,
          tideData: {
            nextHighTime: tideMetaForIndexing.nextHighTime,
            nextLowTime: tideMetaForIndexing.nextLowTime,
            nextHighHeight: tideMetaForIndexing.nextHighHeight,
            nextLowHeight: tideMetaForIndexing.nextLowHeight,
          },
        });
        title = result.title;
        description = result.description;
      } else {
        tempMetaForIndexing = await getWaterTempMetaData(beach.id);
        const result = buildDynamicWaterTempMetadata({
          beach,
          waterTempData: {
            tempF: tempMetaForIndexing.tempF,
            wetsuitRec: tempMetaForIndexing.wetsuitRec,
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
    const metadata = { ...meta, title: { absolute: title } };
    const snapshots = await getCachedForecastIndexabilitySnapshots([
      { id: beach.id, timezone: beach.timezone ?? null },
    ]);
    const hasSubPageData =
      pageType === "tides"
        ? Boolean(
            tideMetaForIndexing?.nextHighTime ||
              tideMetaForIndexing?.nextLowTime,
          )
        : tempMetaForIndexing?.tempF != null;
    const indexable = isBeachSubPageIndexable(
      snapshots.get(beach.id),
      subPagePath,
      { hasSubPageData },
    );
    return applyIndexabilityToMetadata(metadata, {
      indexable,
      reason: indexable ? "forecast-approved" : "forecast-missing",
    });
  }

  const meta = buildPageMetadata({
    title: config.fallbackMetadata.title,
    description: config.fallbackMetadata.description,
    path: subPagePath,
  });
  return {
    ...meta,
    title: { absolute: config.fallbackMetadata.title },
    robots: {
      index: false,
      follow: false,
      googleBot: { index: false, follow: false },
    },
  };
}
