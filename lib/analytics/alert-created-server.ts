import { runAfterResponse } from "@/lib/analytics/after-response";
import { getOwnAnalyticsTrackingAllowed } from "@/lib/analytics/consent";
import { deterministicEventUuid } from "@/lib/analytics/deterministic-uuid";
import { capturePostHogEvent } from "@/lib/posthog-server";

type ConsentClient = Parameters<typeof getOwnAnalyticsTrackingAllowed>[0];

/**
 * Where on the server the rule was inserted. `rules_api` is shared by the web
 * popover, the web alerts page and the native app; `platform` tells them apart.
 */
export type AlertCreatedSource =
  | "rules_api"
  | "onboarding_seed"
  | "anon_capture";

export type AlertCreatedPlatform = "web" | "native";

export interface AlertCreatedEvent {
  /** Known for direct inserts; the anon-capture RPC only returns capture ids. */
  ruleId?: string | null;
  captureId?: string | null;
  beachId: string;
  /** alert_rules.preset_type; null is a hand-built (custom) condition set. */
  presetType: string | null;
  source: AlertCreatedSource;
  platform: AlertCreatedPlatform;
  isFirstAlert: boolean;
  notifyEmail?: boolean | null;
  notifyPush?: boolean | null;
}

/**
 * Native sends a Supabase Bearer token; the web uses the cookie session. An
 * explicit `x-quiver-platform` header wins when a client sets it, and native
 * should send it: the Bearer check is only a fallback.
 */
export function resolveRequestPlatform(request: {
  headers?: { get?: (name: string) => string | null };
}): AlertCreatedPlatform {
  const headers = request?.headers;
  const declared = headers?.get?.("x-quiver-platform")?.toLowerCase();
  if (declared === "ios" || declared === "android") return "native";
  if (declared === "web") return "web";

  const authorization = headers?.get?.("authorization") ?? "";
  return /^Bearer\s+\S+/i.test(authorization) ? "native" : "web";
}

function dedupeKey(event: AlertCreatedEvent): string | null {
  if (event.ruleId) return `alert_created:${event.ruleId}`;
  if (event.captureId) return `alert_created:capture:${event.captureId}`;
  return null;
}

/**
 * Canonical server-side `alert_created` for the funnel
 * (first session -> alert created -> paywall -> trial -> paid). Called after a
 * successful insert, gated on the same owner-scoped analytics consent the
 * other server events use. Never throws: analytics must not fail a write.
 */
export async function captureAlertCreatedEvents({
  supabase,
  userId,
  events,
}: {
  supabase: ConsentClient;
  userId: string;
  events: AlertCreatedEvent[];
}): Promise<void> {
  if (events.length === 0) return;

  try {
    const allowed = await getOwnAnalyticsTrackingAllowed(supabase, userId).catch(
      () => false,
    );
    if (!allowed) return;

    for (const event of events) {
      const key = dedupeKey(event);
      await capturePostHogEvent({
        distinctId: userId,
        event: "alert_created",
        // PostHog dedupes on uuid; $insert_id is kept for readability only.
        ...(key ? { uuid: deterministicEventUuid(key) } : {}),
        properties: {
          ...(key ? { $insert_id: key } : {}),
          alert_type: event.presetType ?? "custom",
          beach_id: event.beachId,
          source: event.source,
          platform: event.platform,
          is_first_alert: event.isFirstAlert,
          ...(event.ruleId ? { rule_id: event.ruleId } : {}),
          ...(typeof event.notifyEmail === "boolean"
            ? { notify_email: event.notifyEmail }
            : {}),
          ...(typeof event.notifyPush === "boolean"
            ? { notify_push: event.notifyPush }
            : {}),
        },
      });
    }
  } catch (error) {
    console.error("[analytics] alert_created capture failed:", error);
  }
}

interface CaptureInput {
  supabase: ConsentClient;
  userId: string;
  events: AlertCreatedEvent[];
}

/** Capture after the response is sent; see runAfterResponse. */
export function scheduleAlertCreatedEvents(input: CaptureInput): void {
  runAfterResponse(() => captureAlertCreatedEvents(input));
}

/**
 * Schedules alert_created for rules seeded by seedDefaultRulesForUser. The seed
 * only runs for a user with no rules, so the first rule is their first alert.
 */
export function scheduleSeededAlertCreated({
  supabase,
  userId,
  beachId,
  rules,
  platform,
  notifyEmail,
  notifyPush,
}: {
  supabase: ConsentClient;
  userId: string;
  beachId: string;
  rules: ReadonlyArray<{ ruleId: string; presetType: string }>;
  platform: AlertCreatedPlatform;
  notifyEmail: boolean;
  notifyPush: boolean;
}): void {
  if (rules.length === 0) return;

  scheduleAlertCreatedEvents({
    supabase,
    userId,
    events: rules.map((rule, index) => ({
      ruleId: rule.ruleId,
      beachId,
      presetType: rule.presetType,
      source: "onboarding_seed",
      platform,
      isFirstAlert: index === 0,
      notifyEmail,
      notifyPush,
    })),
  });
}
