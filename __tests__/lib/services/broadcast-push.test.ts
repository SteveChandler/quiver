/**
 * Tests for broadcastToActiveUsers() — the marketing launch-day broadcast wrapper.
 */

jest.mock("@/lib/services/push-notifications", () => ({
  sendPushNotification: jest.fn(),
}));

import { sendPushNotification } from "@/lib/services/push-notifications";
import {
  broadcastToActiveUsers,
  BROADCAST_BATCH_SIZE,
} from "@/lib/services/broadcast-push";

const sendPushNotificationMock = sendPushNotification as jest.Mock;

type DeviceRow = { user_id: string };

function makeSupabase(rows: DeviceRow[] | null, error: { message: string } | null = null) {
  const select = jest.fn(() => Promise.resolve({ data: rows, error }));
  const from = jest.fn(() => ({ select }));
  return { from } as any;
}

function makeRows(userIds: string[]): DeviceRow[] {
  return userIds.map((user_id) => ({ user_id }));
}

describe("broadcastToActiveUsers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sendPushNotificationMock.mockResolvedValue({ success: 1, failed: 0 });
  });

  it("returns zero counts when user_devices is empty", async () => {
    const supabase = makeSupabase([]);

    const result = await broadcastToActiveUsers(supabase, {
      title: "Hi",
      body: "Launch day",
    });

    expect(result).toEqual({
      totalUsers: 0,
      sentBatches: 0,
      failedBatches: 0,
      errors: [],
    });
    expect(sendPushNotificationMock).not.toHaveBeenCalled();
  });

  it("sends one batch when user count is under BROADCAST_BATCH_SIZE", async () => {
    const userIds = Array.from({ length: 10 }, (_, i) => `user-${i}`);
    const supabase = makeSupabase(makeRows(userIds));

    const result = await broadcastToActiveUsers(supabase, {
      title: "Hi",
      body: "Launch day",
      data: { type: "launch" },
    });

    expect(result.totalUsers).toBe(10);
    expect(result.sentBatches).toBe(1);
    expect(result.failedBatches).toBe(0);
    expect(sendPushNotificationMock).toHaveBeenCalledTimes(1);
    expect(sendPushNotificationMock).toHaveBeenCalledWith({
      userIds,
      title: "Hi",
      body: "Launch day",
      data: { type: "launch" },
    });
  });

  it("chunks into multiple batches of BROADCAST_BATCH_SIZE when over the limit", async () => {
    const total = BROADCAST_BATCH_SIZE * 2 + 37;
    const userIds = Array.from({ length: total }, (_, i) => `user-${i}`);
    const supabase = makeSupabase(makeRows(userIds));

    const result = await broadcastToActiveUsers(supabase, {
      title: "Broadcast",
      body: "To everyone",
    });

    expect(result.totalUsers).toBe(total);
    expect(result.sentBatches).toBe(3);
    expect(result.failedBatches).toBe(0);
    expect(sendPushNotificationMock).toHaveBeenCalledTimes(3);

    const firstCall = sendPushNotificationMock.mock.calls[0][0];
    const secondCall = sendPushNotificationMock.mock.calls[1][0];
    const thirdCall = sendPushNotificationMock.mock.calls[2][0];

    expect(firstCall.userIds).toHaveLength(BROADCAST_BATCH_SIZE);
    expect(firstCall.userIds[0]).toBe("user-0");
    expect(secondCall.userIds).toHaveLength(BROADCAST_BATCH_SIZE);
    expect(secondCall.userIds[0]).toBe(`user-${BROADCAST_BATCH_SIZE}`);
    expect(thirdCall.userIds).toHaveLength(37);
    expect(thirdCall.userIds[0]).toBe(`user-${BROADCAST_BATCH_SIZE * 2}`);
  });

  it("deduplicates users with multiple device rows", async () => {
    const rows: DeviceRow[] = [
      { user_id: "user-1" },
      { user_id: "user-2" },
      { user_id: "user-1" }, // second device for user-1
      { user_id: "user-3" },
      { user_id: "user-2" }, // second device for user-2
    ];
    const supabase = makeSupabase(rows);

    const result = await broadcastToActiveUsers(supabase, {
      title: "Hi",
      body: "Launch day",
    });

    expect(result.totalUsers).toBe(3);
    expect(sendPushNotificationMock).toHaveBeenCalledTimes(1);
    const call = sendPushNotificationMock.mock.calls[0][0];
    expect(call.userIds.sort()).toEqual(["user-1", "user-2", "user-3"]);
  });

  it("respects the maxUsers cap", async () => {
    const userIds = Array.from({ length: 50 }, (_, i) => `user-${i}`);
    const supabase = makeSupabase(makeRows(userIds));

    const result = await broadcastToActiveUsers(supabase, {
      title: "Hi",
      body: "Launch day",
      maxUsers: 5,
    });

    expect(result.totalUsers).toBe(5);
    expect(result.sentBatches).toBe(1);
    const call = sendPushNotificationMock.mock.calls[0][0];
    expect(call.userIds).toHaveLength(5);
  });

  it("records a failed batch but still sends remaining batches", async () => {
    const total = BROADCAST_BATCH_SIZE * 2 + 10;
    const userIds = Array.from({ length: total }, (_, i) => `user-${i}`);
    const supabase = makeSupabase(makeRows(userIds));

    sendPushNotificationMock
      .mockResolvedValueOnce({ success: BROADCAST_BATCH_SIZE, failed: 0 })
      .mockRejectedValueOnce(new Error("FCM blew up"))
      .mockResolvedValueOnce({ success: 10, failed: 0 });

    const result = await broadcastToActiveUsers(supabase, {
      title: "Hi",
      body: "Launch day",
    });

    expect(result.totalUsers).toBe(total);
    expect(result.sentBatches).toBe(2);
    expect(result.failedBatches).toBe(1);
    expect(result.errors).toEqual(["FCM blew up"]);
    expect(sendPushNotificationMock).toHaveBeenCalledTimes(3);
  });

  it("throws a clear error when the user_devices fetch fails", async () => {
    const supabase = makeSupabase(null, { message: "connection refused" });

    await expect(
      broadcastToActiveUsers(supabase, { title: "Hi", body: "Launch day" })
    ).rejects.toThrow(/connection refused/);
    expect(sendPushNotificationMock).not.toHaveBeenCalled();
  });
});
