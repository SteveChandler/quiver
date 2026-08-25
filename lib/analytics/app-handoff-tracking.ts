import { track } from "@/lib/analytics";
import { deriveSeoPageContextFromPath } from "@/lib/analytics/web-context";
import { getVisitorId } from "@/lib/utils/visitor-id";
import type {
  BfrFallbackClassification,
  BfrHandoffContext,
  BfrHandoffResolutionReason,
} from "@/lib/analytics/event-taxonomy";

export const APP_HANDOFF_VIEW_EVENT = "app_handoff_view";
export const APP_HANDOFF_QR_RENDERED_EVENT = "app_handoff_qr_rendered";
export const APP_HANDOFF_EMAIL_SUBMIT_EVENT = "app_handoff_email_submit";
export const APP_HANDOFF_EMAIL_SENT_EVENT = "app_handoff_email_sent";
export const APP_HANDOFF_EMAIL_FAILED_EVENT = "app_handoff_email_failed";
export const APP_HANDOFF_LINK_OPENED_EVENT = "app_handoff_link_opened";

type AppHandoffEvent =
  | typeof APP_HANDOFF_VIEW_EVENT
  | typeof APP_HANDOFF_QR_RENDERED_EVENT
  | typeof APP_HANDOFF_EMAIL_SUBMIT_EVENT
  | typeof APP_HANDOFF_EMAIL_SENT_EVENT
  | typeof APP_HANDOFF_EMAIL_FAILED_EVENT
  | typeof APP_HANDOFF_LINK_OPENED_EVENT;

export interface AppHandoffMetadata {
  source: string;
  handoff_id?: string;
  surface?: string;
  placement?: string;
  platform?: "ios" | "android" | "desktop";
  destination_type?: string;
  destination_url?: string;
  handoff_channel?: "qr" | "email";
  /** Domain only - NEVER the full email address. */
  email_domain?: string;
  viewport_width?: number;
  handoff_context?: BfrHandoffContext;
  fallback_classification?: BfrFallbackClassification;
  reason?: BfrHandoffResolutionReason;
  [key: string]: unknown;
}

export interface ExactCallHandoffMetadata {
  source: string;
  handoff_context: BfrHandoffContext;
  fallback_classification: BfrFallbackClassification;
  reason?: BfrHandoffResolutionReason;
  surface?: string;
  placement?: string;
  platform?: "ios" | "android" | "desktop";
}

function enrich(metadata: AppHandoffMetadata): AppHandoffMetadata {
  return {
    cta_family: "app_handoff",
    ...deriveSeoPageContextFromPath(),
    ...metadata,
  };
}

function fireToUserEvents(
  eventType: AppHandoffEvent,
  metadata: AppHandoffMetadata,
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
    // Tracking must never block the funnel.
  }
}

function emit(eventType: AppHandoffEvent, metadata: AppHandoffMetadata): void {
  let enriched: AppHandoffMetadata;
  try {
    enriched = enrich({
      viewport_width:
        typeof window !== "undefined" ? window.innerWidth : undefined,
      ...metadata,
    });
  } catch {
    return;
  }
  try {
    track(eventType, enriched);
  } catch {
    // Product analytics is best effort and must not block the handoff.
  }
  fireToUserEvents(eventType, enriched);
}

export const trackAppHandoffView = (metadata: AppHandoffMetadata): void =>
  emit(APP_HANDOFF_VIEW_EVENT, metadata);

export const trackAppHandoffQrRendered = (
  metadata: AppHandoffMetadata,
): void => emit(APP_HANDOFF_QR_RENDERED_EVENT, { handoff_channel: "qr", ...metadata });

export const trackAppHandoffEmailSubmit = (
  metadata: AppHandoffMetadata,
): void =>
  emit(APP_HANDOFF_EMAIL_SUBMIT_EVENT, {
    handoff_channel: "email",
    ...metadata,
  });

export const trackAppHandoffEmailSent = (
  metadata: AppHandoffMetadata,
): void =>
  emit(APP_HANDOFF_EMAIL_SENT_EVENT, {
    handoff_channel: "email",
    ...metadata,
  });

export const trackAppHandoffEmailFailed = (
  metadata: AppHandoffMetadata,
): void =>
  emit(APP_HANDOFF_EMAIL_FAILED_EVENT, {
    handoff_channel: "email",
    ...metadata,
  });

export const trackAppHandoffLinkOpened = (
  metadata: AppHandoffMetadata,
): void => emit(APP_HANDOFF_LINK_OPENED_EVENT, metadata);
