import {
  createErrorResponse,
  createSuccessResponse,
  handleApiError,
  validateCronRequest,
} from "@/lib/api-utils";
import { submitUrlsInBatches } from "@/lib/services/indexnow-service";
import { SITE_URL } from "@/lib/constants/seo";
import { createPublicReadClient } from "@/lib/supabase/server";
import { buildCitySlug } from "@/lib/seo/city-slug-utils";
import { COLLISION_CITY_MAP } from "@/lib/seo/city-collision-list";
import { slugifyAscii } from "@/lib/utils/text-utils";
import { stateToSlug } from "@/lib/utils/beach-url-utils";
import { getAllForecastRegionSlugs } from "@/lib/data/forecast-regions";
import { getAllCamRegionSlugs } from "@/lib/data/cam-regions";
import { HUB_REGION_SLUGS } from "@/lib/data/hub-regions";
import { withObservedCron } from "@/lib/cron/observability";
import { getIndexableSeoFunnelRoutes } from "@/lib/seo/funnel-pages";

export const revalidate = 0;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INTENTS = [
  "beginner",
  "least-crowded",
  "tide",
  "water-temp",
  "longboard",
  "dawn-patrol",
  "sunset",
] as const;

const US_INTENT_STATES = [
  "ca", "or", "wa", "hi", "pr", "fl", "nj", "ny", "nc", "sc", "tx", "ma",
  "me", "nh", "ri", "ga",
] as const;

/**
 * GET /api/cron/indexnow-submit
 *
 * Weekly cron that submits intent pages, city hub pages, and other
 * programmatic URLs to IndexNow for accelerated search engine discovery.
 */
async function _GET(request: Request): Promise<Response> {
  try {
    if (!validateCronRequest(request)) {
      return createErrorResponse(
        "Unauthorized",
        "Invalid cron authentication",
        401
      );
    }

    if (!process.env.INDEXNOW_KEY) {
      return createErrorResponse(
        "Missing configuration",
        "INDEXNOW_KEY environment variable is not set",
        500
      );
    }

    const startMs = Date.now();
    const urls: string[] = [];

    // Collect all URL categories in parallel
    const [intentUrls, locationUrls, staticSeoUrls] = await Promise.all([
      collectIntentUrls(),
      collectLocationUrls(),
      Promise.resolve(collectStaticSeoUrls()),
    ]);

    urls.push(...intentUrls, ...locationUrls, ...staticSeoUrls);

    // Deduplicate
    const uniqueUrls = [...new Set(urls)];

    const result = await submitUrlsInBatches(uniqueUrls);

    return createSuccessResponse({
      submitted: result.totalSubmitted,
      totalUrls: uniqueUrls.length,
      breakdown: {
        intent: intentUrls.length,
        location: locationUrls.length,
        staticSeo: staticSeoUrls.length,
      },
      batches: result.batches.length,
      errors: result.errors,
      durationMs: Date.now() - startMs,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export const GET = withObservedCron("/api/cron/indexnow-submit", _GET);

// ---------------------------------------------------------------------------
// URL Collectors
// ---------------------------------------------------------------------------

/**
 * Collect intent page URLs (city-level + state-level).
 * Mirrors the filtering logic in app/sitemap.ts getIntentRoutes().
 */
async function collectIntentUrls(): Promise<string[]> {
  const urls: string[] = [];

  try {
    const supabase = createPublicReadClient();
    const { data, error } = await supabase.rpc(
      "get_cities_with_beach_skills",
      { min_beaches: 1 }
    );

    if (error || !data) {
      console.error("IndexNow: Failed to fetch cities with beach skills", error);
      return urls;
    }

    type RpcRow = {
      city: string;
      state: string;
      country: string;
      beach_count: number;
      has_beginner: boolean;
      has_advanced: boolean;
      has_least_crowded?: boolean;
      has_editorial_content?: boolean;
    };

    const rows = data as unknown as RpcRow[];
    const usCities = rows.filter(
      (c) =>
        c.country?.toUpperCase() === "USA" || c.country?.toUpperCase() === "US"
    );

    const collisionMap = COLLISION_CITY_MAP;
    const BEGINNER_INTENTS = new Set(["beginner", "longboard"]);
    const FILTERED_INTENTS = new Set(["beginner", "longboard", "least-crowded"]);

    // State-level tracking
    const statesWithBeginnerBeaches = new Set<string>();
    const statesWithLeastCrowdedBeaches = new Set<string>();

    // Build per-state beach count for thin-state exemptions
    const stateBeachCounts = new Map<string, number>();
    for (const c of usCities) {
      if (c.state) {
        stateBeachCounts.set(
          c.state,
          (stateBeachCounts.get(c.state) ?? 0) + c.beach_count
        );
        if (c.has_beginner) statesWithBeginnerBeaches.add(c.state.toLowerCase());
        if (c.has_least_crowded)
          statesWithLeastCrowdedBeaches.add(c.state.toLowerCase());
      }
    }

    // City-level intent pages
    for (const city of usCities) {
      const citySlug = buildCitySlug(city.city, city.state, collisionMap);
      if (!citySlug) continue;

      // Single-beach city filter (matches sitemap logic)
      if (city.beach_count === 1) {
        const stateTotal = stateBeachCounts.get(city.state) ?? 0;
        if (stateTotal >= 20 || !city.has_editorial_content) continue;
      }
      if (city.beach_count === 2 && !city.has_editorial_content) continue;

      for (const intent of INTENTS) {
        if (FILTERED_INTENTS.has(intent)) {
          if (BEGINNER_INTENTS.has(intent) && !city.has_beginner) continue;
          if (intent === "least-crowded" && !city.has_least_crowded) continue;
        }
        urls.push(`${SITE_URL}/${intent}/${citySlug}`);
      }
    }

    // State-level intent pages
    for (const state of US_INTENT_STATES) {
      for (const intent of INTENTS) {
        if (FILTERED_INTENTS.has(intent)) {
          if (BEGINNER_INTENTS.has(intent) && !statesWithBeginnerBeaches.has(state))
            continue;
          if (
            intent === "least-crowded" &&
            !statesWithLeastCrowdedBeaches.has(state)
          )
            continue;
        }
        urls.push(`${SITE_URL}/${intent}/${state}`);
      }
    }
  } catch (error) {
    console.error("IndexNow: Error collecting intent URLs", error);
  }

  return urls;
}

/**
 * Collect city hub / location page URLs.
 * Mirrors getLocationRoutes() in app/sitemap.ts.
 */
async function collectLocationUrls(): Promise<string[]> {
  const urls: string[] = [];

  try {
    const supabase = createPublicReadClient();
    const { data, error } = await supabase.rpc("get_all_beach_locations");

    if (error || !data) {
      console.error("IndexNow: Failed to fetch beach locations", error);
      return urls;
    }

    type LocationRow = {
      city: string;
      state: string;
      country?: string | null;
      beachCount?: number;
      isMetro?: boolean;
    };

    const locations = data as unknown as LocationRow[];
    const usaStates = new Set<string>();

    for (const loc of locations) {
      const isUsa =
        !loc.country ||
        loc.country.toLowerCase() === "usa" ||
        loc.country.toLowerCase() === "us";

      if (isUsa) {
        const stSlug = stateToSlug(loc.state);
        const ctSlug = slugifyAscii(loc.city);
        if (stSlug && ctSlug) {
          usaStates.add(stSlug);
          urls.push(`${SITE_URL}/${stSlug}/${ctSlug}`);
        }
      } else {
        const countrySlug = slugifyAscii(loc.country ?? "");
        const regionSlug = slugifyAscii(loc.state);
        const ctSlug = slugifyAscii(loc.city);
        if (countrySlug && regionSlug && ctSlug) {
          urls.push(`${SITE_URL}/${countrySlug}/${regionSlug}/${ctSlug}`);
        }
      }
    }

    // State-level pages
    for (const st of usaStates) {
      urls.push(`${SITE_URL}/beaches/usa/${st}`);
    }
  } catch (error) {
    console.error("IndexNow: Error collecting location URLs", error);
  }

  return urls;
}

/**
 * Collect static SEO-important URLs that benefit from proactive indexing:
 * forecast region pages, cam region pages, guide pages, tools.
 */
function collectStaticSeoUrls(): string[] {
  const urls: string[] = [];

  // Forecast hub + regions
  urls.push(`${SITE_URL}/forecast`);
  for (const slug of getAllForecastRegionSlugs()) {
    urls.push(`${SITE_URL}/forecast/${slug}`);
  }

  // Cam hub + regions
  urls.push(`${SITE_URL}/cams`);
  for (const slug of getAllCamRegionSlugs()) {
    urls.push(`${SITE_URL}/cams/${slug}`);
  }

  // Guide pages
  for (const region of HUB_REGION_SLUGS) {
    urls.push(`${SITE_URL}/guides/surfing-${region}`);
  }

  // High-value static pages
  urls.push(
    `${SITE_URL}/best-time-to-surf`,
    `${SITE_URL}/tools`,
    `${SITE_URL}/learn`,
    `${SITE_URL}/vs/surfline`,
    `${SITE_URL}/forecast-accuracy`
  );

  for (const route of getIndexableSeoFunnelRoutes()) {
    urls.push(`${SITE_URL}${route}`);
  }

  return urls;
}
