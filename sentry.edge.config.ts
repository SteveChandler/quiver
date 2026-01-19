// This file configures the initialization of Sentry for edge features (middleware, edge routes, and so on).
// The config you add here will be used whenever one of the edge features is loaded.
// Note that this config is unrelated to the Vercel Edge Runtime and is also required when running locally.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

/**
 * Detect environment based on URL hostname.
 * This prevents localhost errors from being reported as "production"
 * even when NODE_ENV=production (e.g., running `next start` locally).
 */
function detectEnvironment(url: string | undefined): string {
  if (!url) {
    return process.env.NODE_ENV || "development";
  }

  try {
    const hostname = new URL(url).hostname;

    // Localhost patterns - always "development" regardless of NODE_ENV
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname.endsWith(".local") ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("10.")
    ) {
      return "development";
    }

    // Vercel preview deployments
    if (hostname.includes(".vercel.app") && !hostname.startsWith("quiver.")) {
      return "preview";
    }

    // Production
    return "production";
  } catch {
    return process.env.NODE_ENV || "development";
  }
}

Sentry.init({
  dsn: "https://9a9b828ed217cf8ae38f59b3e9fec9ab@o4510293516091392.ingest.us.sentry.io/4510293517205504",

  // Define how likely traces are sampled. Adjust this value in production, or use tracesSampler for greater control.
  tracesSampleRate: 1,

  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Enable sending user PII (Personally Identifiable Information)
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
  sendDefaultPii: true,

  // Override environment based on actual hostname, not just NODE_ENV
  // This prevents localhost errors from polluting production error tracking
  beforeSend(event) {
    // Extract URL from the request context
    const requestUrl = event.request?.url;
    const detectedEnv = detectEnvironment(requestUrl);

    // Drop localhost events entirely - don't send to Sentry
    if (detectedEnv === "development") {
      return null;
    }

    // Override the environment tag
    event.environment = detectedEnv;

    return event;
  },
});
