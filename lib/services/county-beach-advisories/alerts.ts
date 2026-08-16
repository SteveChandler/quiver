import * as Sentry from "@sentry/nextjs";

export function alertCountyFeedOperator(message: string): void {
  if (process.env.NODE_ENV === "test") return;
  console.error(`[county-advisory-ingest] ${message}`);
  Sentry.captureMessage(`[county-advisory-ingest] ${message}`, "error");
}

export function warnCountyFeedOperator(message: string): void {
  if (process.env.NODE_ENV === "test") return;
  console.warn(`[county-advisory-ingest] ${message}`);
  Sentry.captureMessage(`[county-advisory-ingest] ${message}`, "warning");
}
