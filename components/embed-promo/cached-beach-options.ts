import "server-only";

import { unstable_cache } from "next/cache";

import { getBeaches } from "@/actions/beach/beach-query-actions";

export interface CachedBeachOption {
  name: string;
  slug: string;
  city: string | null;
  state: string | null;
}

/**
 * Beach options for the embed-promo landing pages (/for-businesses,
 * /for-surf-schools).
 *
 * Those pages read `?beach=` from searchParams, which opts them into dynamic
 * rendering — their `revalidate = 86400` no longer keeps the beach query off
 * the request path. `getBeaches()` is an uncached passthrough to the DB, so
 * without this wrapper every visit would re-query the full beach table.
 *
 * Matches the `unstable_cache` pattern already used for the other bulk beach
 * queries in `actions/beach/beach-query-actions.ts`.
 */
const getCachedBeachOptions = unstable_cache(
  async (): Promise<CachedBeachOption[]> => {
    const response = await getBeaches();

    if (!response.success || !response.data) return [];

    return response.data
      .filter((b) => b.slug)
      .map((b) => ({
        name: b.name,
        slug: b.slug as string,
        city: b.city,
        state: b.state,
      }));
  },
  ["embed-promo-beach-options"],
  {
    revalidate: 86400, // matches the landing pages' own revalidate
    tags: ["beaches"],
  }
);

export function getEmbedPromoBeachOptions(): Promise<CachedBeachOption[]> {
  return getCachedBeachOptions();
}
