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
import { BeachVisualHero } from "@/components/beach-detail/visual/beach-visual-hero";
import { BeachActions } from "@/components/beach-detail/visual/beach-actions";
import { BeachHourlyChart } from "@/components/beach-detail/visual/beach-hourly-chart";
import { BeachDayColumn } from "@/components/beach-detail/visual/beach-day-column";
import { VISUAL_PAPER_CLASS } from "@/components/beach-detail/visual/beach-visual-shell";
import { ZineAboutSpot } from "@/components/beach-detail/zine/zine-about-spot";
import { AmenitiesBadges } from "@/components/beach-detail/amenities-badges";
import { isFreeGrowthPhaseEnabled } from "@/lib/flags/free-growth-phase";
import { getPublicSurfCall } from "@/lib/utils/public-surf-call";
import { selectBeachWatchWindow } from "@/lib/alerts/beach-watch";
import { buildHourlyChart } from "@/lib/utils/beach-hourly-chart";
import { rowToSwellPartition } from "@/lib/domains/conditions/map-forecast";
import { getLocalDateString } from "@/lib/utils/timezone-utils";
import { formatTimeRangeInTimezone } from "@/lib/utils/date-time";

import type { Metadata } from "next";
import { buildPageMetadata, buildDynamicBeachMetadata } from "@/lib/seo/meta";
import { currentWaterQuality } from "@/lib/services/water-quality/current-status";
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
import { applyIndexabilityToMetadata } from "@/lib/seo/indexability";
import { sanitizeBeachEditorialContent } from "@/lib/seo/editorial-integrity";
import {
  selectPublicForecastContextFacts,
  selectPublicForecastReportFacts,
} from "@/lib/utils/public-forecast-facts";
import {
  evaluateBeachPageIndexability,
  isBeachSubPageIndexable,
} from "@/lib/seo/forecast-indexability";
import { getCachedForecastIndexabilitySnapshots } from "@/lib/seo/forecast-indexability-cache";
import { getTideMetaData } from "@/lib/seo/tide-meta-data";
import { getWaterTempMetaData } from "@/lib/seo/water-temp-meta-data";

// Rendered per request so forecast revisions and windows are current; the HTML
// is then shared at the CDN for at most 15 minutes (lib/seo/beach-detail-cdn-cache.ts),
// so it must not depend on the request (cookies, user agent).
export const dynamic = "force-dynamic";

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
      photoResult,
      nearbyResult,
      waterTemp,
      tideMeta,
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
          return data ? (await currentWaterQuality([data]))[0] as WaterQuality : null;
        } catch {
          // Gracefully degrade if the table doesn't exist yet
          return null;
        }
      })(),
      getBeachCameraUrl(beach.id),
      getSpotFeaturedPhoto(beach.id).then((photo) =>
        photo
          ? {
              zine: {
                image_url: photo.thumbUrl ?? photo.imageUrl,
                thumb_url: photo.thumbUrl,
                source: photo.source,
                creator_name: photo.creatorName,
                license_code: null,
                attribution_html: photo.attributionHtml,
                attribution: photo.attribution,
              },
              // The hero is full-bleed, so it takes the full-size image first.
              heroUrl: photo.imageUrl ?? photo.thumbUrl,
            }
          : { zine: null, heroUrl: null },
      ),
      beach.lat != null && beach.lon != null
        ? getNearbyBeaches(beach.lat, beach.lon, 25)
        : null,
      getWaterTempMetaData(beach.id),
      getTideMetaData(beach.id),
    ]);

    const beachPhoto = photoResult.zine;
    const heroPhotoUrl = photoResult.heroUrl;

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

    const beachTz = beachTimezone ?? "UTC";
    const publicCall = getPublicSurfCall({
      verdict: surfCallReport?.verdict,
      score: surfCallReport?.score,
      availability: surfCallReport?.recommendationAvailability,
      isTomorrow: surfCallIsTomorrow,
    });
    const windowStart = forecastContext?.displayWindowStart ?? surfCallReport?.bestWindowStart ?? null;
    const windowEnd = forecastContext?.displayWindowEnd ?? surfCallReport?.bestWindowEnd ?? null;
    const watchWindow = selectBeachWatchWindow({
      call: publicCall,
      start: windowStart,
      end: windowEnd,
      forecastAt: forecastContext?.selectedRowTime ?? null,
      timezone: beachTz,
      isTomorrow: surfCallIsTomorrow,
    });
    const hourlyChart = buildHourlyChart(hourlyForecasts, { start: windowStart, end: windowEnd });
    const localDate = getLocalDateString(new Date(), beachTz);
    const callLocalDate = surfCallIsTomorrow
      ? new Date(Date.parse(`${localDate}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10)
      : localDate;
    // The swell field draws the same hour as the hero's swell and wind facts
    // (the context's selected row). With no such row in the table, it draws none.
    const selectedRowAt = forecastContext?.selectedRowTime ? Date.parse(forecastContext.selectedRowTime) : null;
    const heroSwellRow = forecastContext
      ? hourlyForecasts.find((hour) => Date.parse(hour.forecast_at) === selectedRowAt) ?? null
      : hourlyForecasts[0] ?? null;

    const visualTop = (
      <>
        <BeachVisualHero
          beach={{ id: publicBeach.id, name: publicBeach.name, lat: publicBeach.lat ?? null, lon: publicBeach.lon ?? null, city: publicBeach.city ?? null }}
          timezone={beachTz}
          localDate={localDate}
          forecastLocalDate={forecastContext?.localDate ?? null}
          photoUrl={heroPhotoUrl}
          sources={cameraUrl ? { camera_url: cameraUrl } : null}
          swellPartition={heroSwellRow ? rowToSwellPartition(heroSwellRow) : null}
          call={publicCall}
          surf={{
            size: forecastContext?.waveHeightRangeLabel ?? forecastContext?.waveHeight ?? surfCallReport?.waveHeight ?? null,
            swell: forecastContext?.swellPeriod ? [forecastContext.swellPeriod, forecastContext.swellDirection].filter(Boolean).join(" ") : null,
            wind: forecastContext?.windSpeed ? [forecastContext.windSpeed, surfCallReport?.windType].filter(Boolean).join(" ") : null,
            bestWindow: formatTimeRangeInTimezone(windowStart, windowEnd, beachTz),
          }}
          beachDay={{
            water: waterTemp.tempF != null ? [`${waterTemp.tempF}°F`, waterTemp.wetsuitRec].filter(Boolean).join(" · ") : null,
            nextLow: tideMeta.nextInteriorLowTime ? `Low ${tideMeta.nextInteriorLowTime}` : null,
            advisory: waterQualityResult?.status === "advisory" || waterQualityResult?.status === "closure" ? "Water-quality advisory" : null,
          }}
        />
        <BeachActions
          beach={{ id: publicBeach.id, slug: beachSlug, name: publicBeach.name }}
          watchWindow={watchWindow}
          score={surfCallReport?.score ?? null}
          shareUrl={`${baseUrl}${buildBeachUrl(publicBeach)}`}
        />
        <div className="mt-10 grid gap-6 lg:grid-cols-[1.35fr_1fr]">
          {hourlyChart.points.length > 0 ? (
            <section id="beach-hourly" aria-labelledby="beach-hourly-heading" className="scroll-mt-20">
              <h2 id="beach-hourly-heading" className="zine-display text-xl uppercase">Surf, hour by hour</h2>
              <div className="mt-3"><BeachHourlyChart chart={hourlyChart} timezone={beachTz} /></div>
            </section>
          ) : null}
          <BeachDayColumn
            beachId={publicBeach.id}
            timezone={beachTz}
            localDate={localDate}
            waterTemp={waterTemp}
            tide={tideMeta}
            waterQuality={waterQualityResult}
            links={{
              waterTemp: waterTemp.tempF != null ? `${buildBeachUrl(publicBeach)}/water-temp` : null,
              tides: tideMeta.nextInteriorLowTime || tideMeta.nextInteriorHighTime ? `${buildBeachUrl(publicBeach)}/tides` : null,
            }}
          />
        </div>
      </>
    );

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
            layout="visual"
            visualTop={visualTop}
            weekCall={{ localDate: callLocalDate, call: publicCall }}
            freeGrowthPhaseEnabled={isFreeGrowthPhaseEnabled()}
            beforeTabsContent={
              <Suspense fallback={null}>
                <DeferredZineNearbySpots
                  beach={beach}
                  nearbyBeachesRaw={nearbyBeachesRaw}
                />
              </Suspense>
            }
            afterTabsContent={
              <div className="space-y-10 text-[#11100D]">
                <section aria-labelledby="about-heading" className={VISUAL_PAPER_CLASS}>
                  <h2 id="about-heading" className="zine-display text-2xl uppercase">About {publicBeach.name}</h2>
                  <ZineAboutSpot beach={publicBeach} open />
                  <div className="mt-4"><AmenitiesBadges amenities={amenitiesResult} /></div>
                  <div className="mt-6">
                    <PublicForecastAnswer
                      beach={publicBeach}
                      waterQuality={waterQualityResult}
                      report={publicForecastReport}
                      context={publicForecastContext}
                      isTomorrow={surfCallIsTomorrow}
                      publicDecisionWindow={{ start: windowStart, end: windowEnd }}
                      nearbyBeaches={nearbyBeachesRaw}
                      headingLevel="h2"
                      title="Forecast details"
                      returnTo={returnTo}
                      showRipCurrentWarning={false}
                      exploreForecastHref={hourlyChart.points.length > 0 ? "#beach-hourly" : null}
                    />
                  </div>
                  {hourlyForecasts.length > 0 ? (
                    <details className="mt-6">
                      <summary className="cursor-pointer text-base font-bold">Full hourly table</summary>
                      <PublicForecastHourly
                        beachName={publicBeach.name}
                        forecastHours={hourlyForecasts}
                        context={publicForecastContext}
                        forecastDay={hourlyForecastDay}
                        returnTo={returnTo}
                      />
                    </details>
                  ) : null}
                  <section aria-labelledby="faq-heading" className="mt-6">
                    <h2 id="faq-heading" className="zine-display text-xl uppercase">Frequently asked</h2>
                    {generateBeachFAQ(publicBeach).map((item) => (
                      <details key={item.question} className="border-t border-[#11100D]/20 py-3">
                        <summary className="cursor-pointer font-semibold">{item.question}</summary>
                        <p className="mt-2 text-sm">{item.answer}</p>
                      </details>
                    ))}
                  </section>
                  <Suspense fallback={null}>
                    <DeferredRelatedGuidesSection beach={publicBeach} />
                  </Suspense>
                </section>
              </div>
            }
          />
        </AuthenticatedForecastDecisionProvider>
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
  const [forecastSnapshots, waterTempData, tideData] = await Promise.all([
    getCachedForecastIndexabilitySnapshots([
      { id: beach.id, timezone: beach.timezone ?? null },
    ]),
    getWaterTempMetaData(beach.id),
    getTideMetaData(beach.id),
  ]);
  const forecastSnapshot = forecastSnapshots.get(beach.id);
  const hasWaterTemp = isBeachSubPageIndexable(
    forecastSnapshot,
    `${beachPath}/water-temp`,
    { hasSubPageData: waterTempData.tempF != null },
  );
  // Same availability test the tides sub-page applies in its own metadata
  // (lib/utils/beach-sub-page-utils.tsx), so the link only appears when the
  // target answers indexable.
  const hasTides = isBeachSubPageIndexable(forecastSnapshot, `${beachPath}/tides`, {
    hasSubPageData: Boolean(tideData.nextHighTime || tideData.nextLowTime),
  });

  return (
    <RelatedGuidesSection
      beach={beach}
      className="mt-10"
      hasLeastCrowded={false}
      hasWaterTemp={hasWaterTemp}
      hasTides={hasTides}
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
  if (nearbyBeaches.length === 0) return null;

  // Zine ink on the twilight stage needs its own paper.
  return (
    <div className={VISUAL_PAPER_CLASS}>
      <ZineNearbySpots
        beaches={nearbyBeaches}
        sourceBeachName={beach.name}
        sourceBeachLat={beach.lat}
        sourceBeachLon={beach.lon}
      />
    </div>
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

    // The title and description use the live report for the wave-height hook.
    // Robots do NOT: they come from the cached coverage snapshot below, the
    // same one the sitemap reads, so both sides answer from one clock.
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

    const snapshots = await getCachedForecastIndexabilitySnapshots([
      { id: beach.id, timezone: beach.timezone ?? null },
    ]);
    const decision = evaluateBeachPageIndexability(
      snapshots.get(beach.id),
      path === buildBeachUrl(beach) && !path.startsWith("/beach/"),
    );
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
