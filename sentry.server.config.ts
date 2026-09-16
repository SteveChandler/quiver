import { redactSecrets } from "@/lib/monitoring/redact-secrets";
// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import {
  detectSentryEnvironmentFromUrl,
  getQuiverTraceSampleRate,
  getSentryDist,
  getSentryRelease,
  getSentryRuntimeEnvironment,
  getSentryServerDsn,
  isSentryRuntimeEnabled,
  shouldDropSentryEnvironment,
} from "@/lib/monitoring/sentry-config";

Sentry.init({
  dsn: getSentryServerDsn(),
  environment: getSentryRuntimeEnvironment(),
  release: getSentryRelease(),
  dist: getSentryDist(),

  // Disable all Sentry overhead in development
  enabled: isSentryRuntimeEnabled(),
  tracesSampler: getQuiverTraceSampleRate,
  enableLogs: isSentryRuntimeEnabled(),
  beforeSendLog: redactSecrets,

  // Enable sending user PII (Personally Identifiable Information)
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#sendDefaultPii
  sendDefaultPii: true,

  // Override environment based on actual hostname, not just NODE_ENV
  // This prevents localhost errors from polluting production error tracking
  beforeSend(event) {
    // Extract URL from the request context
    const requestUrl = event.request?.url;
    const detectedEnv = detectSentryEnvironmentFromUrl(requestUrl);

    // Drop localhost and preview events — don't send to Sentry
    if (shouldDropSentryEnvironment(detectedEnv)) {
      return null;
    }

    // Override the environment tag
    event.environment = detectedEnv;

    return redactSecrets(event);
  },

  beforeSendTransaction(event) {
    const requestUrl = event.request?.url;
    const detectedEnv = detectSentryEnvironmentFromUrl(requestUrl);

    if (shouldDropSentryEnvironment(detectedEnv)) {
      return null;
    }

    event.environment = detectedEnv;
    return redactSecrets(event);
  },
});
