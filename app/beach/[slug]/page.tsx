import {
  getBeachById,
  getBeachesBySlug,
} from "@/actions/beach/beach-query-actions";
import type { Beach } from "@/types/database";
import { BeachPageStructuredData } from "@/components/seo/structured-data";
import { BreadcrumbStructuredData } from "@/components/seo/breadcrumb-schema";
import { BeachDetailClient } from "./beach-detail-client";
import type { Metadata } from "next";
import { buildPageMetadata } from "@/lib/seo/meta";
import { notFound, redirect } from "next/navigation";
import { buildBeachUrl } from "@/lib/utils/beach-url-utils";
import { getTimezoneFromCoords } from "@/lib/utils/timezone-utils.server";
import { cache } from "react";

const baseUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "https://www.quiversurf.app";

/**
 * Selects the best beach candidate from a list using deterministic sorting.
 * Prefers: coordinates > review_count > created_at > id
 */
function selectBestCandidate(candidates: Beach[]): Beach | null {
  if (candidates.length === 0) return null;
  return [...candidates].sort((a, b) => {
    const aHasCoords = Number(Boolean(a.lat && a.lon));
    const bHasCoords = Number(Boolean(b.lat && b.lon));
    if (aHasCoords !== bHasCoords) return bHasCoords - aHasCoords;

    const aReviews = a.review_count ?? 0;
    const bReviews = b.review_count ?? 0;
    if (aReviews !== bReviews) return bReviews - aReviews;

    const aCreated = a.created_at ? Date.parse(a.created_at) : 0;
    const bCreated = b.created_at ? Date.parse(b.created_at) : 0;
    if (aCreated !== bCreated) return bCreated - aCreated;

    return String(a.id).localeCompare(String(b.id));
  })[0] ?? null;
}

/**
 * Cached beach lookup by slug with fallback to ID.
 * React's cache() deduplicates this call between generateMetadata and page component.
 */
const getBeachBySlugOrId = cache(async (slug: string): Promise<Beach | null> => {
  // Try slug lookup first
  const bySlugResult = await getBeachesBySlug(slug);
  const candidates = bySlugResult.success ? bySlugResult.data ?? [] : [];

  if (candidates.length > 0) {
    return selectBestCandidate(candidates);
  }

  // Fallback: treat slug as an ID for back-compat
  const byIdResult = await getBeachById(slug);
  if (byIdResult.success && byIdResult.data) {
    return byIdResult.data;
  }

  return null;
});

export default async function BeachDetailBySlugPage({
  params,
}: {
  params: { slug: string };
}) {
  // Fetch beach data server-side using cached function
  try {
    const beach = await getBeachBySlugOrId(params.slug);

    if (!beach) {
      notFound();
    }

    const beachTimezone =
      beach.lat != null && beach.lon != null
        ? getTimezoneFromCoords(beach.lat, beach.lon)
        : null;

    // Redirect to hierarchical URL format if beach has the required data
    // This helps with SEO and provides a better URL structure
    if (beach.slug && beach.city && beach.state) {
      const hierarchicalUrl = buildBeachUrl(beach);
      const currentPath = `/beach/${params.slug}`;

      // Only redirect if the hierarchical URL is different from current path
      if (hierarchicalUrl !== currentPath) {
        redirect(hierarchicalUrl);
      }
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
            { name: "Surf Spots Map", url: `${baseUrl}/map` },
            { name: beach.name, url: `${baseUrl}/beach/${params.slug}` },
          ]}
        />

        {/* Client detail component with auth tracking */}
        <BeachDetailClient
          beach={beach}
          slug={params.slug}
          beachTimezone={beachTimezone}
        />
      </>
    );
  } catch (error) {
    // Ensure Next.js router signals are not swallowed by this page-level try/catch.
    // `notFound()` and `redirect()` throw special errors with a `digest` marker.
    if (error && typeof error === "object" && "digest" in error) {
      const digest = (error as { digest?: unknown }).digest;
      if (
        digest === "NEXT_NOT_FOUND" ||
        (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT"))
      ) {
        throw error;
      }
    }

    console.error("Error fetching beach:", error);
    return (
      <div className="flex flex-col min-h-screen">
        <main className="flex-1 container mx-auto px-4 py-6">
          <div className="text-center py-12">
            <h2 className="text-2xl font-bold mb-2">Error Loading Beach</h2>
            <p className="text-muted-foreground">
              There was an error loading this beach. Please try again.
            </p>
          </div>
        </main>
      </div>
    );
  }
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  // Keep metadata generation side-effect free; don't depend on auth/session
  // Uses cached function - deduped with page component in same render pass
  const beach = await getBeachBySlugOrId(params.slug);

  if (beach) {
    // Format review count for title
    const reviewCount = beach.review_count ?? 0;
    const reviewText =
      reviewCount === 1 ? "1 Review" : `${reviewCount} Reviews`;

    return buildPageMetadata({
      title: `${beach.name}, ${reviewText}, Map`,
      description: `Today's surf summary, tides, wind, swell, cams, and community intel for ${beach.name}.`,
      path: `/beach/${params.slug}`,
    });
  }

  return buildPageMetadata({
    title: `Beach`,
    description: `Conditions, intel, photos, and community tips for this beach.`,
    path: `/beach/${params.slug}`,
  });
}
