export const IOS_APP_STORE_APP_ID = "6759300320";

export const IOS_APP_STORE_URL =
  "https://apps.apple.com/us/app/surf-forecast-quiver/id6759300320";

export const IOS_APP_STORE_CAMPAIGNS = {
  WEB: "web",
  EMAIL: "email",
  PARTNER_QR: "partner_qr",
} as const;

export type IosAppStoreCampaign =
  (typeof IOS_APP_STORE_CAMPAIGNS)[keyof typeof IOS_APP_STORE_CAMPAIGNS];

/** Canonical campaign label for the default web -> native funnel. */
export const APP_FIRST_CAMPAIGN = "app_first_v1";

export const IOS_APP_STORE_REDIRECT_PATH = "/app-store";

interface IosAppStoreCampaignSignals {
  campaign?: string;
  medium?: string;
  placement?: string;
  source?: string;
  surface?: string;
}

/** Keep Apple's campaign grain intentionally small so low-volume campaigns can report. */
export function resolveIosAppStoreCampaign({
  campaign,
  medium,
  placement,
  source,
  surface,
}: IosAppStoreCampaignSignals): IosAppStoreCampaign {
  if (campaign === IOS_APP_STORE_CAMPAIGNS.EMAIL) {
    return IOS_APP_STORE_CAMPAIGNS.EMAIL;
  }
  if (campaign === IOS_APP_STORE_CAMPAIGNS.PARTNER_QR) {
    return IOS_APP_STORE_CAMPAIGNS.PARTNER_QR;
  }
  if (campaign === IOS_APP_STORE_CAMPAIGNS.WEB) {
    return IOS_APP_STORE_CAMPAIGNS.WEB;
  }

  if (source === "email" || medium === "email" || medium === "app_link") {
    return IOS_APP_STORE_CAMPAIGNS.EMAIL;
  }
  if (
    source === "partner_qr" ||
    surface === "partner_landing" ||
    placement === "desktop_partner_qr"
  ) {
    return IOS_APP_STORE_CAMPAIGNS.PARTNER_QR;
  }

  return IOS_APP_STORE_CAMPAIGNS.WEB;
}

/** Apple App Store campaign attribution. `ct` is our free-form campaign label;
 *  `pt` is set only when IOS_APP_STORE_PROVIDER_TOKEN is configured in App
 *  Store Connect. `mt=8` marks the link as an app link. */
export function iosAppStoreUrlWithCampaign(
  campaign: IosAppStoreCampaign,
  providerToken?: string,
): string {
  const search = new URLSearchParams();
  const normalizedProviderToken =
    normalizeIosAppStoreProviderToken(providerToken);
  if (normalizedProviderToken) search.set("pt", normalizedProviderToken);
  search.set("ct", campaign);
  search.set("mt", "8");
  return `${IOS_APP_STORE_URL}?${search.toString()}`;
}

export function buildIosAppStoreRedirectPath(
  campaign: IosAppStoreCampaign,
): string {
  const search = new URLSearchParams({ ct: campaign });
  return `${IOS_APP_STORE_REDIRECT_PATH}?${search.toString()}`;
}

export const IOS_APP_STORE_WEB_REDIRECT_PATH = buildIosAppStoreRedirectPath(
  IOS_APP_STORE_CAMPAIGNS.WEB,
);

export function normalizeIosAppStoreProviderToken(
  providerToken?: string,
): string | undefined {
  const normalized = providerToken?.trim();
  return normalized && /^\d+$/.test(normalized) ? normalized : undefined;
}

export function buildIosSmartAppBannerContent(providerToken?: string): string {
  const parts = [`app-id=${IOS_APP_STORE_APP_ID}`];
  const normalizedProviderToken =
    normalizeIosAppStoreProviderToken(providerToken);
  if (normalizedProviderToken) {
    parts.push(
      `affiliate-data=pt=${normalizedProviderToken}&ct=${IOS_APP_STORE_CAMPAIGNS.WEB}`,
    );
  }
  parts.push(`app-argument=${IOS_APP_STORE_SMART_BANNER_ARGUMENT}`);
  return parts.join(", ");
}

export const IOS_APP_STORE_CTA = "Open App Store";

export const IOS_APP_STORE_DESTINATION_STATUS = "app_store_live";

export const IOS_APP_STORE_SMART_BANNER_ARGUMENT = `https://www.quiversurf.app/app?source=ios_smart_app_banner&surface=web&placement=apple_smart_banner&utm_source=ios_safari&utm_medium=smart_banner&utm_campaign=${APP_FIRST_CAMPAIGN}`;

export const ANDROID_BETA_LANDING_PATH = "/android-beta";

export const ANDROID_BETA_LANDING_URL = `https://www.quiversurf.app${ANDROID_BETA_LANDING_PATH}`;

export const ANDROID_BETA_GROUP_URL =
  "https://groups.google.com/g/quiver-android-testers";

export const ANDROID_BETA_CONTACT_EMAIL = "steven@quiversurf.app";

export const ANDROID_BETA_CONTACT_MAILTO = `mailto:${ANDROID_BETA_CONTACT_EMAIL}`;

export const ANDROID_BETA_PLAY_URL: string | null =
  "https://play.google.com/apps/testing/app.quiversurf.surf";

export const ANDROID_PLAY_STORE_LISTING_URL =
  "https://play.google.com/store/apps/details?id=app.quiversurf.surf";
