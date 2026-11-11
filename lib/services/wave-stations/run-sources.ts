/**
 * Runs one sync job for several sources, so a failing source never stops the
 * others. The cron route reports each source's outcome.
 */

import type { WaveStationSource, WaveStationSourceAdapter } from "./types";

export type SourceRun<T> =
  | { source: WaveStationSource; ok: true; result: T }
  | { source: WaveStationSource; ok: false; error: string };

export async function runPerSource<T>(
  adapters: readonly WaveStationSourceAdapter[],
  job: (adapter: WaveStationSourceAdapter) => Promise<T>,
): Promise<Array<SourceRun<T>>> {
  return Promise.all(
    adapters.map(async (adapter): Promise<SourceRun<T>> => {
      try {
        return { source: adapter.source, ok: true, result: await job(adapter) };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[WaveStations] ${adapter.source} failed:`, message);
        return { source: adapter.source, ok: false, error: message };
      }
    }),
  );
}

/** Sum a number over the sources that succeeded. */
export function sumOk<T>(runs: Array<SourceRun<T>>, pick: (result: T) => number): number {
  return runs.reduce((total, run) => total + (run.ok ? pick(run.result) : 0), 0);
}

/** "marine_ie: HTTP 503; aodn: timeout", or null when every source succeeded. */
export function failedSources<T>(runs: Array<SourceRun<T>>): string | null {
  const failed = runs.filter((run): run is Extract<SourceRun<T>, { ok: false }> => !run.ok);
  return failed.length > 0 ? failed.map((run) => `${run.source}: ${run.error}`).join("; ") : null;
}

/**
 * The latest phase runs every 15 minutes. A 30-minute source runs in the
 * :00 and :30 quarters, a 60-minute source in the :00 quarter only.
 */
export function isLatestDue(adapter: Pick<WaveStationSourceAdapter, "latestEveryMinutes">, nowMs: number): boolean {
  const quarterStart = Math.floor(new Date(nowMs).getUTCMinutes() / 15) * 15;
  return quarterStart % adapter.latestEveryMinutes === 0;
}
