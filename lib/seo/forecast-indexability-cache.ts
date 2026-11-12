import { createHash } from "node:crypto";
import { unstable_cache } from "next/cache";

import {
  FORECAST_COVERAGE_UNKNOWN,
  ForecastIndexabilityUnavailableError,
  getForecastIndexabilityForBeaches,
  reportForecastCoverageUnavailable,
  type ForecastCoverageLookup,
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

/** Above the ~1,500 beaches the sitemap reads, so one sitemap read fits. */
const LAST_GOOD_MAX_BEACHES = 5000;

/**
 * The last answer this instance read for each beach. On a failed read a beach
 * keeps its last known state (fresh, stale, incomplete or missing) instead of
 * opening the forecast gate; only a beach with no entry is unknown.
 */
const lastGoodSnapshotByBeachId = new Map<string, ForecastIndexabilitySnapshot>();

function rememberSnapshots(snapshots: ReadonlyMap<string, ForecastIndexabilitySnapshot>): void {
  for (const [beachId, snapshot] of snapshots) {
    // Delete first so the entry moves to the end of the insertion order.
    lastGoodSnapshotByBeachId.delete(beachId);
    lastGoodSnapshotByBeachId.set(beachId, snapshot);
  }
  for (const oldest of lastGoodSnapshotByBeachId.keys()) {
    if (lastGoodSnapshotByBeachId.size <= LAST_GOOD_MAX_BEACHES) break;
    lastGoodSnapshotByBeachId.delete(oldest);
  }
}

export async function getCachedForecastIndexabilitySnapshots(
  beaches: ReadonlyArray<ForecastIndexabilityBeach>,
): Promise<ForecastCoverageLookup> {
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
    const snapshots = new Map(await load());
    rememberSnapshots(snapshots);
    return snapshots;
  } catch (error) {
    if (!(error instanceof ForecastIndexabilityUnavailableError)) throw error;
    reportForecastCoverageUnavailable(error);
    // The throw happened inside the cached loader, so nothing was stored and
    // the next request reads again.
    return new Map(
      beaches.map((beach) => [
        beach.id,
        lastGoodSnapshotByBeachId.get(beach.id) ?? FORECAST_COVERAGE_UNKNOWN,
      ]),
    );
  }
}
