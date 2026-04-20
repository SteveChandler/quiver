/**
 * Tests for Push Notification Service
 * Demonstrates unit testing approach for FCM push notifications
 */

import { describe, it, expect, jest, beforeEach } from "@jest/globals";

// Mock Firebase Admin SDK
const mockSendEach = jest.fn<any>();
const mockMessaging = {
  sendEach: mockSendEach,
};

jest.mock("@/lib/services/firebase-admin", () => ({
  getFirebaseAdminMessaging: jest.fn(() => mockMessaging),
}));

// Mock Supabase service role client
const mockSupabaseFrom = jest.fn<any>();
const mockSupabase = {
  from: mockSupabaseFrom,
};

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(() => mockSupabase),
  createSupabaseServerClient: jest.fn(() => mockSupabase),
}));

describe("Push Notifications Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("sendSessionInvitePush", () => {
    it("should return early if no invitee IDs provided", async () => {
      const { sendSessionInvitePush } = await import(
        "@/lib/services/push-notifications"
      );

      const result = await sendSessionInvitePush({
        inviteeIds: [],
        inviterName: "John Doe",
        sessionId: "session-123",
      });

      expect(result).toEqual({ success: 0, failed: 0 });
      expect(mockSupabaseFrom).not.toHaveBeenCalled();
    });

    it("should fetch device tokens and send push notifications", async () => {
      const mockDevices = [
        { device_token: "token-1", platform: "ios", user_id: "user-1" },
        { device_token: "token-2", platform: "android", user_id: "user-2" },
      ];

      mockSupabaseFrom.mockReturnValue({
        select: jest.fn<any>().mockReturnValue({
          in: jest.fn<any>().mockResolvedValue({
            data: mockDevices,
            error: null,
          }),
        }),
      });

      mockSendEach.mockResolvedValue({
        successCount: 2,
        failureCount: 0,
        responses: [{ success: true }, { success: true }],
      });

      const { sendSessionInvitePush } = await import(
        "@/lib/services/push-notifications"
      );

      const result = await sendSessionInvitePush({
        inviteeIds: ["user-1", "user-2"],
        inviterName: "John Doe",
        beachName: "Swami's",
        arrivalTime: "2025-01-20T08:00:00Z",
        sessionId: "session-123",
        message: "Dawn patrol!",
      });

      expect(result).toEqual({ success: 2, failed: 0 });
      expect(mockSupabaseFrom).toHaveBeenCalledWith("user_devices");
      expect(mockSendEach).toHaveBeenCalledTimes(1);

      const sentMessages = mockSendEach.mock.calls[0][0] as any[];
      expect(sentMessages).toHaveLength(2);
      expect(sentMessages[0]).toMatchObject({
        token: "token-1",
        notification: {
          title: "New Surf Session Invite",
          body: expect.stringContaining("John Doe"),
        },
        data: expect.objectContaining({
          type: "session_invite",
          session_id: "session-123",
        }),
      });
      // Assert platform-specific blocks survive the PushMessage → FCM Message
      // mapping. These were the exact fields flagged as at-risk during the
      // sendEachForMulticast → sendEach consolidation — if a future refactor
      // drops them, session-invite pushes lose high-priority FCM routing and
      // iOS badge/sound.
      expect(sentMessages[0].android).toMatchObject({
        priority: "high",
        notification: {
          channelId: "session_invites",
          priority: "high",
        },
      });
      expect(sentMessages[0].apns).toMatchObject({
        payload: {
          aps: {
            sound: "default",
            badge: 1,
            alert: {
              title: "New Surf Session Invite",
              body: expect.stringContaining("John Doe"),
            },
          },
        },
      });
    });

    it("should prune invalid device tokens", async () => {
      const mockDevices = [
        { device_token: "valid-token", platform: "ios", user_id: "user-1" },
        { device_token: "invalid-token", platform: "ios", user_id: "user-2" },
      ];

      const mockDeleteIn = jest.fn<any>().mockResolvedValue({ error: null });
      const mockDelete = jest.fn<any>().mockReturnValue({ in: mockDeleteIn });

      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "user_devices") {
          return {
            select: jest.fn<any>().mockReturnValue({
              in: jest.fn<any>().mockResolvedValue({
                data: mockDevices,
                error: null,
              }),
            }),
            delete: mockDelete,
          };
        }
        return {};
      });

      mockSendEach.mockResolvedValue({
        successCount: 1,
        failureCount: 1,
        responses: [
          { success: true },
          {
            success: false,
            error: { code: "messaging/registration-token-not-registered" },
          },
        ],
      });

      const { sendSessionInvitePush } = await import(
        "@/lib/services/push-notifications"
      );

      await sendSessionInvitePush({
        inviteeIds: ["user-1", "user-2"],
        inviterName: "John Doe",
        sessionId: "session-123",
      });

      expect(mockDelete).toHaveBeenCalled();
      expect(mockDeleteIn).toHaveBeenCalledWith("device_token", ["invalid-token"]);
    });

    it("should handle errors gracefully", async () => {
      mockSupabaseFrom.mockReturnValue({
        select: jest.fn<any>().mockReturnValue({
          in: jest.fn<any>().mockResolvedValue({
            data: null,
            error: new Error("Database error"),
          }),
        }),
      });

      const { sendSessionInvitePush } = await import(
        "@/lib/services/push-notifications"
      );

      const result = await sendSessionInvitePush({
        inviteeIds: ["user-1"],
        inviterName: "John Doe",
        sessionId: "session-123",
      });

      expect(result).toEqual({
        success: 0,
        failed: 0,
        errors: expect.arrayContaining([expect.any(String)]),
      });
    });
  });

  describe("sendPushNotification (generic)", () => {
    it("should send generic push notifications", async () => {
      const mockDevices = [
        { device_token: "token-1" },
        { device_token: "token-2" },
      ];

      mockSupabaseFrom.mockReturnValue({
        select: jest.fn<any>().mockReturnValue({
          in: jest.fn<any>().mockResolvedValue({
            data: mockDevices,
            error: null,
          }),
        }),
      });

      mockSendEach.mockResolvedValue({
        successCount: 2,
        failureCount: 0,
        responses: [{ success: true }, { success: true }],
      });

      const { sendPushNotification } = await import(
        "@/lib/services/push-notifications"
      );

      const result = await sendPushNotification({
        userIds: ["user-1", "user-2"],
        title: "Test Notification",
        body: "This is a test",
        data: { custom: "data" },
      });

      expect(result).toEqual({ success: 2, failed: 0 });
      expect(mockSendEach).toHaveBeenCalledTimes(1);

      const sentMessages = mockSendEach.mock.calls[0][0] as any[];
      expect(sentMessages).toHaveLength(2);
      expect(sentMessages[0]).toMatchObject({
        token: "token-1",
        notification: { title: "Test Notification", body: "This is a test" },
        data: { custom: "data" },
      });
    });
  });

  describe("sendPushNotifications (pre-built messages)", () => {
    it("is a no-op when given an empty array", async () => {
      const { sendPushNotifications } = await import(
        "@/lib/services/push-notifications"
      );

      await sendPushNotifications([]);

      expect(mockSendEach).not.toHaveBeenCalled();
      expect(mockSupabaseFrom).not.toHaveBeenCalled();
    });

    it("sends raw FCM tokens through firebase-admin sendEach", async () => {
      mockSendEach.mockResolvedValue({
        successCount: 1,
        failureCount: 0,
        responses: [{ success: true }],
      });

      const { sendPushNotifications } = await import(
        "@/lib/services/push-notifications"
      );

      await sendPushNotifications([
        { to: "fcm-token-xyz", title: "Wave Alert", body: "Perfect conditions" },
      ]);

      expect(mockSendEach).toHaveBeenCalledTimes(1);
      const messages = mockSendEach.mock.calls[0][0] as any[];
      expect(messages).toHaveLength(1);
      expect(messages[0]).toMatchObject({
        token: "fcm-token-xyz",
        notification: { title: "Wave Alert", body: "Perfect conditions" },
      });
    });

    it("serializes non-string data payload entries for FCM", async () => {
      mockSendEach.mockResolvedValue({
        successCount: 1,
        failureCount: 0,
        responses: [{ success: true }],
      });

      const { sendPushNotifications } = await import(
        "@/lib/services/push-notifications"
      );

      await sendPushNotifications([
        {
          to: "fcm-token-abc",
          title: "Alert",
          body: "Check it",
          data: { count: 42, nested: { foo: "bar" }, flag: true },
        },
      ]);

      const messages = mockSendEach.mock.calls[0][0] as any[];
      expect(messages[0].data).toEqual({
        count: "42",
        nested: '{"foo":"bar"}',
        flag: "true",
      });
    });

    it("prunes invalid tokens from user_devices", async () => {
      const mockDeleteIn = jest.fn<any>().mockResolvedValue({ error: null });
      const mockDelete = jest.fn<any>().mockReturnValue({ in: mockDeleteIn });

      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "user_devices") {
          return { delete: mockDelete };
        }
        return {};
      });

      mockSendEach.mockResolvedValue({
        successCount: 1,
        failureCount: 1,
        responses: [
          { success: true },
          {
            success: false,
            error: { code: "messaging/invalid-registration-token" },
          },
        ],
      });

      const { sendPushNotifications } = await import(
        "@/lib/services/push-notifications"
      );

      await sendPushNotifications([
        { to: "good-token", title: "T", body: "B" },
        { to: "stale-token", title: "T", body: "B" },
      ]);

      expect(mockDelete).toHaveBeenCalled();
      expect(mockDeleteIn).toHaveBeenCalledWith("device_token", ["stale-token"]);
    });
  });
});
