/**
 * @jest-environment node
 */

jest.mock("@/lib/services/firebase-admin", () => ({
  getFirebaseAdminMessaging: jest.fn(() => null),
}));

jest.mock("@/lib/posthog-server", () => ({
  capturePostHogEvent: jest.fn(async () => undefined),
}));

import type { SupabaseClient } from "@supabase/supabase-js";
import { evaluateConditions } from "@/lib/alerts/condition-evaluator";
import type {
  AlertConditions,
  BeachAlertMeta,
  ForecastHour,
} from "@/lib/alerts/types";
import type { PoolBeach } from "@/lib/alerts/user-pool";
import {
  runDailyCallCron,
  type DailyCallCandidate,
  type DailyCallDeps,
  type DailyCallProfile,
} from "@/lib/cron/daily-call-runner";
import {
  runSwellAlertCron,
  type SwellAlertDeps,
  type SwellAlertProfile,
} from "@/lib/cron/swell-alert-runner";
import { processPendingEvents } from "@/lib/notifications/worker";
import type { EnqueueArgs, EnqueueResult } from "@/lib/notifications/types";
import type { Database } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";

const USER_ID = "10000000-0000-4000-8000-000000000001";
const BLACKS_ID = "20000000-0000-4000-8000-000000000001";
const OSPREY_ID = "20000000-0000-4000-8000-000000000002";
const SWELL_TICK = new Date("2026-09-18T00:00:00.000Z");
const MORNING_TICK = new Date("2026-09-18T13:00:00.000Z");
// A rerun inside the same send hour (06:30 PDT) must be a no-op because the
// 06:00 tick already enqueued the daily call for this local date.
const SECOND_MORNING_TICK = new Date("2026-09-18T13:30:00.000Z");

interface EventRow {
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
  cancel_reason: string | null;
  created_at: string;
  processed_at: string | null;
  claimed_at: string | null;
  claim_token: string | null;
  attempt_count: number;
  next_attempt_at: string | null;
  last_attempt_at: string | null;
  last_error: string | null;
}

interface DeliveryAttempt {
  id: string;
  notification_event_id: string;
  channel: "push" | "in_app" | "email";
  status: string;
  provider_response: unknown;
  error_message: string | null;
  created_at: string;
}

interface HarnessState {
  events: EventRow[];
  attempts: DeliveryAttempt[];
  surfSlots: Map<string, { eventId: string; priority: number }>;
  pushes: Array<{ data?: Record<string, string> }>;
  now: Date;
}

function poolBeach(
  id: string,
  name: string,
  relation: PoolBeach["relation"],
): PoolBeach {
  return {
    beach: {
      id,
      name,
      short_name: name,
      slug: name.toLowerCase(),
      timezone: "America/Los_Angeles",
    } as PoolBeach["beach"],
    relation,
    distanceMiles: null,
  };
}

const blacks = poolBeach(BLACKS_ID, "Blacks", "home");
const osprey = poolBeach(OSPREY_ID, "Osprey", "favorite");

const forecastFixture: ForecastHour = {
  forecast_id: "forecast-blacks-1500",
  forecast_at: "2026-09-18T15:00:00.000Z",
  wave_height: 4,
  wave_period: 14,
  wave_direction: "SW",
  swell_1_height: 3,
  swell_1_period: 10,
  swell_1_direction: 225,
  wind_speed: 4,
  wind_direction_deg: 90,
  tide_height: 3,
  tide_status: "Rising",
};

const blacksMeta: BeachAlertMeta = {
  id: BLACKS_ID,
  name: "Blacks",
  slug: "blacks",
  lat: 32.89,
  lon: -117.25,
  timezone: "America/Los_Angeles",
  wind_offshore_deg: 90,
  wind_offshore_tol_deg: 35,
  aspect_deg: 270,
  preferred_tide_ft_min: 1,
  preferred_tide_ft_max: 5,
  preferred_tide_direction: "rising",
  swell_window_center_deg: 270,
  swell_window_halfwidth_deg: 90,
};

const manualRule: AlertConditions = {
  swell_height_min: 3,
  swell_period_min: 12,
  local_time_start: "08:00",
  local_time_end: "09:00",
};

function eventFromEnqueue(
  state: HarnessState,
  args: EnqueueArgs,
): EnqueueResult {
  const existing = state.events.find(
    (event) =>
      event.recipient_user_id === args.recipientUserId &&
      event.type === args.type &&
      event.dedupe_key === args.dedupeKey,
  );
  if (existing) return { enqueued: false, reason: "duplicate" };

  const eventId = `event-${state.events.length + 1}`;
  state.events.push({
    id: eventId,
    recipient_user_id: args.recipientUserId,
    actor_user_id: args.actorUserId ?? null,
    type: args.type,
    entity_type: args.entityType ?? null,
    entity_id: args.entityId ?? null,
    payload: args.payload as Record<string, unknown>,
    dedupe_key: args.dedupeKey ?? null,
    status: "pending",
    skip_reason: null,
    cancel_reason: null,
    created_at: state.now.toISOString(),
    processed_at: null,
    claimed_at: null,
    claim_token: null,
    attempt_count: 0,
    next_attempt_at: null,
    last_attempt_at: null,
    last_error: null,
  });
  return { enqueued: true, eventId };
}

function buildWorkerClient(state: HarnessState): SupabaseClient<Database> {
  const from = (table: string): unknown => {
    if (table === "notification_events") {
      return {
        select: () => ({
          eq: (_recipientColumn: string, recipientId: string) => ({
            eq: (_typeColumn: string, type: string) => ({
              gte: async (_createdColumn: string, since: string) => ({
                data: state.events
                  .filter((event) =>
                    event.recipient_user_id === recipientId &&
                    event.type === type &&
                    Date.parse(event.created_at) >= Date.parse(since),
                  )
                  .map((event) => ({ id: event.id, payload: event.payload })),
                error: null,
              }),
            }),
          }),
        }),
        update: (values: Partial<EventRow>) => ({
          eq: (_idColumn: string, eventId: string) => ({
            eq: async (_claimColumn: string, claimToken: string) => {
              const event = state.events.find(({ id }) => id === eventId);
              if (!event || event.claim_token !== claimToken) {
                return { error: null };
              }
              Object.assign(event, values);
              return { error: null };
            },
          }),
        }),
      };
    }

    if (table === "notification_delivery_attempts") {
      return {
        select: () => ({
          in: async (_eventColumn: string, eventIds: string[]) => ({
            data: state.attempts.filter((attempt) =>
              eventIds.includes(attempt.notification_event_id),
            ),
            error: null,
          }),
          eq: (_channelColumn: string, channel: string) => ({
            eq: (_statusColumn: string, status: string) => ({
              gte: (_createdColumn: string, since: string) => ({
                in: (_eventColumn: string, eventIds: string[]) => ({
                  limit: async (limit: number) => ({
                    data: state.attempts
                      .filter((attempt) =>
                        attempt.channel === channel &&
                        attempt.status === status &&
                        Date.parse(attempt.created_at) >= Date.parse(since) &&
                        eventIds.includes(attempt.notification_event_id),
                      )
                      .slice(0, limit)
                      .map(({ id }) => ({ id })),
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        }),
        insert: async (attempts: Omit<DeliveryAttempt, "id" | "created_at">[]) => {
          state.attempts.push(...attempts.map((attempt) => ({
            ...attempt,
            id: `attempt-${state.attempts.length + 1}`,
            created_at: state.now.toISOString(),
          })));
          return { error: null };
        },
      };
    }

    if (table === "alert_delivery_attempts") {
      return { insert: async () => ({ error: null }) };
    }

    if (table === "profiles") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: {
                id: USER_ID,
                display_name: "Task 12 Surfer",
                timezone: "America/Los_Angeles",
                experience_level: "advanced",
                allow_implicit_tracking: false,
                notif_push_enabled: true,
                notif_email_enabled: true,
                notif_inapp_enabled: false,
                notif_likes: true,
                notif_follows: true,
                notif_reminders: true,
                notif_xp_updates: true,
                notif_forecast_alerts: true,
                notif_swell_alerts: true,
                notif_water_quality: true,
                notif_similarity_alerts: false,
              },
              error: null,
            }),
          }),
        }),
      };
    }

    if (table === "user_devices") {
      return {
        select: () => ({
          eq: () => ({
            is: async () => ({
              data: [{
                id: "device-1",
                device_token: "task-12-token",
                installation_id: null,
                retired_at: null,
                platform: "ios",
                app_version: "1.0.1",
                build_number: "11",
              }],
              error: null,
            }),
          }),
        }),
      };
    }

    throw new Error(`Unexpected table: ${table}`);
  };

  const rpc = async (name: string, args: Record<string, unknown>) => {
    if (name === "claim_notification_events") {
      const claimToken = String(args.p_claim_token);
      const batchSize = Number(args.p_batch_size);
      const claimed = state.events
        .filter((event) => event.status === "pending")
        .slice(0, batchSize);
      for (const event of claimed) {
        event.status = "processing";
        event.claim_token = claimToken;
        event.claimed_at = state.now.toISOString();
        event.attempt_count += 1;
        event.last_attempt_at = state.now.toISOString();
      }
      return { data: claimed.map((event) => ({ ...event })), error: null };
    }

    if (name === "claim_surf_alert_slot") {
      const key = `${String(args.p_recipient_user_id)}:${String(args.p_alert_date)}`;
      const eventId = String(args.p_event_id);
      const priority = Number(args.p_priority);
      const existing = state.surfSlots.get(key);
      if (!existing) {
        state.surfSlots.set(key, { eventId, priority });
        return { data: true, error: null };
      }
      if (existing.eventId === eventId) return { data: true, error: null };
      if (priority <= existing.priority) return { data: false, error: null };

      const replaced = state.events.find(({ id }) => id === existing.eventId);
      if (replaced?.status === "pending") {
        replaced.status = "cancelled";
        replaced.skip_reason = "skipped_redundant";
        replaced.cancel_reason = "skipped_redundant";
      }
      state.surfSlots.set(key, { eventId, priority });
      return { data: true, error: null };
    }

    throw new Error(`Unexpected RPC: ${name}`);
  };

  return { from, rpc } as unknown as SupabaseClient<Database>;
}

function dailyCandidate(): DailyCallCandidate & {
  sourceForecast: EnhancedForecastEntity;
  timezone: string;
} {
  return {
    pool: osprey,
    window: {
      start: "2026-09-18T15:00:00.000Z",
      end: "2026-09-18T17:00:00.000Z",
      minutes: 120,
      drivers: [{
        kind: "wind",
        edge: "end",
        at: "2026-09-18T17:00:00.000Z",
        approximate: true,
        label: "offshore until the wind turns",
      }],
    },
    physicalScore: 82,
    personalFit: 10,
    verdict: "go",
    decisionId: "daily-decision-1",
    sessionDecision: { verdict: "go" },
    sourceForecast: {
      id: "forecast-osprey-1500",
      beach_id: OSPREY_ID,
      forecast_at: "2026-09-18T15:00:00.000Z",
      forecast_date: "2026-09-18",
      forecast_time: "08:00:00",
      wave_height: "4",
      wave_period: "14",
      wave_direction: "SW",
      wind_speed: "4",
      wind_direction: "E",
      tide_height: "3",
      tide_status: "Rising",
      water_temp: "66",
      confidence_score: 85,
      data_source: "NOAA_NWS",
      created_at: MORNING_TICK.toISOString(),
      updated_at: MORNING_TICK.toISOString(),
    },
    timezone: "America/Los_Angeles",
  };
}

describe("surf push budget integration", () => {
  it("delivers one evening swell push and lets the manual rule win the morning", async () => {
    const state: HarnessState = {
      events: [],
      attempts: [],
      surfSlots: new Map(),
      pushes: [],
      now: SWELL_TICK,
    };
    const client = buildWorkerClient(state);
    const enqueue = async (args: EnqueueArgs): Promise<EnqueueResult> =>
      eventFromEnqueue(state, args);
    const swellProfile: SwellAlertProfile = {
      id: USER_ID,
      timezone: "America/Los_Angeles",
      homeBeachId: BLACKS_ID,
      location: null,
      maxDriveMinutes: null,
      experienceLevel: "advanced",
      notifPushEnabled: true,
      notifSwellAlerts: true,
    };
    const swellDeps: SwellAlertDeps = {
      isEnabled: () => true,
      isUserAllowed: () => true,
      loadProfiles: async () => [swellProfile],
      evaluatePool: async () => ({
        history: [
          { localDate: "2026-09-14", bestScore: 50, go: false },
          { localDate: "2026-09-15", bestScore: 55, go: false },
          { localDate: "2026-09-16", bestScore: 60, go: false },
        ],
        candidates: [blacks, osprey, poolBeach(
          "20000000-0000-4000-8000-000000000003",
          "Scripps",
          "nearby",
        )].map((pool, index) => ({
          beach: {
            id: pool.beach.id,
            name: pool.beach.name,
            shortName: pool.beach.short_name,
            slug: pool.beach.slug,
            state: "CA",
          },
          event: {
            eventStartDate: "2026-09-18",
            peakDate: "2026-09-19",
            peakHeightFt: 6 - index,
            peakPeriodS: 16 - index,
            peakForecastAt: `2026-09-19T${15 + index}:00:00.000Z`,
            baselineHeightFt: 2,
          },
          peakScore: 85 - index,
          direction: "SW",
          serious: false,
          awarenessSignal: "forecast_trend" as const,
          officialEvidenceRefs: [],
        })),
      }),
      loadAlertState: async () => ({
        eventExists: false,
        lastAlertAt: null,
        recentTitleIds: [],
        recentFilmCount: 0,
      }),
      insertAlert: async () => ({ id: "swell-alert-1" }),
      enqueue,
      markAlertEnqueued: async () => undefined,
    };

    const swellSummary = await runSwellAlertCron({
      now: SWELL_TICK,
      deps: swellDeps,
    });
    expect(swellSummary.sent).toBe(1);
    expect(state.events.filter(({ type }) => type === "swell_watch")).toHaveLength(1);

    const fcm = {
      sendEach: jest.fn(async (messages: Array<{ data?: Record<string, string> }>) => {
        state.pushes.push(...messages);
        return {
          successCount: messages.length,
          failureCount: 0,
          responses: messages.map(() => ({ success: true })),
        };
      }),
    };
    const allowHold = async () => ({ status: "allowed" as const, candidate: null });
    await processPendingEvents(client as never, {
      now: SWELL_TICK,
      fcm: fcm as never,
      resolveMajorEventHold: allowHold,
    });
    expect(state.pushes).toHaveLength(1);
    expect(state.pushes[0].data?.type).toBe("swell_watch");

    state.now = MORNING_TICK;
    expect(evaluateConditions(manualRule, forecastFixture, blacksMeta)).toBe(true);
    await enqueue({
      type: "forecast_alert",
      recipientUserId: USER_ID,
      entityType: "beach",
      entityId: BLACKS_ID,
      dedupeKey: `forecast_alert:${USER_ID}:${BLACKS_ID}:2026-09-18`,
      payload: {
        alert_date: "2026-09-18",
        title: "Blacks lines up this morning",
        body: "4ft @ 14s SW with light offshore wind.",
        beach_id: BLACKS_ID,
        beach_slug: "blacks",
        forecast_at: forecastFixture.forecast_at,
        queue_items: [{ queue_id: "queue-1", rule_id: "rule-1" }],
      },
    });

    const dailyProfile: DailyCallProfile = {
      id: USER_ID,
      homeBeachId: BLACKS_ID,
      timezone: "America/Los_Angeles",
      dailyCallTime: "06:00",
      notifPushEnabled: true,
      notifForecastAlerts: true,
      experienceLevel: "advanced",
      maxDriveMinutes: null,
      location: null,
      homeBeach: blacks.beach,
    };
    const dailyDeps: DailyCallDeps = {
      isEnabled: () => true,
      isUserAllowed: () => true,
      loadProfiles: async () => [dailyProfile],
      resolveTimezone: () => "America/Los_Angeles",
      getSunrise: () => null,
      loadPool: async () => [blacks, osprey],
      buildCandidates: async () => ({
        candidates: [dailyCandidate()],
        hadForecasts: true,
      }),
      alreadySentToday: async (userId, alertDate) => state.events.some((event) =>
        event.recipient_user_id === userId &&
        event.type === "daily_call" &&
        event.payload.alert_date === alertDate,
      ),
      loadSwellEventKey: async () => "2026-09-19:blacks",
      loadRecentTitleIds: async () => [],
      selectTitle: () => ({
        id: "d05",
        title: "Osprey 8:00–10:00",
        body: "Offshore until the wind turns.",
        fallback: false,
      }),
      enqueue: async (args) => enqueue(args),
    };

    const dailySummary = await runDailyCallCron({
      now: MORNING_TICK,
      supabase: client,
      deps: dailyDeps,
    });
    expect(dailySummary.sent).toBe(1);
    expect(state.events.filter(({ type }) => type === "daily_call")).toHaveLength(1);

    const pushCountBeforeMorningWorker = state.pushes.length;
    await processPendingEvents(client as never, {
      now: MORNING_TICK,
      fcm: fcm as never,
      resolveMajorEventHold: allowHold,
    });

    state.now = SECOND_MORNING_TICK;
    const secondDailySummary = await runDailyCallCron({
      now: SECOND_MORNING_TICK,
      supabase: client,
      deps: dailyDeps,
    });
    const dailyEvent = state.events.find(({ type }) => type === "daily_call");
    const swellEvent = state.events.find(({ type }) => type === "swell_watch");
    const morningPushes = state.pushes.slice(pushCountBeforeMorningWorker);

    expect({
      morningPushCount: morningPushes.length,
      deliveredType: morningPushes[0]?.data?.type,
      deliveredBeach: morningPushes[0]?.data?.beach_id,
      dailyStatus: dailyEvent?.status,
      dailyCancelReason: dailyEvent?.cancel_reason,
      swellStatus: swellEvent?.status,
      swellCancelReason: swellEvent?.cancel_reason,
      secondTickAlreadySent: secondDailySummary.skippedCounts.already_sent_today,
      secondTickEnqueued: secondDailySummary.sent,
    }).toEqual({
      morningPushCount: 1,
      deliveredType: "forecast_alert",
      deliveredBeach: BLACKS_ID,
      dailyStatus: "cancelled",
      // The slot RPC records a replaced pending winner as skipped_redundant
      // (carried over from the original per-beach slot contract).
      dailyCancelReason: "skipped_redundant",
      swellStatus: "processed",
      swellCancelReason: null,
      secondTickAlreadySent: 1,
      secondTickEnqueued: 0,
    });
  });
});
