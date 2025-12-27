import { getBeachBySlug } from "@/actions/beach/beach-query-actions";
import { BeachPageStructuredData } from "@/components/seo/structured-data";
import { BreadcrumbStructuredData } from "@/components/seo/breadcrumb-schema";
import { BeachDetailClient } from "@/app/beach/[slug]/beach-detail-client";
import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo/meta";
import {
  buildBeachUrl,
  buildInternationalBeachUrl,
  buildInternationalCityUrl,
  cityToSlug,
  countryToSlug,
  isValidStateSlug,
  regionToSlug,
} from "@/lib/utils/beach-url-utils";
import { notFound } from "next/navigation";

// Force dynamic rendering - this page accesses cookies via Supabase client
export const dynamic = "force-dynamic";

const baseUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "https://www.quiversurf.app";

interface PageProps {
  params: {
    intent: string; // In this 4-segment context, this represents a country slug (e.g., "mexico")
    city: string; // In this 4-segment context, this represents a region/state slug (e.g., "baja-california")
    beachSlug: string; // In this 4-segment context, this represents a city slug (e.g., "rosarito")
    intlBeachSlug: string; // Actual beach slug (e.g., "teresas")
  };
}

/**
 * International Beach Detail Page (4 segments)
 *
 * Canonical URL format:
 * - /{country}/{regionState}/{city}/{beachSlug}
 *
 * Examples:
 * - /mexico/baja-california/rosarito/teresas
 *
 * NOTE: This is implemented under the existing [intent] route tree to avoid
 * Next.js root dynamic segment conflicts.
 */
export default async function InternationalBeachDetailPage({
  params,
}: PageProps) {
  const {
    intent: countryParam,
    city: regionParam,
    beachSlug: cityParam,
    intlBeachSlug,
  } = params;

  // Prevent accidental matches like /ca/san-diego/ocean-beach/extra
  if (isValidStateSlug(countryParam)) notFound();

  try {
    const result = await getBeachBySlug(intlBeachSlug);
    if (!result.success || !result.data) notFound();

    const beach = result.data;

    const expectedCountrySlug = countryToSlug(beach.country);
    const expectedRegionSlug = regionToSlug(beach.state);
    const expectedCitySlug = cityToSlug(beach.city);

    if (
      !expectedCountrySlug ||
      !expectedRegionSlug ||
      !expectedCitySlug ||
      countryParam.toLowerCase() !== expectedCountrySlug ||
      regionParam.toLowerCase() !== expectedRegionSlug ||
      cityParam.toLowerCase() !== expectedCitySlug
    ) {
      console.warn("[InternationalBeachDetailPage] Slug mismatch:", {
        intlBeachSlug,
        expected: {
          country: expectedCountrySlug,
          state: expectedRegionSlug,
          city: expectedCitySlug,
        },
        provided: {
          country: countryParam,
          state: regionParam,
          city: cityParam,
        },
      });
      notFound();
    }

    const cityUrl = buildInternationalCityUrl(
      beach.country,
      beach.state,
      beach.city
    );
    const beachUrl =
      buildInternationalBeachUrl(
        beach.country,
        beach.state,
        beach.city,
        beach.slug
      ) || buildBeachUrl(beach);

    return (
      <>
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

        <BreadcrumbStructuredData
          items={[
            { name: "Home", url: baseUrl },
            {
              name:
                beach.city && beach.state
                  ? `${beach.city}, ${beach.state}`
                  : "Location",
              url: `${baseUrl}${cityUrl}`,
            },
            { name: beach.name, url: `${baseUrl}${beachUrl}` },
          ]}
        />

        <BeachDetailClient beach={beach} slug={intlBeachSlug} />
      </>
    );
  } catch (error) {
    console.error(
      "[InternationalBeachDetailPage] Error rendering beach page:",
      {
        params,
        message: error instanceof Error ? error.message : "Unknown error",
      }
    );
    notFound();
  }
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { intlBeachSlug } = params;

  // Skip metadata generation for any state-slug first segment (not international)
  if (isValidStateSlug(params.intent)) {
    return buildPageMetadata({
      title: "Page Not Found",
      description: "This page could not be found.",
      path: `/${params.intent}/${params.city}/${params.beachSlug}/${intlBeachSlug}`,
    });
  }

  try {
    const result = await getBeachBySlug(intlBeachSlug);
    if (result.success && result.data) {
      const beach = result.data;

      const reviewCount = beach.review_count ?? 0;
      const reviewText =
        reviewCount === 1 ? "1 Review" : `${reviewCount} Reviews`;

      const locationContext =
        beach.city && beach.state ? ` in ${beach.city}, ${beach.state}` : "";

      const path = buildInternationalBeachUrl(
        beach.country,
        beach.state,
        beach.city,
        beach.slug
      );

      return buildPageMetadata({
        title: `${beach.name}${locationContext} - ${reviewText}, Map & Forecast`,
        description: `Today's surf summary, tides, wind, swell, cams, and community intel for ${beach.name}${locationContext}.`,
        path: path || `/beach/${intlBeachSlug}`,
        keywords: [
          beach.name,
          beach.city || "",
          beach.state || "",
          beach.country || "",
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
    console.error("[InternationalBeachDetailPage] Error generating metadata:", {
      params,
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });
  }

  return buildPageMetadata({
    title: `Beach - Surf Forecast & Conditions`,
    description: `Conditions, intel, photos, and community tips for this beach.`,
    path: `/beach/${intlBeachSlug}`,
  });
}





