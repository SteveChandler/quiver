import { getBeachBySlug } from "@/actions/beach/beach-query-actions";
import { BeachPageStructuredData } from "@/components/seo/structured-data";
import { BreadcrumbStructuredData } from "@/components/seo/breadcrumb-schema";
import { BeachDetailClient } from "@/app/beach/[slug]/beach-detail-client";
import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo/meta";
import {
  buildBeachUrl,
  buildCityUrl,
  buildStateUrl,
  stateToSlug,
  cityToSlug,
  isValidStateSlug,
} from "@/lib/utils/beach-url-utils";
import { notFound } from "next/navigation";

// Force dynamic rendering - this page accesses cookies via Supabase client
export const dynamic = 'force-dynamic';

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://quiversurf.app";

interface PageProps {
  params: {
    intent: string; // This is actually a state slug for beach URLs (e.g., "or", "wa", "hi")
    city: string;
    beachSlug: string;
  };
}

/**
 * Generic Beach Detail Page for non-California states
 * 
 * This route handles URLs like:
 * - /or/newport/agate-beach (Oregon beach)
 * - /wa/westport/westport-jetty (Washington beach)
 * - /hi/haleiwa/pipeline (Hawaii beach)
 * 
 * California beaches use the more specific /ca/[city]/[beachSlug] route.
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
    // Fetch beach data by slug
    const result = await getBeachBySlug(beachSlug);

    if (!result.success || !result.data) {
      notFound();
    }

    const beach = result.data;

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
            {
              name: beach.state || "State",
              url: `${baseUrl}${buildStateUrl(beach.state)}`,
            },
            {
              name: beach.city || "City",
              url: `${baseUrl}${buildCityUrl(beach.state, beach.city)}`,
            },
            {
              name: beach.name,
              url: `${baseUrl}${buildBeachUrl(beach)}`,
            },
          ]}
        />

        {/* Client detail component with auth tracking */}
        <BeachDetailClient beach={beach} slug={beachSlug} />
      </>
    );
  } catch (error) {
    console.error("[GenericBeachDetailPage] Error rendering beach page:", {
      params,
      // Avoid logging full error objects in case of sensitive details
      message: error instanceof Error ? error.message : "Unknown error",
    });
    notFound();
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
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
    // Try to resolve beach by slug
    const result = await getBeachBySlug(beachSlug);

    if (result.success && result.data) {
      const beach = result.data;

      // Format review count for title
      const reviewCount = beach.review_count ?? 0;
      const reviewText =
        reviewCount === 1 ? "1 Review" : `${reviewCount} Reviews`;

      // Build location context for title
      const locationContext =
        beach.city && beach.state ? ` in ${beach.city}, ${beach.state}` : "";

      // Build path safely - use fallback if beach data is incomplete
      let path: string;
      try {
        path = buildBeachUrl(beach);
      } catch (urlError) {
        console.warn("[GenericBeachDetailPage] Error building beach URL for metadata:", {
          beachSlug,
          error: urlError instanceof Error ? urlError.message : "Unknown error",
        });
        path = `/beach/${beachSlug}`;
      }

      return buildPageMetadata({
        title: `${beach.name}${locationContext} - ${reviewText}, Map & Forecast`,
        description: `Today's surf summary, tides, wind, swell, cams, and community intel for ${beach.name}${locationContext}.`,
        path,
        keywords: [
          beach.name,
          beach.city || "",
          beach.state || "",
          "surf forecast",
          "surf conditions",
          "surf report",
          "beach",
          "waves",
          "swell",
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

// Generate static params for beaches at build time
// This covers all states that have beaches with complete location data (excluding CA)
export async function generateStaticParams() {
  try {
    // Fetch all beaches with their location data
    const response = await fetch(`${baseUrl}/api/beaches`, {
      next: { revalidate: 86400 }, // Revalidate daily
      cache: "no-store",
    });

    if (!response.ok) {
      console.warn(
        "Failed to fetch beaches for generateStaticParams, returning empty array"
      );
      return [];
    }

    const json = await response.json();
    // Handle both wrapped response format (json.data.beaches) and direct format (json.beaches)
    const beaches: Array<{
      slug: string | null;
      city: string | null;
      state: string | null;
    }> = json?.data?.beaches || json?.beaches || [];

    // Generate params for all beaches with complete location data
    // Exclude California beaches as they're handled by the more specific /ca/ route
    const nonCaBeaches = beaches
      .filter((b) => {
        if (!b.slug || !b.city || !b.state) return false;
        // Exclude California beaches - they use the /ca/ route
        const stateSlug = stateToSlug(b.state);
        return stateSlug !== "ca";
      })
      .map((beach) => ({
        intent: stateToSlug(beach.state), // Named 'intent' for route param consistency
        city: cityToSlug(beach.city),
        beachSlug: beach.slug!,
      }));

    console.log(`Generated ${nonCaBeaches.length} non-CA beach pages for generic state route`);
    return nonCaBeaches;
  } catch (error) {
    console.warn(
      "Error generating static params for generic beach pages (likely build-time fetch):",
      error instanceof Error ? error.message : "Unknown error"
    );
    // Return empty array during build - pages will be generated on-demand
    return [];
  }
}

