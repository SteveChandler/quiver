export interface BeachEmailLinkParams {
  origin: string;
  beachSlug: string;
  emailType: string;
  params?: Record<string, string | undefined>;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign: string;
  source?: string;
  messageInstanceId: string;
}

interface EmailAttributionParams {
  emailType: string;
  messageInstanceId: string;
  source?: string;
  utmCampaign: string;
  utmMedium?: string;
  utmSource?: string;
}

export interface AppEmailLinkParams extends EmailAttributionParams {
  origin: string;
  path?: `/${string}`;
  params?: Record<string, string | undefined>;
}

export interface SessionEmailLinkParams extends EmailAttributionParams {
  origin: string;
  token?: string;
  beachId?: string;
  startedAt?: string;
  params?: Record<string, string | undefined>;
}

function normalizeOrigin(origin: string): string {
  const normalized = origin.trim().replace(/\/+$/, "");
  if (normalized === "https://quiversurf.app") {
    return "https://www.quiversurf.app";
  }
  return normalized;
}

function buildEmailAttributionSearchParams(
  params: EmailAttributionParams
): URLSearchParams {
  const search = new URLSearchParams({
    utm_source: params.utmSource ?? "email",
    utm_medium: params.utmMedium ?? "email",
    utm_campaign: params.utmCampaign,
    email_type: params.emailType,
    message_instance_id: params.messageInstanceId,
  });

  if (params.source) {
    search.set("source", params.source);
  }

  return search;
}

function appendDefinedParams(
  search: URLSearchParams,
  params?: Record<string, string | undefined>
): void {
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value !== undefined) {
      search.set(key, value);
    }
  }
}

/**
 * Builds a universal link the native app claims. App users land in the app;
 * everyone else gets the web spot page with durable email attribution params.
 */
export function buildBeachEmailLink(params: BeachEmailLinkParams): string {
  const origin = normalizeOrigin(params.origin);
  const search = new URLSearchParams();
  appendDefinedParams(search, params.params);
  const attribution = buildEmailAttributionSearchParams({
    emailType: params.emailType,
    messageInstanceId: params.messageInstanceId,
    source: params.source,
    utmCampaign: params.utmCampaign,
    utmMedium: params.utmMedium,
    utmSource: params.utmSource,
  });
  attribution.forEach((value, key) => search.set(key, value));

  return `${origin}/app/spot/${encodeURIComponent(params.beachSlug)}?${search.toString()}`;
}

export function buildAppEmailLink(params: AppEmailLinkParams): string {
  const origin = normalizeOrigin(params.origin);
  const search = buildEmailAttributionSearchParams(params);
  appendDefinedParams(search, params.params);

  return `${origin}${params.path ?? "/app"}?${search.toString()}`;
}

export function buildSessionEmailLink(params: SessionEmailLinkParams): string {
  const origin = normalizeOrigin(params.origin);
  const search = new URLSearchParams();

  appendDefinedParams(search, {
    token: params.token,
    beachId: params.beachId,
    startedAt: params.startedAt,
    ...params.params,
  });
  search.set("entrySource", "email");

  const attribution = buildEmailAttributionSearchParams(params);
  attribution.forEach((value, key) => {
    search.set(key, value);
  });

  return `${origin}/sessions/new?${search.toString()}`;
}
