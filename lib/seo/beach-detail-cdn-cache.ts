/**
 * Beach detail pages render per request (force-dynamic) and next.config.mjs
 * shares each document response at Vercel's CDN through
 * `Vercel-CDN-Cache-Control`. There is no stale-while-revalidate, so a served
 * page is never older than this bound; the next request after it renders fresh.
 *
 * 15 minutes is half the forecast ingestion interval (dispatch runs at :00/:30).
 * next.config.mjs repeats these values because it cannot import TypeScript;
 * __tests__/lib/seo/beach-detail-cdn-cache.test.ts keeps them in sync.
 */
export const BEACH_DETAIL_CDN_MAX_AGE_SECONDS = 900;

const BEACH_DETAIL_CDN_CACHE_TAG_PREFIX = "beach-detail";

/**
 * The CDN cache tag next.config.mjs puts on one beach detail page, from its
 * canonical path (e.g. "/ca/san-diego/blacks"). Purging it drops that page only.
 */
export function beachDetailCdnCacheTag(beachPath: string): string {
  return `${BEACH_DETAIL_CDN_CACHE_TAG_PREFIX}${beachPath}`;
}
