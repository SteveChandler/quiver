import { track } from "@/lib/analytics";
import { deriveSeoPageContextFromPath } from "@/lib/analytics/web-context";
import {
  IOS_APP_STORE_CTA,
  IOS_APP_STORE_DESTINATION_STATUS,
  IOS_APP_STORE_WEB_REDIRECT_PATH,
} from "@/lib/constants/app-store";
import { getVisitorId } from "@/lib/utils/visitor-id";

export const IOS_APP_CTA_VIEW_EVENT = "ios_app_cta_view";
export const IOS_APP_CTA_CLICK_EVENT = "ios_app_cta_click";
const IOS_APP_STORE_CAMPAIGN_URL = IOS_APP_STORE_WEB_REDIRECT_PATH;

type InternalCtaEventType = "cta_impression" | "cta_click";

export interface IosAppCtaMetadata {
  source: string;
  surface?: string;
  placement?: string;
  cta_text?: string;
  destination_url?: string;
  destination_status?: string;
  destination_type?: string;
  platform?: "ios";
  video_loaded?: boolean;
  [key: string]: unknown;
}

function buildIosAppCtaMetadata(
  metadata: IosAppCtaMetadata,
): IosAppCtaMetadata {
  const seoPageContext = deriveSeoPageContextFromPath();

  return {
    cta_family: "ios_app",
    platform: "ios",
    destination_type: "app_store",
    destination_status: IOS_APP_STORE_DESTINATION_STATUS,
    destination_url: IOS_APP_STORE_CAMPAIGN_URL,
    cta_text: IOS_APP_STORE_CTA,
    ...seoPageContext,
    ...metadata,
  };
}

function fireToUserEvents(
  eventType: InternalCtaEventType,
  metadata: IosAppCtaMetadata,
): void {
  if (typeof window === "undefined") return;

  try {
    fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventType,
        metadata,
        sessionId: getVisitorId(),
        viewportWidth: window.innerWidth,
      }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Tracking must never block navigation.
  }
}

export function trackIosAppCtaView(metadata: IosAppCtaMetadata): void {
  let enriched: IosAppCtaMetadata;
  try {
    enriched = buildIosAppCtaMetadata(metadata);
  } catch {
    return;
  }
  try {
    track(IOS_APP_CTA_VIEW_EVENT, enriched);
  } catch {
    // Product analytics is best effort and must not block the CTA.
  }
  fireToUserEvents("cta_impression", enriched);
}

export function trackIosAppCtaClick(metadata: IosAppCtaMetadata): void {
  let enriched: IosAppCtaMetadata;
  try {
    enriched = buildIosAppCtaMetadata(metadata);
  } catch {
    return;
  }
  try {
    track(IOS_APP_CTA_CLICK_EVENT, enriched);
  } catch {
    // Product analytics is best effort and must not block the CTA.
  }
  fireToUserEvents("cta_click", enriched);
}
