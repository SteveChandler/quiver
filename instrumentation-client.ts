import { redactSecrets } from "@/lib/monitoring/redact-secrets";
import { init, captureRouterTransitionStart } from "@sentry/nextjs";
import { initPostHog } from "@/lib/posthog-client";
import {
  detectSentryEnvironmentFromHostname,
  getQuiverTraceSampleRate,
  getSentryClientDsn,
  getSentryDist,
  getSentryRelease,
  getSentryRuntimeEnvironment,
  isSentryRuntimeEnabled,
  shouldDropSentryEnvironment,
} from "@/lib/monitoring/sentry-config";

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
function detectEnvironment() {
  if (typeof window === "undefined") {
    return getSentryRuntimeEnvironment();
  }

  // eslint-disable-next-line no-restricted-properties -- Reading hostname for environment detection, not navigation
  return detectSentryEnvironmentFromHostname(window.location.hostname);
}

initPostHog();

/**
 * Client-side instrumentation entrypoint (Next.js App Router).
 *
 * Sentry recommends moving `sentry.client.config.ts` into this file because
 * Turbopack will no longer load `sentry.client.config.ts`.
 */
export async function register(): Promise<void> {
  init({
    dsn: getSentryClientDsn(),
    environment: getSentryRuntimeEnvironment(),
    release: getSentryRelease(),
    dist: getSentryDist(),

    // Setting this option to true will print useful information to the console while you're setting up Sentry.
    debug: false,

    tracesSampler: getQuiverTraceSampleRate,

    enabled: isSentryRuntimeEnabled(),

    // Replay is lazy-loaded after hydration to save ~200KB from initial bundle.
    // Rates stay at 0 until Phase 12 project split and usage caps are verified.
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
      if (shouldDropSentryEnvironment(detectedEnv)) {
        return null;
      }

      // Override environment based on hostname
      event.environment = detectedEnv;

      return redactSecrets(event);
    },

    beforeSendTransaction(event) {
      const detectedEnv = detectEnvironment();

      if (shouldDropSentryEnvironment(detectedEnv)) {
        return null;
      }

      event.environment = detectedEnv;
      return redactSecrets(event);
    },

    // Replay is lazy-loaded below — keep integrations empty at init time
    integrations: [],
  });

  // Lazy-load Session Replay after hydration to save ~200KB from initial bundle
  if (typeof window !== "undefined" && isSentryRuntimeEnabled()) {
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
