import {
  SENTRY_TRACE_SAMPLE_RATES,
  detectSentryEnvironmentFromHostname,
  detectSentryEnvironmentFromUrl,
  getQuiverTraceSampleRate,
  getSentryDist,
  getSentryRelease,
  getSentryRuntimeEnvironment,
  isSentryRuntimeEnabled,
  shouldDropSentryEnvironment,
} from "@/lib/monitoring/sentry-config";

describe("sentry-config", () => {
  describe("environment detection", () => {
    it("treats localhost as development even for production builds", () => {
      expect(
        detectSentryEnvironmentFromHostname("localhost", { NODE_ENV: "production" })
      ).toBe("development");
    });

    it("treats dev.quiversurf.app as preview", () => {
      expect(
        detectSentryEnvironmentFromHostname("dev.quiversurf.app", {
          NODE_ENV: "production",
        })
      ).toBe("preview");
    });

    it("uses VERCEL_ENV preview as the fallback when server events lack a URL", () => {
      expect(
        detectSentryEnvironmentFromUrl(undefined, {
          NODE_ENV: "production",
          VERCEL_ENV: "preview",
        })
      ).toBe("preview");
    });

    it("keeps production enabled only for the production runtime environment", () => {
      expect(
        isSentryRuntimeEnabled({
          NODE_ENV: "production",
          VERCEL_ENV: "production",
        })
      ).toBe(true);
      expect(
        isSentryRuntimeEnabled({
          NODE_ENV: "production",
          VERCEL_ENV: "preview",
        })
      ).toBe(false);
    });

    it("drops non-production Sentry environments", () => {
      expect(shouldDropSentryEnvironment("production")).toBe(false);
      expect(shouldDropSentryEnvironment("preview")).toBe(true);
      expect(shouldDropSentryEnvironment("development")).toBe(true);
    });

    it("prefers explicit Sentry release and derives dist from commit SHA", () => {
      expect(
        getSentryRelease({
          SENTRY_RELEASE: "release-1",
          VERCEL_GIT_COMMIT_SHA: "abcdef1234567890",
        })
      ).toBe("release-1");
      expect(getSentryDist({ VERCEL_GIT_COMMIT_SHA: "abcdef1234567890" })).toBe(
        "abcdef123456"
      );
    });

    it("reads NEXT_PUBLIC_VERCEL_ENV for client runtime classification", () => {
      expect(
        getSentryRuntimeEnvironment({
          NODE_ENV: "production",
          NEXT_PUBLIC_VERCEL_ENV: "preview",
        })
      ).toBe("preview");
    });

    it("treats Vercel development as development even with NODE_ENV production", () => {
      expect(
        getSentryRuntimeEnvironment({
          NODE_ENV: "production",
          VERCEL_ENV: "development",
        })
      ).toBe("development");
    });
  });

  describe("trace sampling", () => {
    it("drops static assets and health checks", () => {
      expect(getQuiverTraceSampleRate({ name: "GET /_next/static/app.js" })).toBe(
        SENTRY_TRACE_SAMPLE_RATES.staticOrHealth
      );
      expect(getQuiverTraceSampleRate({ name: "GET /api/health" })).toBe(
        SENTRY_TRACE_SAMPLE_RATES.staticOrHealth
      );
    });

    it("samples critical auth, cron, and RevenueCat flows above default", () => {
      expect(getQuiverTraceSampleRate({ name: "GET /auth/confirm" })).toBe(
        SENTRY_TRACE_SAMPLE_RATES.critical
      );
      expect(getQuiverTraceSampleRate({ name: "GET /api/cron/enhanced-forecast-sync" })).toBe(
        SENTRY_TRACE_SAMPLE_RATES.critical
      );
      expect(
        getQuiverTraceSampleRate({
          attributes: { "http.route": "/api/webhooks/revenuecat" },
        })
      ).toBe(SENTRY_TRACE_SAMPLE_RATES.critical);
    });

    it("samples launch surfaces above forecast and default traffic", () => {
      expect(getQuiverTraceSampleRate({ location: { pathname: "/pbsc" } })).toBe(
        SENTRY_TRACE_SAMPLE_RATES.launch
      );
      expect(getQuiverTraceSampleRate({ name: "GET /pricing" })).toBe(
        SENTRY_TRACE_SAMPLE_RATES.launch
      );
    });

    it("samples forecast and analytics flows below launch but above default", () => {
      expect(getQuiverTraceSampleRate({ name: "GET /forecast/santa-cruz" })).toBe(
        SENTRY_TRACE_SAMPLE_RATES.forecast
      );
      expect(getQuiverTraceSampleRate({ normalizedRequest: { url: "/api/events" } })).toBe(
        SENTRY_TRACE_SAMPLE_RATES.forecast
      );
    });

    it("falls back to default sampling for routine pages", () => {
      expect(getQuiverTraceSampleRate({ name: "GET /about" })).toBe(
        SENTRY_TRACE_SAMPLE_RATES.default
      );
    });

    it("respects inherited trace sampling decisions when available", () => {
      const inheritOrSampleWith = jest.fn((sampleRate: number) => sampleRate / 2);

      expect(
        getQuiverTraceSampleRate({
          name: "GET /auth/confirm",
          inheritOrSampleWith,
        })
      ).toBe(SENTRY_TRACE_SAMPLE_RATES.critical / 2);
      expect(inheritOrSampleWith).toHaveBeenCalledWith(
        SENTRY_TRACE_SAMPLE_RATES.critical
      );
    });
  });
});
