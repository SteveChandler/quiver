import type { MetadataRoute } from "next";

import { HUB_REGION_SLUGS } from "@/lib/data/hub-regions";
import { getAllForecastRegionSlugs } from "@/lib/data/forecast-regions";
import { getAllCamRegionSlugs } from "@/lib/data/cam-regions";
import { getCitiesWithBestMonthsData } from "@/actions/city/best-time-actions";
import { getAllBeachLocations } from "@/actions/beach/beach-location-list-actions";
import { getBeaches } from "@/actions/beach/beach-query-actions";
import { getAllCitiesWithBeachSkills } from "@/actions/beach/beach-location-actions";
import {
  buildBeachUrl,
  cityToSlug,
  isValidCountrySlug,
  isValidStateSlug,
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

const baseUrl = (
  process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
).replace(/\/$/, "");

// Force dynamic rendering because sitemap generation requires database queries
// at request time to fetch beaches, locations, and cities with skill data.
export const dynamic = "force-dynamic";

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
    Promise.resolve(buildBeachRoutes(allBeaches)),
    getLocationRoutes(validCitySlugs),
    getIntentRoutes(),
    Promise.resolve(getGuideRoutes()),
    Promise.resolve(getForecastRoutes()),
    Promise.resolve(getCamRoutes()),
    Promise.resolve(getSeoFunnelRoutes()),
    getBestTimeToSurfRoutes(),
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
  // Use fixed date - these pages change when content updates, not per-request
  const staticPageDate = "2026-02-10";

  return [
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
    "/forecast-accuracy",
    "/vs/surfline",
    "/vs/surfline/free",
    "/roadmap",
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: staticPageDate,
    changeFrequency: "daily",
    priority:
      route === "/"
        ? 1
        : route === "/free-surf-reports"
          ? 0.85
          : route === "/vs/surfline"
            ? 0.8
            : route === "/vs/surfline/free"
              ? 0.78
              : route === "/roadmap"
                ? 0.6
                : 0.7,
  }));
}

/**
 * Beach detail pages + tides/water-temp subpages.
 *
 * Subpages are included because they have robust metadata, FAQs, structured
 * data, and CTAs. Google already crawls and ranks them via internal links —
 * adding them to the sitemap formalizes discoverability.
 *
 * Tides/water-temp subpages are only generated for US beaches (state slug is a
 * valid 2-letter US state). International beaches (e.g., Baja Mexico) use a
 * 4-segment URL pattern that does not have dedicated subpage routes.
 *
 * Accepts pre-fetched beach data to avoid duplicate DB calls (the main
 * sitemap function shares this data with location route validation).
 */
function buildBeachRoutes(beaches: NonNullable<Awaited<ReturnType<typeof getBeaches>>["data"]>): MetadataRoute.Sitemap {
  const fallbackDate = "2026-02-10";

  const subPageTypes = ["tides", "water-temp"] as const;

  return beaches
    .filter((b) => b.slug && b.city && b.state) // Only include beaches with complete location data
    .flatMap((beach) => {
      const beachPath = buildBeachUrl(beach);
      const beachUrl = `${baseUrl}${beachPath}`;

      const lastModifiedDate =
        (beach as { updated_at?: string | null }).updated_at ||
        beach.created_at ||
        fallbackDate;

      // Determine whether this is a US beach. Only US beaches have tides/water-temp
      // subpage routes — international beaches (e.g., /mexico/baja-california/rosarito/teresas)
      // use a 4-segment URL pattern with no dedicated subpage routes.
      const stateSlug = stateToSlug(beach.state);
      const isUsa = isValidStateSlug(stateSlug);

      // Main beach page + tides and water-temp subpages (US only).
      // Subpages have robust metadata, FAQs, structured data, and CTAs —
      // Google is already crawling them via internal links and ranking them
      // (e.g., T-Street /tides: 1,209 impressions). Adding to sitemap
      // formalizes discoverability for these high-intent queries.
      return [
        {
          url: beachUrl,
          lastModified: lastModifiedDate,
          changeFrequency: "weekly" as const,
          priority: 0.7,
        },
        ...(isUsa
          ? subPageTypes.map((subPage) => ({
              url: `${beachUrl}/${subPage}`,
              lastModified: lastModifiedDate,
              changeFrequency: "weekly" as const,
              priority: 0.65,
            }))
          : []),
      ];
    });
}

/**
 * Location pages - city and state listing pages.
 */
async function getLocationRoutes(validCitySlugs: Set<string>): Promise<MetadataRoute.Sitemap> {
  const response = await getAllBeachLocations();
  if (!response.success || !response.data) {
    console.error("Sitemap: Failed to load beach locations");
    return [];
  }

  // Use fixed date - location pages change when template updates, not per-request
  const locationPageDate = "2026-02-01";

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
      locationRoutes.push(
        {
          url: `${baseUrl}/hi/waimea-kauai`,
          lastModified: locationPageDate,
          changeFrequency: "hourly",
          priority: 0.85,
        },
        {
          url: `${baseUrl}/hi/waimea-big-island`,
          lastModified: locationPageDate,
          changeFrequency: "hourly",
          priority: 0.85,
        }
      );
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
        // Only include cities that have valid beaches in the sitemap.
        // Cities without scored beaches redirect to /map, wasting crawl budget.
        // Metro areas are exempt — their content is aggregated from constituent
        // cities at runtime, so they won't appear in the per-beach validCitySlugs set.
        if (!(location as any).isMetro && !validCitySlugs.has(`${stateSlug}/${citySlug}`)) {
          filteredCount++;
          continue;
        }
        const locationUrl = `${baseUrl}/${stateSlug}/${citySlug}`;
        if (emittedUrls.has(locationUrl)) continue;
        emittedUrls.add(locationUrl);
        usaStates.add(stateSlug);
        locationRoutes.push({
          url: locationUrl,
          lastModified: locationPageDate,
          changeFrequency: "hourly",
          priority: 0.85,
        });
      }
    } else {
      const countrySlug = slugifyAscii(location.country);
      const regionSlug = slugifyAscii(location.state);
      const citySlug = slugifyAscii(location.city);
      if (countrySlug && regionSlug && citySlug) {
        if (isValidCountrySlug(countrySlug)) {
          internationalHubs.add(`${baseUrl}/beaches/${countrySlug}`);
          internationalHubs.add(`${baseUrl}/beaches/${countrySlug}/${regionSlug}`);
        }
        const intlUrl = `${baseUrl}/${countrySlug}/${regionSlug}/${citySlug}`;
        if (emittedUrls.has(intlUrl)) continue;
        emittedUrls.add(intlUrl);
        locationRoutes.push({
          url: intlUrl,
          lastModified: locationPageDate,
          changeFrequency: "weekly",
          priority: 0.75,
        });
      }
    }
  }

  if (filteredCount > 0) {
    console.log(`Sitemap: Filtered ${filteredCount} city routes without valid beaches`);
  }

  // Add state-level pages
  const stateRoutes: MetadataRoute.Sitemap = [...usaStates].map((stateSlug) => ({
    url: `${baseUrl}/beaches/usa/${stateSlug}`,
    lastModified: locationPageDate,
    changeFrequency: "weekly",
    priority: 0.7,
  }));

  const internationalHubRoutes: MetadataRoute.Sitemap = [...internationalHubs].map((url) => ({
    url,
    lastModified: locationPageDate,
    changeFrequency: "weekly",
    priority: url.split("/").length <= 5 ? 0.7 : 0.65,
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
async function getIntentRoutes(): Promise<MetadataRoute.Sitemap> {
  // Use template version date - intent pages change when template updates
  const intentTemplateDate = "2026-03-06";

  // Skill-based intents that require cities to have matching beach skill levels
  const BEGINNER_INTENTS = new Set(["beginner", "longboard"]);
  const FILTERED_INTENTS = new Set(["beginner", "longboard", "least-crowded"]);
  const intents = ["beginner", "least-crowded", "tide", "water-temp", "longboard", "dawn-patrol", "sunset"];

  const routes: MetadataRoute.Sitemap = [];

  // Track which states have beginner/longboard beaches and least-crowded beaches
  // (derived from city data below).
  const statesWithBeginnerBeaches = new Set<string>();
  const statesWithLeastCrowdedBeaches = new Set<string>();

  // City-level intent pages (database-driven)
  try {
    const citiesResult = await getAllCitiesWithBeachSkills(1);
    if (citiesResult.success && citiesResult.data && citiesResult.data.length > 0) {
      // Filter to US-only cities (non-US cities lack state codes for disambiguation)
      const usCities = citiesResult.data.filter(
        (c) => c.country?.toUpperCase() === "USA" || c.country?.toUpperCase() === "US"
      );
      const collisionMap = COLLISION_CITY_MAP;

      // Derive which states have beginner/longboard beaches and least-crowded beaches
      // for state-level filtering below
      for (const c of usCities) {
        if (c.hasBeginnerBeaches && c.state) {
          statesWithBeginnerBeaches.add(c.state.toLowerCase());
        }
        if (c.hasLeastCrowdedBeaches && c.state) {
          statesWithLeastCrowdedBeaches.add(c.state.toLowerCase());
        }
      }

      // Build per-state beach count for thin-state exemptions
      const stateBeachCounts = new Map<string, number>();
      for (const c of usCities) {
        if (c.state) {
          const current = stateBeachCounts.get(c.state) ?? 0;
          stateBeachCounts.set(c.state, current + c.beachCount);
        }
      }

      for (const cityRecord of usCities) {
        const citySlug = buildCitySlug(cityRecord.city, cityRecord.state, collisionMap);
        if (!citySlug) continue;

        // Single-beach cities: allow only in thin states (<20 beaches) WITH editorial content
        if (cityRecord.beachCount === 1) {
          const stateTotal = stateBeachCounts.get(cityRecord.state) ?? 0;
          if (stateTotal >= 20 || !cityRecord.hasEditorialContent) continue;
        }

        // For cities with exactly 2 beaches, require editorial quality content
        // (description + at least one editorial field on both beaches).
        // Cities with 3+ beaches have sufficient content depth without this check.
        if (cityRecord.beachCount === 2 && !cityRecord.hasEditorialContent) continue;

        for (const intent of intents) {
          // Filter skill-based and crowd-based intents to cities with matching beaches.
          // This ensures empty intent pages are NOT included in the sitemap.
          if (FILTERED_INTENTS.has(intent)) {
            if (BEGINNER_INTENTS.has(intent) && !cityRecord.hasBeginnerBeaches) continue;
            if (intent === "least-crowded" && !cityRecord.hasLeastCrowdedBeaches) continue;
          }

          // Dynamic priority based on beach count
          const priority = cityRecord.beachCount >= 10 ? 0.8 : 0.7;

          routes.push({
            url: `${baseUrl}/${intent}/${citySlug}`,
            lastModified: intentTemplateDate,
            changeFrequency: "daily" as const,
            priority: intent === "beginner" ? Math.min(0.85, priority + 0.05) : priority,
          });
        }
      }
    }
  } catch (error) {
    console.error("Sitemap: Failed to generate city intent routes", error);
  }

  // State-level intent pages for major US surf markets and territories.
  // This is a curated subset (not all coastal states) focusing on states/territories with
  // significant surf communities: CA, HI, FL (Tier 1), plus East Coast, PNW, TX (Tier 2), and PR (territory).
  //
  // Skill-based intents (beginner, longboard) are filtered per-state using the city data
  // already fetched above, preventing empty/thin pages from entering the sitemap.
  const usStates = ["ca", "or", "wa", "hi", "pr", "fl", "nj", "ny", "nc", "sc", "tx", "ma", "me", "nh", "ri", "ga"];
  for (const state of usStates) {
    for (const intent of intents) {
      // Skip skill-based and crowd-based intents for states with no matching beaches.
      if (FILTERED_INTENTS.has(intent)) {
        if (BEGINNER_INTENTS.has(intent) && !statesWithBeginnerBeaches.has(state)) continue;
        if (intent === "least-crowded" && !statesWithLeastCrowdedBeaches.has(state)) continue;
      }

      routes.push({
        url: `${baseUrl}/${intent}/${state}`,
        lastModified: intentTemplateDate,
        changeFrequency: "daily" as const,
        priority: 0.75,
      });
    }
  }

  return routes;
}

/**
 * Hub region guide pages.
 */
function getGuideRoutes(): MetadataRoute.Sitemap {
  // Use fixed date - guide pages change when content is updated
  const guidePageDate = "2026-01-15";

  return HUB_REGION_SLUGS.map((region) => ({
    url: `${baseUrl}/guides/surfing-${region}`,
    lastModified: guidePageDate,
    changeFrequency: "weekly" as const,
    priority: 0.9,
  }));
}

/**
 * Forecast pages - hub landing page and regional forecast pages.
 */
function getForecastRoutes(): MetadataRoute.Sitemap {
  // Use fixed date - forecast pages are templated, data updates frequently but pages don't
  const forecastTemplateDate = "2026-02-10";

  const routes: MetadataRoute.Sitemap = [];

  // Forecast hub landing page
  routes.push({
    url: `${baseUrl}/forecast`,
    lastModified: forecastTemplateDate,
    changeFrequency: "daily" as const,
    priority: 0.9,
  });

  // Regional forecast pages (e.g., /forecast/southern-california)
  const regionSlugs = getAllForecastRegionSlugs();
  for (const slug of regionSlugs) {
    routes.push({
      url: `${baseUrl}/forecast/${slug}`,
      lastModified: forecastTemplateDate,
      changeFrequency: "daily" as const,
      priority: 0.8,
    });
  }

  return routes;
}

/**
 * Cam directory pages - hub and regional cam listings.
 */
function getCamRoutes(): MetadataRoute.Sitemap {
  const camPageDate = "2026-02-11";

  const routes: MetadataRoute.Sitemap = [];

  // Cam hub page
  routes.push({
    url: `${baseUrl}/cams`,
    lastModified: camPageDate,
    changeFrequency: "daily" as const,
    priority: 0.9,
  });

  // Regional cam pages (e.g., /cams/southern-california)
  const camRegionSlugs = getAllCamRegionSlugs();
  for (const slug of camRegionSlugs) {
    routes.push({
      url: `${baseUrl}/cams/${slug}`,
      lastModified: camPageDate,
      changeFrequency: "daily" as const,
      priority: 0.8,
    });
  }

  return routes;
}

/**
 * Curated SEO funnel pages.
 */
function getSeoFunnelRoutes(): MetadataRoute.Sitemap {
  const funnelDate = "2026-05-10";

  return INDEXABLE_SEO_FUNNEL_PAGES.map((page) => ({
    url: `${baseUrl}${page.path}`,
    lastModified: funnelDate,
    changeFrequency: page.type === "surf-report-today" ? "daily" : "weekly",
    priority: page.type === "surf-report-today" ? 0.86 : 0.82,
  }));
}

/**
 * Best-time-to-surf city pages.
 * Only includes cities with >= 2 beaches that have best_months data.
 * The threshold was lowered from 3 to 2 to expand coverage to smaller high-quality markets.
 */
async function getBestTimeToSurfRoutes(): Promise<MetadataRoute.Sitemap> {
  const bestTimeDate = "2026-02-12";

  // Hub page
  const routes: MetadataRoute.Sitemap = [
    {
      url: `${baseUrl}/best-time-to-surf`,
      lastModified: bestTimeDate,
      changeFrequency: "monthly" as const,
      priority: 0.85,
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
        return {
          url: `${baseUrl}/best-time-to-surf/${citySlug}`,
          lastModified: bestTimeDate,
          changeFrequency: "monthly" as const,
          priority: 0.7,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    return [...routes, ...cityRoutes];
  } catch (error) {
    console.error("Sitemap: Failed to generate best-time-to-surf routes", error);
    return routes;
  }
}

/**
 * Free surf tools — static routes for all 8 tools.
 */
function getToolsRoutes(): MetadataRoute.Sitemap {
  const toolsDate = "2026-03-30";

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
      lastModified: toolsDate,
      changeFrequency: "weekly" as const,
      priority: 0.85,
    },
    ...toolSlugs.map((slug) => ({
      url: `${baseUrl}/tools/${slug}`,
      lastModified: toolsDate,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}

/**
 * Learn hub and article pages — educational content for AI citability.
 */
function getLearnRoutes(): MetadataRoute.Sitemap {
  const learnDate = "2026-03-26";

  return [
    {
      url: `${baseUrl}/learn`,
      lastModified: learnDate,
      changeFrequency: "weekly",
      priority: 0.85,
    },
    ...learnArticles.map((article) => ({
      url: `${baseUrl}/learn/${article.slug}`,
      lastModified: learnDate,
      changeFrequency: "monthly" as const,
      priority: 0.8,
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
      changeFrequency: "weekly",
      priority: 0.75,
    },
    ...posts.map((post) => ({
      url: `${baseUrl}/blog/${post.slug}`,
      lastModified: post.dateModified ?? post.datePublished,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}
