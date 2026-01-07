import * as Sentry from "@sentry/nextjs";

/**
 * Next.js will call this hook (when present) to instrument router
 * transitions. We simply forward to Sentry's helper so the existing
 * client-side `Sentry.init` configuration handles the heavy lifting.
 */
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

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

    // Filter out intentional test errors from E2E tests
    beforeSend(event, hint) {
      const error = hint.originalException;
      // Drop errors that are intentionally thrown by E2E tests
      if (error instanceof Error && /^Test error \d+$/.test(error.message)) {
        return null;
      }
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
