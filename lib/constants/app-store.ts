export const IOS_APP_STORE_APP_ID = "6759300320";

export const IOS_APP_STORE_URL =
  "https://apps.apple.com/us/app/surf-forecast-quiver/id6759300320";

/** Canonical campaign label for the web -> native funnel. */
export const APP_FIRST_CAMPAIGN = "app_first_v1";

/** Apple App Store campaign attribution. `ct` is our free-form campaign label;
 *  `pt` is set only when IOS_APP_STORE_PROVIDER_TOKEN is configured in App
 *  Store Connect. */
export function iosAppStoreUrlWithCampaign(campaign: string): string {
  const search = new URLSearchParams();
  const providerToken = process.env.IOS_APP_STORE_PROVIDER_TOKEN;
  if (providerToken) search.set("pt", providerToken);
  search.set("ct", campaign);
  return `${IOS_APP_STORE_URL}?${search.toString()}`;
}

export const IOS_APP_STORE_CTA = "Open App Store";

export const IOS_APP_STORE_DESTINATION_STATUS = "app_store_live";

export const IOS_APP_STORE_SMART_BANNER_ARGUMENT =
  "https://www.quiversurf.app";

export const ANDROID_BETA_LANDING_PATH = "/android-beta";

export const ANDROID_BETA_LANDING_URL =
  `https://www.quiversurf.app${ANDROID_BETA_LANDING_PATH}`;

export const ANDROID_BETA_GROUP_URL =
  "https://groups.google.com/g/quiver-android-testers";

export const ANDROID_BETA_CONTACT_EMAIL = "steven@quiversurf.app";

export const ANDROID_BETA_CONTACT_MAILTO =
  `mailto:${ANDROID_BETA_CONTACT_EMAIL}`;

export const ANDROID_BETA_PLAY_URL: string | null =
  "https://play.google.com/apps/testing/app.quiversurf.surf";
