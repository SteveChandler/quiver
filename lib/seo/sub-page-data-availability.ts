import * as Sentry from "@sentry/nextjs";

/**
 * A sub-page data read (tides, water temperature) failed and this instance
 * knows of no earlier read that found the beach without data. Distinct from a
 * successful read with no rows, which means the beach has no sub-page data.
 */
export const SUB_PAGE_DATA_UNKNOWN = "sub-page-data-unknown" as const;

/**
 * The read failed. Thrown inside the readers and the sitemap's cached loader,
 * never past them, so a cache layer does not store "no data" for an outage.
 */
export class SubPageDataUnavailableError extends Error {
  constructor(source: string, detail: string) {
    super(`[${source}] sub-page data read failed: ${detail}`);
    this.name = "SubPageDataUnavailableError";
  }
}

/**
 * Thrown by a sub-page render whose data read is unknown. These routes are
 * force-static ISR: a render that throws is not stored. On a regeneration Next
 * keeps serving the last good page (and retries); on a first render the visitor
 * gets an uncached 500 (`no-store`) and the next request renders again. Either
 * is better than storing a thin page, or noindex, for an hour.
 */
export class SubPageDataUnknownError extends Error {
  constructor(source: string) {
    super(`[${source}] sub-page data unknown; not storing this render`);
    this.name = "SubPageDataUnknownError";
  }
}

export function throwIfSubPageDataUnknown(
  meta: { availability?: typeof SUB_PAGE_DATA_UNKNOWN } | null | undefined,
  source: string,
): void {
  if (meta?.availability === SUB_PAGE_DATA_UNKNOWN) throw new SubPageDataUnknownError(source);
}

/**
 * A code bug, not a failed read: callers rethrow these instead of wrapping
 * them as SubPageDataUnavailableError.
 */
export function isProgrammingError(error: unknown): boolean {
  return (
    error instanceof TypeError ||
    error instanceof ReferenceError ||
    error instanceof SyntaxError
  );
}

/** Matches the forecast-coverage store; above the ~1,500 beaches the sitemap reads. */
const LAST_GOOD_MAX_BEACHES = 5000;

/** Per-instance "did the last good read find data" by beach id, oldest evicted first. */
interface LastGoodSubPageData {
  remember(beachId: string, hasData: boolean): void;
  get(beachId: string): boolean | undefined;
}

export function createLastGoodSubPageData(
  maxBeaches: number = LAST_GOOD_MAX_BEACHES,
): LastGoodSubPageData {
  const hasDataByBeachId = new Map<string, boolean>();
  return {
    remember(beachId, hasData) {
      // Delete first so the entry moves to the end of the insertion order.
      hasDataByBeachId.delete(beachId);
      hasDataByBeachId.set(beachId, hasData);
      for (const oldest of hasDataByBeachId.keys()) {
        if (hasDataByBeachId.size <= maxBeaches) break;
        hasDataByBeachId.delete(oldest);
      }
    },
    get: (beachId) => hasDataByBeachId.get(beachId),
  };
}

/**
 * The sub-page data gate for links to a sub-page. A failed read with no last
 * good "no data" answer keeps the gate open; the sub-page itself does not
 * render in that state (see throwIfSubPageDataUnknown). The canonical and
 * forecast gates still apply.
 */
export function hasSubPageDataOrUnknown(
  meta: { availability?: typeof SUB_PAGE_DATA_UNKNOWN } | null | undefined,
  hasData: boolean,
): boolean {
  return hasData || meta?.availability === SUB_PAGE_DATA_UNKNOWN;
}

const REPORT_WINDOW_MS = 5 * 60 * 1000;
const reportWindowBySource = new Map<string, { lastAtMs: number; suppressed: number }>();

/**
 * Report a sub-page data read failure at most once per five minutes per source;
 * every render hits it during one outage. The window is module state, so it is
 * per server instance. The log line uses the same window and carries the count
 * it suppressed. Separate from the forecast-coverage reporter so one outage
 * class cannot hide the other.
 */
export function reportSubPageDataUnavailable(
  source: string,
  error: SubPageDataUnavailableError,
): void {
  const nowMs = Date.now();
  const window = reportWindowBySource.get(source);
  if (window && nowMs - window.lastAtMs < REPORT_WINDOW_MS) {
    window.suppressed += 1;
    return;
  }
  console.error(error.message, {
    suppressedSinceLastReport: window?.suppressed ?? 0,
  });
  reportWindowBySource.set(source, { lastAtMs: nowMs, suppressed: 0 });
  Sentry.captureException(error, {
    level: "warning",
    tags: { area: "seo-indexability", source },
  });
}

export const subPageErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
