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

/** Steady-state facts (e.g. a fixed set of unmatched sites): logged and breadcrumbed, never an issue. */
export function noteCountyFeedOperator(message: string): void {
  if (process.env.NODE_ENV === "test") return;
  console.warn(`[county-advisory-ingest] ${message}`);
  Sentry.addBreadcrumb({ category: "county-advisory-ingest", message, level: "info" });
}
