import {
  APP_FIRST_CAMPAIGN,
  iosAppStoreUrlWithCampaign,
} from "@/lib/constants/app-store";

export { APP_FIRST_CAMPAIGN, iosAppStoreUrlWithCampaign };

/** Approved universal-link route for controllable QR + email handoffs.
 * Bare /app remains a web/store route and must not be captured by the app. */
export const APP_HANDOFF_PATH = "/app/handoff";

/** Only these keys survive into the handoff URL. Anything else is dropped. */
export const SAFE_HANDOFF_PARAM_KEYS = [
  "source",
  "surface",
  "placement",
  "handoff_id",
  "qr_id",
  "target",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;

export type SafeHandoffParamKey = (typeof SAFE_HANDOFF_PARAM_KEYS)[number];
export type HandoffParams = Partial<Record<SafeHandoffParamKey, string>>;

const DEFAULT_APP_HANDOFF_ORIGIN = "https://www.quiversurf.app";

export function buildAppHandoffPath(params: HandoffParams): string {
  const search = new URLSearchParams();
  for (const key of SAFE_HANDOFF_PARAM_KEYS) {
    const value = params[key];
    if (value) search.set(key, value);
  }
  const qs = search.toString();
  return qs ? `${APP_HANDOFF_PATH}?${qs}` : APP_HANDOFF_PATH;
}

export function buildAppHandoffUrl(params: HandoffParams): string {
  const origin = (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    DEFAULT_APP_HANDOFF_ORIGIN
  ).replace(/\/$/, "");
  return `${origin}${buildAppHandoffPath(params)}`;
}

export function buildSmartQrHandoffUrl(
  params: HandoffParams & {
    source: string;
    surface: string;
    placement: string;
    qr_id: string;
  },
): string {
  return buildAppHandoffUrl({
    utm_source: "qr",
    utm_medium: "smart_qr",
    utm_campaign: APP_FIRST_CAMPAIGN,
    ...params,
  });
}
