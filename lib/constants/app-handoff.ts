import {
  APP_FIRST_CAMPAIGN,
  iosAppStoreUrlWithCampaign,
} from "@/lib/constants/app-store";

export { APP_FIRST_CAMPAIGN, iosAppStoreUrlWithCampaign };

/** Quiver-hosted handoff route. QR + email links point here so attribution
 *  survives the phone handoff. Never link a QR straight at the App Store. */
export const APP_HANDOFF_PATH = "/app";

/** Only these keys survive into the handoff URL. Anything else is dropped. */
export const SAFE_HANDOFF_PARAM_KEYS = [
  "source",
  "placement",
  "utm_source",
  "utm_medium",
  "utm_campaign",
] as const;

export type SafeHandoffParamKey = (typeof SAFE_HANDOFF_PARAM_KEYS)[number];
export type HandoffParams = Partial<Record<SafeHandoffParamKey, string>>;

export function buildAppHandoffPath(params: HandoffParams): string {
  const search = new URLSearchParams();
  for (const key of SAFE_HANDOFF_PARAM_KEYS) {
    const value = params[key];
    if (value) search.set(key, value);
  }
  const qs = search.toString();
  return qs ? `${APP_HANDOFF_PATH}?${qs}` : APP_HANDOFF_PATH;
}
