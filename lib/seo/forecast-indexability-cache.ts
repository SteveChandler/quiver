import { createHash } from "node:crypto";
import { unstable_cache } from "next/cache";

import {
  getForecastIndexabilityForBeaches,
  type ForecastIndexabilityBeach,
  type ForecastIndexabilitySnapshot,
} from "@/lib/seo/forecast-indexability";

/**
 * The beach page and its sub-pages are force-static with revalidate = 3600, so
 * the robots tag they serve is frozen for up to an hour. The sitemap is
 * force-dynamic and re-evaluated per request. Reading the coverage snapshot
 * through a cache on the same window puts every consumer on one clock: the
 * sitemap, the beach page's robots tag, and the sub-page robots tags all read
 * the same snapshot for the same hour instead of each racing the database.
 *
 * This bounds the disagreement to one revalidate period; it does not eliminate
 * it, because the page cache and the data cache do not turn over in phase.
 */
export const FORECAST_INDEXABILITY_REVALIDATE_SECONDS = 3600;

/** Stable collision-resistant cache key for a beach-id set. */
export function fingerprintBeachIds(beachIds: readonly string[]): string {
  const digest = createHash("sha256")
    .update([...beachIds].sort().join("\n"))
    .digest("hex");
  return `${beachIds.length}-${digest}`;
}

export async function getCachedForecastIndexabilitySnapshots(
  beaches: ReadonlyArray<ForecastIndexabilityBeach>,
): Promise<Map<string, ForecastIndexabilitySnapshot>> {
  // Maps do not survive the data cache's JSON round trip, so the cached layer
  // deals in entry arrays and the Map is rebuilt here.
  const load = unstable_cache(
    async (): Promise<Array<[string, ForecastIndexabilitySnapshot]>> => [
      ...(await getForecastIndexabilityForBeaches(beaches)).entries(),
    ],
    [
      "forecast-indexability-snapshots",
      fingerprintBeachIds(beaches.map((beach) => beach.id)),
    ],
    { revalidate: FORECAST_INDEXABILITY_REVALIDATE_SECONDS },
  );

  return new Map(await load());
}
