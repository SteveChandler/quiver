import { track } from "@/lib/analytics";
import { deriveSeoPageContextFromPath } from "@/lib/analytics/web-context";
import { getVisitorId } from "@/lib/utils/visitor-id";
import type {
  BfrHandoffContext,
  BfrPageType,
} from "@/lib/analytics/event-taxonomy";
import {
  BFR_HANDOFF_CONTEXTS,
  BFR_PAGE_TYPES,
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

type LegacyAppHandoffMetadata<Metadata extends AppHandoffMetadata> =
  Metadata & { source: Exclude<Metadata["source"], "exact_call"> };

type ExactCallHandoffBaseMetadata = {
  handoff_id: string;
  source: "exact_call";
  handoff_context: BfrHandoffContext;
  surface?: BfrPageType;
  placement?: "exact_call";
};

export type ExactCallHandoffMetadata = ExactCallHandoffBaseMetadata;

const EXACT_CALL_ALLOWED_KEYS = new Set<keyof ExactCallHandoffMetadata>([
  "handoff_id",
  "source",
  "handoff_context",
  "surface",
  "placement",
]);
const EXACT_CALL_HANDOFF_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const EXACT_CALL_CONTEXTS = new Set<string>(BFR_HANDOFF_CONTEXTS);
const EXACT_CALL_SURFACES = new Set<string>(BFR_PAGE_TYPES);

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
    sanitized.placement !== undefined
    && (
      typeof sanitized.placement !== "string"
      || sanitized.placement !== "exact_call"
    )
  ) {
    return null;
  }

  return sanitized as ExactCallHandoffMetadata;
}

function emitExactCall(metadata: ExactCallHandoffMetadata): void {
  const sanitized = sanitizeExactCallMetadata(metadata);
  if (!sanitized) return;

  try {
    track(APP_HANDOFF_LINK_OPENED_EVENT, sanitized);
  } catch {
    // Product analytics is best effort and must not block the handoff.
  }
  fireToUserEvents(APP_HANDOFF_LINK_OPENED_EVENT, sanitized);
}

function emit(eventType: AppHandoffEvent, metadata: AppHandoffMetadata): void {
  if (metadata.source === "exact_call") return;

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

export const trackAppHandoffView = <const Metadata extends AppHandoffMetadata>(
  metadata: LegacyAppHandoffMetadata<Metadata>,
): void => emit(APP_HANDOFF_VIEW_EVENT, metadata);

export const trackAppHandoffQrRendered = <const Metadata extends AppHandoffMetadata>(
  metadata: LegacyAppHandoffMetadata<Metadata>,
): void => emit(APP_HANDOFF_QR_RENDERED_EVENT, { handoff_channel: "qr", ...metadata });

export const trackAppHandoffEmailSubmit = <const Metadata extends AppHandoffMetadata>(
  metadata: LegacyAppHandoffMetadata<Metadata>,
): void =>
  emit(APP_HANDOFF_EMAIL_SUBMIT_EVENT, {
    handoff_channel: "email",
    ...metadata,
  });

export const trackAppHandoffEmailSent = <const Metadata extends AppHandoffMetadata>(
  metadata: LegacyAppHandoffMetadata<Metadata>,
): void =>
  emit(APP_HANDOFF_EMAIL_SENT_EVENT, {
    handoff_channel: "email",
    ...metadata,
  });

export const trackAppHandoffEmailFailed = <const Metadata extends AppHandoffMetadata>(
  metadata: LegacyAppHandoffMetadata<Metadata>,
): void =>
  emit(APP_HANDOFF_EMAIL_FAILED_EVENT, {
    handoff_channel: "email",
    ...metadata,
  });

export const trackAppHandoffLinkOpened = <const Metadata extends AppHandoffMetadata>(
  metadata: LegacyAppHandoffMetadata<Metadata>,
): void => emit(APP_HANDOFF_LINK_OPENED_EVENT, metadata);

// Import is inert; Plans 20.1-03/04/05 product wiring invokes this guarded emitter.
export const trackExactCallHandoffLinkOpened = (
  metadata: ExactCallHandoffMetadata
): void => emitExactCall(metadata);
