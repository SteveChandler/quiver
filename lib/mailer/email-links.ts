export interface BeachEmailLinkParams {
  origin: string;
  beachSlug: string;
  emailType: string;
  utmMedium: string;
  utmCampaign: string;
  source: string;
  messageInstanceId: string;
}

/**
 * Builds a universal link the native app claims. App users land in the app;
 * everyone else gets the web spot page with durable email attribution params.
 */
export function buildBeachEmailLink(params: BeachEmailLinkParams): string {
  const origin = params.origin.replace(/\/$/, "");
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
