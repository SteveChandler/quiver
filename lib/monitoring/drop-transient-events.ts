import type { ErrorEvent } from "@sentry/nextjs";

/**
 * posthog-node logs failed flushes with console.error, which Sentry's console
 * capture turns into an error issue. A dropped analytics request is transient and
 * never user-facing, so it is dropped (the Vercel log line remains).
 */
export function dropTransientEvents<T extends ErrorEvent>(event: T): T | null {
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
