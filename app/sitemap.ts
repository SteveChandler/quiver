import type { MetadataRoute } from "next";

import { HUB_REGION_SLUGS } from "@/lib/data/hub-regions";
import {
  FORECAST_REGIONS,
  getAllForecastRegionSlugs,
} from "@/lib/data/forecast-regions";
import { getIndexableCamRegionSlugs } from "@/lib/data/cam-regions";
import { getCitiesWithBestMonthsData } from "@/actions/city/best-time-actions";
import { getAllBeachLocations } from "@/actions/beach/beach-location-list-actions";
import { getBeaches } from "@/actions/beach/beach-query-actions";
import { getAllCitiesWithBeachSkills } from "@/actions/beach/beach-location-actions";
import {
  buildBeachUrl,
  cityToSlug,
  isUsaCountry,
  isValidCountrySlug,
  isValidStateSlug,
  normalizeBeachCountry,
  stateToSlug,
} from "@/lib/utils/beach-url-utils";
import { slugifyAscii } from "@/lib/utils/text-utils";
import { buildCitySlug } from "@/lib/seo/city-slug-utils";
import { COLLISION_CITY_MAP } from "@/lib/seo/city-collision-list";
import {
  getAllBlogPosts,
  getLatestBlogModifiedDate,
} from "@/lib/data/blog-posts";
import { learnArticles } from "@/lib/data/learn-articles";
import { INDEXABLE_SEO_FUNNEL_PAGES } from "@/lib/seo/funnel-pages";
import { getReviewedCityEditorialContent } from "@/actions/city/city-editorial-actions";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { unstable_cache } from "next/cache";
import { parseWaterTempF } from "@/lib/utils/wetsuit-utils";
import type { Beach } from "@/types/database";
import {
  findNextTideExtremes,
  type TideHeightRow,
} from "@/lib/seo/tide-meta-data";
import {
  cityEditorialKey,
  evaluateBeachIndexability,
  evaluateCityDataIntentIndexability,
  evaluateCityEditorialIndexability,
  isDataBackedCityIntent,
  toBeachEditorialInput,
  toCityEditorialInput,
  type BeachEditorialDatabaseRecord,
  type CityEditorialDatabaseRecord,
} from "@/lib/seo/indexability";
import {
  evaluateBeachPageIndexability,
  isBeachSubPageIndexable,
  type ForecastIndexabilitySnapshot,
} from "@/lib/seo/forecast-indexability";
import {
  FORECAST_INDEXABILITY_REVALIDATE_SECONDS,
  fingerprintBeachIds,
  getCachedForecastIndexabilitySnapshots,
} from "@/lib/seo/forecast-indexability-cache";
import { getBeachesForRegion } from "@/lib/utils/regional-forecast-utils";

const baseUrl = (
  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
).replace(/\/$/, "");

// Update a family date only when its shared page content or template changes
// significantly. Row-backed and authored-content routes use their own timestamps.
const SITEMAP_CONTENT_VERSIONS = {
  staticPages: "2026-02-10",
  beachFallback: "2026-02-10",
  beachTemplate: "2026-08-03",
  cityEditorialFallback: "2026-02-10",
  locationTemplate: "2026-02-01",
  intentTemplate: "2026-03-06",
  guideContent: "2026-03-26",
  forecastTemplate: "2026-02-10",
  camDirectory: "2026-02-11",
  seoFunnelContent: "2026-05-10",
  bestTimeTemplate: "2026-02-12",
  toolsContent: "2026-03-30",
  learnContentFallback: "2026-03-26",
} as const;

function latestSitemapDate(
  fallback: string,
  ...values: Array<string | null | undefined>
): string {
  return values
    .filter((value): value is string => {
      if (!value) return false;
      return !Number.isNaN(Date.parse(value));
    })
    .reduce(
      (latest, candidate) =>
        Date.parse(candidate) > Date.parse(latest) ? candidate : latest,
      fallback,
    );
}

const SITEMAP_ACQUISITION_ROUTES = [
  { path: "/download", lastModified: "2026-07-15" },
  { path: "/android-beta", lastModified: "2026-07-22" },
  { path: "/guides", lastModified: "2026-06-25" },
  { path: "/support", lastModified: "2026-06-25" },
  { path: "/data-deletion", lastModified: "2026-06-25" },
  { path: "/us-open-of-surfing-forecast", lastModified: "2026-07-23" },
] as const;

// Force dynamic rendering because sitemap generation requires database queries
// at request time to fetch beaches, locations, and cities with skill data.
export const dynamic = "force-dynamic";

type SitemapBeachEditorialFields = {
  seo_indexable?: boolean | null;
  editorial_reviewed_at?: string | null;
  editorial_sources?: BeachEditorialDatabaseRecord["editorial_sources"];
  description?: string | null;
  crowd_tips?: string | null;
  wave_tips?: string | null;
  best_conditions_prose?: string | null;
};

export interface BeachSubPageCoverage {
  tideCoverage: ReadonlySet<string>;
  waterTempCoverage: ReadonlySet<string>;
}

interface TideCoverageRow {
  beach_id: string | null;
  ts: string | null;
  tide_height_m: number | null;
}

interface WaterTempCoverageRow {
  beach_id: string | null;
  water_temp: string | null;
  forecast_at: string | null;
}

// PostgREST caps a response at 1000 rows regardless of .limit(). Coverage now
// reads every row per beach (24 hourly tide points, ~8 water-temp points), so
// the batch must stay small enough that a full batch cannot reach that cap:
// 10 beaches x 24h stays well under it even if tide granularity went 4x finer.
const BEACH_COVERAGE_BATCH_SIZE = 10;
const POSTGREST_MAX_ROWS = 1000;

interface CityEditorialRoute {
  editorial: CityEditorialDatabaseRecord;
  lastModified: string;
}

export function isBeachIndexableForSitemap(
  beach: SitemapBeachEditorialFields,
  canonicalPath = "/",
): boolean {
  return evaluateBeachIndexability(toBeachEditorialInput(beach), canonicalPath)
    .indexable;
}

function isCityRouteIndexable(
  route: CityEditorialRoute | undefined,
  expectedIntent: string | null,
  canonicalPath: string,
  dataRich: boolean,
): boolean {
  return evaluateCityEditorialIndexability(
    toCityEditorialInput(route?.editorial),
    expectedIntent,
    canonicalPath,
    dataRich,
  ).indexable;
}

function hasUsableSitemapCountry(beach: { country?: string | null }): boolean {
  // Older callers may omit country entirely; keep that legacy USA behavior.
  // An explicitly present null/blank value is unknown and cannot be canonical.
  return (
    !Object.prototype.hasOwnProperty.call(beach, "country") ||
    normalizeBeachCountry(beach.country) !== null
  );
}

function batchBeachIds(ids: readonly string[]): string[][] {
  const batches: string[][] = [];
  for (let index = 0; index < ids.length; index += BEACH_COVERAGE_BATCH_SIZE) {
    batches.push(ids.slice(index, index + BEACH_COVERAGE_BATCH_SIZE));
  }
  return batches;
}

/**
 * The sub-page routes are force-static with revalidate = 3600, so the robots
 * meta they serve is frozen for up to an hour. The sitemap is force-dynamic and
 * re-evaluated on every request. That asymmetry lets the sitemap advertise a URL
 * the moment its data qualifies, while the page it points at can still be
 * serving noindex from a render up to an hour old.
 *
 * Reading coverage through a cache on the same window puts both sides on the
 * same clock. It bounds the disagreement to one revalidate period instead of
 * leaving the sitemap instantaneous against an hourly page; it does not
 * eliminate it, because the two caches do not turn over in phase. Closing the
 * window entirely would mean making the sub-pages dynamic.
 */

async function getBeachSubPageCoverage(
  beachIds: readonly string[],
): Promise<BeachSubPageCoverage> {
  // Sets do not survive the data cache's JSON round trip, so the cached layer
  // deals in arrays and the Sets are rebuilt here.
  const load = unstable_cache(
    async () => {
      const coverage = await fetchBeachSubPageCoverage(beachIds);
      return {
        tideCoverage: [...coverage.tideCoverage],
        waterTempCoverage: [...coverage.waterTempCoverage],
      };
    },
    ["beach-sub-page-coverage", fingerprintBeachIds(beachIds)],
    { revalidate: FORECAST_INDEXABILITY_REVALIDATE_SECONDS },
  );

  const { tideCoverage, waterTempCoverage } = await load();
  return {
    tideCoverage: new Set(tideCoverage),
    waterTempCoverage: new Set(waterTempCoverage),
  };
}

function warnIfTruncated(rowCount: number, label: string): void {
  if (rowCount < POSTGREST_MAX_ROWS) return;
  // Truncation would silently drop beaches from the sitemap rather than error,
  // so make it loud instead of letting a clean-looking sitemap hide it.
  console.error(
    `Sitemap: ${label} coverage response hit the ${POSTGREST_MAX_ROWS}-row cap; ` +
      "coverage for this batch is incomplete and pages may be omitted. " +
      "Lower BEACH_COVERAGE_BATCH_SIZE.",
  );
}

async function fetchBeachSubPageCoverage(
  beachIds: readonly string[],
): Promise<BeachSubPageCoverage> {
  const tideCoverage = new Set<string>();
  const waterTempCoverage = new Set<string>();
  if (beachIds.length === 0) return { tideCoverage, waterTempCoverage };

  let supabase: Awaited<ReturnType<typeof createSupabaseServiceRoleClient>>;
  try {
    supabase = await createSupabaseServiceRoleClient();
  } catch (error) {
    console.error("Sitemap: Failed to create sub-page coverage client", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return { tideCoverage, waterTempCoverage };
  }

  const now = new Date();
  const tideEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const today = now.toISOString().split("T")[0];
  const tomorrow = new Date(`${today}T00:00:00.000Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  try {
    const responses = await Promise.all(
      batchBeachIds(beachIds).map(async (batch) => {
        const [tideResponse, waterTempResponse] = await Promise.all([
          supabase
            .from("tide_forecasts")
            .select("beach_id, ts, tide_height_m")
            .in("beach_id", batch)
            .gte("ts", now.toISOString())
            .lte("ts", tideEnd.toISOString())
            .limit(POSTGREST_MAX_ROWS),
          supabase
            .from("enhanced_forecasts")
            .select("beach_id, water_temp, forecast_at")
            .in("beach_id", batch)
            .gte("forecast_at", `${today}T00:00:00.000Z`)
            .lt("forecast_at", tomorrow.toISOString())
            .not("water_temp", "is", null)
            .limit(POSTGREST_MAX_ROWS),
        ]);

        return { tideResponse, waterTempResponse };
      }),
    );

    for (const { tideResponse, waterTempResponse } of responses) {
      if (tideResponse.error) {
        console.error("Sitemap: Tide coverage query failed", {
          message: tideResponse.error.message,
        });
      } else {
        const rows = (tideResponse.data ?? []) as TideCoverageRow[];
        warnIfTruncated(rows.length, "tide");
        const byBeach = new Map<string, TideHeightRow[]>();
        for (const row of rows) {
          if (!row.beach_id || !row.ts) continue;
          const series = byBeach.get(row.beach_id) ?? [];
          series.push({ ts: row.ts, tide_height_m: row.tide_height_m });
          byBeach.set(row.beach_id, series);
        }
        // Same predicate the sub-page runs: rows alone are not coverage, a
        // detectable high or low is. Ordering is done here rather than in the
        // query so coverage does not depend on the database returning sorted
        // rows.
        for (const [beachId, series] of byBeach) {
          series.sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts));
          const { nextHigh, nextLow } = findNextTideExtremes(series);
          if (nextHigh || nextLow) tideCoverage.add(beachId);
        }
      }

      if (waterTempResponse.error) {
        console.error("Sitemap: Water-temperature coverage query failed", {
          message: waterTempResponse.error.message,
        });
      } else {
        const rows = (waterTempResponse.data ?? []) as WaterTempCoverageRow[];
        warnIfTruncated(rows.length, "water-temperature");
        // Pick the newest row per beach -- the one getWaterTempMetaData would
        // select -- then apply the same parse and validity bounds. A present
        // but unparseable reading is not coverage.
        const newest = new Map<string, WaterTempCoverageRow>();
        for (const row of rows) {
          if (!row.beach_id) continue;
          const current = newest.get(row.beach_id);
          if (
            !current ||
            Date.parse(row.forecast_at ?? "") >
              Date.parse(current.forecast_at ?? "")
          ) {
            newest.set(row.beach_id, row);
          }
        }
        for (const [beachId, row] of newest) {
          if (parseWaterTempF(row.water_temp) !== null) {
            waterTempCoverage.add(beachId);
          }
        }
      }
    }
  } catch (error) {
    console.error("Sitemap: Sub-page coverage query failed", {
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }

  return { tideCoverage, waterTempCoverage };
}

/**
 * Generate a single flat sitemap combining all routes.
 *
 * NOTE: Reverted from segmented sitemap pattern due to Next.js 16 bug where
 * generateSitemaps() does NOT auto-generate a sitemap index at /sitemap.xml,
 * causing a 404. This flat approach ensures /sitemap.xml is properly served.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Sitemap protocol limit: 50,000 URLs / 50 MB per file.
  // Expected URL count range: ~1,400–2,500 URLs depending on DB beach/city completeness.
  // Breakdown: ~12 static, ~870 beaches (279 × 3 USA + Baja × 1), ~40 city/state locations,
  //   ~300–600 intent pages, ~11 guides, ~17 forecast, ~9 cams, ~1 best-time hub + cities,
  //   ~6 learn — all well under the 50,000 limit.

  // Fetch beaches first — shared between beach routes and location route validation.
  // Location routes are cross-validated against this set to exclude cities whose
  // scoring RPC returns no results (which would 307 redirect to /map, wasting crawl budget).
  const beachesResponse = await getBeaches();
  const allBeaches =
    beachesResponse.success && beachesResponse.data ? beachesResponse.data : [];
  const [forecastIndexabilityByBeachId, beachSubPageCoverage] =
    await Promise.all([
      getCachedForecastIndexabilitySnapshots(
        allBeaches.map((beach) => ({ id: beach.id, timezone: beach.timezone })),
      ),
      getBeachSubPageCoverage(allBeaches.map((beach) => beach.id)),
    ]);
  const reviewedCityEditorial = await getReviewedCityEditorialContent();
  const cityEditorialRoutes = new Map<string, CityEditorialRoute>();
  const selectedCityEditorial = new Map<
    string,
    (typeof reviewedCityEditorial)[number]
  >();
  const editorialRows = [...reviewedCityEditorial].sort((left, right) => {
    const leftReviewed = left.editorial_reviewed_at ? 0 : 1;
    const rightReviewed = right.editorial_reviewed_at ? 0 : 1;
    if (leftReviewed !== rightReviewed) return leftReviewed - rightReviewed;
    const reviewedComparison = (
      right.editorial_reviewed_at ?? ""
    ).localeCompare(left.editorial_reviewed_at ?? "");
    if (reviewedComparison !== 0) return reviewedComparison;
    const updatedComparison = (right.updated_at ?? "").localeCompare(
      left.updated_at ?? "",
    );
    if (updatedComparison !== 0) return updatedComparison;
    return (left.intent === null ? 0 : 1) - (right.intent === null ? 0 : 1);
  });

  for (const editorial of editorialRows) {
    const key = cityEditorialKey(
      editorial.country_slug,
      editorial.state_slug,
      editorial.city_slug,
      editorial.intent === "general" ? null : (editorial.intent ?? null),
    );
    if (!selectedCityEditorial.has(key))
      selectedCityEditorial.set(key, editorial);
  }

  for (const editorial of selectedCityEditorial.values()) {
    cityEditorialRoutes.set(
      cityEditorialKey(
        editorial.country_slug,
        editorial.state_slug,
        editorial.city_slug,
        editorial.intent === "general" ? null : (editorial.intent ?? null),
      ),
      {
        editorial,
        lastModified:
          editorial.updated_at ||
          editorial.editorial_reviewed_at ||
          SITEMAP_CONTENT_VERSIONS.cityEditorialFallback,
      },
    );
  }

  // Build set of city+state combos that have at least one valid beach
  const validCitySlugs = new Set<string>();
  for (const beach of allBeaches) {
    if (beach.slug && beach.city && beach.state) {
      const st = stateToSlug(beach.state);
      const ct = slugifyAscii(beach.city);
      if (st && ct) validCitySlugs.add(`${st}/${ct}`);
    }
  }

  // Combine all route generators into a single flat sitemap
  const [
    staticRoutes,
    beachRoutes,
    locationRoutes,
    intentRoutes,
    guideRoutes,
    forecastRoutes,
    camRoutes,
    seoFunnelRoutes,
    bestTimeRoutes,
    learnRoutes,
    blogRoutes,
  ] = await Promise.all([
    Promise.resolve(getStaticRoutes()),
    Promise.resolve(
      buildBeachRoutes(
        allBeaches,
        forecastIndexabilityByBeachId,
        beachSubPageCoverage,
      ),
    ),
    getLocationRoutes(validCitySlugs, cityEditorialRoutes),
    buildIntentRoutes(cityEditorialRoutes),
    Promise.resolve(getGuideRoutes()),
    Promise.resolve(
      getForecastRoutes(allBeaches, forecastIndexabilityByBeachId),
    ),
    Promise.resolve(getCamRoutes()),
    Promise.resolve(getSeoFunnelRoutes()),
    getBestTimeToSurfRoutes(cityEditorialRoutes),
    Promise.resolve(getLearnRoutes()),
    Promise.resolve(getBlogRoutes()),
  ]);

  const routes = [
    ...staticRoutes,
    ...beachRoutes,
    ...locationRoutes,
    ...intentRoutes,
    ...guideRoutes,
    ...forecastRoutes,
    ...camRoutes,
    ...seoFunnelRoutes,
    ...bestTimeRoutes,
    ...learnRoutes,
    ...blogRoutes,
    ...getToolsRoutes(),
  ];

  const seenUrls = new Set<string>();
  return routes.filter((route) => {
    if (seenUrls.has(route.url)) return false;
    seenUrls.add(route.url);
    return true;
  });
}

// =============================================================================
// Route Generators
// =============================================================================

/**
 * Static pages - home, features, about, etc.
 */
function getStaticRoutes(): MetadataRoute.Sitemap {
  const staticRoutes = [
    "/",
    "/features",
    "/about",
    "/privacy",
    "/terms",
    "/plans",
    "/map",
    "/beaches",
    "/beaches/usa",
    "/beaches/mexico",
    "/for-surf-schools",
    "/for-businesses",
    "/free-surf-reports",
    "/best-surf-forecast-app",
    "/surf-session-log",
    "/personal-surf-forecast",
    "/forecast-accuracy",
    "/vs/surfline",
    "/vs/surfline/free",
    "/roadmap",
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: SITEMAP_CONTENT_VERSIONS.staticPages,
  }));

  return [
    ...staticRoutes,
    ...SITEMAP_ACQUISITION_ROUTES.map((route) => ({
      url: `${baseUrl}${route.path}`,
      lastModified: route.lastModified,
    })),
  ];
}

/**
 * Beach detail pages + tides/water-temp subpages.
 *
 * Subpages are included because they have robust metadata, FAQs, structured
 * data, and CTAs. Google already crawls and ranks them via internal links —
 * adding them to the sitemap formalizes discoverability.
 *
 * Tides/water-temp subpages are generated for US beaches and eligible Mexico
 * beaches. Other international beaches use a 4-segment URL pattern without
 * dedicated subpage routes.
 *
 * Accepts pre-fetched beach data to avoid duplicate DB calls (the main
 * sitemap function shares this data with location route validation).
 */
export function buildBeachRoutes(
  beaches: NonNullable<Awaited<ReturnType<typeof getBeaches>>["data"]>,
  forecastIndexabilityByBeachId: ReadonlyMap<
    string,
    ForecastIndexabilitySnapshot
  >,
  subPageCoverage?: BeachSubPageCoverage,
): MetadataRoute.Sitemap {
  const subPageTypes = ["tides", "water-temp"] as const;

  return beaches
    .filter(
      (beach) =>
        beach.slug &&
        beach.city &&
        beach.state &&
        hasUsableSitemapCountry(beach),
    )
    .flatMap((beach) => {
      const beachPath = buildBeachUrl(beach);
      const beachUrl = `${baseUrl}${beachPath}`;
      const countrySlug = slugifyAscii(
        normalizeBeachCountry(beach.country) ?? "",
      );

      const lastModifiedDate = latestSitemapDate(
        countrySlug === "mexico"
          ? SITEMAP_CONTENT_VERSIONS.beachTemplate
          : SITEMAP_CONTENT_VERSIONS.beachFallback,
        (beach as { updated_at?: string | null }).updated_at,
        beach.created_at,
      );

      // US beaches and Mexico beaches have dedicated tides/water-temp routes;
      // other international beaches retain their four-segment detail URL only.
      const stateSlug = stateToSlug(beach.state);
      const isUsa = isUsaCountry(beach.country) && isValidStateSlug(stateSlug);
      const hasDedicatedSubPages = isUsa || countrySlug === "mexico";
      const forecastSnapshot = forecastIndexabilityByBeachId.get(beach.id);
      const forecastIndexable = evaluateBeachPageIndexability(
        forecastSnapshot,
        !beachPath.startsWith("/beach/"),
      ).indexable;

      const candidateRoutes = [
        ...(forecastIndexable
          ? [
              {
                url: beachUrl,
                lastModified: lastModifiedDate,
              },
            ]
          : []),
        ...(hasDedicatedSubPages
          ? subPageTypes.flatMap((subPage) => {
              const subPagePath = `${beachPath}/${subPage}`;
              const hasSubPageData = subPageCoverage
                ? subPage === "tides"
                  ? subPageCoverage.tideCoverage.has(beach.id)
                  : subPageCoverage.waterTempCoverage.has(beach.id)
                : true;
              return isBeachSubPageIndexable(forecastSnapshot, subPagePath, {
                hasSubPageData,
              })
                ? [
                    {
                      url: `${baseUrl}${subPagePath}`,
                      lastModified: lastModifiedDate,
                    },
                  ]
                : [];
            })
          : []),
      ];

      return candidateRoutes;
    });
}

/**
 * Location pages - city and state listing pages.
 */
async function getLocationRoutes(
  validCitySlugs: Set<string>,
  cityEditorialRoutes: Map<string, CityEditorialRoute>,
): Promise<MetadataRoute.Sitemap> {
  const response = await getAllBeachLocations();
  if (!response.success || !response.data) {
    console.error("Sitemap: Failed to load beach locations");
    return [];
  }

  const usaStates = new Set<string>();
  const internationalHubs = new Set<string>();
  const emittedUrls = new Set<string>();
  const locationRoutes: MetadataRoute.Sitemap = [];
  let filteredCount = 0;

  // Process metros first so their URLs take priority over individual cities
  const metros = response.data.filter((l: any) => l.isMetro);
  const nonMetros = response.data.filter((l: any) => !l.isMetro);

  for (const location of [...metros, ...nonMetros]) {
    const isUsa =
      !location.country ||
      String(location.country).toLowerCase() === "usa" ||
      String(location.country).toLowerCase() === "us";

    // HI: replace ambiguous Waimea city URL with island-specific pages
    if (
      isUsa &&
      stateToSlug(location.state) === "hi" &&
      cityToSlug(location.city) === "waimea"
    ) {
      usaStates.add("hi");
      for (const citySlug of ["waimea-kauai", "waimea-big-island"]) {
        const canonicalPath = `/hi/${citySlug}`;
        const editorial = cityEditorialRoutes.get(
          cityEditorialKey("usa", "hi", "waimea", null),
        );
        if (
          !isCityRouteIndexable(
            editorial,
            null,
            canonicalPath,
            (location.beachCount ?? 0) >= 1,
          )
        ) {
          continue;
        }
        locationRoutes.push({
          url: `${baseUrl}${canonicalPath}`,
          lastModified: latestSitemapDate(
            SITEMAP_CONTENT_VERSIONS.locationTemplate,
            editorial?.lastModified,
          ),
        });
      }
      continue;
    }

    // Filter out locations with no beaches (thin content).
    // City listing pages with a single beach are valid — they show the beach
    // with full scoring, a map, and intent quick-links. Requiring 2+ beaches
    // was overly conservative and excluded many real surf cities.
    // Metro areas (beachCount=0 in the listing) are exempt — their content
    // is aggregated from constituent cities at runtime.
    if (!(location as any).isMetro && (location.beachCount ?? 0) < 1) continue;

    if (isUsa) {
      const stateSlug = stateToSlug(location.state);
      const citySlug = slugifyAscii(location.city);
      if (stateSlug && citySlug) {
        const editorial = cityEditorialRoutes.get(
          cityEditorialKey("usa", stateSlug, citySlug, null),
        );
        // Only include cities that have valid beaches in the sitemap.
        // Cities without scored beaches redirect to /map, wasting crawl budget.
        // Metro areas are exempt — their content is aggregated from constituent
        // cities at runtime, so they won't appear in the per-beach validCitySlugs set.
        if (
          !(location as any).isMetro &&
          !validCitySlugs.has(`${stateSlug}/${citySlug}`)
        ) {
          filteredCount++;
          continue;
        }
        const canonicalPath = `/${stateSlug}/${citySlug}`;
        if (
          !isCityRouteIndexable(
            editorial,
            null,
            canonicalPath,
            (location.beachCount ?? 0) >= 1 ||
              Boolean((location as any).isMetro),
          )
        ) {
          continue;
        }
        const locationUrl = `${baseUrl}${canonicalPath}`;
        if (emittedUrls.has(locationUrl)) continue;
        emittedUrls.add(locationUrl);
        usaStates.add(stateSlug);
        locationRoutes.push({
          url: locationUrl,
          lastModified: latestSitemapDate(
            SITEMAP_CONTENT_VERSIONS.locationTemplate,
            editorial?.lastModified,
          ),
        });
      }
    } else {
      const countrySlug = slugifyAscii(location.country);
      const regionSlug = slugifyAscii(location.state);
      const citySlug = slugifyAscii(location.city);
      if (countrySlug && regionSlug && isValidCountrySlug(countrySlug)) {
        internationalHubs.add(`${baseUrl}/beaches/${countrySlug}`);
        internationalHubs.add(
          `${baseUrl}/beaches/${countrySlug}/${regionSlug}`,
        );
      }
      if (countrySlug && regionSlug && citySlug) {
        const editorial = cityEditorialRoutes.get(
          cityEditorialKey(countrySlug, regionSlug, citySlug, null),
        );
        const canonicalPath = `/${countrySlug}/${regionSlug}/${citySlug}`;
        if (
          !isCityRouteIndexable(
            editorial,
            null,
            canonicalPath,
            (location.beachCount ?? 0) >= 1,
          )
        ) {
          continue;
        }
        const intlUrl = `${baseUrl}${canonicalPath}`;
        if (emittedUrls.has(intlUrl)) continue;
        emittedUrls.add(intlUrl);
        locationRoutes.push({
          url: intlUrl,
          lastModified: latestSitemapDate(
            SITEMAP_CONTENT_VERSIONS.locationTemplate,
            editorial?.lastModified,
          ),
        });
      }
    }
  }

  if (filteredCount > 0) {
    console.log(
      `Sitemap: Filtered ${filteredCount} city routes without valid beaches`,
    );
  }

  // Add state-level pages
  const stateRoutes: MetadataRoute.Sitemap = [...usaStates].map(
    (stateSlug) => ({
      url: `${baseUrl}/beaches/usa/${stateSlug}`,
      lastModified: SITEMAP_CONTENT_VERSIONS.locationTemplate,
    }),
  );

  const internationalHubRoutes: MetadataRoute.Sitemap = [
    ...internationalHubs,
  ].map((url) => ({
    url,
    lastModified: SITEMAP_CONTENT_VERSIONS.locationTemplate,
  }));

  return [...stateRoutes, ...internationalHubRoutes, ...locationRoutes];
}

/**
 * Intent pages - city and state level intent pages.
 *
 * IMPORTANT: Filters out:
 * 1. Skill-based intent pages (beginner, longboard) for cities without matching beaches
 * 2. Single-beach cities unless the state has <20 total beaches AND the beach has editorial content
 * 3. Cities with exactly 2 beaches that lack editorial quality content
 *    (editorial quality = description + at least one of crowd_tips/wave_tips/best_conditions_prose
 *     on both beaches). Cities with 3+ beaches are included without this extra guard.
 *
 * This prevents empty or thin intent pages from being included in the sitemap.
 */
export async function buildIntentRoutes(
  cityEditorialRoutes: Map<string, CityEditorialRoute>,
): Promise<MetadataRoute.Sitemap> {
  // Skill-based intents that require cities to have matching beach skill levels
  const BEGINNER_INTENTS = new Set(["beginner", "longboard"]);
  const FILTERED_INTENTS = new Set(["beginner", "longboard", "least-crowded"]);
  const intents = [
    "beginner",
    "least-crowded",
    "tide",
    "water-temp",
    "longboard",
    "dawn-patrol",
    "sunset",
  ];

  const routes: MetadataRoute.Sitemap = [];

  // City-level intent pages (database-driven)
  try {
    const citiesResult = await getAllCitiesWithBeachSkills(1);
    if (
      citiesResult.success &&
      citiesResult.data &&
      citiesResult.data.length > 0
    ) {
      // Filter to US-only cities (non-US cities lack state codes for disambiguation)
      const usCities = citiesResult.data.filter(
        (c) =>
          c.country?.toUpperCase() === "USA" ||
          c.country?.toUpperCase() === "US",
      );
      const collisionMap = COLLISION_CITY_MAP;

      // Build per-state beach count for thin-state exemptions
      const stateBeachCounts = new Map<string, number>();
      for (const c of usCities) {
        if (c.state) {
          const current = stateBeachCounts.get(c.state) ?? 0;
          stateBeachCounts.set(c.state, current + c.beachCount);
        }
      }

      for (const cityRecord of usCities) {
        const citySlug = buildCitySlug(
          cityRecord.city,
          cityRecord.state,
          collisionMap,
        );
        if (!citySlug) continue;

        // Single-beach cities: allow only in thin states (<20 beaches) WITH editorial content
        if (cityRecord.beachCount === 1) {
          const stateTotal = stateBeachCounts.get(cityRecord.state) ?? 0;
          if (stateTotal >= 20 || !cityRecord.hasEditorialContent) continue;
        }

        // For cities with exactly 2 beaches, require editorial quality content
        // (description + at least one editorial field on both beaches).
        // Cities with 3+ beaches have sufficient content depth without this check.
        if (cityRecord.beachCount === 2 && !cityRecord.hasEditorialContent)
          continue;

        for (const intent of intents) {
          const editorial = cityEditorialRoutes.get(
            cityEditorialKey(
              "usa",
              cityRecord.state,
              cityToSlug(cityRecord.city),
              intent,
            ),
          );
          // Filter skill-based and crowd-based intents to cities with matching beaches.
          // This ensures empty intent pages are NOT included in the sitemap.
          if (FILTERED_INTENTS.has(intent)) {
            if (BEGINNER_INTENTS.has(intent) && !cityRecord.hasBeginnerBeaches)
              continue;
            if (
              intent === "least-crowded" &&
              !cityRecord.hasLeastCrowdedBeaches
            )
              continue;
          }
          if (intent === "tide" && cityRecord.hasTideData === false) continue;
          if (intent === "water-temp" && cityRecord.hasWaterTempData === false)
            continue;

          const canonicalPath = `/${intent}/${citySlug}`;
          const dataRich =
            cityRecord.beachCount >= 3 || cityRecord.hasEditorialContent;

          const indexable = isDataBackedCityIntent(intent)
            ? evaluateCityDataIntentIndexability(
                toCityEditorialInput(editorial?.editorial),
                canonicalPath,
                {
                  hasIntentData:
                    intent === "tide"
                      ? cityRecord.hasTideData !== false
                      : cityRecord.hasWaterTempData !== false,
                  dataRich,
                },
              ).indexable
            : isCityRouteIndexable(editorial, intent, canonicalPath, dataRich);

          if (!indexable) continue;

          routes.push({
            url: `${baseUrl}${canonicalPath}`,
            lastModified: latestSitemapDate(
              SITEMAP_CONTENT_VERSIONS.intentTemplate,
              editorial?.lastModified,
            ),
          });
        }
      }
    }
  } catch (error) {
    console.error("Sitemap: Failed to generate city intent routes", error);
  }

  return routes;
}

/**
 * Hub region guide pages.
 */
function getGuideRoutes(): MetadataRoute.Sitemap {
  return HUB_REGION_SLUGS.map((region) => ({
    url: `${baseUrl}/guides/surfing-${region}`,
    lastModified: SITEMAP_CONTENT_VERSIONS.guideContent,
  }));
}

/**
 * Forecast pages - hub landing page and regional forecast pages.
 */
function latestForecastModifiedForBeaches(
  beaches: Array<{ id: string }>,
  forecastIndexabilityByBeachId: ReadonlyMap<
    string,
    ForecastIndexabilitySnapshot
  >,
): string {
  return latestSitemapDate(
    SITEMAP_CONTENT_VERSIONS.forecastTemplate,
    ...beaches.map(
      (beach) =>
        forecastIndexabilityByBeachId.get(beach.id)?.sourceDataUpdatedAt,
    ),
  );
}

function getForecastRoutes(
  allBeaches: Beach[],
  forecastIndexabilityByBeachId: ReadonlyMap<
    string,
    ForecastIndexabilitySnapshot
  >,
): MetadataRoute.Sitemap {
  const routes: MetadataRoute.Sitemap = [];

  // Forecast hub landing page
  routes.push({
    url: `${baseUrl}/forecast`,
    lastModified: latestForecastModifiedForBeaches(
      allBeaches,
      forecastIndexabilityByBeachId,
    ),
  });

  // Regional forecast pages (e.g., /forecast/southern-california)
  const regionSlugs = getAllForecastRegionSlugs();
  for (const slug of regionSlugs) {
    const region = FORECAST_REGIONS[slug];
    const regionBeaches = region
      ? getBeachesForRegion(region, allBeaches)
      : [];
    routes.push({
      url: `${baseUrl}/forecast/${slug}`,
      lastModified: latestForecastModifiedForBeaches(
        regionBeaches,
        forecastIndexabilityByBeachId,
      ),
    });
  }

  return routes;
}

/**
 * Cam directory pages - hub and regional cam listings.
 */
function getCamRoutes(): MetadataRoute.Sitemap {
  const routes: MetadataRoute.Sitemap = [];

  // Cam hub page
  routes.push({
    url: `${baseUrl}/cams`,
    lastModified: SITEMAP_CONTENT_VERSIONS.camDirectory,
  });

  // Regional cam pages (e.g., /cams/southern-california). Regions owned by a
  // curated /surf-cams page redirect and are listed via the funnel routes.
  const camRegionSlugs = getIndexableCamRegionSlugs();
  for (const slug of camRegionSlugs) {
    routes.push({
      url: `${baseUrl}/cams/${slug}`,
      lastModified: SITEMAP_CONTENT_VERSIONS.camDirectory,
    });
  }

  return routes;
}

/**
 * Curated SEO funnel pages.
 */
function getSeoFunnelRoutes(): MetadataRoute.Sitemap {
  return INDEXABLE_SEO_FUNNEL_PAGES.filter(
    (page) => !isStateIntentPath(page.path),
  ).map((page) => ({
    url: `${baseUrl}${page.path}`,
    lastModified: SITEMAP_CONTENT_VERSIONS.seoFunnelContent,
  }));
}

function isStateIntentPath(path: string): boolean {
  const match = path.match(
    /^\/(beginner|least-crowded|tide|water-temp|longboard|dawn-patrol|sunset)\/([a-z]{2})$/,
  );
  return Boolean(match?.[2] && isValidStateSlug(match[2]));
}

/**
 * Best-time-to-surf city pages.
 * Only includes cities with >= 2 beaches that have best_months data.
 * The threshold was lowered from 3 to 2 to expand coverage to smaller high-quality markets.
 */
async function getBestTimeToSurfRoutes(
  cityEditorialRoutes: Map<string, CityEditorialRoute>,
): Promise<MetadataRoute.Sitemap> {
  // Hub page
  const routes: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/best-time-to-surf`,
      lastModified: SITEMAP_CONTENT_VERSIONS.bestTimeTemplate,
    },
  ];

  try {
    const result = await getCitiesWithBestMonthsData();
    if (!result.success || !result.data) return routes;

    const collisionMap = COLLISION_CITY_MAP;
    const cityRoutes = result.data
      .map((c) => {
        const citySlug = buildCitySlug(c.city, c.state, collisionMap);
        if (!citySlug) return null;
        const editorial = cityEditorialRoutes.get(
          cityEditorialKey("usa", c.state, cityToSlug(c.city), "best-time"),
        );
        const canonicalPath = `/best-time-to-surf/${citySlug}`;
        if (
          !isCityRouteIndexable(
            editorial,
            "best-time",
            canonicalPath,
            c.beachCount >= 1,
          )
        ) {
          return null;
        }
        return {
          url: `${baseUrl}${canonicalPath}`,
          lastModified: latestSitemapDate(
            SITEMAP_CONTENT_VERSIONS.bestTimeTemplate,
            editorial?.lastModified,
          ),
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    return [...routes, ...cityRoutes];
  } catch (error) {
    console.error(
      "Sitemap: Failed to generate best-time-to-surf routes",
      error,
    );
    return routes;
  }
}

/**
 * Free surf tools — static routes for all 8 tools.
 */
function getToolsRoutes(): MetadataRoute.Sitemap {
  const toolSlugs = [
    "tide-clock",
    "wave-converter",
    "wind-checker",
    "dawn-patrol",
    "board-calculator",
    "swell-analyzer",
    "water-quality",
  ];

  return [
    {
      url: `${baseUrl}/tools`,
      lastModified: SITEMAP_CONTENT_VERSIONS.toolsContent,
    },
    ...toolSlugs.map((slug) => ({
      url: `${baseUrl}/tools/${slug}`,
      lastModified: SITEMAP_CONTENT_VERSIONS.toolsContent,
    })),
  ];
}

/**
 * Learn hub and article pages — educational content for AI citability.
 */
function getLearnRoutes(): MetadataRoute.Sitemap {
  return [
    {
      url: `${baseUrl}/learn`,
      lastModified: learnArticles.reduce<string>(
        (latest, article) =>
          (article.dateModified ?? article.datePublished ?? "") > latest
            ? (article.dateModified ?? article.datePublished ?? latest)
            : latest,
        SITEMAP_CONTENT_VERSIONS.learnContentFallback,
      ),
    },
    ...learnArticles.map((article) => ({
      url: `${baseUrl}/learn/${article.slug}`,
      lastModified:
        article.dateModified ??
        article.datePublished ??
        SITEMAP_CONTENT_VERSIONS.learnContentFallback,
    })),
  ];
}

/**
 * Blog hub and post pages — founder notes and product transparency updates.
 */
function getBlogRoutes(): MetadataRoute.Sitemap {
  const blogDate = getLatestBlogModifiedDate();
  const posts = getAllBlogPosts();

  return [
    {
      url: `${baseUrl}/blog`,
      lastModified: blogDate,
    },
    ...posts.map((post) => ({
      url: `${baseUrl}/blog/${post.slug}`,
      lastModified: post.dateModified ?? post.datePublished,
    })),
  ];
}
