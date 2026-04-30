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

import { processPendingEvents } from "@/lib/notifications/worker";
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
  notif_session_invites: boolean;
  notif_likes: boolean;
  notif_follows: boolean;
  notif_reminders: boolean;
  notif_xp_updates: boolean;
  notif_forecast_alerts: boolean;
  notif_water_quality: boolean;
  inapp_session_invites: boolean;
  email_session_invites: boolean;
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
  eventUpdates: Array<{ id: string; status: string; skip_reason: string | null }>;
  deviceDeletes: string[];
  /** When set, fetch on this table throws to simulate a Supabase error. */
  errorOnSelect?: Set<string>;
  /** When set, profile lookup for this user_id throws. */
  errorOnProfileLookup?: Set<string>;
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
    notif_session_invites: true,
    notif_likes: true,
    notif_follows: true,
    notif_reminders: true,
    notif_xp_updates: true,
    notif_forecast_alerts: true,
    notif_water_quality: true,
    inapp_session_invites: true,
    email_session_invites: true,
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
        update: (
          row: Partial<{
            status: string;
            skip_reason: string | null;
            claimed_at: string | null;
            claim_token: string | null;
            processed_at: string | null;
          }>
        ) => {
          // markEventTerminal: update(row).eq('id', eventId).eq('claim_token', claimToken)
          // releaseClaims:     update(row).in('id', ids).eq('claim_token', claimToken)
          return {
            // markEventTerminal path — first .eq is on 'id'
            eq: (_idCol: string, eventId: string) => ({
              eq: async (_col: string, claimToken: string) => {
                const e = state.events.find((x) => x.id === eventId);
                if (!e) return { error: null };
                // claim_token defense: only write if our token matches
                if (e.claim_token !== claimToken) return { error: null };
                if ("status" in row) {
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
                return { error: null };
              },
            }),
            // releaseClaims path — first .in is on 'id'
            in: (_inCol: string, ids: string[]) => ({
              eq: async (_col: string, claimToken: string) => {
                for (const id of ids) {
                  const ev = state.events.find((e) => e.id === id);
                  if (!ev) continue;
                  if (ev.claim_token !== claimToken) continue;
                  ev.status = "pending";
                  ev.claimed_at = null;
                  ev.claim_token = null;
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
        select: () => ({
          in: async (_col: string, ids: string[]) => ({
            data: state.attempts.filter((a) =>
              ids.includes(a.notification_event_id)
            ),
            error: null,
          }),
        }),
        insert: async (rows: MockAttempt[]) => {
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
    rpc: async (
      name: string,
      args: { p_batch_size: number; p_lease_seconds: number; p_claim_token: string }
    ) => {
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
        args.p_batch_size,
        args.p_lease_seconds,
        args.p_claim_token,
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
    eventUpdates: [],
    deviceDeletes: [],
  };
}

const NOON_PT = new Date("2026-04-29T19:00:00Z"); // 12:00 Pacific.

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

  it("releases claim on retryable channels so next tick can pick it up immediately", async () => {
    // Quiet hours sets channel to "pending" (retryable). After the tick, the
    // worker releases claimed_at to NULL. Next tick (in-window) should be
    // able to re-claim and dispatch.
    const state = emptyState();
    state.events.push(
      buildEvent({
        type: "session_invite",
        payload: { session_id: "sess-1", beach_name: "Mavericks" },
        dedupe_key: "session_invite:sess-1:user-recipient",
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
    // Claim was released so the next tick can re-claim immediately.
    expect(state.events[0].claimed_at).toBeNull();
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
