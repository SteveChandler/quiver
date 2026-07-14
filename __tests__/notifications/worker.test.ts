/**
 * @jest-environment node
 *
 * Worker pipeline tests. Mocks supabase + FCM and asserts the full decision
 * tree: self-suppress, master pref, per-type pref, quiet hours, no-device,
 * Firebase null, happy path, mark-event terminal status, AND per-channel
 * retry semantics for transient failures.
 *
 * Plan: ~/.claude/plans/on-quiver-native-we-have-snug-tiger.md (Phase 2e + review fixes).
 */

jest.mock("@/lib/services/firebase-admin", () => ({
  getFirebaseAdminMessaging: jest.fn(() => null),
}));

jest.mock("@/lib/posthog-server", () => ({
  capturePostHogEvent: jest.fn(async () => undefined),
}));

import { processPendingEvents } from "@/lib/notifications/worker";
import { capturePostHogEvent } from "@/lib/posthog-server";
import { expectConsoleErrors } from "@/__tests__/setup/test-utils";

interface MockEvent {
  id: string;
  recipient_user_id: string;
  actor_user_id: string | null;
  type: string;
  entity_type: string | null;
  entity_id: string | null;
  payload: Record<string, unknown>;
  dedupe_key: string | null;
  status: "pending" | "processing" | "processed" | "failed" | "cancelled";
  skip_reason: string | null;
  created_at: string;
  processed_at: string | null;
  claimed_at: string | null;
  // Phase 5a additions
  attempt_count: number;
  next_attempt_at: string | null;
  last_attempt_at: string | null;
  claim_token: string | null;
  cancel_reason: string | null;
  last_error: string | null;
}

interface MockProfile {
  id: string;
  display_name: string | null;
  timezone: string | null;
  notif_push_enabled: boolean;
  notif_email_enabled: boolean;
  notif_inapp_enabled: boolean;
  notif_likes: boolean;
  notif_follows: boolean;
  notif_reminders: boolean;
  notif_xp_updates: boolean;
  notif_forecast_alerts: boolean;
  notif_water_quality: boolean;
  notif_similarity_alerts: boolean;
}

interface MockAttempt {
  id: string;
  notification_event_id: string;
  channel: "push" | "in_app" | "email";
  status: string;
  provider_response: unknown;
  error_message: string | null;
  created_at: string;
}

interface MockState {
  events: MockEvent[];
  profiles: Map<string, MockProfile>;
  devices: Map<string, string[]>;
  notificationsInserts: Array<{ user_id: string; type: string; data: unknown }>;
  attempts: MockAttempt[];
  alertAttempts: Array<{
    queue_id: string;
    rule_id: string;
    user_id: string;
    channel: "push";
    status: string;
    skip_reason: string | null;
  }>;
  eventUpdates: Array<{ id: string; status: string; skip_reason: string | null }>;
  deviceDeletes: string[];
  surfAlertSlots: Map<string, { eventId: string; priority: number }>;
  /** When set, fetch on this table throws to simulate a Supabase error. */
  errorOnSelect?: Set<string>;
  /** When set, profile lookup for this user_id throws. */
  errorOnProfileLookup?: Set<string>;
  /** When set, delivery-attempt inserts return this error. */
  attemptInsertError?: string;
  /** Override "now" inside the mock RPC simulator. Defaults to Date.now(). */
  now?: number;
}

function buildProfile(over: Partial<MockProfile> = {}): MockProfile {
  return {
    id: "user-recipient",
    display_name: "Recipient User",
    timezone: "America/Los_Angeles",
    notif_push_enabled: true,
    notif_email_enabled: true,
    notif_inapp_enabled: true,
    notif_likes: true,
    notif_follows: true,
    notif_reminders: true,
    notif_xp_updates: true,
    notif_forecast_alerts: true,
    notif_water_quality: true,
    notif_similarity_alerts: true,
    ...over,
  };
}

function buildEvent(over: Partial<MockEvent> = {}): MockEvent {
  return {
    id: "evt-1",
    recipient_user_id: "user-recipient",
    actor_user_id: "user-actor",
    type: "like",
    entity_type: "session",
    entity_id: "sess-1",
    payload: { session_id: "sess-1", beach_name: "Mavericks" },
    dedupe_key: "like:sess-1:user-actor",
    status: "pending",
    skip_reason: null,
    created_at: new Date("2026-04-29T12:00:00Z").toISOString(),
    processed_at: null,
    claimed_at: null,
    attempt_count: 0,
    next_attempt_at: null,
    last_attempt_at: null,
    claim_token: null,
    cancel_reason: null,
    last_error: null,
    ...over,
  };
}

function buildMockSupabase(state: MockState) {
  // Phase 5b: atomic claim simulator. Mirrors the SQL function semantics:
  // eligible = (pending OR (processing AND stale)) AND next_attempt_at not in
  // future. Updates state in-place so subsequent calls see processing rows.
  function simulateClaim(
    batchSize: number,
    leaseSeconds: number,
    claimToken: string,
    nowMs: number
  ): MockEvent[] {
    const staleCutoff = nowMs - leaseSeconds * 1000;
    const claimed: MockEvent[] = [];
    for (const ev of state.events) {
      if (claimed.length >= batchSize) break;
      const isPending = ev.status === "pending";
      const isStaleProcessing =
        ev.status === "processing" &&
        ev.claimed_at !== null &&
        new Date(ev.claimed_at).getTime() < staleCutoff;
      if (!isPending && !isStaleProcessing) continue;
      if (
        ev.next_attempt_at !== null &&
        new Date(ev.next_attempt_at).getTime() > nowMs
      ) {
        continue;
      }
      ev.status = "processing";
      ev.claim_token = claimToken;
      ev.claimed_at = new Date(nowMs).toISOString();
      ev.attempt_count += 1;
      ev.last_attempt_at = ev.claimed_at;
      claimed.push({ ...ev });
    }
    return claimed;
  }

  function fromTable(table: string) {
    if (table === "notification_events") {
      return {
        // Phase 5g: cooldown lookup —
        //   select('id').eq('recipient_user_id', X).eq('type', T).gte('created_at', iso)
        select: () => ({
          eq: (col1: string, val1: string) => ({
            eq: (col2: string, val2: string) => ({
              gte: async (col3: string, iso: string) => {
                if (
                  col1 !== "recipient_user_id" ||
                  col2 !== "type" ||
                  col3 !== "created_at"
                ) {
                  throw new Error(
                    `Unexpected notification_events select chain: ${col1}/${col2}/${col3}`
                  );
                }
                const cutoff = new Date(iso).getTime();
                return {
                  data: state.events
                    .filter(
                      (e) =>
                        e.recipient_user_id === val1 &&
                        e.type === val2 &&
                        new Date(e.created_at).getTime() >= cutoff
                    )
                    .map((e) => ({ id: e.id })),
                  error: null,
                };
              },
            }),
          }),
        }),
        update: (
          row: Partial<{
            status: string;
            skip_reason: string | null;
            claimed_at: string | null;
            claim_token: string | null;
            processed_at: string | null;
            next_attempt_at: string | null;
          }>
        ) => {
          // markEventTerminal: update(row).eq('id', eventId).eq('claim_token', claimToken)
          // releaseClaims:     update(row).eq('id', eventId).eq('claim_token', claimToken) — per event
          return {
            eq: (_idCol: string, eventId: string) => ({
              eq: async (_col: string, claimToken: string) => {
                const e = state.events.find((x) => x.id === eventId);
                if (!e) return { error: null };
                // claim_token defense: only write if our token matches
                if (e.claim_token !== claimToken) return { error: null };
                if ("status" in row) {
                  if (row.status === "pending") {
                    // releaseClaims path
                    e.status = "pending";
                    e.claimed_at = null;
                    e.claim_token = null;
                    e.next_attempt_at =
                      (row.next_attempt_at ?? null) as string | null;
                  } else {
                    // markEventTerminal path
                    state.eventUpdates.push({
                      id: eventId,
                      status: row.status as string,
                      skip_reason: (row.skip_reason ?? null) as string | null,
                    });
                    e.status = row.status as MockEvent["status"];
                    e.skip_reason = (row.skip_reason ?? null) as string | null;
                    e.claim_token = null;
                    e.claimed_at = null;
                  }
                }
                return { error: null };
              },
            }),
          };
        },
      };
    }
    if (table === "notification_delivery_attempts") {
      return {
        // Two select shapes supported:
        //   1. .select(...).in('notification_event_id', ids)               (history lookup)
        //   2. .select(...).eq('channel',c).eq('status',s).gte('created_at',iso).in('notification_event_id', ids).limit(1)  (Phase 5g cooldown)
        select: () => {
          const buildHistoryShape = () => ({
            in: async (_col: string, ids: string[]) => ({
              data: state.attempts.filter((a) =>
                ids.includes(a.notification_event_id)
              ),
              error: null,
            }),
          });
          return {
            ...buildHistoryShape(),
            eq: (channelCol: string, channelVal: string) => ({
              eq: (statusCol: string, statusVal: string) => ({
                gte: (_dateCol: string, iso: string) => ({
                  in: (_idCol: string, ids: string[]) => ({
                    limit: async (_n: number) => {
                      const cutoff = new Date(iso).getTime();
                      const matches = state.attempts.filter(
                        (a) =>
                          a.channel === channelVal &&
                          a.status === statusVal &&
                          new Date(a.created_at).getTime() >= cutoff &&
                          ids.includes(a.notification_event_id)
                      );
                      return {
                        data: matches.slice(0, _n).map((m) => ({ id: m.id })),
                        error: null,
                      };
                    },
                  }),
                }),
                _: { channelCol, statusCol },
              }),
            }),
          };
        },
        insert: async (rows: MockAttempt[]) => {
          if (state.attemptInsertError) {
            return { error: { message: state.attemptInsertError } };
          }
          state.attempts.push(
            ...rows.map((r, i) => ({
              ...r,
              id: `att-${state.attempts.length + i + 1}`,
              created_at: new Date().toISOString(),
            }))
          );
          return { error: null };
        },
      };
    }
    if (table === "alert_delivery_attempts") {
      return {
        insert: async (
          rows: Array<{
            queue_id: string;
            rule_id: string;
            user_id: string;
            channel: "push";
            status: string;
            skip_reason: string | null;
          }>
        ) => {
          state.alertAttempts.push(...rows);
          return { error: null };
        },
      };
    }
    if (table === "profiles") {
      return {
        select: () => ({
          eq: (_col: string, val: string) => ({
            maybeSingle: async () => {
              if (state.errorOnProfileLookup?.has(val)) {
                return {
                  data: null,
                  error: { message: "simulated profile query error" },
                };
              }
              return {
                data: state.profiles.get(val) ?? null,
                error: null,
              };
            },
          }),
        }),
      };
    }
    if (table === "user_devices") {
      return {
        select: () => ({
          eq: async (_col: string, val: string) => ({
            data: (state.devices.get(val) ?? []).map((t) => ({ device_token: t })),
            error: null,
          }),
        }),
        delete: () => ({
          in: async (_col: string, tokens: string[]) => {
            state.deviceDeletes.push(...tokens);
            return { error: null };
          },
        }),
      };
    }
    if (table === "notifications") {
      return {
        insert: async (row: { user_id: string; type: string; data: unknown }) => {
          state.notificationsInserts.push(row);
          return { error: null };
        },
      };
    }
    throw new Error(`Unexpected table in mock: ${table}`);
  }
  return {
    from: fromTable,
    rpc: async (name: string, args: Record<string, unknown>) => {
      if (name === "claim_surf_alert_slot") {
        const eventId = args.p_event_id as string;
        const slotKey = [
          args.p_recipient_user_id,
          args.p_beach_id,
          args.p_alert_date,
        ].join(":");
        const priority = args.p_priority as number;
        const existing = state.surfAlertSlots.get(slotKey);
        if (!existing) {
          state.surfAlertSlots.set(slotKey, { eventId, priority });
          return { data: true, error: null };
        }
        if (existing.eventId === eventId) {
          return { data: true, error: null };
        }

        const existingEvent = state.events.find((event) => event.id === existing.eventId);
        if (!existingEvent || ["processing", "processed"].includes(existingEvent.status)) {
          return { data: false, error: null };
        }
        if (existingEvent.status !== "pending" || priority > existing.priority) {
          if (existingEvent.status === "pending") {
            if (["forecast_alert", "similarity_match"].includes(existingEvent.type)) {
              const queueItems = Array.isArray(existingEvent.payload.queue_items)
                ? existingEvent.payload.queue_items
                : [];
              for (const queueItem of queueItems) {
                if (
                  typeof queueItem === "object" &&
                  queueItem !== null &&
                  "queue_id" in queueItem &&
                  "rule_id" in queueItem
                ) {
                  state.alertAttempts.push({
                    queue_id: String(queueItem.queue_id),
                    rule_id: String(queueItem.rule_id),
                    user_id: existingEvent.recipient_user_id,
                    channel: "push",
                    status: "skipped_dedup_collision",
                    skip_reason: "skipped_dedup",
                  });
                }
              }
            }
            existingEvent.status = "cancelled";
            existingEvent.skip_reason = "skipped_redundant";
            existingEvent.cancel_reason = "skipped_redundant";
          }
          state.surfAlertSlots.set(slotKey, { eventId, priority });
          return { data: true, error: null };
        }
        return { data: false, error: null };
      }
      if (name !== "claim_notification_events") {
        throw new Error(`Unexpected rpc in mock: ${name}`);
      }
      if (state.errorOnSelect?.has("notification_events")) {
        return {
          data: null,
          error: { message: "simulated db error", code: "57P01" },
        };
      }
      const data = simulateClaim(
        args.p_batch_size as number,
        args.p_lease_seconds as number,
        args.p_claim_token as string,
        state.now ?? Date.now()
      );
      return { data, error: null };
    },
  };
}

function emptyState(): MockState {
  return {
    events: [],
    profiles: new Map(),
    devices: new Map(),
    notificationsInserts: [],
    attempts: [],
    alertAttempts: [],
    eventUpdates: [],
    deviceDeletes: [],
    surfAlertSlots: new Map(),
  };
}

const NOON_PT = new Date("2026-04-29T19:00:00Z"); // 12:00 Pacific.

beforeEach(() => {
  jest.clearAllMocks();
});

describe("processPendingEvents — empty state", () => {
  it("returns zero counts when nothing is pending", async () => {
    const state = emptyState();
    const summary = await processPendingEvents(
      buildMockSupabase(state) as never,
      { now: NOON_PT }
    );

    expect(summary).toEqual({
      fetched: 0,
      processed: 0,
      skipped: 0,
      failed: 0,
      pending_after_run: 0,
      firebase_configured: false,
      by_status: {},
      // Phase 5m
      deferred_quiet_hours_count: 0,
      retry_scheduled_count: 0,
      unknown_type_count: 0,
      missing_timezone_count: 0,
    });
    expect(state.attempts).toEqual([]);
    expect(state.eventUpdates).toEqual([]);
  });
});

describe("processPendingEvents — happy path", () => {
  it("like: push fires, in-app row inserted, event marked processed", async () => {
    const state = emptyState();
    state.events.push(buildEvent());
    state.profiles.set("user-recipient", buildProfile());
    state.profiles.set(
      "user-actor",
      buildProfile({ id: "user-actor", display_name: "Actor User" })
    );
    state.devices.set("user-recipient", ["device-token-A"]);

    const fakeFcm = {
      sendEach: jest.fn(async () => ({
        successCount: 1,
        failureCount: 0,
        responses: [{ success: true }],
      })),
    };

    const summary = await processPendingEvents(
      buildMockSupabase(state) as never,
      { now: NOON_PT, fcm: fakeFcm as never }
    );

    expect(summary.processed).toBe(1);
    expect(summary.firebase_configured).toBe(true);
    expect(summary.by_status.sent).toBe(2);
    expect(state.attempts).toEqual([
      expect.objectContaining({ channel: "push", status: "sent" }),
      expect.objectContaining({ channel: "in_app", status: "sent" }),
    ]);
    expect(fakeFcm.sendEach).toHaveBeenCalledTimes(1);
    const sentMessages = (fakeFcm.sendEach.mock.calls[0] as unknown[])[0] as Array<
      Record<string, unknown>
    >;
    expect(sentMessages[0]).toMatchObject({
      token: "device-token-A",
      notification: expect.objectContaining({
        title: "Actor User liked your session",
      }),
    });
    expect(state.eventUpdates).toEqual([
      { id: "evt-1", status: "processed", skip_reason: null },
    ]);
    expect(capturePostHogEvent).toHaveBeenCalledWith({
      distinctId: "user-recipient",
      event: "notification_delivery_attempt",
      properties: expect.objectContaining({
        "$insert_id": "notification_delivery_attempt:evt-1:push:1:sent",
        notification_event_id: "evt-1",
        notification_type: "like",
        notification_channel: "push",
        notification_status: "sent",
        notification_entity_type: "session",
        notification_entity_id: "sess-1",
        has_actor: true,
        attempt_count: 1,
        provider_success: 1,
        provider_failed: 0,
        provider_invalid_token_count: 0,
        provider_error_count: 0,
      }),
    });
    expect(capturePostHogEvent).toHaveBeenCalledWith({
      distinctId: "user-recipient",
      event: "notification_delivery_attempt",
      properties: expect.objectContaining({
        "$insert_id": "notification_delivery_attempt:evt-1:in_app:1:sent",
        notification_channel: "in_app",
        notification_status: "sent",
      }),
    });
  });

  it("push payload includes notification_event_id", async () => {
    const state = emptyState();
    state.events.push(buildEvent({ id: "evt-push-attribution" }));
    state.profiles.set("user-recipient", buildProfile());
    state.profiles.set(
      "user-actor",
      buildProfile({ id: "user-actor", display_name: "Actor User" })
    );
    state.devices.set("user-recipient", ["device-token-A"]);

    const fakeFcm = {
      sendEach: jest.fn(async () => ({
        successCount: 1,
        failureCount: 0,
        responses: [{ success: true }],
      })),
    };

    await processPendingEvents(buildMockSupabase(state) as never, {
      now: NOON_PT,
      fcm: fakeFcm as never,
    });

    const sentMessages = (fakeFcm.sendEach.mock.calls[0] as unknown[])[0] as Array<{
      data?: Record<string, string>;
    }>;
    expect(sentMessages[0].data?.notification_event_id).toBe(
      "evt-push-attribution"
    );
    expect(sentMessages[0].data?.message_instance_id).toBe(
      "evt-push-attribution"
    );
  });

  it("forecast_alert: worker push success reconciles alert_delivery_attempts", async () => {
    const state = emptyState();
    state.events.push(
      buildEvent({
        id: "evt-forecast",
        actor_user_id: null,
        type: "forecast_alert",
        entity_type: "beach",
        entity_id: "beach-1",
        payload: {
          alert_date: "2026-05-10",
          title: "Conditions lining up today",
          body: "La Jolla Shores 7am-9am",
          beach_id: "beach-1",
          forecast_at: "2026-05-10T14:30:00.000Z",
          queue_items: [{ queue_id: "queue-forecast-1", rule_id: "rule-forecast-1" }],
        },
        dedupe_key: "forecast_alert:user-recipient:2026-05-10",
      })
    );
    state.profiles.set("user-recipient", buildProfile());
    state.devices.set("user-recipient", ["device-token-A"]);

    const fakeFcm = {
      sendEach: jest.fn(async () => ({
        successCount: 1,
        failureCount: 0,
        responses: [{ success: true }],
      })),
    };

    const summary = await processPendingEvents(
      buildMockSupabase(state) as never,
      { now: NOON_PT, fcm: fakeFcm as never }
    );

    expect(summary.processed).toBe(1);
    expect(state.attempts).toEqual([
      expect.objectContaining({ notification_event_id: "evt-forecast", channel: "push", status: "sent" }),
      expect.objectContaining({ notification_event_id: "evt-forecast", channel: "in_app", status: "sent" }),
    ]);
    expect(state.alertAttempts).toEqual([
      {
        queue_id: "queue-forecast-1",
        rule_id: "rule-forecast-1",
        user_id: "user-recipient",
        channel: "push",
        status: "sent",
        skip_reason: "sent",
      },
    ]);
  });

  it("similarity_match: worker push success reconciles alert_delivery_attempts", async () => {
    const state = emptyState();
    state.events.push(
      buildEvent({
        id: "evt-similarity",
        actor_user_id: null,
        type: "similarity_match",
        entity_type: "beach",
        entity_id: "beach-2",
        payload: {
          beach_id: "beach-2",
          beach_slug: "la-jolla-shores",
          beach_name: "La Jolla Shores",
          alert_date: "2026-05-10",
          forecast_at: "2026-05-10T14:30:00.000Z",
          score: 8.7,
          label: "GOOD",
          reason: "Conditions match your best sessions",
          queue_items: [{ queue_id: "queue-sim-1", rule_id: "rule-sim-1" }],
        },
        dedupe_key: "similarity_match:user-recipient:2026-05-10",
      })
    );
    state.profiles.set("user-recipient", buildProfile());
    state.devices.set("user-recipient", ["device-token-A"]);

    const fakeFcm = {
      sendEach: jest.fn(async () => ({
        successCount: 1,
        failureCount: 0,
        responses: [{ success: true }],
      })),
    };

    const summary = await processPendingEvents(
      buildMockSupabase(state) as never,
      { now: NOON_PT, fcm: fakeFcm as never }
    );

    expect(summary.processed).toBe(1);
    expect(state.attempts).toEqual([
      expect.objectContaining({ notification_event_id: "evt-similarity", channel: "push", status: "sent" }),
      expect.objectContaining({ notification_event_id: "evt-similarity", channel: "in_app", status: "sent" }),
    ]);
    expect(state.alertAttempts).toEqual([
      {
        queue_id: "queue-sim-1",
        rule_id: "rule-sim-1",
        user_id: "user-recipient",
        channel: "push",
        status: "sent",
        skip_reason: "sent",
      },
    ]);
  });
});

describe("processPendingEvents — durable surf-alert arbitration", () => {
  it("keeps one in-app surf alert when push is disabled", async () => {
    const state = emptyState();
    state.now = NOON_PT.getTime();
    state.profiles.set(
      "user-recipient",
      buildProfile({ notif_push_enabled: false, notif_inapp_enabled: true }),
    );
    state.events.push(
      buildEvent({
        id: "evt-similarity-in-app",
        actor_user_id: null,
        type: "similarity_match",
        entity_type: "beach",
        entity_id: "beach-1",
        payload: {
          beach_id: "beach-1",
          beach_slug: "mavericks",
          beach_name: "Mavericks",
          alert_date: "2026-04-29",
          forecast_at: "2026-04-29T19:00:00.000Z",
          score: 8.4,
          label: "GOOD",
          reason: "Conditions match your best sessions",
        },
      }),
      buildEvent({
        id: "evt-forecast-in-app",
        actor_user_id: null,
        type: "forecast_alert",
        entity_type: "beach",
        entity_id: "beach-1",
        payload: {
          alert_date: "2026-04-29",
          beach_id: "beach-1",
          title: "Clean window at Mavericks",
          body: "2.7 ft @ 14s",
        },
      }),
    );

    const summary = await processPendingEvents(buildMockSupabase(state) as never, {
      now: NOON_PT,
      fcm: { sendEach: jest.fn() } as never,
    });

    expect(summary).toMatchObject({ processed: 2, skipped: 1 });
    expect(state.notificationsInserts).toHaveLength(1);
    expect(state.notificationsInserts[0]).toMatchObject({
      type: "forecast_alert",
    });
    expect(state.events.find((event) => event.id === "evt-similarity-in-app")).toMatchObject({
      status: "cancelled",
      skip_reason: "skipped_redundant",
    });
  });

  it("lets an enabled morning call deliver when a higher-priority forecast alert is disabled", async () => {
    const state = emptyState();
    state.now = NOON_PT.getTime();
    state.profiles.set(
      "user-recipient",
      buildProfile({ notif_forecast_alerts: false, notif_reminders: true }),
    );
    state.devices.set("user-recipient", ["device-token-A"]);
    state.events.push(
      buildEvent({
        id: "evt-home-enabled",
        actor_user_id: null,
        type: "home_morning_call",
        entity_type: "beach",
        entity_id: "beach-1",
        payload: {
          alert_date: "2026-04-29",
          beach_id: "beach-1",
          verdict: "YES",
          title: "Worth it at Mavericks",
          body: "Clean early window",
        },
      }),
      buildEvent({
        id: "evt-forecast-disabled",
        actor_user_id: null,
        type: "forecast_alert",
        entity_type: "beach",
        entity_id: "beach-1",
        payload: {
          alert_date: "2026-04-29",
          beach_id: "beach-1",
          title: "Clean window at Mavericks",
          body: "2.7 ft @ 14s",
        },
      }),
    );

    const fakeFcm = {
      sendEach: jest.fn(async () => ({
        successCount: 1,
        failureCount: 0,
        responses: [{ success: true }],
      })),
    };

    const summary = await processPendingEvents(buildMockSupabase(state) as never, {
      now: NOON_PT,
      fcm: fakeFcm as never,
    });

    expect(summary).toMatchObject({ processed: 2, skipped: 1 });
    expect(fakeFcm.sendEach).toHaveBeenCalledTimes(1);
    expect(state.events.find((event) => event.id === "evt-home-enabled")).toMatchObject({
      status: "processed",
      skip_reason: null,
    });
    expect(state.surfAlertSlots.get("user-recipient:beach-1:2026-04-29")).toEqual({
      eventId: "evt-home-enabled",
      priority: 1,
    });
  });

  it("cancels a same-beach surf alert claimed in a later worker tick", async () => {
    const state = emptyState();
    state.now = NOON_PT.getTime();
    state.profiles.set("user-recipient", buildProfile());
    state.devices.set("user-recipient", ["device-token-A"]);
    state.events.push(
      buildEvent({
        id: "evt-home",
        actor_user_id: null,
        type: "home_morning_call",
        entity_type: "beach",
        entity_id: "beach-1",
        payload: {
          alert_date: "2026-04-29",
          beach_id: "beach-1",
          verdict: "YES",
          title: "Worth it at Mavericks",
          body: "Clean early window",
        },
      }),
    );

    const fakeFcm = {
      sendEach: jest.fn(async () => ({
        successCount: 1,
        failureCount: 0,
        responses: [{ success: true }],
      })),
    };

    await processPendingEvents(buildMockSupabase(state) as never, {
      now: NOON_PT,
      fcm: fakeFcm as never,
    });

    state.events.push(
      buildEvent({
        id: "evt-condition",
        actor_user_id: null,
        type: "forecast_alert",
        entity_type: "beach",
        entity_id: "beach-1",
        payload: {
          alert_date: "2026-04-29",
          beach_id: "beach-1",
          title: "Clean window at Mavericks",
          body: "2.7 ft @ 14s",
        },
      }),
    );

    const summary = await processPendingEvents(buildMockSupabase(state) as never, {
      now: NOON_PT,
      fcm: fakeFcm as never,
    });

    expect(summary).toMatchObject({ processed: 1, skipped: 1 });
    expect(fakeFcm.sendEach).toHaveBeenCalledTimes(1);
    expect(state.events.find((event) => event.id === "evt-condition")).toMatchObject({
      status: "cancelled",
      skip_reason: "skipped_redundant",
    });
  });

  it("reconciles queue bookkeeping when a higher-priority event displaces a pending winner", async () => {
    const state = emptyState();
    state.now = NOON_PT.getTime();
    state.profiles.set("user-recipient", buildProfile());
    state.devices.set("user-recipient", ["device-token-A"]);
    state.events.push(
      buildEvent({
        id: "evt-similarity-pending",
        actor_user_id: null,
        type: "similarity_match",
        entity_type: "beach",
        entity_id: "beach-1",
        payload: {
          beach_id: "beach-1",
          beach_slug: "mavericks",
          beach_name: "Mavericks",
          alert_date: "2026-04-29",
          forecast_at: "2026-04-29T19:00:00.000Z",
          score: 8.4,
          label: "GOOD",
          reason: "Conditions match your best sessions",
          queue_items: [{ queue_id: "queue-sim-pending", rule_id: "rule-sim-pending" }],
        },
      }),
    );

    await processPendingEvents(buildMockSupabase(state) as never, {
      now: NOON_PT,
      fcm: null,
    });
    expect(state.events[0]).toMatchObject({ status: "pending" });

    state.events.push(
      buildEvent({
        id: "evt-condition-winner",
        actor_user_id: null,
        type: "forecast_alert",
        entity_type: "beach",
        entity_id: "beach-1",
        payload: {
          alert_date: "2026-04-29",
          beach_id: "beach-1",
          title: "Clean window at Mavericks",
          body: "2.7 ft @ 14s",
        },
      }),
    );
    const fakeFcm = {
      sendEach: jest.fn(async () => ({
        successCount: 1,
        failureCount: 0,
        responses: [{ success: true }],
      })),
    };

    await processPendingEvents(buildMockSupabase(state) as never, {
      now: NOON_PT,
      fcm: fakeFcm as never,
    });

    const retryAt = new Date(NOON_PT.getTime() + 61_000);
    state.now = retryAt.getTime();
    await processPendingEvents(buildMockSupabase(state) as never, {
      now: retryAt,
      fcm: fakeFcm as never,
    });

    expect(state.alertAttempts).toContainEqual({
      queue_id: "queue-sim-pending",
      rule_id: "rule-sim-pending",
      user_id: "user-recipient",
      channel: "push",
      status: "skipped_dedup_collision",
      skip_reason: "skipped_dedup",
    });
    expect(fakeFcm.sendEach).toHaveBeenCalledTimes(1);
  });
});

describe("processPendingEvents — terminal skips", () => {
  it("master pref off → both channels skipped_pref_master, event skipped", async () => {
    const state = emptyState();
    state.events.push(buildEvent());
    state.profiles.set(
      "user-recipient",
      buildProfile({ notif_push_enabled: false, notif_inapp_enabled: false })
    );
    state.profiles.set("user-actor", buildProfile({ id: "user-actor" }));

    const summary = await processPendingEvents(
      buildMockSupabase(state) as never,
      { now: NOON_PT, fcm: { sendEach: jest.fn() } as never }
    );

    expect(summary.skipped).toBe(1);
    expect(summary.processed).toBe(1); // Phase 5a: all-skipped is event-level processed
    expect(summary.by_status.skipped_pref_master).toBe(2);
    expect(state.notificationsInserts).toEqual([]);
    expect(state.eventUpdates[0]).toEqual({
      id: "evt-1",
      status: "processed",
      skip_reason: "all_channels_skipped",
    });
  });

  it("per-type pref off → both push and in_app skipped_pref_type", async () => {
    const state = emptyState();
    state.events.push(buildEvent());
    state.profiles.set("user-recipient", buildProfile({ notif_likes: false }));
    state.profiles.set("user-actor", buildProfile({ id: "user-actor" }));

    const summary = await processPendingEvents(
      buildMockSupabase(state) as never,
      { now: NOON_PT, fcm: { sendEach: jest.fn() } as never }
    );

    expect(summary.skipped).toBe(1);
    expect(summary.by_status.skipped_pref_type).toBe(2);
    expect(state.notificationsInserts).toEqual([]);
  });

  it("self-notify → both channels skipped_self when actor === recipient", async () => {
    const state = emptyState();
    state.events.push(buildEvent({ actor_user_id: "user-recipient" }));
    state.profiles.set("user-recipient", buildProfile());

    const summary = await processPendingEvents(
      buildMockSupabase(state) as never,
      { now: NOON_PT, fcm: { sendEach: jest.fn() } as never }
    );

    expect(summary.skipped).toBe(1);
    expect(summary.by_status.skipped_self).toBe(2);
  });

  it("no device tokens → push skipped_no_device, in-app sends, event processed", async () => {
    const state = emptyState();
    state.events.push(buildEvent());
    state.profiles.set("user-recipient", buildProfile());
    state.profiles.set("user-actor", buildProfile({ id: "user-actor" }));

    const summary = await processPendingEvents(
      buildMockSupabase(state) as never,
      { now: NOON_PT, fcm: { sendEach: jest.fn() } as never }
    );

    expect(summary.processed).toBe(1);
    expect(summary.by_status.skipped_no_device).toBe(1);
    expect(summary.by_status.sent).toBe(1);
    expect(state.notificationsInserts).toHaveLength(1);
    expect(capturePostHogEvent).toHaveBeenCalledWith({
      distinctId: "user-recipient",
      event: "notification_delivery_attempt",
      properties: expect.objectContaining({
        notification_channel: "push",
        notification_status: "skipped_no_device",
      }),
    });
  });
});

describe("processPendingEvents — quiet hours", () => {
  it("quiet hours → push deferred_quiet_hours, event STAYS PENDING (retry next tick)", async () => {
    const state = emptyState();
    state.events.push(buildEvent());
    state.profiles.set(
      "user-recipient",
      buildProfile({ timezone: "America/Los_Angeles" })
    );
    state.profiles.set("user-actor", buildProfile({ id: "user-actor" }));
    state.devices.set("user-recipient", ["device-token-A"]);

    // 06:00 UTC = 23:00 PT (previous day) → in 22-04 quiet window.
    const inQuietWindow = new Date("2026-04-29T06:00:00Z");

    const summary = await processPendingEvents(
      buildMockSupabase(state) as never,
      { now: inQuietWindow, fcm: { sendEach: jest.fn() } as never }
    );

    expect(summary.by_status.deferred_quiet_hours).toBe(1);
    expect(summary.by_status.sent).toBe(1); // in-app still sent
    expect(summary.pending_after_run).toBe(1);
    expect(summary.processed).toBe(0);
    expect(state.notificationsInserts).toHaveLength(1);
    // Event NOT marked terminal — it stays pending until quiet hours pass.
    expect(state.eventUpdates).toEqual([]);
    expect(state.events[0].next_attempt_at).toBe("2026-04-29T11:00:00.000Z");
  });

  it("missing profile timezone uses the app default timezone for quiet-hours math", async () => {
    const state = emptyState();
    state.now = new Date("2026-04-29T06:00:00Z").getTime(); // 23:00 PT prev day
    state.events.push(buildEvent());
    state.profiles.set("user-recipient", buildProfile({ timezone: null }));
    state.profiles.set("user-actor", buildProfile({ id: "user-actor" }));
    state.devices.set("user-recipient", ["device-token-A"]);
    const fakeFcm = { sendEach: jest.fn() };

    const summary = await processPendingEvents(
      buildMockSupabase(state) as never,
      { now: new Date("2026-04-29T06:00:00Z"), fcm: fakeFcm as never }
    );

    expect(summary.missing_timezone_count).toBe(1);
    expect(summary.by_status.deferred_quiet_hours).toBe(1);
    expect(summary.pending_after_run).toBe(1);
    expect(fakeFcm.sendEach).not.toHaveBeenCalled();
  });

  it("quiet-hours retry: in-app skipped on second tick (idempotent), push attempted again", async () => {
    const state = emptyState();
    state.events.push(buildEvent());
    state.profiles.set(
      "user-recipient",
      buildProfile({ timezone: "America/Los_Angeles" })
    );
    state.profiles.set("user-actor", buildProfile({ id: "user-actor" }));
    state.devices.set("user-recipient", ["device-token-A"]);
    // Pre-populate: in-app already sent on a prior tick.
    state.attempts.push({
      id: "att-prior",
      notification_event_id: "evt-1",
      channel: "in_app",
      status: "sent",
      provider_response: null,
      error_message: null,
      created_at: new Date().toISOString(),
    });

    const fakeFcm = {
      sendEach: jest.fn(async () => ({
        successCount: 1,
        failureCount: 0,
        responses: [{ success: true }],
      })),
    };

    const summary = await processPendingEvents(
      buildMockSupabase(state) as never,
      { now: NOON_PT, fcm: fakeFcm as never }
    );

    // In-app already sent → not re-inserted.
    expect(state.notificationsInserts).toEqual([]);
    // Push fires this time.
    expect(fakeFcm.sendEach).toHaveBeenCalledTimes(1);
    expect(summary.processed).toBe(1);
    // Only ONE new attempt this tick (push). Total = prior + 1.
    expect(state.attempts).toHaveLength(2);
    expect(state.attempts[1]).toMatchObject({ channel: "push", status: "sent" });
  });
});

describe("processPendingEvents — Firebase / provider failure retry", () => {
  it("Firebase null on first tick → push failed_provider, event STAYS PENDING (not lost)", async () => {
    const state = emptyState();
    state.events.push(buildEvent());
    state.profiles.set("user-recipient", buildProfile());
    state.profiles.set("user-actor", buildProfile({ id: "user-actor" }));
    state.devices.set("user-recipient", ["device-token-A"]);

    const summary = await processPendingEvents(
      buildMockSupabase(state) as never,
      { now: NOON_PT, fcm: null }
    );

    expect(summary.firebase_configured).toBe(false);
    expect(summary.by_status.failed_provider).toBe(1);
    expect(summary.by_status.sent).toBe(1); // in_app sent
    expect(summary.pending_after_run).toBe(1);
    expect(summary.processed).toBe(0);
    expect(summary.failed).toBe(0);
    // Event NOT marked terminal — push side will retry.
    expect(state.eventUpdates).toEqual([]);
    expect(state.attempts).toContainEqual(
      expect.objectContaining({
        channel: "push",
        status: "failed_provider",
        provider_response: expect.objectContaining({
          reason: "firebase_not_configured",
        }),
        error_message: "Firebase not configured",
      })
    );
  });

  it("after MAX_FAILED_ATTEMPTS_PER_CHANNEL=3 push failures → channel permanently failed, event marked processed (in_app already sent)", async () => {
    const state = emptyState();
    state.events.push(buildEvent());
    state.profiles.set("user-recipient", buildProfile());
    state.profiles.set("user-actor", buildProfile({ id: "user-actor" }));
    state.devices.set("user-recipient", ["device-token-A"]);
    // Pre-populate: in-app already sent + 3 prior push failures.
    state.attempts.push(
      {
        id: "att-prior-1",
        notification_event_id: "evt-1",
        channel: "in_app",
        status: "sent",
        provider_response: null,
        error_message: null,
        created_at: new Date().toISOString(),
      },
      ...Array.from({ length: 3 }, (_, i) => ({
        id: `att-prior-${i + 2}`,
        notification_event_id: "evt-1",
        channel: "push" as const,
        status: "failed_provider",
        provider_response: null,
        error_message: null,
        created_at: new Date().toISOString(),
      }))
    );

    const fakeFcm = {
      sendEach: jest.fn(),
    };

    const summary = await processPendingEvents(
      buildMockSupabase(state) as never,
      { now: NOON_PT, fcm: fakeFcm as never }
    );

    // FCM not called — push channel is at the cap, no further attempts.
    expect(fakeFcm.sendEach).not.toHaveBeenCalled();
    // No new attempts inserted this tick.
    expect(state.attempts).toHaveLength(4);
    // In-app was sent (terminal-success), push hit the cap (terminal-failed),
    // event has at least one sent → marked processed.
    expect(summary.processed).toBe(1);
    expect(state.eventUpdates[0]).toEqual({
      id: "evt-1",
      status: "processed",
      skip_reason: null,
    });
  });

  it("all channels failed past cap and nothing sent → event marked failed", async () => {
    const state = emptyState();
    state.events.push(buildEvent({ type: "follow" })); // follow has push + in_app
    state.profiles.set("user-recipient", buildProfile());
    state.profiles.set("user-actor", buildProfile({ id: "user-actor" }));
    state.devices.set("user-recipient", ["device-token-A"]);
    // Both channels capped on failures.
    for (const channel of ["push", "in_app"] as const) {
      for (let i = 0; i < 3; i++) {
        state.attempts.push({
          id: `att-${channel}-${i}`,
          notification_event_id: "evt-1",
          channel,
          status: channel === "push" ? "failed_provider" : "failed_internal",
          provider_response: null,
          error_message: null,
          created_at: new Date().toISOString(),
        });
      }
    }

    const fakeFcm = { sendEach: jest.fn() };

    const summary = await processPendingEvents(
      buildMockSupabase(state) as never,
      { now: NOON_PT, fcm: fakeFcm as never }
    );

    expect(fakeFcm.sendEach).not.toHaveBeenCalled();
    expect(summary.failed).toBe(1);
    expect(state.eventUpdates[0]).toEqual({
      id: "evt-1",
      status: "failed",
      skip_reason: "all_channels_failed",
    });
  });
});

describe("processPendingEvents — fatal data conditions", () => {
  it("unknown registry type → event marked failed with skip_reason=unknown_type", async () => {
    const state = emptyState();
    state.events.push(buildEvent({ type: "made_up_type" }));
    state.profiles.set("user-recipient", buildProfile());

    const summary = await processPendingEvents(
      buildMockSupabase(state) as never,
      { now: NOON_PT, fcm: { sendEach: jest.fn() } as never }
    );

    expect(summary.failed).toBe(1);
    expect(state.eventUpdates[0]).toEqual({
      id: "evt-1",
      status: "failed",
      skip_reason: "unknown_type",
    });
    expect(state.attempts).toEqual([]);
  });

  it("registered type with no channels → event processed as disabled surface", async () => {
    const state = emptyState();
    state.events.push(
      buildEvent({
        type: "daily_digest",
        actor_user_id: null,
        entity_type: null,
        entity_id: null,
        payload: {
          alert_date: "2026-05-12",
          title: "Quiver Daily Forecast",
          body: "Daily digest disabled",
        },
        dedupe_key: "daily_forecast_summary:user-recipient:2026-05-12",
      })
    );
    state.profiles.set("user-recipient", buildProfile());

    const summary = await processPendingEvents(
      buildMockSupabase(state) as never,
      { now: NOON_PT, fcm: { sendEach: jest.fn() } as never }
    );

    expect(summary.processed).toBe(1);
    expect(summary.skipped).toBe(1);
    expect(summary.failed).toBe(0);
    expect(state.eventUpdates[0]).toEqual({
      id: "evt-1",
      status: "processed",
      skip_reason: "surface_disabled",
    });
    expect(state.notificationsInserts).toEqual([]);
    expect(state.attempts).toEqual([]);
  });

  it("recipient profile missing (row not found) → event terminal failed", async () => {
    const state = emptyState();
    state.events.push(buildEvent());
    // No profile row for user-recipient.

    const summary = await processPendingEvents(
      buildMockSupabase(state) as never,
      { now: NOON_PT, fcm: null }
    );

    expect(summary.failed).toBe(1);
    expect(state.eventUpdates[0]).toEqual({
      id: "evt-1",
      status: "failed",
      skip_reason: "recipient_profile_missing",
    });
  });
});

describe("processPendingEvents — transient error handling", () => {
  it("notification_events fetch error → throws (cron_runs.status=error)", async () => {
    const state = emptyState();
    state.errorOnSelect = new Set(["notification_events"]);

    await expect(
      processPendingEvents(buildMockSupabase(state) as never, { now: NOON_PT })
    ).rejects.toThrow(/notification_events claim failed/);

    expectConsoleErrors([]);
  });

  it("profile query error → event STAYS PENDING (no spurious recipient_profile_missing)", async () => {
    const state = emptyState();
    state.events.push(buildEvent());
    state.errorOnProfileLookup = new Set(["user-recipient"]);

    const summary = await processPendingEvents(
      buildMockSupabase(state) as never,
      { now: NOON_PT, fcm: null }
    );

    expect(summary.pending_after_run).toBe(1);
    expect(summary.failed).toBe(0);
    expect(state.eventUpdates).toEqual([]);
    expectConsoleErrors([
      /profile query errored for event/,
    ]);
  });

  it("does not emit PostHog delivery analytics when attempt insert fails", async () => {
    const state = emptyState();
    state.events.push(buildEvent());
    state.profiles.set("user-recipient", buildProfile());
    state.profiles.set("user-actor", buildProfile({ id: "user-actor" }));
    state.devices.set("user-recipient", ["device-token-A"]);
    state.attemptInsertError = "simulated attempt insert failure";

    const fakeFcm = {
      sendEach: jest.fn(async () => ({
        successCount: 1,
        failureCount: 0,
        responses: [{ success: true }],
      })),
    };

    await processPendingEvents(buildMockSupabase(state) as never, {
      now: NOON_PT,
      fcm: fakeFcm as never,
    });

    expect(capturePostHogEvent).not.toHaveBeenCalled();
    expectConsoleErrors([/attempts insert failed/]);
  });
});

describe("processPendingEvents — push provider details", () => {
  it("FCM invalid token error → token pruned from user_devices", async () => {
    const state = emptyState();
    state.events.push(buildEvent());
    state.profiles.set("user-recipient", buildProfile());
    state.profiles.set("user-actor", buildProfile({ id: "user-actor" }));
    state.devices.set("user-recipient", ["good-token", "bad-token"]);

    const fakeFcm = {
      sendEach: jest.fn(async () => ({
        successCount: 1,
        failureCount: 1,
        responses: [
          { success: true },
          {
            success: false,
            error: {
              code: "messaging/registration-token-not-registered",
              message: "token revoked",
            },
          },
        ],
      })),
    };

    await processPendingEvents(buildMockSupabase(state) as never, {
      now: NOON_PT,
      fcm: fakeFcm as never,
    });

    expect(state.deviceDeletes).toEqual(["bad-token"]);
  });

  it("failed provider responses persist provider_response and error_message", async () => {
    const state = emptyState();
    state.events.push(buildEvent());
    state.profiles.set("user-recipient", buildProfile());
    state.profiles.set("user-actor", buildProfile({ id: "user-actor" }));
    state.devices.set("user-recipient", ["device-token-A"]);

    const fakeFcm = {
      sendEach: jest.fn(async () => ({
        successCount: 0,
        failureCount: 1,
        responses: [
          {
            success: false,
            error: {
              code: "messaging/internal-error",
              message: "provider down",
            },
          },
        ],
      })),
    };

    await processPendingEvents(buildMockSupabase(state) as never, {
      now: NOON_PT,
      fcm: fakeFcm as never,
    });

    expect(state.attempts).toContainEqual(
      expect.objectContaining({
        channel: "push",
        status: "failed_provider",
        provider_response: expect.objectContaining({
          success: 0,
          failed: 1,
          errors: ["messaging/internal-error: provider down"],
        }),
        error_message: "messaging/internal-error: provider down",
      })
    );
    expect(capturePostHogEvent).toHaveBeenCalledWith({
      distinctId: "user-recipient",
      event: "notification_delivery_attempt",
      properties: expect.objectContaining({
        notification_channel: "push",
        notification_status: "failed_provider",
        provider_success: 0,
        provider_failed: 1,
        provider_error_count: 1,
        has_error_message: true,
      }),
    });
  });

  it("Expo push token routes through Expo Push Service without calling FCM", async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        data: [{ status: "ok", id: "ticket-1" }],
      }),
    })) as unknown as typeof fetch;

    try {
      const state = emptyState();
      state.events.push(buildEvent());
      state.profiles.set("user-recipient", buildProfile());
      state.profiles.set("user-actor", buildProfile({ id: "user-actor" }));
      state.devices.set("user-recipient", ["ExponentPushToken[expo-abc]"]);

      const fakeFcm = {
        sendEach: jest.fn(async () => ({
          successCount: 1,
          failureCount: 0,
          responses: [{ success: true }],
        })),
      };

      const summary = await processPendingEvents(buildMockSupabase(state) as never, {
        now: NOON_PT,
        fcm: fakeFcm as never,
      });

      expect(summary.processed).toBe(1);
      expect(fakeFcm.sendEach).not.toHaveBeenCalled();
      expect(global.fetch).toHaveBeenCalledWith(
        "https://exp.host/--/api/v2/push/send",
        expect.objectContaining({ method: "POST" })
      );
    } finally {
      global.fetch = originalFetch;
    }
  });
});

describe("processPendingEvents — atomic claim (concurrency)", () => {
  it("claims pending event by setting claimed_at; concurrent worker sees nothing claimable", async () => {
    const state = emptyState();
    state.events.push(buildEvent());
    state.profiles.set("user-recipient", buildProfile());
    state.profiles.set(
      "user-actor",
      buildProfile({ id: "user-actor", display_name: "Actor User" })
    );
    state.devices.set("user-recipient", ["device-token-A"]);

    const fakeFcm = {
      sendEach: jest.fn(async () => ({
        successCount: 1,
        failureCount: 0,
        responses: [{ success: true }],
      })),
    };

    // Worker A claims and processes the event end-to-end.
    const summaryA = await processPendingEvents(
      buildMockSupabase(state) as never,
      { now: NOON_PT, fcm: fakeFcm as never }
    );
    expect(summaryA.fetched).toBe(1);
    expect(summaryA.processed).toBe(1);

    // Worker B (immediate concurrent run) sees the event already terminal AND
    // claimed, so claimable filter returns 0 rows — even if concurrent runs
    // somehow happen, no double-dispatch.
    const summaryB = await processPendingEvents(
      buildMockSupabase(state) as never,
      { now: NOON_PT, fcm: fakeFcm as never }
    );
    expect(summaryB.fetched).toBe(0);

    expect(fakeFcm.sendEach).toHaveBeenCalledTimes(1);
  });

  it("concurrent workers race on a single pending event — only one wins the claim", async () => {
    // Snapshot two workers reading the candidate set at the same time, then
    // each running phase-2 UPDATE sequentially. The mock's UPDATE re-checks
    // `claimable(e)` per row, so worker B's claim attempt fails on a row
    // already claimed by worker A.
    const state = emptyState();
    state.events.push(buildEvent());
    state.profiles.set("user-recipient", buildProfile());
    state.profiles.set(
      "user-actor",
      buildProfile({ id: "user-actor", display_name: "Actor User" })
    );
    state.devices.set("user-recipient", ["device-token-A"]);

    const fakeFcmA = {
      sendEach: jest.fn(async () => ({
        successCount: 1,
        failureCount: 0,
        responses: [{ success: true }],
      })),
    };
    const fakeFcmB = {
      sendEach: jest.fn(async () => ({
        successCount: 1,
        failureCount: 0,
        responses: [{ success: true }],
      })),
    };

    const supabase = buildMockSupabase(state) as never;
    // Run sequentially — but the second call's claim phase will see the row
    // already claimed_at != null and skip it.
    const a = await processPendingEvents(supabase, {
      now: NOON_PT,
      fcm: fakeFcmA as never,
    });
    const b = await processPendingEvents(supabase, {
      now: NOON_PT,
      fcm: fakeFcmB as never,
    });

    expect(a.fetched + b.fetched).toBe(1);
    expect(fakeFcmA.sendEach.mock.calls.length + fakeFcmB.sendEach.mock.calls.length).toBe(1);
  });

  it("releases claim on retryable quiet-hours channels and schedules the next claim for window end", async () => {
    // Quiet hours sets channel to "pending" (retryable). After the tick, the
    // worker releases claimed_at to NULL and sets next_attempt_at to the quiet
    // window end so it does not re-claim every minute while still in-window.
    const state = emptyState();
    state.events.push(
      buildEvent({
        type: "like",
        payload: { session_id: "sess-1", beach_name: "Mavericks" },
        dedupe_key: "like:sess-1:user-recipient",
      })
    );
    state.profiles.set("user-recipient", buildProfile());
    state.profiles.set(
      "user-actor",
      buildProfile({ id: "user-actor", display_name: "Actor User" })
    );
    state.devices.set("user-recipient", ["device-token-A"]);

    // 02:00 local = inside default quiet window 22→04.
    const QUIET_HOUR = new Date("2026-04-29T10:00:00Z");
    const fakeFcm = {
      sendEach: jest.fn(async () => ({
        successCount: 1,
        failureCount: 0,
        responses: [{ success: true }],
      })),
    };

    await processPendingEvents(buildMockSupabase(state) as never, {
      now: QUIET_HOUR,
      fcm: fakeFcm as never,
    });

    // Push deferred (quiet hours), in-app delivered. Event still pending.
    expect(state.events[0].status).toBe("pending");
    // Claim was released, but next_attempt_at prevents re-claim until quiet
    // hours end.
    expect(state.events[0].claimed_at).toBeNull();
    expect(state.events[0].next_attempt_at).toBe("2026-04-29T11:00:00.000Z");
    expect(fakeFcm.sendEach).not.toHaveBeenCalled();
  });

  it("stale claim (>5 min old) is reclaimable", async () => {
    // Simulate a crashed worker that left claimed_at set 10 minutes ago
    // relative to NOON_PT (19:00Z) — i.e. 18:50Z.
    const state = emptyState();
    const stale = new Date("2026-04-29T18:50:00Z").toISOString();
    state.events.push(buildEvent({ claimed_at: stale }));
    state.profiles.set("user-recipient", buildProfile());
    state.profiles.set(
      "user-actor",
      buildProfile({ id: "user-actor", display_name: "Actor User" })
    );
    state.devices.set("user-recipient", ["device-token-A"]);

    // Now is 12:00 — claim is 10 min old, > 5 min stale TTL.
    const fakeFcm = {
      sendEach: jest.fn(async () => ({
        successCount: 1,
        failureCount: 0,
        responses: [{ success: true }],
      })),
    };

    const summary = await processPendingEvents(
      buildMockSupabase(state) as never,
      { now: NOON_PT, fcm: fakeFcm as never }
    );

    expect(summary.fetched).toBe(1);
    expect(summary.processed).toBe(1);
    expect(fakeFcm.sendEach).toHaveBeenCalledTimes(1);
  });

  it("recently claimed (<5 min old) is NOT reclaimed", async () => {
    // Phase 5b: in the new model, a 'processing' row with a fresh claim is
    // not eligible. 2 minutes before NOON_PT (19:00Z) — within the 5-min lease.
    const state = emptyState();
    state.now = NOON_PT.getTime();
    const recent = new Date("2026-04-29T18:58:00Z").toISOString();
    state.events.push(
      buildEvent({
        status: "processing",
        claimed_at: recent,
        claim_token: "00000000-0000-0000-0000-000000000001",
      })
    );
    state.profiles.set("user-recipient", buildProfile());
    state.profiles.set(
      "user-actor",
      buildProfile({ id: "user-actor", display_name: "Actor User" })
    );
    state.devices.set("user-recipient", ["device-token-A"]);

    const fakeFcm = {
      sendEach: jest.fn(async () => ({
        successCount: 1,
        failureCount: 0,
        responses: [{ success: true }],
      })),
    };

    const summary = await processPendingEvents(
      buildMockSupabase(state) as never,
      { now: NOON_PT, fcm: fakeFcm as never }
    );

    expect(summary.fetched).toBe(0);
    expect(fakeFcm.sendEach).not.toHaveBeenCalled();
  });
});

describe("processPendingEvents — Phase 5c backoff scheduling", () => {
  it("failed_provider on attempt 1 → next_attempt_at set ~60s in future", async () => {
    // Firebase null → push channel returns failed_provider. In-app sends.
    // Since push is retryable (not at cap), event should stay pending with
    // next_attempt_at = now + 60s.
    const state = emptyState();
    state.now = NOON_PT.getTime();
    state.events.push(buildEvent());
    state.profiles.set("user-recipient", buildProfile());
    state.profiles.set(
      "user-actor",
      buildProfile({ id: "user-actor", display_name: "Actor User" })
    );
    state.devices.set("user-recipient", ["device-token-A"]);

    await processPendingEvents(buildMockSupabase(state) as never, {
      now: NOON_PT,
      fcm: null, // Firebase null → push fails
    });

    const ev = state.events[0];
    expect(ev.status).toBe("pending");
    expect(ev.next_attempt_at).not.toBeNull();
    const scheduled = new Date(ev.next_attempt_at!).getTime();
    const expected = NOON_PT.getTime() + 60_000;
    expect(scheduled).toBe(expected);
  });

  it("backoff schedule increments per claim", async () => {
    // Pre-set attempt_count=1 so post-claim it's 2 → backoff = 5 min.
    const state = emptyState();
    state.now = NOON_PT.getTime();
    state.events.push(buildEvent({ attempt_count: 1 }));
    state.profiles.set("user-recipient", buildProfile());
    state.profiles.set(
      "user-actor",
      buildProfile({ id: "user-actor", display_name: "Actor User" })
    );
    state.devices.set("user-recipient", ["device-token-A"]);

    await processPendingEvents(buildMockSupabase(state) as never, {
      now: NOON_PT,
      fcm: null,
    });

    const ev = state.events[0];
    // attempt_count post-claim = 2 → backoff(2) = 5 min
    expect(ev.attempt_count).toBe(2);
    const scheduled = new Date(ev.next_attempt_at!).getTime();
    expect(scheduled).toBe(NOON_PT.getTime() + 5 * 60_000);
  });

  it("quiet hours alone (no failure) → next_attempt_at is the quiet window end", async () => {
    // Quiet hours is retryable but not a failure — schedule for the quiet
    // window end instead of logging another deferred row every minute.
    const state = emptyState();
    state.now = new Date("2026-04-29T06:00:00Z").getTime(); // 23:00 PT prev day
    state.events.push(buildEvent());
    state.profiles.set(
      "user-recipient",
      buildProfile({ timezone: "America/Los_Angeles" })
    );
    state.profiles.set("user-actor", buildProfile({ id: "user-actor" }));
    state.devices.set("user-recipient", ["device-token-A"]);

    const inQuiet = new Date("2026-04-29T06:00:00Z");
    await processPendingEvents(buildMockSupabase(state) as never, {
      now: inQuiet,
      fcm: { sendEach: jest.fn() } as never,
    });

    const ev = state.events[0];
    expect(ev.status).toBe("pending");
    expect(ev.next_attempt_at).toBe("2026-04-29T11:00:00.000Z");
  });
});

describe("processPendingEvents — Phase 5m observability counters", () => {
  it("unknown_type_count increments when an event's type is not in the registry", async () => {
    const state = emptyState();
    state.events.push(buildEvent({ type: "totally_made_up_type" as never }));
    state.profiles.set("user-recipient", buildProfile());

    const summary = await processPendingEvents(
      buildMockSupabase(state) as never,
      { now: NOON_PT, fcm: { sendEach: jest.fn() } as never }
    );

    expect(summary.unknown_type_count).toBe(1);
    expect(summary.failed).toBe(1);
  });

  it("missing_timezone_count increments when recipient profile has no timezone", async () => {
    const state = emptyState();
    state.events.push(buildEvent());
    state.profiles.set(
      "user-recipient",
      buildProfile({ timezone: null })
    );
    state.profiles.set("user-actor", buildProfile({ id: "user-actor" }));

    const summary = await processPendingEvents(
      buildMockSupabase(state) as never,
      {
        now: NOON_PT,
        fcm: {
          sendEach: jest.fn(async () => ({
            successCount: 1,
            failureCount: 0,
            responses: [{ success: true }],
          })),
        } as never,
      }
    );

    expect(summary.missing_timezone_count).toBe(1);
  });

  it("deferred_quiet_hours_count increments when quiet hours defer push", async () => {
    const state = emptyState();
    // Like type uses DEFAULT_QUIET (10pm-4am defer). Set "now" to 11pm PT.
    state.events.push(buildEvent());
    state.profiles.set("user-recipient", buildProfile());
    state.profiles.set("user-actor", buildProfile({ id: "user-actor" }));
    state.devices.set("user-recipient", ["device-A"]);

    const ELEVEN_PM_PT = new Date("2026-04-30T06:00:00Z"); // 23:00 Pacific previous day
    const summary = await processPendingEvents(
      buildMockSupabase(state) as never,
      {
        now: ELEVEN_PM_PT,
        fcm: { sendEach: jest.fn() } as never,
      }
    );

    expect(summary.deferred_quiet_hours_count).toBe(1);
    expect(summary.retry_scheduled_count).toBe(0);
  });

  it("retry_scheduled_count increments when failed_provider triggers backoff", async () => {
    const state = emptyState();
    state.events.push(buildEvent());
    state.profiles.set("user-recipient", buildProfile());
    state.profiles.set("user-actor", buildProfile({ id: "user-actor" }));
    state.devices.set("user-recipient", ["device-A"]);

    // FCM null → failed_provider for the push channel; in-app still sends.
    const summary = await processPendingEvents(
      buildMockSupabase(state) as never,
      { now: NOON_PT, fcm: null as never }
    );

    expect(summary.retry_scheduled_count).toBe(1);
    expect(summary.deferred_quiet_hours_count).toBe(0);
  });
});

describe("processPendingEvents — Phase 5g per-type cooldown", () => {
  // The `like` registry entry has no cooldown set in production; we patch it
  // for these tests and restore in afterEach so other tests are unaffected.
  const registry = require("@/lib/notifications/registry").NOTIFICATION_REGISTRY;
  let originalCooldown: number | undefined;

  beforeEach(() => {
    originalCooldown = registry.like.cooldownMs;
  });
  afterEach(() => {
    registry.like.cooldownMs = originalCooldown;
  });

  function withCooldown(ms: number) {
    registry.like.cooldownMs = ms;
  }

  it("emits skipped_cooldown when a `sent` push exists within the window", async () => {
    withCooldown(5 * 60 * 1000); // 5min cooldown

    const state = emptyState();
    // Prior event in the same window with a sent push attempt.
    const priorCreated = new Date("2026-04-29T18:58:00Z").toISOString(); // 2 min before "now"
    state.events.push(
      buildEvent({
        id: "evt-prior",
        status: "processed",
        created_at: priorCreated,
        dedupe_key: "like:sess-old:user-actor",
      })
    );
    state.attempts.push({
      id: "att-prior-1",
      notification_event_id: "evt-prior",
      channel: "push",
      status: "sent",
      provider_response: null,
      error_message: null,
      created_at: priorCreated,
    });
    // The new event we're about to process.
    state.events.push(
      buildEvent({
        id: "evt-new",
        created_at: new Date("2026-04-29T19:00:00Z").toISOString(),
        dedupe_key: "like:sess-new:user-actor",
      })
    );
    state.profiles.set("user-recipient", buildProfile());
    state.profiles.set("user-actor", buildProfile({ id: "user-actor" }));
    state.devices.set("user-recipient", ["device-token-A"]);

    const fakeFcm = { sendEach: jest.fn() };
    const summary = await processPendingEvents(
      buildMockSupabase(state) as never,
      { now: NOON_PT, fcm: fakeFcm as never }
    );

    expect(fakeFcm.sendEach).not.toHaveBeenCalled();
    expect(summary.by_status.skipped_cooldown).toBe(1);
    // Cooldown is push-only; in-app still landed.
    expect(summary.by_status.sent).toBe(1);
    const newEvent = state.events.find((e) => e.id === "evt-new")!;
    expect(newEvent.status).toBe("processed");
  });

  it("does NOT skip when the prior `sent` push is older than the window", async () => {
    withCooldown(5 * 60 * 1000); // 5min

    const state = emptyState();
    // 10 minutes before "now" — outside the 5-min window.
    const priorCreated = new Date("2026-04-29T18:50:00Z").toISOString();
    state.events.push(
      buildEvent({
        id: "evt-prior",
        status: "processed",
        created_at: priorCreated,
        dedupe_key: "like:sess-old:user-actor",
      })
    );
    state.attempts.push({
      id: "att-prior-1",
      notification_event_id: "evt-prior",
      channel: "push",
      status: "sent",
      provider_response: null,
      error_message: null,
      created_at: priorCreated,
    });
    state.events.push(
      buildEvent({
        id: "evt-new",
        created_at: new Date("2026-04-29T19:00:00Z").toISOString(),
        dedupe_key: "like:sess-new:user-actor",
      })
    );
    state.profiles.set("user-recipient", buildProfile());
    state.profiles.set("user-actor", buildProfile({ id: "user-actor" }));
    state.devices.set("user-recipient", ["device-token-A"]);

    const fakeFcm = {
      sendEach: jest.fn(async () => ({
        successCount: 1,
        failureCount: 0,
        responses: [{ success: true }],
      })),
    };
    const summary = await processPendingEvents(
      buildMockSupabase(state) as never,
      { now: NOON_PT, fcm: fakeFcm as never }
    );

    expect(fakeFcm.sendEach).toHaveBeenCalledTimes(1);
    expect(summary.by_status.skipped_cooldown).toBeUndefined();
    expect(summary.by_status.sent).toBe(2);
  });

  it("no cooldown set on registry → never emits skipped_cooldown", async () => {
    // cooldownMs not set (default behavior — production registry).
    const state = emptyState();
    const priorCreated = new Date("2026-04-29T18:59:30Z").toISOString();
    state.events.push(
      buildEvent({
        id: "evt-prior",
        status: "processed",
        created_at: priorCreated,
        dedupe_key: "like:sess-old:user-actor",
      })
    );
    state.attempts.push({
      id: "att-prior-1",
      notification_event_id: "evt-prior",
      channel: "push",
      status: "sent",
      provider_response: null,
      error_message: null,
      created_at: priorCreated,
    });
    state.events.push(
      buildEvent({
        id: "evt-new",
        created_at: new Date("2026-04-29T19:00:00Z").toISOString(),
        dedupe_key: "like:sess-new:user-actor",
      })
    );
    state.profiles.set("user-recipient", buildProfile());
    state.profiles.set("user-actor", buildProfile({ id: "user-actor" }));
    state.devices.set("user-recipient", ["device-token-A"]);

    const fakeFcm = {
      sendEach: jest.fn(async () => ({
        successCount: 1,
        failureCount: 0,
        responses: [{ success: true }],
      })),
    };
    const summary = await processPendingEvents(
      buildMockSupabase(state) as never,
      { now: NOON_PT, fcm: fakeFcm as never }
    );

    expect(fakeFcm.sendEach).toHaveBeenCalledTimes(1);
    expect(summary.by_status.skipped_cooldown).toBeUndefined();
  });
});
