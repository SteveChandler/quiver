import { cache } from "react";
import { BeachPageStructuredData } from "@/components/seo/structured-data";
import { BreadcrumbStructuredData } from "@/components/seo/breadcrumb-schema";
import { BeachDetailClient } from "@/app/beach/[slug]/beach-detail-client";
import { SpotSurfReportStream } from "@/components/spots/spot-surf-report";
import { NearbyBeachesEnriched } from "@/components/beach-detail/nearby-spots-enriched";
import { enrichBeachesWithConditions } from "@/lib/utils/nearby-beach-enrichment";
import { RelatedGuidesSection } from "@/components/beach-detail/related-guides-section";
import { InlineSignupCta } from "@/components/seo/inline-signup-cta";
import { StickySignupBar } from "@/components/ui/sticky-signup-bar";
import type { Metadata } from "next";
import { buildPageMetadata, buildDynamicBeachMetadata } from "@/lib/seo/meta";
import { getBeachForecastPreview } from "@/actions/forecast-actions";
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
import type { BeachAmenities } from "@/types/amenities";
import type { WaterQuality } from "@/components/beach-detail/water-quality-badge";
import { getTimezoneFromCoords } from "@/lib/utils/timezone-utils.server";
import { FAQSchema } from "@/components/seo/faq-schema";
import { ReviewSchema } from "@/components/seo/review-schema";
import { pickBestUsaBeachMatch } from "@/lib/utils/beach-matching-utils";
import { generateBeachFAQ } from "@/lib/utils/beach-faq-utils";
import { getSpotSurfReport } from "@/actions/spot/spot-surf-report-actions";
import { getNearbyBeaches } from "@/actions/beach/beach-location-actions";
import { getBeachReviews } from "@/actions/beach-review-actions";
import { getBestTimeToSurfUrl } from "@/lib/utils/best-time-to-surf-utils";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { WebPageSchema } from "@/components/seo/web-page-schema";

// Force dynamic rendering - this page accesses cookies via Supabase client
export const dynamic = "force-dynamic";

const getCachedBeachCandidates = cache(async (slug: string) => {
  const { getBeachesBySlug } = await import("@/actions/beach/beach-query-actions");
  return getBeachesBySlug(slug);
});

const baseUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "https://www.quiversurf.app";

interface PageProps {
  params: Promise<{
    intent: string; // This is actually a state slug for beach URLs (e.g., "or", "wa", "hi")
    city: string;
    beachSlug: string;
  }>;
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
export default async function GenericBeachDetailPage(props: PageProps) {
  const params = await props.params;
  const { intent: stateParam, city, beachSlug } = params;

  // Only handle requests where the first param is a valid state slug
  // This excludes intent slugs like "surf-forecast", "beginner", etc.
  if (!isValidStateSlug(stateParam)) {
    notFound();
  }

  try {
    // Fetch candidate beach rows by slug; disambiguate by state+city from URL
    const candidatesResult = await getCachedBeachCandidates(beachSlug);

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

    // Fetch surf report, nearby beaches, reviews, best time to surf URL, amenities, and water quality in parallel
    const [surfReportResult, nearbyResult, reviewsResult, bestTimeToSurfUrl, amenitiesResult, waterQualityResult] = await Promise.all([
      getSpotSurfReport(beach),
      beach.lat && beach.lon
        ? getNearbyBeaches(beach.lat, beach.lon, 25)
        : Promise.resolve(null),
      getBeachReviews(beach.id),
      beach.city && beach.state
        ? getBestTimeToSurfUrl(cityToSlug(beach.city), beach.city, beach.state)
        : Promise.resolve(undefined),
      (async () => {
        try {
          const supabase = await createSupabaseServerClient();
          const { data } = await supabase
            .from("mv_beach_amenities")
            .select("*")
            .eq("beach_id", beach.id)
            .maybeSingle();
          return data as BeachAmenities | null;
        } catch {
          // Gracefully degrade if the materialized view doesn't exist yet
          return null;
        }
      })(),
      (async () => {
        try {
          const supabase = await createSupabaseServerClient();
          const { data } = await supabase
            .from("beach_water_quality")
            .select("*")
            .eq("beach_id", beach.id)
            .maybeSingle();
          return data as WaterQuality | null;
        } catch {
          // Gracefully degrade if the table doesn't exist yet
          return null;
        }
      })(),
    ]);

    const surfCallReport = surfReportResult?.report || null;
    const surfCallIsTomorrow = surfReportResult?.isTomorrow ?? false;
    const reviews = reviewsResult.success ? reviewsResult.data ?? [] : [];

    let nearbyBeachesRaw: Beach[] = [];
    if (nearbyResult?.success && nearbyResult.data) {
      nearbyBeachesRaw = nearbyResult.data
        .filter((b) => b.id !== beach.id && b.slug !== beach.slug)
        .slice(0, 4);
    }

    // Enrich nearby beaches with live conditions and photos
    const nearbyBeaches = await enrichBeachesWithConditions(nearbyBeachesRaw);

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
          rating={beach.average_rating || undefined}
          reviewCount={beach.review_count || undefined}
          city={beach.city || undefined}
          state={beach.state || undefined}
          country={beach.country || undefined}
          amenities={amenitiesResult}
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

        {/* Review structured data */}
        <ReviewSchema
          beachName={beach.name}
          beachUrl={`${baseUrl}${buildBeachUrl(beach)}`}
          reviews={reviews.map((r) => ({
            author: r.profiles?.full_name ?? "Anonymous",
            datePublished: r.created_at ?? new Date().toISOString(),
            reviewRating: r.overall_rating,
            reviewBody: r.content ?? undefined,
          }))}
          aggregateRating={beach.average_rating ?? undefined}
          reviewCount={beach.review_count ?? undefined}
        />

        {/* WebPage structured data with dateModified for freshness signal */}
        <WebPageSchema
          name={`${beach.name} Surf Report & Forecast`}
          url={`${baseUrl}${buildBeachUrl(beach)}`}
        />

        {/* Client detail component with auth tracking */}
        <BeachDetailClient
          beach={beach}
          slug={beachSlug}
          beachTimezone={beachTimezone}
          surfReportSlot={<SpotSurfReportStream beach={beach} />}
          surfCallReport={surfCallReport}
          surfCallIsTomorrow={surfCallIsTomorrow}
          amenities={amenitiesResult}
          waterQuality={waterQualityResult}
        />

        <StickySignupBar
          source={`beach-detail-${beachSlug}`}
          ctaText="See Your Match"
          supportingText={`Your match score for ${beach.name}`}
          scrollThreshold={150}
        />

        {/* Signup CTA for anonymous visitors */}
        <div className="container mx-auto px-4 pt-6">
          <InlineSignupCta
            title="Know Before You Go"
            description={`Get your personal match score, 12-day outlook, and condition alerts for ${beach.name}`}
            primaryButtonText="Get My Forecast"
            source={`beach-detail-${beachSlug}`}
          />
        </div>

        {/* SSR sections below tabs for SEO crawlability */}
        <div className="container mx-auto px-4 pb-8 space-y-8">
          <NearbyBeachesEnriched
              beaches={nearbyBeaches}
              sourceBeachName={beach.name}
              sourceBeachLat={beach.lat}
              sourceBeachLon={beach.lon}
            />
          <RelatedGuidesSection beach={beach} bestTimeToSurfUrl={bestTimeToSurfUrl} />
        </div>
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

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const params = await props.params;
  const { intent: stateParam, beachSlug } = params;

  // Skip metadata generation for invalid state slugs (intent slugs)
  if (!isValidStateSlug(stateParam)) {
    return {
      title: "Page Not Found | Quiver",
      robots: { index: false, follow: false },
    };
  }

  try {
    const candidatesResult = await getCachedBeachCandidates(beachSlug);
    const beach = pickBestUsaBeachMatch({
      stateParam,
      cityParam: params.city,
      beaches: candidatesResult.success ? candidatesResult.data ?? [] : [],
    });

    // Beach not found — return noindex metadata immediately so no canonical or
    // indexable metadata is emitted before notFound() renders the 404 page.
    if (!beach) {
      return {
        title: "Page Not Found | Quiver",
        robots: { index: false, follow: false },
      };
    }

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

    // Fetch forecast data for dynamic SEO (lightweight preview endpoint)
    let forecastData: { wave_height?: string | null } | null = null;
    try {
      const forecastResult = await getBeachForecastPreview(beach.id);
      if (forecastResult.success && forecastResult.data) {
        forecastData = { wave_height: forecastResult.data.wave_height };
      }
    } catch {
      // Gracefully degrade to static metadata on forecast fetch failure
    }

    // Extract first sentence of beach description for meta tags
    const descriptionExcerpt = beach.description
      ? beach.description.split(/\.(\s|$)/)[0] + "."
      : null;

    // Build CTR-optimized title and description
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
      forecast: forecastData,
    });

    return buildPageMetadata({
      title,
      description,
      path,
      image: `/api/og/beach?slug=${beachSlug}`,
      keywords: [
        `${beach.name} surf report`,
        `${beach.name} surf forecast`,
        `${beach.name} surf`,
        `best time to surf ${beach.name}`,
        `${beach.name} tide chart`,
        beach.city ? `surf report ${beach.city}` : "",
        beach.city ? `surf forecast ${beach.city}` : "",
        "surf report",
        "surf forecast",
        "surf conditions today",
        "wave height today",
      ].filter(Boolean),
    });
  } catch (error) {
    console.error("[GenericBeachDetailPage] Error generating metadata:", {
      params,
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
    });
  }

  // Error fallback: couldn't resolve beach data — suppress indexing to avoid
  // emitting a canonical URL to a page that may not render correctly.
  return {
    title: "Page Not Found | Quiver",
    robots: { index: false, follow: false },
  };
}

// NOTE: generateStaticParams removed - this page uses force-dynamic due to cookie access.
// Pages are rendered on-demand with ISR caching via Next.js defaults.
