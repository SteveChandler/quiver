import { track } from "@/lib/analytics";
import {
  ANDROID_WAITLIST_CTA,
  ANDROID_WAITLIST_DESTINATION_STATUS,
} from "@/lib/constants/android-waitlist";
import { getVisitorId } from "@/lib/utils/visitor-id";
import type { InstallAttribution } from "@/lib/install-attribution";

export const ANDROID_WAITLIST_CTA_VIEW_EVENT = "android_waitlist_cta_view";
export const ANDROID_WAITLIST_CTA_CLICK_EVENT = "android_waitlist_cta_click";
export const ANDROID_INSTALL_CTA_CLICK_EVENT = "android_install_cta_click";

type InternalCtaEventType = "cta_impression" | "cta_click";

export interface AndroidWaitlistCtaMetadata {
  source: string;
  surface?: string;
  placement?: string;
  auth_state?: "anonymous" | "authenticated";
  cta_text?: string;
  destination_status?: string;
  destination_type?: string;
  platform?: "android";
  profile_flag_requested?: boolean;
  [key: string]: unknown;
}

function buildAndroidWaitlistCtaMetadata(
  metadata: AndroidWaitlistCtaMetadata,
): AndroidWaitlistCtaMetadata {
  return {
    cta_family: "android_waitlist",
    platform: "android",
    destination_type: "profile_flag",
    destination_status: ANDROID_WAITLIST_DESTINATION_STATUS,
    cta_text: ANDROID_WAITLIST_CTA,
    ...metadata,
  };
}

function fireToUserEvents(
  eventType: InternalCtaEventType,
  metadata: AndroidWaitlistCtaMetadata,
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
    // Tracking must never block signup or navigation.
  }
}

export function trackAndroidWaitlistCtaView(
  metadata: AndroidWaitlistCtaMetadata,
): void {
  const enriched = buildAndroidWaitlistCtaMetadata(metadata);
  track(ANDROID_WAITLIST_CTA_VIEW_EVENT, enriched);
  fireToUserEvents("cta_impression", enriched);
}

export function trackAndroidWaitlistCtaClick(
  metadata: AndroidWaitlistCtaMetadata,
): void {
  const enriched = buildAndroidWaitlistCtaMetadata(metadata);
  track(ANDROID_WAITLIST_CTA_CLICK_EVENT, enriched);
  fireToUserEvents("cta_click", enriched);
}

export function trackAndroidInstallCtaClick(
  attribution: InstallAttribution,
): void {
  const metadata = {
    cta_family: "android_install",
    platform: "android" as const,
    destination_type: "google_play_store_listing",
    destination_status: "attributed_outbound",
    ...attribution,
  };
  track(ANDROID_INSTALL_CTA_CLICK_EVENT, metadata);
  fireToUserEvents("cta_click", metadata);
}
