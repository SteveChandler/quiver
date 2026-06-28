export interface BeachEmailLinkParams {
  origin: string;
  beachSlug: string;
  emailType: string;
  utmMedium: string;
  utmCampaign: string;
  source: string;
  messageInstanceId: string;
}

export interface SessionPromptAppLinkParams {
  origin: string;
  beachId: string;
  beachName: string;
  startedAt: string;
  messageInstanceId: string;
}

function normalizeUniversalLinkOrigin(origin: string): string {
  const normalized = origin.trim().replace(/\/+$/, "");
  if (normalized === "https://quiversurf.app") {
    return "https://www.quiversurf.app";
  }
  return normalized;
}

/**
 * Builds a universal link the native app claims. App users land in the app;
 * everyone else gets the web spot page with durable email attribution params.
 */
export function buildBeachEmailLink(params: BeachEmailLinkParams): string {
  const origin = normalizeUniversalLinkOrigin(params.origin);
  const search = new URLSearchParams({
    utm_source: "email",
    utm_medium: params.utmMedium,
    utm_campaign: params.utmCampaign,
    email_type: params.emailType,
    source: params.source,
    message_instance_id: params.messageInstanceId,
  });

  return `${origin}/app/spot/${encodeURIComponent(params.beachSlug)}?${search.toString()}`;
}

/**
 * Builds the session prompt's native-claimed session form link.
 */
export function buildSessionPromptAppLink(
  params: SessionPromptAppLinkParams
): string {
  const origin = normalizeUniversalLinkOrigin(params.origin);
  const search = new URLSearchParams({
    entrySource: "email",
    beachId: params.beachId,
    beachName: params.beachName,
    startedAt: params.startedAt,
    utm_source: "quiver",
    utm_medium: "email",
    utm_campaign: "session_prompt",
    email_type: "session_prompt",
    message_instance_id: params.messageInstanceId,
  });

  return `${origin}/sessions/new?${search.toString()}`;
}
