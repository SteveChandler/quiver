
import { BeachPageStructuredData } from "@/components/seo/structured-data";
import { BreadcrumbStructuredData } from "@/components/seo/breadcrumb-schema";
import { BeachFAQSchema } from "@/components/seo/faq-schema";
import { BeachDetailClient } from "./beach-detail-client";
import { NearbyBeachesEnriched } from "@/components/beach-detail/nearby-spots-enriched";
import { enrichBeachesWithConditions } from "@/lib/utils/nearby-beach-enrichment";
import { RelatedGuidesSection } from "@/components/beach-detail/related-guides-section";
import type { Metadata } from "next";
import { buildPageMetadata, buildDynamicBeachMetadata } from "@/lib/seo/meta";
import { getBeachForecastPreview } from "@/actions/forecast-actions";
import { notFound, permanentRedirect } from "next/navigation";
import { buildBeachUrl } from "@/lib/utils/beach-url-utils";
import { getTimezoneFromCoords } from "@/lib/utils/timezone-utils.server";
import { getBeachBySlugOrId } from "@/lib/utils/beach-lookup-utils";
import { getNearbyBeaches } from "@/actions/beach/beach-location-actions";
import type { Beach } from "@/types/database";
import type { BeachAmenities } from "@/types/amenities";
import type { WaterQuality } from "@/components/beach-detail/water-quality-badge";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const baseUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "https://www.quiversurf.app";

export default async function BeachDetailBySlugPage(
  props: {
    params: Promise<{ slug: string }>;
  }
) {
  const params = await props.params;
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
        permanentRedirect(hierarchicalUrl);
      }
    }

    // Fetch nearby beaches for SSR SEO section
    let nearbyBeachesRaw: Beach[] = [];
    if (beach.lat && beach.lon) {
      const nearbyResult = await getNearbyBeaches(beach.lat, beach.lon, 25);
      if (nearbyResult.success && nearbyResult.data) {
        nearbyBeachesRaw = nearbyResult.data
          .filter((b) => b.id !== beach.id && b.slug !== beach.slug)
          .slice(0, 4);
      }
    }

    // Enrich nearby beaches with live conditions and photos
    const nearbyBeaches = await enrichBeachesWithConditions(nearbyBeachesRaw);

    // Fetch amenity and water quality data (gracefully degrade when tables don't exist yet)
    let amenities: BeachAmenities | null = null;
    let waterQuality: WaterQuality | null = null;
    try {
      const supabase = await createSupabaseServerClient();
      const [amenitiesResult, waterQualityResult] = await Promise.all([
        supabase
          .from("mv_beach_amenities")
          .select("*")
          .eq("beach_id", beach.id)
          .maybeSingle(),
        supabase
          .from("beach_water_quality")
          .select("*")
          .eq("beach_id", beach.id)
          .maybeSingle(),
      ]);
      amenities = amenitiesResult.data as BeachAmenities | null;
      waterQuality = waterQualityResult.data as WaterQuality | null;
    } catch {
      // Gracefully degrade if tables don't exist yet
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
          amenities={amenities}
        />

        {/* Breadcrumb Structured Data for SEO */}
        <BreadcrumbStructuredData
          items={[
            { name: "Home", url: baseUrl },
            { name: "Surf Spots Map", url: `${baseUrl}/map` },
            { name: beach.name, url: `${baseUrl}${buildBeachUrl(beach)}` },
          ]}
        />

        {/* FAQ Structured Data for rich snippets */}
        <BeachFAQSchema beachName={beach.name} />

        {/* Client detail component with auth tracking */}
        <BeachDetailClient
          beach={beach}
          slug={params.slug}
          beachTimezone={beachTimezone}
          amenities={amenities}
          waterQuality={waterQuality}
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

export async function generateMetadata(
  props: {
    params: Promise<{ slug: string }>;
  }
): Promise<Metadata> {
  const params = await props.params;
  // Keep metadata generation side-effect free; don't depend on auth/session
  // Uses cached function - deduped with page component in same render pass
  const beach = await getBeachBySlugOrId(params.slug);

  if (beach) {
    // Compute canonical path: prefer hierarchical URL, fallback to UUID path
    let canonicalPath = `/beach/${params.slug}`;
    if (beach.slug && beach.city && beach.state) {
      try {
        canonicalPath = buildBeachUrl(beach);
      } catch {
        // Keep fallback UUID path
      }
    }

    // Fetch live forecast data for dynamic title with wave heights
    const forecastResult = await getBeachForecastPreview(beach.id);
    const forecast = forecastResult.success && forecastResult.data
      ? { wave_height: forecastResult.data.wave_height }
      : null;

    // Extract first sentence of beach description for meta tags
    const descriptionExcerpt = beach.description
      ? (beach.description.split(/\.(\s|$)/)[0] + ".").trim() || null
      : null;

    const { title, description } = buildDynamicBeachMetadata({
      beach: {
        name: beach.name,
        city: beach.city,
        state: beach.state,
        break_type: beach.break_type,
        skill_level: beach.skill_level,
        description_excerpt: descriptionExcerpt,
        wave_tips: beach.wave_tips,
        crowd_level: beach.crowd_level,
        average_rating: beach.average_rating,
        review_count: beach.review_count,
      },
      forecast,
    });

    return buildPageMetadata({
      title,
      description,
      path: canonicalPath,
      image: `/api/og/beach?slug=${params.slug}`,
    });
  }

  return buildPageMetadata({
    title: `Beach`,
    description: `Conditions, intel, photos, and community tips for this beach.`,
    path: `/beach/${params.slug}`,
  });
}
