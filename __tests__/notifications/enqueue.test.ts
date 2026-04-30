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

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(() => ({ from: mockFrom })),
}));

import { enqueueNotification } from "@/lib/notifications/enqueue";
import { expectConsoleErrors } from "@/__tests__/setup/test-utils";

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
    });
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
      type: "session_invite",
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
    });
  });
});
