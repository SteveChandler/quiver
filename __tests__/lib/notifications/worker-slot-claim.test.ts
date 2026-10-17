/** @jest-environment node */

import { processPendingEvents } from "@/lib/notifications/worker";
import { getRegistryEntry } from "@/lib/notifications/registry";
import type { NotificationEventRow } from "@/lib/notifications/db-augment";

jest.mock("@/lib/services/firebase-admin", () => ({
  getFirebaseAdminMessaging: jest.fn(() => null),
}));
jest.mock("@/lib/posthog-server", () => ({
  capturePostHogEvent: jest.fn(),
}));
jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(() => {
    throw new Error("Unexpected service client: this test must use its injected client");
  }),
}));

it.each(["push", "in_app"] as const)(
  "current known-inverted behaviour awaiting a product decision: a processed priority-2 Daily Call cancels a later priority-3 manual alert as skipped_redundant at %s claim",
  async (channel) => {
    const now = new Date("2026-10-16T19:00:00Z");
    const event: NotificationEventRow = {
      id: "manual-alert",
      recipient_user_id: "surfer",
      actor_user_id: null,
      type: "forecast_alert",
      entity_type: "beach",
      entity_id: "beach-1",
      payload: {
        alert_date: "2026-10-16",
        beach_id: "beach-1",
        title: "Clean afternoon window",
        body: "3 ft at 14s",
      },
      dedupe_key: null,
      status: "processing",
      skip_reason: null,
      created_at: now.toISOString(),
      processed_at: null,
      claimed_at: now.toISOString(),
      attempt_count: 1,
      next_attempt_at: null,
      last_attempt_at: now.toISOString(),
      claim_token: null,
      cancel_reason: null,
      last_error: null,
    };
    expect(getRegistryEntry("daily_call").surfAlertPriority).toBe(2);
    expect(getRegistryEntry("forecast_alert").surfAlertPriority).toBe(3);

    // SQL coverage pins why the processed winner returns false; this test pins the worker's response.
    const rpc = jest.fn(async (name: string, args: Record<string, unknown>) => {
      if (name === "claim_notification_events") {
        event.claim_token = String(args.p_claim_token);
        return { data: [event], error: null };
      }
      if (name === "claim_surf_alert_slot") return { data: false, error: null };
      throw new Error(`Unexpected RPC ${name}`);
    });
    const attemptInsert = jest.fn(async () => ({ error: null }));
    const notificationInsert = jest.fn(async () => ({ error: null }));
    const terminalClaimFilter = jest.fn(async () => ({ error: null }));
    const terminalIdFilter = jest.fn(() => ({ eq: terminalClaimFilter }));
    const eventUpdate = jest.fn(() => ({ eq: terminalIdFilter }));
    const from = jest.fn((table: string): unknown => {
      switch (table) {
        case "profiles":
          return { select: () => ({ eq: () => ({ maybeSingle: async () => ({
            data: {
              id: "surfer",
              display_name: "Surfer",
              timezone: "America/Los_Angeles",
              experience_level: "intermediate",
              allow_implicit_tracking: false,
              notif_push_enabled: channel === "push",
              notif_inapp_enabled: true,
              notif_forecast_alerts: true,
            },
            error: null,
          }) }) }) };
        case "notification_delivery_attempts":
          return {
            select: () => ({ in: async () => ({ data: [], error: null }) }),
            insert: attemptInsert,
          };
        case "user_devices":
          return { select: () => ({ eq: () => ({ is: async () => ({
            data: [{ device_token: "test-device", platform: "ios" }], error: null,
          }) }) }) };
        case "notification_events":
          return { update: eventUpdate };
        case "notifications":
          return { insert: notificationInsert };
        default:
          throw new Error(`Unexpected table ${table}`);
      }
    });
    const sendEach = jest.fn();

    const summary = await processPendingEvents({ from, rpc } as never, {
      now,
      fcm: { sendEach } as never,
      resolveMajorEventHold: async () => ({ status: "allowed", candidate: null }),
    });

    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc).toHaveBeenLastCalledWith("claim_surf_alert_slot", {
      p_event_id: "manual-alert",
      p_recipient_user_id: "surfer",
      p_alert_date: "2026-10-16",
      p_priority: 3,
    });
    expect(eventUpdate).toHaveBeenCalledTimes(1);
    expect(eventUpdate).toHaveBeenCalledWith(expect.objectContaining({
      status: "cancelled",
      skip_reason: "skipped_redundant",
      cancel_reason: "skipped_redundant",
      claim_token: null,
    }));
    expect(terminalIdFilter).toHaveBeenCalledWith("id", "manual-alert");
    expect(terminalClaimFilter).toHaveBeenCalledWith("claim_token", event.claim_token);
    expect(attemptInsert).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ notification_event_id: event.id, channel, status: "skipped_dedup" }),
    ]));
    expect(summary).toMatchObject({ fetched: 1, processed: 1, skipped: 1, failed: 0, pending_after_run: 0 });
    expect(sendEach).not.toHaveBeenCalled();
    expect(notificationInsert).not.toHaveBeenCalled();
  },
);
