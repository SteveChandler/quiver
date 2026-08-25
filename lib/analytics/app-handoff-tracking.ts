import { track } from "@/lib/analytics";
import { deriveSeoPageContextFromPath } from "@/lib/analytics/web-context";
import { getVisitorId } from "@/lib/utils/visitor-id";
import type {
  BfrHandoffContext,
  BfrHandoffResolutionMetadata,
  BfrPageType,
} from "@/lib/analytics/event-taxonomy";
import {
  BFR_HANDOFF_CONTEXTS,
  BFR_PAGE_TYPES,
  hasValidBfrHandoffResolutionPair,
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
  handoff_context?: never;
  fallback_classification?: never;
  reason?: never;
  [key: string]: unknown;
}

type ExactCallHandoffBaseMetadata = {
  handoff_id: string;
  source: "exact_call";
  handoff_context: BfrHandoffContext;
  surface?: BfrPageType;
  platform?: "ios" | "android" | "desktop";
};

export type ExactCallHandoffMetadata = ExactCallHandoffBaseMetadata
  & BfrHandoffResolutionMetadata;

const EXACT_CALL_ALLOWED_KEYS = new Set<keyof ExactCallHandoffMetadata>([
  "handoff_id",
  "source",
  "handoff_context",
  "fallback_classification",
  "reason",
  "surface",
  "platform",
]);
const EXACT_CALL_HANDOFF_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const EXACT_CALL_CONTEXTS = new Set<string>(BFR_HANDOFF_CONTEXTS);
const EXACT_CALL_SURFACES = new Set<string>(BFR_PAGE_TYPES);
const EXACT_CALL_PLATFORMS = new Set<string>([
  "ios",
  "android",
  "desktop",
]);

function enrich(metadata: AppHandoffMetadata): AppHandoffMetadata {
  return {
    cta_family: "app_handoff",
    ...deriveSeoPageContextFromPath(),
    ...metadata,
  };
}

function fireToUserEvents(
  eventType: AppHandoffEvent,
  metadata: Record<string, unknown>,
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

function sanitizeExactCallMetadata(
  metadata: ExactCallHandoffMetadata
): ExactCallHandoffMetadata | null {
  const input = metadata as unknown as Record<string, unknown>;
  const sanitized = Object.fromEntries(
    Object.entries(input).filter(([key]) =>
      EXACT_CALL_ALLOWED_KEYS.has(key as keyof ExactCallHandoffMetadata)
    )
  ) as Record<string, unknown>;

  if (
    typeof sanitized.handoff_id !== "string" ||
    !EXACT_CALL_HANDOFF_ID_PATTERN.test(sanitized.handoff_id)
  ) {
    return null;
  }
  if (sanitized.source !== "exact_call") return null;
  if (
    typeof sanitized.handoff_context !== "string"
    || !EXACT_CALL_CONTEXTS.has(sanitized.handoff_context)
  ) return null;
  if (!hasValidBfrHandoffResolutionPair(sanitized)) return null;
  if (
    sanitized.surface !== undefined
    && (
      typeof sanitized.surface !== "string"
      || !EXACT_CALL_SURFACES.has(sanitized.surface)
    )
  ) {
    return null;
  }
  if (
    sanitized.platform !== undefined
    && (
      typeof sanitized.platform !== "string"
      || !EXACT_CALL_PLATFORMS.has(sanitized.platform)
    )
  ) {
    return null;
  }

  return sanitized as ExactCallHandoffMetadata;
}

function emitExactCall(metadata: ExactCallHandoffMetadata): void {
  const sanitized = sanitizeExactCallMetadata(metadata);
  if (!sanitized) return;

  let enriched: Record<string, unknown>;
  try {
    enriched = {
      cta_family: "app_handoff",
      ...deriveSeoPageContextFromPath(),
      viewport_width:
        typeof window !== "undefined" ? window.innerWidth : undefined,
      ...sanitized,
    };
  } catch {
    return;
  }
  try {
    track(APP_HANDOFF_LINK_OPENED_EVENT, enriched);
  } catch {
    // Product analytics is best effort and must not block the handoff.
  }
  fireToUserEvents(APP_HANDOFF_LINK_OPENED_EVENT, enriched);
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

export const trackExactCallHandoffLinkOpened = (
  metadata: ExactCallHandoffMetadata
): void => emitExactCall(metadata);
