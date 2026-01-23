import { BeachPageStructuredData } from "@/components/seo/structured-data";
import { BreadcrumbStructuredData } from "@/components/seo/breadcrumb-schema";
import { BeachDetailClient } from "@/app/beach/[slug]/beach-detail-client";
import { SpotSurfReportStream } from "@/components/spots/spot-surf-report";
import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo/meta";
import {
  buildBeachUrl,
  buildHiCityUrlForBeach,
  getUsStateRootPathOrNull,
  stateToSlug,
  cityToSlug,
  isValidStateSlug,
} from "@/lib/utils/beach-url-utils";
import { notFound } from "next/navigation";
import type { Beach } from "@/types/database";
import { getTimezoneFromCoords } from "@/lib/utils/timezone-utils.server";
import { FAQSchema } from "@/components/seo/faq-schema";
import { pickBestUsaBeachMatch } from "@/lib/utils/beach-matching-utils";
import { generateBeachFAQ } from "@/lib/utils/beach-faq-utils";

// Force dynamic rendering - this page accesses cookies via Supabase client
export const dynamic = "force-dynamic";

const baseUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "https://www.quiversurf.app";

interface PageProps {
  params: {
    intent: string; // This is actually a state slug for beach URLs (e.g., "or", "wa", "hi")
    city: string;
    beachSlug: string;
  };
}


function isNextRouterSignal(error: unknown) {
  if (!error || typeof error !== "object" || !("digest" in error)) return false;
  const digest = (error as { digest?: unknown }).digest;
  return (
    digest === "NEXT_NOT_FOUND" ||
    (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT"))
  );
}


/**
 * Generic Beach Detail Page for all states
 *
 * This route handles hierarchical beach URLs like:
 * - /ca/san-diego/ocean-beach (California beach)
 * - /or/newport/agate-beach (Oregon beach)
 * - /wa/westport/westport-jetty (Washington beach)
 * - /hi/haleiwa/pipeline (Hawaii beach)
 *
 * Intent-based URLs like /surf-forecast/newport use the parent [intent]/[city] route.
 *
 * The "intent" param is named for consistency with the parent route,
 * but in this 3-segment context it represents a state slug.
 */
export default async function GenericBeachDetailPage({ params }: PageProps) {
  const { intent: stateParam, city, beachSlug } = params;

  // Only handle requests where the first param is a valid state slug
  // This excludes intent slugs like "surf-forecast", "beginner", etc.
  if (!isValidStateSlug(stateParam)) {
    notFound();
  }

  try {
    // Fetch candidate beach rows by slug; disambiguate by state+city from URL
    const { getBeachesBySlug } = await import(
      "@/actions/beach/beach-query-actions"
    );
    const candidatesResult = await getBeachesBySlug(beachSlug);

    const beach = pickBestUsaBeachMatch({
      stateParam,
      cityParam: city,
      beaches: candidatesResult.success ? candidatesResult.data ?? [] : [],
    });

    if (!beach) notFound();

    const beachTimezone =
      beach.lat != null && beach.lon != null
        ? getTimezoneFromCoords(beach.lat, beach.lon)
        : null;

    // Validate that the beach's state matches the URL state parameter
    const expectedStateSlug = stateToSlug(beach.state);
    if (stateParam.toLowerCase() !== expectedStateSlug) {
      console.warn("[GenericBeachDetailPage] State slug mismatch:", {
        beachSlug,
        expectedState: expectedStateSlug,
        providedState: stateParam,
      });
      notFound();
    }

    // Check city match if beach has city data
    if (beach.city) {
      const expectedCitySlug = cityToSlug(beach.city);
      if (city !== expectedCitySlug) {
        console.warn("[GenericBeachDetailPage] City slug mismatch:", {
          beachSlug,
          expectedCity: expectedCitySlug,
          providedCity: city,
        });
        notFound();
      }
    } else {
      // Beach has no city data - this is an incomplete record
      console.warn("[GenericBeachDetailPage] Beach has no city data:", {
        beachSlug,
        beachName: beach.name,
      });
      notFound();
    }

    return (
      <>
        {/* Structured Data: Place/Beach */}
        <BeachPageStructuredData
          beachName={beach.name}
          description={`Surf conditions, tides, wind, swell and community intel for ${beach.name}.`}
          latitude={beach.lat || 0}
          longitude={beach.lon || 0}
          rating={(beach as any).average_rating || undefined}
          reviewCount={(beach as any).review_count || undefined}
          city={beach.city || undefined}
          state={beach.state || undefined}
          country={beach.country || undefined}
        />

        {/* Breadcrumb Structured Data for SEO */}
        <BreadcrumbStructuredData
          items={[
            { name: "Home", url: baseUrl },
            ...(() => {
              const statePath = getUsStateRootPathOrNull(beach.state);
              // Only emit US state-root URLs (e.g. "/ca"). Skip international states.
              if (!statePath) return [];

              return [
                {
                  name: beach.state || "State",
                  url: `${baseUrl}${statePath}`,
                },
              ];
            })(),
            {
              name: beach.city || "City",
              url: `${baseUrl}${buildHiCityUrlForBeach(beach)}`,
            },
            {
              name: beach.name,
              url: `${baseUrl}${buildBeachUrl(beach)}`,
            },
          ]}
        />

        {/* FAQ structured data for rich snippets */}
        <FAQSchema items={generateBeachFAQ(beach)} />

        {/* WebPage structured data with dateModified for freshness signal */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebPage",
              name: `${beach.name} Surf Report & Forecast`,
              dateModified: new Date().toISOString(),
            }),
          }}
        />

        {/* Above-the-fold surf report (streams via Suspense) */}
        <SpotSurfReportStream beach={beach} />

        {/* Client detail component with auth tracking */}
        <BeachDetailClient
          beach={beach}
          slug={beachSlug}
          beachTimezone={beachTimezone}
        />
      </>
    );
  } catch (error) {
    // Ensure Next.js router signals are not swallowed by this page-level try/catch.
    if (isNextRouterSignal(error)) throw error;

    console.error("[GenericBeachDetailPage] Error rendering beach page:", {
      params,
      // Avoid logging full error objects in case of sensitive details
      message: error instanceof Error ? error.message : "Unknown error",
    });
    notFound();
  }
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { intent: stateParam, beachSlug } = params;

  // Skip metadata generation for invalid state slugs (intent slugs)
  if (!isValidStateSlug(stateParam)) {
    return buildPageMetadata({
      title: "Page Not Found",
      description: "This page could not be found.",
      path: `/${stateParam}/${params.city}/${beachSlug}`,
    });
  }

  try {
    const { getBeachesBySlug } = await import(
      "@/actions/beach/beach-query-actions"
    );
    const candidatesResult = await getBeachesBySlug(beachSlug);
    const beach = pickBestUsaBeachMatch({
      stateParam,
      cityParam: params.city,
      beaches: candidatesResult.success ? candidatesResult.data ?? [] : [],
    });

    if (beach) {
      // Build location context for description
      const locationContext =
        beach.city && beach.state ? ` in ${beach.city}, ${beach.state}` : "";

      // Build path safely - use fallback if beach data is incomplete
      let path: string;
      try {
        path = buildBeachUrl(beach);
      } catch (urlError) {
        console.warn(
          "[GenericBeachDetailPage] Error building beach URL for metadata:",
          {
            beachSlug,
            error:
              urlError instanceof Error ? urlError.message : "Unknown error",
          }
        );
        path = `/beach/${beachSlug}`;
      }

      return buildPageMetadata({
        title: `${beach.name} Surf Report & Forecast (Updated Daily) | Quiver`,
        description: `Today's surf call, wave height, wind, tide, and best time window for ${beach.name}${locationContext} — plus nearby spots.`,
        path,
        keywords: [
          `${beach.name} surf report`,
          `${beach.name} surf forecast`,
          beach.city || "",
          beach.state || "",
          "surf report",
          "surf forecast",
          "surf conditions",
          "wave height",
          "tide",
          "wind",
        ].filter(Boolean),
      });
    }
  } catch (error) {
    console.error("[GenericBeachDetailPage] Error generating metadata:", {
      params,
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });
  }

  return buildPageMetadata({
    title: `Beach - Surf Forecast & Conditions`,
    description: `Conditions, intel, photos, and community tips for this beach.`,
    path: `/beach/${beachSlug}`,
  });
}

// NOTE: generateStaticParams removed - this page uses force-dynamic due to cookie access.
// Pages are rendered on-demand with ISR caching via Next.js defaults.
