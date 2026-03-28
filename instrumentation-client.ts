import { init, captureRouterTransitionStart } from "@sentry/nextjs";

/**
 * Next.js will call this hook (when present) to instrument router
 * transitions. We simply forward to Sentry's helper so the existing
 * client-side `init` configuration handles the heavy lifting.
 */
export const onRouterTransitionStart = captureRouterTransitionStart;

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
  init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

    // Setting this option to true will print useful information to the console while you're setting up Sentry.
    debug: false,

    // Sample rate for performance monitoring
    // Adjust this value in production, or use tracesSampler for greater control
    tracesSampleRate: 1.0,

    // Setting this option to true will disable Sentry in development
    enabled: process.env.NODE_ENV === "production",

    // Replay is lazy-loaded after hydration to save ~200KB from initial bundle.
    // Sample rates are set to 0 here and enabled via addIntegration() below.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,

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

      // Drop localhost and preview events — don't send to Sentry
      if (detectedEnv === "development" || detectedEnv === "preview") {
        return null;
      }

      // Override environment based on hostname
      event.environment = detectedEnv;

      return event;
    },

    beforeSendTransaction(event) {
      const detectedEnv = detectEnvironment();

      if (detectedEnv === "development" || detectedEnv === "preview") {
        return null;
      }

      event.environment = detectedEnv;
      return event;
    },

    // Replay is lazy-loaded below — keep integrations empty at init time
    integrations: [],
  });

  // Lazy-load Session Replay after hydration to save ~200KB from initial bundle
  if (typeof window !== "undefined" && process.env.NODE_ENV === "production") {
    const loadReplay = async () => {
      try {
        const { replayIntegration, getClient } = await import("@sentry/nextjs");
        const client = getClient();
        if (client) {
          client.addIntegration(replayIntegration({
            maskAllText: true,
            blockAllMedia: true,
          }));
        }
      } catch {
        // Swallow replay loading errors — non-critical
      }
    };

    if ("requestIdleCallback" in window) {
      requestIdleCallback(() => loadReplay());
    } else {
      setTimeout(loadReplay, 3000);
    }
  }
}
