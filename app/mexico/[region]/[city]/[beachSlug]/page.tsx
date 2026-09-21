import { BeachPageStructuredData } from "@/components/seo/structured-data";
import { BreadcrumbStructuredData } from "@/components/seo/breadcrumb-schema";
import { BeachDetailClient } from "@/app/beach/[slug]/beach-detail-client";
import { NearbyBeachesEnriched } from "@/components/beach-detail/nearby-spots-enriched";
import { enrichBeachesWithConditions } from "@/lib/utils/nearby-beach-enrichment";
import { RelatedGuidesSection } from "@/components/beach-detail/related-guides-section";

import { FAQSchema } from "@/components/seo/faq-schema";
import { generateBeachFAQ } from "@/lib/utils/beach-faq-utils";
import type { Metadata } from "next";
import { buildDynamicBeachMetadata, buildPageMetadata, formatMetaDate } from "@/lib/seo/meta";
import { notFound } from "next/navigation";
import { getTimezoneFromCoords } from "@/lib/utils/timezone-utils.server";
import { getBeachBySlugOrId } from "@/lib/utils/beach-lookup-utils";
import { getSpotSurfReportPublic } from "@/lib/services/spot-surf-report-service";
import { getSpotFeaturedPhoto } from "@/actions/spot/spot-data-actions";
import { buildBeachUrl, regionToSlug, cityToSlug } from "@/lib/utils/beach-url-utils";
import { getNearbyBeaches } from "@/actions/beach/beach-location-actions";
import type { Beach } from "@/types/database";
import { WebPageSchema } from "@/components/seo/web-page-schema";
import { isFreeGrowthPhaseEnabled } from "@/lib/flags/free-growth-phase";
import { BeachProseSummary } from "@/components/beach-detail/beach-prose-summary";
import {
  applyIndexabilityToMetadata,
  parseEditorialSources,
  type BeachEditorialDatabaseRecord,
} from "@/lib/seo/indexability";
import { evaluateBeachPageIndexability } from "@/lib/seo/forecast-indexability";
import { getCachedForecastIndexabilitySnapshots } from "@/lib/seo/forecast-indexability-cache";
import { sanitizeBeachEditorialContent } from "@/lib/seo/editorial-integrity";

const baseUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "https://www.quiversurf.app";

// Forecast revisions and selected windows must reflect this request.
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ region: string; city: string; beachSlug: string }>;
}

/**
 * Check if an error is a Next.js router signal (notFound, redirect)
 * These should be re-thrown, not caught by error handlers.
 */
function isNextRouterSignal(error: unknown) {
  if (!error || typeof error !== "object" || !("digest" in error)) return false;
  const digest = (error as { digest?: unknown }).digest;
  return (
    digest === "NEXT_NOT_FOUND" ||
    (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT"))
  );
}

/**
 * Mexico Beach Detail Page
 *
 * Handles hierarchical beach URLs for Mexico/Baja beaches like:
 * - /mexico/baja-california/rosarito/k-38
 * - /mexico/baja-california/ensenada/san-miguel
 *
 * The redirect from /beach/[slug] builds these URLs for Mexico beaches,
 * so this page must exist to handle them.
 */
export default async function MexicoBeachDetailPage(props: PageProps) {
  const params = await props.params;

  try {
    const beach = await getBeachBySlugOrId(params.beachSlug);

    if (!beach) {
      notFound();
    }

    // Validate URL parameters match beach data to prevent duplicate content issues
    const expectedRegion = regionToSlug(beach.state);
    const expectedCity = cityToSlug(beach.city);

    if (params.region !== expectedRegion) {
      console.warn("[MexicoBeachDetailPage] Region slug mismatch:", {
        beachSlug: params.beachSlug,
        expectedRegion,
        providedRegion: params.region,
      });
      notFound();
    }

    if (params.city !== expectedCity) {
      console.warn("[MexicoBeachDetailPage] City slug mismatch:", {
        beachSlug: params.beachSlug,
        expectedCity,
        providedCity: params.city,
      });
      notFound();
    }

    const beachTimezone =
      beach.lat != null && beach.lon != null
        ? getTimezoneFromCoords(beach.lat, beach.lon)
        : null;

    // Fetch surf report, featured photo, and nearby beaches in parallel
    const [surfReportResult, beachPhoto, nearbyResult] = await Promise.all([
      getSpotSurfReportPublic(beach),
      getSpotFeaturedPhoto(beach.id).then((photo) =>
        photo
          ? {
              image_url: photo.thumbUrl ?? photo.imageUrl,
              thumb_url: photo.thumbUrl,
              source: photo.source,
              creator_name: photo.creatorName,
              license_code: null,
              attribution_html: photo.attributionHtml,
              attribution: photo.attribution,
            }
          : null,
      ),
      beach.lat && beach.lon
        ? getNearbyBeaches(beach.lat, beach.lon, 25)
        : Promise.resolve(null),
    ]);

    const surfCallReport = surfReportResult?.report || null;
    const surfCallIsTomorrow = surfReportResult?.isTomorrow ?? false;
    const publicBeach = sanitizeBeachEditorialContent(beach);

    let nearbyBeachesRaw: Beach[] = [];
    if (nearbyResult?.success && nearbyResult.data) {
      nearbyBeachesRaw = nearbyResult.data
        .filter((b) => b.id !== beach.id && b.slug !== beach.slug)
        .slice(0, 4);
    }

    // Enrich nearby beaches with live conditions and photos
    const nearbyBeaches = await enrichBeachesWithConditions(nearbyBeachesRaw);

    const beachPath = `/mexico/${params.region}/${params.city}/${params.beachSlug}`;

    // Build Mexico-specific breadcrumbs
    const regionDisplay = beach.state || formatRegionDisplay(params.region);
    const cityDisplay = beach.city || formatCityDisplay(params.city);

    return (
      <>
        {/* Structured Data: Place/Beach */}
        <BeachPageStructuredData
          beachName={beach.name}
          description={`Surf conditions, tides, wind, swell and community intel for ${beach.name}.`}
          latitude={beach.lat || 0}
          longitude={beach.lon || 0}
          city={beach.city || undefined}
          state={beach.state || undefined}
          country={beach.country || undefined}
        />

        {/* Breadcrumb Structured Data for SEO */}
        <BreadcrumbStructuredData
          items={[
            { name: "Home", url: baseUrl },
            { name: "Mexico", url: `${baseUrl}/beaches/mexico` },
            {
              name: regionDisplay,
              url: `${baseUrl}/beaches/mexico/${params.region}`,
            },
            {
              name: cityDisplay,
              url: `${baseUrl}/mexico/${params.region}/${params.city}`,
            },
            {
              name: beach.name,
              url: `${baseUrl}${beachPath}`,
            },
          ]}
        />

        {/* FAQ structured data for rich snippets */}
        <FAQSchema items={generateBeachFAQ(publicBeach)} />

        {/* WebPage structured data with dateModified for freshness signal */}
        <WebPageSchema
          name={`${beach.name} Surf Report & Forecast`}
          url={`${baseUrl}${beachPath}`}
        />

        <BeachProseSummary
          beach={publicBeach}
          surfCallReport={surfCallReport}
          editorialSources={parseEditorialSources(
            (beach as BeachEditorialDatabaseRecord).editorial_sources,
          )}
        />

        {/* Client detail component with auth tracking */}
        <BeachDetailClient
          beach={publicBeach}
          slug={params.beachSlug}
          beachTimezone={beachTimezone}
          surfCallReport={surfCallReport}
          surfCallIsTomorrow={surfCallIsTomorrow}
          beachPhoto={beachPhoto}
          freeGrowthPhaseEnabled={isFreeGrowthPhaseEnabled()}
        />

        {/* SSR sections below tabs for SEO crawlability */}
        <div className="container mx-auto px-4 pb-8 space-y-8">
          <NearbyBeachesEnriched
              beaches={nearbyBeaches}
              sourceBeachName={beach.name}
              sourceBeachLat={beach.lat}
              sourceBeachLon={beach.lon}
            />
          <RelatedGuidesSection beach={beach} />
        </div>
      </>
    );
  } catch (error) {
    // Ensure Next.js router signals are not swallowed by this page-level try/catch.
    if (isNextRouterSignal(error)) throw error;

    console.error("[MexicoBeachDetailPage] Error rendering beach page:", {
      params,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    notFound();
  }
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const params = await props.params;
  const beach = await getBeachBySlugOrId(params.beachSlug);

  if (beach) {
    const locationContext =
      beach.city && beach.state ? ` in ${beach.city}, ${beach.state}` : "";
    const generatedTitle = buildDynamicBeachMetadata({ beach, forecast: null }).title;
    const title = beach.seo_title?.trim() || generatedTitle;
    const description =
      beach.seo_description?.trim() ||
      `${beach.name} surf report for ${formatMetaDate()}. Wave height, swell, wind, and tide conditions${locationContext}.`;

    const metadata = buildPageMetadata({
      title,
      description,
      path: `/mexico/${params.region}/${params.city}/${params.beachSlug}`,
      image: `/api/og/beach?slug=${params.beachSlug}`,
      keywords: [
        `${beach.name} surf report`,
        `${beach.name} surf forecast`,
        beach.city || "",
        beach.state || "",
        "Mexico",
        "Baja",
        "surf report",
        "surf forecast",
        "surf conditions",
        "wave height",
        "tide",
        "wind",
      ].filter(Boolean),
    });

    const canonicalPath =
      `/mexico/${params.region}/${params.city}/${params.beachSlug}`;
    const snapshots = await getCachedForecastIndexabilitySnapshots([
      { id: beach.id, timezone: beach.timezone ?? null },
    ]);
    const decision = evaluateBeachPageIndexability(
      snapshots.get(beach.id),
      canonicalPath === buildBeachUrl(beach) && !canonicalPath.startsWith("/beach/"),
    );
    return applyIndexabilityToMetadata(metadata, decision);
  }

  const metadata = buildPageMetadata({
    title: `Beach - Surf Forecast & Conditions`,
    description: `Conditions, intel, photos, and community tips for this beach.`,
    path: `/mexico/${params.region}/${params.city}/${params.beachSlug}`,
  });
  return {
    ...metadata,
    robots: {
      index: false,
      follow: false,
      googleBot: { index: false, follow: false },
    },
  };
}

/**
 * Format region slug to display name
 * e.g., "baja-california" -> "Baja California"
 */
function formatRegionDisplay(region: string): string {
  return region
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Format city slug to display name
 * e.g., "rosarito" -> "Rosarito"
 */
function formatCityDisplay(city: string): string {
  return city
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
