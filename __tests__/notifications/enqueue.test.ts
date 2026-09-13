/**
 * @jest-environment node
 *
 * Unit tests for the notification pipeline producer API.
 * Plan: ~/.claude/plans/on-quiver-native-we-have-snug-tiger.md (Phase 1f).
 */

const mockSingle = jest.fn();
const mockSelect = jest.fn(() => ({ single: mockSingle }));
const mockInsert = jest.fn(() => ({ select: mockSelect }));
const mockFrom = jest.fn(() => ({ insert: mockInsert }));
const mockRpc = jest.fn();

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(() => ({ from: mockFrom, rpc: mockRpc })),
}));

import { enqueueNotification } from "@/lib/notifications/enqueue";
import { expectConsoleErrors } from "@/__tests__/setup/test-utils";
import {
  parseSwellWatchNotificationPayload,
} from "@/lib/notifications/types/swell-watch-v2";
import swellWatchV2Fixture from "../fixtures/swell-watch-v2.json";

describe("enqueueNotification", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("inserts a row and returns the new event id on success", async () => {
    mockSingle.mockResolvedValueOnce({
      data: { id: "evt-123" },
      error: null,
    });

    const result = await enqueueNotification({
      type: "like",
      recipientUserId: "user-A",
      actorUserId: "user-B",
      entityType: "session",
      entityId: "sess-1",
      payload: { session_id: "sess-1", beach_name: "Mavericks" },
      dedupeKey: "like:sess-1:user-B",
    });

    expect(result).toEqual({ enqueued: true, eventId: "evt-123" });
    expect(mockFrom).toHaveBeenCalledWith("notification_events");
    expect(mockInsert).toHaveBeenCalledWith({
      recipient_user_id: "user-A",
      actor_user_id: "user-B",
      type: "like",
      entity_type: "session",
      entity_id: "sess-1",
      payload: { session_id: "sess-1", beach_name: "Mavericks" },
      dedupe_key: "like:sess-1:user-B",
      next_attempt_at: null,
    });
  });

  it("holds surf-alert events briefly so higher-priority sources can coalesce", async () => {
    jest.useFakeTimers({ now: new Date("2026-07-13T15:00:00.000Z") });
    mockSingle.mockResolvedValueOnce({
      data: { id: "evt-surf" },
      error: null,
    });

    await enqueueNotification({
      type: "forecast_alert",
      recipientUserId: "user-A",
      entityType: "beach",
      entityId: "beach-1",
      payload: {
        alert_date: "2026-07-13",
        beach_id: "beach-1",
        title: "Clean window",
        body: "2.7 ft @ 14s",
      },
    });

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        next_attempt_at: "2026-07-13T15:05:00.000Z",
      }),
    );
    jest.useRealTimers();
  });

  it("returns enqueued=false reason=duplicate on unique-violation (Postgres 23505)", async () => {
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: { code: "23505", message: "duplicate key value violates unique constraint" },
    });

    const result = await enqueueNotification({
      type: "follow",
      recipientUserId: "user-A",
      actorUserId: "user-B",
      dedupeKey: "follow:user-B:user-A",
    });

    expect(result).toEqual({ enqueued: false, reason: "duplicate" });
  });

  it("returns enqueued=false reason=unknown_type for an unregistered type", async () => {
    const result = await enqueueNotification({
      type: "some_made_up_type",
      recipientUserId: "user-A",
    });

    expect(result).toEqual({
      enqueued: false,
      reason: "unknown_type",
      message: 'Notification type "some_made_up_type" is not registered',
    });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("returns enqueued=false reason=internal_error when recipientUserId is missing", async () => {
    const result = await enqueueNotification({
      type: "like",
      recipientUserId: "",
    });

    expect(result).toEqual({
      enqueued: false,
      reason: "internal_error",
      message: "recipientUserId is required",
    });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("returns enqueued=false reason=internal_error on a non-unique-violation database error", async () => {
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: { code: "42P01", message: "relation does not exist" },
    });

    const result = await enqueueNotification({
      type: "like",
      recipientUserId: "user-A",
      payload: { session_id: "sess-1" },
    });

    expect(result).toEqual({
      enqueued: false,
      reason: "internal_error",
      message: "relation does not exist",
    });
    expectConsoleErrors([/notifications\/enqueue.*insert failed/]);
  });

  it("returns enqueued=false reason=invalid_payload when payload fails registry schema (Phase 5e)", async () => {
    const result = await enqueueNotification({
      type: "like",
      recipientUserId: "user-A",
      // like requires session_id; pass an empty object.
      payload: {},
    });

    expect(result.enqueued).toBe(false);
    if (result.enqueued) throw new Error("Expected invalid payload result");
    expect(result.reason).toBe("invalid_payload");
    expect(result.message).toMatch(/session_id/);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("rejects malformed water_quality status enum (Phase 5e)", async () => {
    const result = await enqueueNotification({
      type: "water_quality",
      recipientUserId: "user-A",
      payload: {
        beach_id: "beach-1",
        beach_slug: "mavericks",
        beach_name: "Mavericks",
        // Invalid enum value — schema enforces good|advisory|closure|unknown.
        status: "totally-fine",
        previous_status: null,
        status_changed_at: "2026-04-30T00:00:00Z",
      },
    });

    expect(result.enqueued).toBe(false);
    if (result.enqueued) throw new Error("Expected invalid payload result");
    expect(result.reason).toBe("invalid_payload");
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("accepts valid payloads through validatePayload and inserts unchanged (Phase 5e)", async () => {
    mockSingle.mockResolvedValueOnce({
      data: { id: "evt-789" },
      error: null,
    });

    const result = await enqueueNotification({
      type: "like",
      recipientUserId: "user-A",
      actorUserId: "user-B",
      payload: {
        session_id: "sess-1",
        beach_name: "Mavericks",
      },
    });

    expect(result).toEqual({ enqueued: true, eventId: "evt-789" });
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "like",
        payload: {
          session_id: "sess-1",
          beach_name: "Mavericks",
        },
      })
    );
  });

  it("stores the normalized Swell Watch v2 identity used by permanent enqueue dedupe", async () => {
    mockRpc.mockResolvedValueOnce({
      data: [{ enqueued: true, reason_code: "enqueued", notification_event_id: "evt-swell-watch-v2" }],
      error: null,
    });
    const payload = parseSwellWatchNotificationPayload(swellWatchV2Fixture);

    await expect(enqueueNotification({
      type: "swell_watch",
      recipientUserId: "user-A",
      payload: swellWatchV2Fixture,
      swellWatchAuthority: { expectedEpoch: 9, policyHash: "a".repeat(64) },
    })).resolves.toEqual({ enqueued: true, eventId: "evt-swell-watch-v2" });

    expect(mockRpc).toHaveBeenCalledWith("swell_watch_enqueue_notification", {
      p_recipient_id: "user-A", p_payload: payload, p_expected_epoch: 9, p_policy_hash: "a".repeat(64),
    });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("rejects Swell Watch v2 without authority rather than inserting directly", async () => {
    expect(await enqueueNotification({ type: "swell_watch", recipientUserId: "user-A", payload: swellWatchV2Fixture }))
      .toEqual({ enqueued: false, reason: "safety_rejected", message: "authority_required" });
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it.each(["duplicate", "projected_send_cap_exceeded", "control_epoch_changed", "authority_unavailable"])("returns atomic enqueue rejection %s without fallback insert", async (reason) => {
    mockRpc.mockResolvedValueOnce({ data: [{ enqueued: false, reason_code: reason, notification_event_id: null }], error: null });
    expect(await enqueueNotification({ type: "swell_watch", recipientUserId: "user-A", payload: swellWatchV2Fixture,
      swellWatchAuthority: { expectedEpoch: 9, policyHash: "a".repeat(64) } }))
      .toEqual(reason === "duplicate" ? { enqueued: false, reason: "duplicate" } : { enqueued: false, reason: "safety_rejected", message: reason });
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("rejects malformed Swell Watch v2 identity before it can reach the queue", async () => {
    const { regional_event_id: _regionalEventId, ...invalidPayload } = swellWatchV2Fixture;

    await expect(enqueueNotification({
      type: "swell_watch",
      recipientUserId: "user-A",
      payload: invalidPayload,
    })).resolves.toMatchObject({
      enqueued: false,
      reason: "invalid_payload",
    });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("accepts the Weekend Scout cron payload with bounded hold context", async () => {
    mockSingle.mockResolvedValueOnce({
      data: { id: "evt-weekend" },
      error: null,
    });
    const payload = {
      snapshot_id: "11111111-1111-4111-8111-111111111111",
      weekend_start: "2026-07-25",
      weekend_end: "2026-07-26",
      qualifying_count: 3,
      beach_id: "22222222-2222-4222-8222-222222222222",
      lead_beach_id: "22222222-2222-4222-8222-222222222222",
      lead_beach_name: "Black's",
      lead_window_local: "Saturday morning",
      forecast_at: "2026-07-25T16:00:00.000Z",
      policy_context: {
        kind: "positive_session_recommendation",
        beach_id: "22222222-2222-4222-8222-222222222222",
        starts_at: "2026-07-25T16:00:00.000Z",
        ends_at: "2026-07-25T18:00:00.000Z",
      },
    };

    const result = await enqueueNotification({
      type: "weekend_window",
      recipientUserId: "user-A",
      payload,
    });

    expect(result).toEqual({ enqueued: true, eventId: "evt-weekend" });
    expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
      type: "weekend_window",
      payload,
    }));
  });

  it("defaults nullable fields when not provided", async () => {
    mockSingle.mockResolvedValueOnce({
      data: { id: "evt-456" },
      error: null,
    });

    await enqueueNotification({
      type: "trial_ending",
      recipientUserId: "user-A",
      payload: {
        title: "Your trial ends soon",
        body: "...",
        trial_ends_at: "2026-05-01",
      },
    });

    expect(mockInsert).toHaveBeenCalledWith({
      recipient_user_id: "user-A",
      actor_user_id: null,
      type: "trial_ending",
      entity_type: null,
      entity_id: null,
      payload: {
        title: "Your trial ends soon",
        body: "...",
        trial_ends_at: "2026-05-01",
      },
      dedupe_key: null,
      next_attempt_at: null,
    });
  });
});
