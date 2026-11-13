import type { ErrorEvent } from "@sentry/nextjs";

/**
 * posthog-node logs failed flushes with console.error, which Sentry's console
 * capture turns into an error issue. A dropped analytics request is transient and
 * never user-facing, so it is dropped (the Vercel log line remains).
 */
/**
 * A sub-page render throws SubPageDataUnknownError on purpose during a database
 * outage so ISR keeps the last good page. Next retries it about every 30 s per
 * path and onRequestError would send each one; the sub-page reader already
 * reports the outage once per source per instance per 5 minutes.
 */
const REPORTED_ELSEWHERE_TYPES = new Set(["SubPageDataUnknownError"]);

export function dropTransientEvents<T extends ErrorEvent>(event: T): T | null {
  if ((event.exception?.values ?? []).some((v) => v.type !== undefined && REPORTED_ELSEWHERE_TYPES.has(v.type))) {
    return null;
  }
  const text = [
    event.message,
    event.logentry?.message,
    ...(event.exception?.values ?? []).flatMap((v) => [v.type, v.value]),
  ].filter(Boolean).join(" ");

  if (text.includes("Error while flushing PostHog") && /PostHogFetchNetworkError|fetch failed|network/i.test(text)) {
    return null;
  }
  return event;
}
