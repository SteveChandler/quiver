import { createHash } from "node:crypto";
import * as Sentry from "@sentry/nextjs";
import { unstable_cache } from "next/cache";

import {
  ForecastIndexabilityUnavailableError,
  getForecastIndexabilityForBeaches,
  type ForecastIndexabilityBeach,
  type ForecastIndexabilitySnapshot,
} from "@/lib/seo/forecast-indexability";

/** Same window as the beach pages' revalidate; see app/sitemap.ts for why. */
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

  try {
    return new Map(await load());
  } catch (error) {
    if (!(error instanceof ForecastIndexabilityUnavailableError)) throw error;
    // This request treats every beach as forecast-missing, as before; the
    // failure is reported and the next request reads again.
    console.error(error.message);
    Sentry.captureException(error, { tags: { area: "seo-indexability" } });
    return new Map();
  }
}
