import * as Sentry from "@sentry/nextjs";

/**
 * Next.js will call this hook (when present) to instrument router
 * transitions. We simply forward to Sentry's helper so the existing
 * client-side `Sentry.init` configuration handles the heavy lifting.
 */
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

/**
 * Detect environment based on hostname.
 * This prevents localhost errors from being reported as "production"
 * even when NODE_ENV=production (e.g., running `next start` locally).
 */
function detectEnvironment(): string {
  if (typeof window === "undefined") {
    return process.env.NODE_ENV || "development";
  }

  // eslint-disable-next-line no-restricted-properties -- Reading hostname for environment detection, not navigation
  const hostname = window.location.hostname;

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
}

/**
 * Client-side instrumentation entrypoint (Next.js App Router).
 *
 * Sentry recommends moving `sentry.client.config.ts` into this file because
 * Turbopack will no longer load `sentry.client.config.ts`.
 */
export async function register(): Promise<void> {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

    // Setting this option to true will print useful information to the console while you're setting up Sentry.
    debug: false,

    // Sample rate for performance monitoring
    // Adjust this value in production, or use tracesSampler for greater control
    tracesSampleRate: 1.0,

    // Setting this option to true will disable Sentry in development
    enabled: process.env.NODE_ENV === "production",

    // You can remove this option if you're not planning to use the Sentry Session Replay feature:
    replaysSessionSampleRate: 0.1,

    // This sets the sample rate to be 10%. You may want this to be 100% while
    // in development and sample at a lower rate in production
    replaysOnErrorSampleRate: 1.0,

    // Override environment based on actual hostname, not just NODE_ENV
    // This prevents localhost errors from polluting production error tracking
    beforeSend(event, hint) {
      const error = hint.originalException;
      // Drop errors that are intentionally thrown by E2E tests
      if (error instanceof Error && /^Test error \d+$/.test(error.message)) {
        return null;
      }

      // Detect environment based on hostname
      const detectedEnv = detectEnvironment();

      // Drop localhost events entirely - don't send to Sentry
      if (detectedEnv === "development") {
        return null;
      }

      // Override environment based on hostname
      event.environment = detectedEnv;

      return event;
    },

    // If the entire session is not sampled, use the below sample rate to sample
    // sessions when an error occurs.
    integrations: [
      Sentry.replayIntegration({
        // Additional Replay configuration goes in here, for example:
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
  });
}
