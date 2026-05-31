const WEB_SENTRY_DSN =
  "https://9a9b828ed217cf8ae38f59b3e9fec9ab@o4510293516091392.ingest.us.sentry.io/4510293517205504";

const STATIC_OR_HEALTH_PATTERNS = [
  "/_next/",
  "/favicon",
  "/manifest",
  "/monitoring",
  "/api/health",
  "/api/ping",
] as const;

const CRITICAL_FLOW_PATTERNS = [
  "/auth",
  "/api/auth",
  "/api/cron",
  "/api/notifications",
  "/api/push",
  "/api/webhooks/revenuecat",
  "/onboarding",
  "revenuecat",
  "notification",
] as const;

const LAUNCH_FLOW_PATTERNS = [
  "/pbsc",
  "/pricing",
  "/download",
  "/founding",
  "/ios",
] as const;

const FORECAST_FLOW_PATTERNS = [
  "/api/forecast",
  "/api/forecasts",
  "/api/beaches",
  "/api/events",
  "/beach/",
  "/forecast/",
  "/map",
  "forecast",
] as const;

export const SENTRY_TRACE_SAMPLE_RATES = {
  staticOrHealth: 0,
  critical: 0.5,
  launch: 0.25,
  forecast: 0.15,
  default: 0.05,
} as const;

type EnvSource = Partial<NodeJS.ProcessEnv>;

type SentryTraceLocation = {
  href?: string;
  pathname?: string;
};

type SentryTraceRequest = {
  url?: string;
  path?: string;
  method?: string;
};

export type SentryTraceSamplingContext = {
  name?: string;
  attributes?: Record<string, unknown>;
  location?: SentryTraceLocation;
  normalizedRequest?: SentryTraceRequest;
  inheritOrSampleWith?: (fallbackSampleRate: number) => number;
};

export type QuiverSentryEnvironment = "production" | "preview" | "development";

export function getSentryClientDsn(env: EnvSource = process.env): string {
  return env.NEXT_PUBLIC_SENTRY_DSN || WEB_SENTRY_DSN;
}

export function getSentryServerDsn(env: EnvSource = process.env): string {
  return env.SENTRY_DSN || env.NEXT_PUBLIC_SENTRY_DSN || WEB_SENTRY_DSN;
}

export function getSentryRuntimeEnvironment(
  env: EnvSource = process.env
): QuiverSentryEnvironment {
  const vercelEnv = env.NEXT_PUBLIC_VERCEL_ENV || env.VERCEL_ENV;

  if (vercelEnv === "production") return "production";
  if (vercelEnv === "preview") return "preview";
  if (vercelEnv) return "development";

  return env.NODE_ENV === "production" ? "production" : "development";
}

export function isSentryRuntimeEnabled(env: EnvSource = process.env): boolean {
  return getSentryRuntimeEnvironment(env) === "production";
}

export function getSentryRelease(env: EnvSource = process.env): string | undefined {
  return (
    env.NEXT_PUBLIC_SENTRY_RELEASE ||
    env.SENTRY_RELEASE ||
    env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ||
    env.VERCEL_GIT_COMMIT_SHA ||
    undefined
  );
}

export function getSentryDist(env: EnvSource = process.env): string | undefined {
  const commitSha = env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || env.VERCEL_GIT_COMMIT_SHA;
  return commitSha ? commitSha.slice(0, 12) : undefined;
}

export function detectSentryEnvironmentFromHostname(
  hostname: string | undefined,
  fallbackEnv: EnvSource = process.env
): QuiverSentryEnvironment {
  if (!hostname) return getSentryRuntimeEnvironment(fallbackEnv);

  const normalizedHostname = hostname.toLowerCase();

  if (
    normalizedHostname === "localhost" ||
    normalizedHostname === "127.0.0.1" ||
    normalizedHostname.endsWith(".local") ||
    normalizedHostname.startsWith("192.168.") ||
    normalizedHostname.startsWith("10.")
  ) {
    return "development";
  }

  if (
    normalizedHostname === "dev.quiversurf.app" ||
    (normalizedHostname.includes(".vercel.app") &&
      !normalizedHostname.startsWith("quiver."))
  ) {
    return "preview";
  }

  return "production";
}

export function detectSentryEnvironmentFromUrl(
  url: string | undefined,
  fallbackEnv: EnvSource = process.env
): QuiverSentryEnvironment {
  if (!url) return getSentryRuntimeEnvironment(fallbackEnv);

  try {
    return detectSentryEnvironmentFromHostname(new URL(url).hostname, fallbackEnv);
  } catch {
    return getSentryRuntimeEnvironment(fallbackEnv);
  }
}

export function shouldDropSentryEnvironment(
  environment: QuiverSentryEnvironment
): boolean {
  return environment !== "production";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function addCandidate(candidates: string[], value: unknown): void {
  if (typeof value !== "string" || value.length === 0) return;

  const normalizedValue = value.toLowerCase();
  candidates.push(normalizedValue);

  try {
    const parsedUrl = new URL(value);
    candidates.push(parsedUrl.pathname.toLowerCase());
  } catch {
    // Not a URL; the original candidate is enough.
  }
}

function getSamplingCandidates(context: SentryTraceSamplingContext): string[] {
  const candidates: string[] = [];
  addCandidate(candidates, context.name);
  addCandidate(candidates, context.location?.href);
  addCandidate(candidates, context.location?.pathname);
  addCandidate(candidates, context.normalizedRequest?.url);
  addCandidate(candidates, context.normalizedRequest?.path);

  const attrs = context.attributes;
  if (attrs) {
    for (const key of [
      "http.route",
      "http.target",
      "http.url",
      "next.route",
      "sentry.source",
      "url.full",
      "url.path",
      "route",
      "path",
    ]) {
      addCandidate(candidates, attrs[key]);
    }

    const request = attrs.request;
    if (isRecord(request)) {
      addCandidate(candidates, request.url);
      addCandidate(candidates, request.path);
    }
  }

  return candidates;
}

function matchesAnyPattern(candidates: string[], patterns: readonly string[]): boolean {
  return candidates.some((candidate) =>
    patterns.some((pattern) => candidate.includes(pattern))
  );
}

function inheritOrFallback(
  context: SentryTraceSamplingContext,
  fallbackSampleRate: number
): number {
  return context.inheritOrSampleWith?.(fallbackSampleRate) ?? fallbackSampleRate;
}

export function getQuiverTraceSampleRate(
  context: SentryTraceSamplingContext
): number {
  const candidates = getSamplingCandidates(context);

  if (matchesAnyPattern(candidates, STATIC_OR_HEALTH_PATTERNS)) {
    return SENTRY_TRACE_SAMPLE_RATES.staticOrHealth;
  }

  if (matchesAnyPattern(candidates, CRITICAL_FLOW_PATTERNS)) {
    return inheritOrFallback(context, SENTRY_TRACE_SAMPLE_RATES.critical);
  }

  if (matchesAnyPattern(candidates, LAUNCH_FLOW_PATTERNS)) {
    return inheritOrFallback(context, SENTRY_TRACE_SAMPLE_RATES.launch);
  }

  if (matchesAnyPattern(candidates, FORECAST_FLOW_PATTERNS)) {
    return inheritOrFallback(context, SENTRY_TRACE_SAMPLE_RATES.forecast);
  }

  return inheritOrFallback(context, SENTRY_TRACE_SAMPLE_RATES.default);
}
