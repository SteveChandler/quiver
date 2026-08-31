import { cache, Suspense } from "react";
import { BeachPageStructuredData } from "@/components/seo/structured-data";
import { BreadcrumbStructuredData } from "@/components/seo/breadcrumb-schema";
import { BeachDetailClient } from "@/app/beach/[slug]/beach-detail-client";
import { PublicForecastAnswer } from "@/components/beach-detail/public-forecast-answer";
import { PublicForecastHourly } from "@/components/beach-detail/public-forecast-hourly";
import { RelatedGuidesSection } from "@/components/beach-detail/related-guides-section";
import { AuthenticatedForecastDecisionProvider } from "@/components/beach-detail/authenticated-forecast-decision";
import { ZineNearbySpots } from "@/components/beach-detail/zine/zine-nearby-spots";
import { enrichBeachesWithConditions } from "@/lib/utils/nearby-beach-enrichment";
import { StickySignupBar } from "@/components/ui/sticky-signup-bar";
import { InstallAppCtaSection } from "@/components/app-store/install-app-cta-section";
import { iphoneBannerOwnsInstallAsk } from "@/lib/app-store/beach-subpage-install-cta";
import { getFirstTouchPlatform } from "@/lib/analytics/web-context";
import { headers } from "next/headers";
import { ContentPageAppHandoffCta } from "@/components/app-store/content-page-app-handoff-cta";
import { isFreeGrowthPhaseEnabled } from "@/lib/flags/free-growth-phase";

import type { Metadata } from "next";
import { buildPageMetadata, buildDynamicBeachMetadata } from "@/lib/seo/meta";
import {
  buildBeachUrl,
  buildHiCityUrlForBeach,
  getUsStateRootPathOrNull,
  stateToSlug,
  cityToSlug,
  isValidStateSlug,
} from "@/lib/utils/beach-url-utils";
import { notFound, redirect } from "next/navigation";
import type { Beach } from "@/types/database";
import type { BeachAmenities } from "@/types/amenities";
import type { WaterQuality } from "@/components/beach-detail/water-quality-badge";
import { getTimezoneFromCoords } from "@/lib/utils/timezone-utils.server";
import { FAQSchema } from "@/components/seo/faq-schema";
import { pickBestUsaBeachMatch } from "@/lib/utils/beach-matching-utils";
import { generateBeachFAQ } from "@/lib/utils/beach-faq-utils";
import { getSpotSurfReportPublic } from "@/lib/services/spot-surf-report-service";
import { getSpotFeaturedPhoto } from "@/actions/spot/spot-data-actions";
import { getNearbyBeaches } from "@/actions/beach/beach-location-actions";
import {
  createPublicReadClient,
  createSupabaseServiceRoleClient,
} from "@/lib/supabase/server";
import { WebPageSchema } from "@/components/seo/web-page-schema";
import { LiveCamSchema } from "@/components/seo/live-cam-schema";
import { getBeachCameraUrl } from "@/actions/beach/cam-actions";
import {
  applyIndexabilityToMetadata,
  evaluateBeachForecastIndexability,
} from "@/lib/seo/indexability";
import { isDataStale } from "@/lib/utils/forecast-client-utils";
import { sanitizeBeachEditorialContent } from "@/lib/seo/editorial-integrity";
import {
  selectPublicForecastContextFacts,
  selectPublicForecastReportFacts,
} from "@/lib/utils/public-forecast-facts";
import {
  getForecastIndexabilityForBeaches,
  isBeachSubPageIndexable,
} from "@/lib/seo/forecast-indexability";
import { getWaterTempMetaData } from "@/lib/seo/water-temp-meta-data";

// Public beach data is cookie-free. Major-event hold transitions explicitly
// revalidate affected paths, so hourly ISR remains safe between transitions.
export const dynamic = "force-static";
export const revalidate = 3600;

const getCachedBeachCandidates = cache(async (slug: string) => {
  const { getBeachesBySlug } =
    await import("@/actions/beach/beach-query-actions");
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

  // The after-tabs install section and IphoneAppBanner are both install asks.
  // Non-Safari iPhone gets the banner, so suppress the section there rather than
  // showing the same ask twice. Every other visitor is unaffected.
  const installCtaUserAgent = (await headers()).get("user-agent") ?? "";
  const bannerOwnsInstallAsk = iphoneBannerOwnsInstallAsk({
    userAgent: installCtaUserAgent,
    pathname: `/${stateParam}/${city}/${beachSlug}`,
  });
  const installCtaPlatform = getFirstTouchPlatform(installCtaUserAgent);

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
      beaches: candidatesResult.success ? (candidatesResult.data ?? []) : [],
    });

    if (!beach) notFound();

    // Validate the canonical location before starting beach-specific data work.
    const expectedStateSlug = stateToSlug(beach.state);
    if (stateParam.toLowerCase() !== expectedStateSlug) {
      console.warn("[GenericBeachDetailPage] State slug mismatch:", {
        beachSlug,
        expectedState: expectedStateSlug,
        providedState: stateParam,
      });
      notFound();
    }

    if (!beach.city) {
      console.warn("[GenericBeachDetailPage] Beach has no city data:", {
        beachSlug,
        beachName: beach.name,
      });
      notFound();
    }

    const expectedCitySlug = cityToSlug(beach.city);
    if (city !== expectedCitySlug) {
      console.warn("[GenericBeachDetailPage] City slug mismatch:", {
        beachSlug,
        expectedCity: expectedCitySlug,
        providedCity: city,
      });
      redirect(buildBeachUrl(beach));
    }

    const beachTimezone =
      beach.timezone ??
      (beach.lat != null && beach.lon != null
        ? getTimezoneFromCoords(beach.lat, beach.lon)
        : null);

    // Fetch above-fold and structured-data essentials in parallel. Nearby spot
    // enrichment streams below the tabs so it does not block the page shell.
    const [
      surfReportResult,
      amenitiesResult,
      waterQualityResult,
      cameraUrl,
      beachPhoto,
      nearbyResult,
    ] = await Promise.all([
      getSpotSurfReportPublic(beach),
      (async () => {
        try {
          const supabase = createSupabaseServiceRoleClient();
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
          const supabase = createPublicReadClient();
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
      getBeachCameraUrl(beach.id),
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
      beach.lat != null && beach.lon != null
        ? getNearbyBeaches(beach.lat, beach.lon, 25)
        : null,
    ]);

    const surfCallReport = surfReportResult?.report || null;
    const surfCallIsTomorrow = surfReportResult?.isTomorrow ?? false;
    const forecastContext = surfReportResult?.forecastContext ?? null;
    const hourlyForecasts = surfReportResult?.hourlyForecasts ?? [];
    const hourlyForecastDay = surfReportResult?.hourlyForecastDay ?? "today";
    const publicBeach = sanitizeBeachEditorialContent(beach);
    const publicForecastReport =
      selectPublicForecastReportFacts(surfCallReport);
    const publicForecastContext =
      selectPublicForecastContextFacts(forecastContext);
    const returnTo = buildBeachUrl(publicBeach);

    const nearbyBeachesRaw = nearbyResult?.success && nearbyResult.data
      ? nearbyResult.data
          .filter((nearbyBeach) =>
            nearbyBeach.id !== beach.id && nearbyBeach.slug !== beach.slug,
          )
          .slice(0, 4)
      : [];

    return (
      <div className="min-h-screen">
        {/* Structured Data: Place/Beach */}
        <BeachPageStructuredData
          beachName={beach.name}
          description={`Surf conditions, tides, wind, swell and community intel for ${beach.name}.`}
          latitude={beach.lat || 0}
          longitude={beach.lon || 0}
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
        <FAQSchema items={generateBeachFAQ(publicBeach)} />

        {/* WebPage structured data with dateModified for freshness signal */}
        <WebPageSchema
          name={`${beach.name} Surf Report & Forecast`}
          url={`${baseUrl}${buildBeachUrl(beach)}`}
          dateModified={forecastContext?.sourceDataUpdatedAt ?? undefined}
        />

        {/* VideoObject + BroadcastEvent for live cam — earns LIVE badge in SERPs */}
        {cameraUrl && (
          <LiveCamSchema
            beachName={beach.name}
            cameraUrl={cameraUrl}
            pageUrl={buildBeachUrl(beach)}
          />
        )}

        {/* Client detail component with auth tracking */}
        <AuthenticatedForecastDecisionProvider beachId={publicBeach.id}>
          <BeachDetailClient
            beach={publicBeach}
            slug={beachSlug}
            beachTimezone={beachTimezone}
            amenities={amenitiesResult}
            waterQuality={waterQualityResult}
            beachPhoto={beachPhoto}
            heroHeadingLevel="h2"
            heroForecastSlot={
              <PublicForecastAnswer
                beach={publicBeach}
                report={publicForecastReport}
                context={publicForecastContext}
                isTomorrow={surfCallIsTomorrow}
                publicDecisionWindow={{
                  start: surfCallReport?.bestWindowStart ?? null,
                  end: surfCallReport?.bestWindowEnd ?? null,
                }}
                nearbyBeaches={nearbyBeachesRaw}
                headingLevel="h1"
                returnTo={returnTo}
              />
            }
            freeGrowthPhaseEnabled={isFreeGrowthPhaseEnabled()}
            beforeTabsContent={
              forecastContext?.selectedRowTime && forecastContext.waveHeight ? (
                <ContentPageAppHandoffCta
                  source={`content-beach-detail-${beachSlug}`}
                  surface="beach_detail"
                  placement="above_fold_after_public_answer"
                  target={`beach:${beachSlug}`}
                  eyebrow={`Next call · ${beach.name}`}
                  title={`Watch the next good window at ${beach.name}.`}
                  description="Today's call is here. Quiver keeps this break on your phone so the next surfable window is easier to catch."
                  ctaLabel="Watch the next window in the app"
                />
              ) : null
            }
            afterTabsContent={
              <div className="pt-2">
                <PublicForecastHourly
                  beachName={publicBeach.name}
                  forecastHours={hourlyForecasts}
                  context={publicForecastContext}
                  forecastDay={hourlyForecastDay}
                  returnTo={returnTo}
                />
                {/* One ask here, not two. The home-break signup this used to stack
                    underneath is the same ask the sticky bar already carries, so
                    it read as the page repeating itself. The install section takes
                    a real already-fetched figure instead — proof beats adjectives. */}
                {!bannerOwnsInstallAsk && (
                  <div className="mt-10">
                    <InstallAppCtaSection
                      platform={installCtaPlatform}
                      source={`beach-detail-${beachSlug}`}
                      surface="beach-detail"
                      placement="after-tabs"
                      beachName={beach.name}
                      proof={
                        forecastContext?.waveHeightRangeLabel ??
                        forecastContext?.waveHeight
                          ? {
                              value: (forecastContext.waveHeightRangeLabel ??
                                forecastContext.waveHeight) as string,
                              label: "Surf right now",
                            }
                          : undefined
                      }
                    />
                  </div>
                )}
                <Suspense fallback={null}>
                  <DeferredZineNearbySpots
                    beach={beach}
                    nearbyBeachesRaw={nearbyBeachesRaw}
                  />
                </Suspense>
                <Suspense fallback={null}>
                  <DeferredRelatedGuidesSection beach={publicBeach} />
                </Suspense>
              </div>
            }
          />
        </AuthenticatedForecastDecisionProvider>

        <StickySignupBar
          source={`beach-detail-${beachSlug}`}
          ctaText={`Save ${beach.name} as your home break`}
          supportingText={`Alerts when ${beach.name} is firing — free`}
          contextMessage={{
            title: `Save ${beach.name} as your home break`,
            description:
              "Condition alerts, 12-day outlook, and your personal match score",
          }}
          ctaCopyVariant="beach_home_break_v1"
        />
      </div>
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

async function DeferredRelatedGuidesSection({ beach }: { beach: Beach }) {
  const beachPath = buildBeachUrl(beach);
  const [forecastSnapshots, waterTempData] = await Promise.all([
    getForecastIndexabilityForBeaches([
      { id: beach.id, timezone: beach.timezone ?? null },
    ]),
    getWaterTempMetaData(beach.id),
  ]);
  const hasWaterTemp = isBeachSubPageIndexable(
    forecastSnapshots.get(beach.id),
    `${beachPath}/water-temp`,
    { hasSubPageData: waterTempData.tempF != null },
  );

  return (
    <RelatedGuidesSection
      beach={beach}
      className="mt-10"
      hasLeastCrowded={false}
      hasWaterTemp={hasWaterTemp}
    />
  );
}

async function DeferredZineNearbySpots({
  beach,
  nearbyBeachesRaw,
}: {
  beach: Beach;
  nearbyBeachesRaw: Beach[];
}) {
  const nearbyBeaches = await enrichBeachesWithConditions(nearbyBeachesRaw);

  return (
    <ZineNearbySpots
      beaches={nearbyBeaches}
      sourceBeachName={beach.name}
      sourceBeachLat={beach.lat}
      sourceBeachLon={beach.lon}
    />
  );
}

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const params = await props.params;
  const { intent: stateParam, beachSlug } = params;

  // Skip metadata generation for invalid state slugs (intent slugs)
  if (!isValidStateSlug(stateParam)) {
    return {
      title: "Page Not Found",
      robots: { index: false, follow: false },
    };
  }

  try {
    const candidatesResult = await getCachedBeachCandidates(beachSlug);
    const beach = pickBestUsaBeachMatch({
      stateParam,
      cityParam: params.city,
      beaches: candidatesResult.success ? (candidatesResult.data ?? []) : [],
    });

    // Beach not found — return noindex metadata immediately so no canonical or
    // indexable metadata is emitted before notFound() renders the 404 page.
    if (!beach) {
      return {
        title: "Page Not Found",
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
          error: urlError instanceof Error ? urlError.message : "Unknown error",
        },
      );
      path = `/beach/${beachSlug}`;
    }

    // Metadata and robots use the same selected state as the server-rendered
    // answer layer, so a stale or incomplete forecast cannot earn indexability.
    const surfReportResult = await getSpotSurfReportPublic(beach);
    const forecastContext = surfReportResult?.forecastContext ?? null;
    const forecastData = forecastContext
      ? {
          wave_height:
            forecastContext.waveHeightRangeLabel ?? forecastContext.waveHeight,
          dayLabel: surfReportResult?.isTomorrow ? "tomorrow" as const : "today" as const,
        }
      : null;

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

    const metadata = buildPageMetadata({
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

    const decision = evaluateBeachForecastIndexability({
      canonicalValid: path === buildBeachUrl(beach) && !path.startsWith("/beach/"),
      forecastAvailable: Boolean(surfReportResult),
      selectedStateComplete: Boolean(
        forecastContext?.selectedRowTime &&
          forecastContext.waveHeight &&
          forecastContext.sourceDataUpdatedAt &&
          forecastContext.primaryDataSource,
      ),
      forecastFresh: Boolean(
        forecastContext?.sourceDataUpdatedAt &&
          forecastContext.primaryDataSource &&
          !isDataStale(
            forecastContext.sourceDataUpdatedAt,
            forecastContext.primaryDataSource,
          ),
      ),
    });
    return applyIndexabilityToMetadata(metadata, decision);
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
    title: "Page Not Found",
    robots: { index: false, follow: false },
  };
}

// generateStaticParams is deferred; pages are generated on demand and cached via ISR.
