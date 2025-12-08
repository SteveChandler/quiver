// This file configures the initialization of Sentry on the client.
// The config you add here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

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
