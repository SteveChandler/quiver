import { BeachPageStructuredData } from "@/components/seo/structured-data";
import { BreadcrumbStructuredData } from "@/components/seo/breadcrumb-schema";
import { BeachDetailClient } from "@/app/beach/[slug]/beach-detail-client";
import { NearbyBeachesEnriched } from "@/components/beach-detail/nearby-spots-enriched";
import { enrichBeachesWithConditions } from "@/lib/utils/nearby-beach-enrichment";
import { RelatedGuidesSection } from "@/components/beach-detail/related-guides-section";

import { FAQSchema } from "@/components/seo/faq-schema";
import { generateBeachFAQ } from "@/lib/utils/beach-faq-utils";
import type { Metadata } from "next";
import { buildPageMetadata, formatMetaDate } from "@/lib/seo/meta";
import { notFound } from "next/navigation";
import { getTimezoneFromCoords } from "@/lib/utils/timezone-utils.server";
import { getBeachBySlugOrId } from "@/lib/utils/beach-lookup-utils";
import { getSpotSurfReportPublic } from "@/lib/services/spot-surf-report-service";
import { regionToSlug, cityToSlug } from "@/lib/utils/beach-url-utils";
import { getNearbyBeaches } from "@/actions/beach/beach-location-actions";
import type { Beach } from "@/types/database";
import { WebPageSchema } from "@/components/seo/web-page-schema";
import { isFreeGrowthPhaseEnabled } from "@/lib/flags/free-growth-phase";
import { BeachProseSummary } from "@/components/beach-detail/beach-prose-summary";
import {
  applyIndexabilityToMetadata,
  evaluateBeachIndexability,
  parseEditorialSources,
  toBeachEditorialInput,
  type BeachEditorialDatabaseRecord,
} from "@/lib/seo/indexability";

const baseUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "https://www.quiversurf.app";

// Personalization happens client-side; the server render stays cookie-free so
// Vercel can cache public Mexico beach pages between explicit hold invalidations.
export const dynamic = "force-static";
export const revalidate = 3600;

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

    // Fetch surf report and nearby beaches in parallel
    const [surfReportResult, nearbyResult] = await Promise.all([
      getSpotSurfReportPublic(beach),
      beach.lat && beach.lon
        ? getNearbyBeaches(beach.lat, beach.lon, 25)
        : Promise.resolve(null),
    ]);

    const surfCallReport = surfReportResult?.report || null;
    const surfCallIsTomorrow = surfReportResult?.isTomorrow ?? false;

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
        <FAQSchema items={generateBeachFAQ(beach)} />

        {/* WebPage structured data with dateModified for freshness signal */}
        <WebPageSchema
          name={`${beach.name} Surf Report & Forecast`}
          url={`${baseUrl}${beachPath}`}
        />

        <BeachProseSummary
          beach={beach}
          surfCallReport={surfCallReport}
          editorialSources={parseEditorialSources(
            (beach as BeachEditorialDatabaseRecord).editorial_sources,
          )}
        />

        {/* Client detail component with auth tracking */}
        <BeachDetailClient
          beach={beach}
          slug={params.beachSlug}
          beachTimezone={beachTimezone}
          surfCallReport={surfCallReport}
          surfCallIsTomorrow={surfCallIsTomorrow}
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

    const metadata = buildPageMetadata({
      title: `${beach.name} Surf Report & Forecast (Updated Daily)`,
      description: `${beach.name} surf report for ${formatMetaDate()}. Wave height, swell, wind, and tide conditions${locationContext}.`,
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
    const decision = evaluateBeachIndexability(
      toBeachEditorialInput(beach as BeachEditorialDatabaseRecord),
      canonicalPath,
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
