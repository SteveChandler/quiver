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

const mockFetch = jest.fn<any>();
global.fetch = mockFetch as unknown as typeof fetch;

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
    mockFetch.mockReset();
  });

  describe("sendPushNotification (generic)", () => {
    it("should send generic push notifications", async () => {
      const mockDevices = [
        { device_token: "token-1" },
        { device_token: "token-2" },
      ];

      mockSupabaseFrom.mockReturnValue({
        select: jest.fn<any>().mockReturnValue({
          in: jest.fn<any>().mockReturnValue({
            is: jest.fn<any>().mockResolvedValue({
              data: mockDevices,
              error: null,
            }),
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
      const mockRetireIs = jest.fn<any>().mockResolvedValue({ error: null });
      const mockRetireIn = jest.fn<any>().mockReturnValue({ is: mockRetireIs });
      const mockRetireUpdate = jest.fn<any>().mockReturnValue({ in: mockRetireIn });

      mockSupabaseFrom.mockImplementation((table: string) => {
        if (table === "user_devices") {
          return { update: mockRetireUpdate };
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

      expect(mockRetireUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ retired_reason: "provider_invalid_token" }),
      );
      expect(mockRetireIn).toHaveBeenCalledWith("device_token", ["stale-token"]);
      expect(mockRetireIs).toHaveBeenCalledWith("retired_at", null);
    });

    it("routes Expo push tokens through Expo Push Service", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ status: "ok", id: "ticket-1" }],
        }),
      });

      const { sendPushNotifications } = await import(
        "@/lib/services/push-notifications"
      );

      await sendPushNotifications([
        {
          to: "ExponentPushToken[expo-123]",
          title: "Wave Alert",
          body: "Perfect conditions",
          data: { beach_id: "b1" },
        },
      ]);

      expect(mockSendEach).not.toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalledWith(
        "https://exp.host/--/api/v2/push/send",
        expect.objectContaining({ method: "POST" })
      );
    });
  });
});
