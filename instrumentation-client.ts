import * as Sentry from "@sentry/nextjs";

/**
 * Next.js will call this hook (when present) to instrument router
 * transitions. We simply forward to Sentry's helper so the existing
 * client-side `Sentry.init` configuration (from `sentry.client.config.ts`)
 * handles the heavy lifting.
 */
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
