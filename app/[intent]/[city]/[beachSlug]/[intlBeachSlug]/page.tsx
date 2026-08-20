import { BeachPageStructuredData } from "@/components/seo/structured-data";
import { BreadcrumbStructuredData } from "@/components/seo/breadcrumb-schema";
import { BeachDetailClient } from "@/app/beach/[slug]/beach-detail-client";
import { PublicForecastAnswer } from "@/components/beach-detail/public-forecast-answer";
import { PublicForecastHourly } from "@/components/beach-detail/public-forecast-hourly";
import { AuthenticatedForecastDecisionProvider } from "@/components/beach-detail/authenticated-forecast-decision";
import { WebPageSchema } from "@/components/seo/web-page-schema";
import type { Metadata } from "next";
import { buildDynamicBeachMetadata, buildPageMetadata } from "@/lib/seo/meta";
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
import type { Beach } from "@/types/database";
import { getTimezoneFromCoords } from "@/lib/utils/timezone-utils.server";
import { isFreeGrowthPhaseEnabled } from "@/lib/flags/free-growth-phase";
import { getSpotSurfReportPublic } from "@/lib/services/spot-surf-report-service";
import { evaluateBeachForecastIndexability, applyIndexabilityToMetadata } from "@/lib/seo/indexability";
import { isDataStale } from "@/lib/utils/forecast-client-utils";
import { sanitizeBeachEditorialContent } from "@/lib/seo/editorial-integrity";
import {
  selectPublicForecastContextFacts,
  selectPublicForecastReportFacts,
} from "@/lib/utils/public-forecast-facts";

// The route only reads public beach data; cache on demand instead of rendering
// every crawler request from scratch.
export const dynamic = "force-static";
export const revalidate = 3600;

const baseUrl =
  process.env.NEXT_PUBLIC_SITE_URL || "https://www.quiversurf.app";

interface PageProps {
  params: Promise<{
    intent: string; // In this 4-segment context, this represents a country slug (e.g., "mexico")
    city: string; // In this 4-segment context, this represents a region/state slug (e.g., "baja-california")
    beachSlug: string; // In this 4-segment context, this represents a city slug (e.g., "rosarito")
    intlBeachSlug: string; // Actual beach slug (e.g., "teresas")
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

function pickBestInternationalBeachMatch(params: {
  countryParam: string;
  regionParam: string;
  cityParam: string;
  beaches: Beach[];
}): Beach | null {
  const { countryParam, regionParam, cityParam, beaches } = params;
  if (!Array.isArray(beaches) || beaches.length === 0) return null;

  const countryLower = countryParam.toLowerCase();
  const regionLower = regionParam.toLowerCase();
  const cityLower = cityParam.toLowerCase();

  const withCountry = beaches.filter(
    (b) => countryToSlug(b.country)?.toLowerCase() === countryLower
  );
  const countryPool = withCountry.length > 0 ? withCountry : beaches;

  const withRegion = countryPool.filter(
    (b) => regionToSlug(b.state)?.toLowerCase() === regionLower
  );
  const regionPool = withRegion.length > 0 ? withRegion : countryPool;

  const withCity = regionPool.filter(
    (b) => cityToSlug(b.city)?.toLowerCase() === cityLower
  );
  const pool = withCity.length > 0 ? withCity : regionPool;

  const sorted = [...pool].sort((a, b) => {
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
  });

  return sorted[0] ?? null;
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
export default async function InternationalBeachDetailPage(props: PageProps) {
  const params = await props.params;
  const {
    intent: countryParam,
    city: regionParam,
    beachSlug: cityParam,
    intlBeachSlug,
  } = params;

  // Prevent accidental matches like /ca/san-diego/ocean-beach/extra
  if (isValidStateSlug(countryParam)) notFound();

  try {
    const { getBeachesBySlug } = await import(
      "@/actions/beach/beach-query-actions"
    );
    const candidatesResult = await getBeachesBySlug(intlBeachSlug);
    const beach = pickBestInternationalBeachMatch({
      countryParam,
      regionParam,
      cityParam,
      beaches: candidatesResult.success ? candidatesResult.data ?? [] : [],
    });

    if (!beach) notFound();

    const beachTimezone =
      beach.lat != null && beach.lon != null
        ? getTimezoneFromCoords(beach.lat, beach.lon)
        : null;

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
    const surfReportResult = await getSpotSurfReportPublic(beach);
    const publicBeach = sanitizeBeachEditorialContent(beach);
    const surfCallReport = surfReportResult?.report ?? null;
    const surfCallIsTomorrow = surfReportResult?.isTomorrow ?? false;
    const forecastContext = surfReportResult?.forecastContext ?? null;
    const hourlyForecasts = surfReportResult?.hourlyForecasts ?? [];
    const hourlyForecastDay = surfReportResult?.hourlyForecastDay ?? "today";
    const publicForecastReport =
      selectPublicForecastReportFacts(surfCallReport);
    const publicForecastContext =
      selectPublicForecastContextFacts(forecastContext);

    return (
      <>
        <BeachPageStructuredData
          beachName={publicBeach.name}
          description={`Surf conditions, tides, wind, swell and community intel for ${beach.name}.`}
          latitude={beach.lat || 0}
          longitude={beach.lon || 0}
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

        <WebPageSchema
          name={`${beach.name} Surf Report & Forecast`}
          url={`${baseUrl}${beachUrl}`}
          dateModified={forecastContext?.sourceDataUpdatedAt ?? undefined}
        />

        <AuthenticatedForecastDecisionProvider beachId={publicBeach.id}>
          <BeachDetailClient
            beach={publicBeach}
            slug={intlBeachSlug}
            beachTimezone={beachTimezone}
            heroHeadingLevel="h2"
            heroForecastSlot={
              <PublicForecastAnswer
                beach={publicBeach}
                report={publicForecastReport}
                context={publicForecastContext}
                isTomorrow={surfCallIsTomorrow}
                headingLevel="h1"
                returnTo={beachUrl}
              />
            }
            freeGrowthPhaseEnabled={isFreeGrowthPhaseEnabled()}
            /* Server-rendered inside the zine paper above the tabs — see the
               canonical US route for why this is not inside the forecast tab. */
            afterTabsContent={
              <PublicForecastHourly
                beachName={publicBeach.name}
                forecastHours={hourlyForecasts}
                context={publicForecastContext}
                forecastDay={hourlyForecastDay}
                returnTo={beachUrl}
              />
            }
          />
        </AuthenticatedForecastDecisionProvider>
      </>
    );
  } catch (error) {
    if (isNextRouterSignal(error)) throw error;
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

export async function generateMetadata(props: PageProps): Promise<Metadata> {
  const params = await props.params;
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
    const { getBeachesBySlug } = await import(
      "@/actions/beach/beach-query-actions"
    );
    const candidatesResult = await getBeachesBySlug(intlBeachSlug);
    const beach = pickBestInternationalBeachMatch({
      countryParam: params.intent,
      regionParam: params.city,
      cityParam: params.beachSlug,
      beaches: candidatesResult.success ? candidatesResult.data ?? [] : [],
    });

    if (beach) {
      const locationContext =
        beach.city && beach.state ? ` in ${beach.city}, ${beach.state}` : "";

      const path = buildInternationalBeachUrl(
        beach.country,
        beach.state,
        beach.city,
        beach.slug
      );
      const surfReportResult = await getSpotSurfReportPublic(beach);
      const forecastContext = surfReportResult?.forecastContext ?? null;
      const { title, description } = buildDynamicBeachMetadata({
        beach: {
          name: beach.name,
          city: beach.city,
          state: beach.state,
          break_type: beach.break_type,
          skill_level: beach.skill_level,
          description_excerpt: beach.description
            ? `${beach.description.split(/\.(\s|$)/)[0]}.`
            : null,
          wave_tips: beach.wave_tips,
          crowd_level: beach.crowd_level,
          average_rating: beach.average_rating,
          review_count: beach.review_count,
        },
        forecast: forecastContext
          ? {
              wave_height:
                forecastContext.waveHeightRangeLabel ?? forecastContext.waveHeight,
              dayLabel: surfReportResult?.isTomorrow ? "tomorrow" : "today",
            }
          : null,
      });

      const metadata = buildPageMetadata({
        title: `${title}${locationContext}`,
        description,
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

      return applyIndexabilityToMetadata(
        metadata,
        evaluateBeachForecastIndexability({
          canonicalValid: Boolean(path && path !== "/" && !path.startsWith("/beach/")),
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
        }),
      );
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
