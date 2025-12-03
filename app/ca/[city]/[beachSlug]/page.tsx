import { BeachDetail } from "@/components/beach-detail";
import { getBeachBySlug } from "@/actions/beach/beach-query-actions";
import type { Beach } from "@/types/database";
import { BeachPageStructuredData } from "@/components/seo/structured-data";
import { BreadcrumbStructuredData } from "@/components/seo/breadcrumb-schema";
import { BeachDetailClient } from "@/app/beach/[slug]/beach-detail-client";
import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo/meta";
import { buildBeachUrl, buildCityUrl, buildStateUrl, stateToSlug, cityToSlug } from "@/lib/utils/beach-url-utils";
import { notFound } from "next/navigation";

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://quiversurf.app";

interface PageProps {
  params: {
    city: string;
    beachSlug: string;
  };
}

export default async function BeachDetailPage({ params }: PageProps) {
  const { city, beachSlug } = params;

  try {
    // Fetch beach data by slug
    const result = await getBeachBySlug(beachSlug);

    if (!result.success || !result.data) {
      notFound();
    }

    const beach = result.data;

    // Validate that this is a California beach and city matches
    // Handle cases where beach data might be incomplete
    // Note: State can be stored as "CA" or "California" in the database
    const isCaliforniaBeach = beach.state === "CA" || beach.state === "California";
    if (!isCaliforniaBeach) {
      console.warn("[BeachDetailPage] Beach is not in California:", {
        beachSlug,
        state: beach.state,
      });
      notFound();
    }

    // Check city match if beach has city data
    if (beach.city) {
      const expectedCitySlug = cityToSlug(beach.city);
      if (city !== expectedCitySlug) {
        console.warn("[BeachDetailPage] City slug mismatch:", {
          beachSlug,
          expectedCity: expectedCitySlug,
          providedCity: city,
        });
        notFound();
      }
    } else {
      // Beach has no city data - this is an incomplete record
      console.warn("[BeachDetailPage] Beach has no city data:", {
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
              url: `${baseUrl}${buildStateUrl(beach.state)}`
            },
            {
              name: beach.city || "City",
              url: `${baseUrl}${buildCityUrl(beach.state, beach.city)}`
            },
            {
              name: beach.name,
              url: `${baseUrl}${buildBeachUrl(beach)}`
            },
          ]}
        />

        {/* Client detail component with auth tracking */}
        <BeachDetailClient beach={beach} slug={beachSlug} />
      </>
    );
  } catch (error) {
    console.error("[BeachDetailPage] Error rendering CA beach page:", {
      params,
      // Avoid logging full error objects in case of sensitive details
      message: error instanceof Error ? error.message : "Unknown error",
    });
    notFound();
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { beachSlug } = params;

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
        console.warn("[BeachDetailPage] Error building beach URL for metadata:", {
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
    console.error("[BeachDetailPage] Error generating metadata:", {
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

// Generate static params for all California beaches at build time
export async function generateStaticParams() {
  try {
    // Fetch all beaches with their location data
    const response = await fetch(`${baseUrl}/api/beaches`, {
      next: { revalidate: 86400 }, // Revalidate daily
      cache: 'no-store',
    });

    if (!response.ok) {
      console.warn("Failed to fetch beaches for generateStaticParams, returning empty array");
      return [];
    }

    const json = await response.json();
    // Handle both wrapped response format (json.data.beaches) and direct format (json.beaches)
    const beaches: Array<{ slug: string | null; city: string | null; state: string | null }> =
      json?.data?.beaches || json?.beaches || [];

    // Generate params for California beaches only (accept both "CA" and "California")
    const caBeaches = beaches
      .filter((b) => b.slug && b.city && (b.state === "CA" || b.state === "California"))
      .map((beach) => ({
        city: cityToSlug(beach.city),
        beachSlug: beach.slug!,
      }));

    console.log(`Generated ${caBeaches.length} California beach pages`);
    return caBeaches;
  } catch (error) {
    console.warn("Error generating static params for CA beach pages (likely build-time fetch):", error instanceof Error ? error.message : "Unknown error");
    // Return empty array during build - pages will be generated on-demand
    return [];
  }
}
