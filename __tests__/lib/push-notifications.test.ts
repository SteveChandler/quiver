/**
 * Tests for Push Notification Service
 * Demonstrates unit testing approach for FCM push notifications
 */

import { describe, it, expect, jest, beforeEach } from "@jest/globals";

// Mock Firebase Admin SDK
const mockSendEachForMulticast = jest.fn<any>();
const mockMessaging = {
  sendEachForMulticast: mockSendEachForMulticast,
};

jest.mock("@/lib/services/firebase-admin", () => ({
  messaging: mockMessaging,
  isFirebaseInitialized: jest.fn(() => true),
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
      // Mock device tokens from database
      const mockDevices = [
        {
          device_token: "token-1",
          platform: "ios",
          user_id: "user-1",
        },
        {
          device_token: "token-2",
          platform: "android",
          user_id: "user-2",
        },
      ];

      mockSupabaseFrom.mockReturnValue({
        select: jest.fn<any>().mockReturnValue({
          in: jest.fn<any>().mockResolvedValue({
            data: mockDevices,
            error: null,
          }),
        }),
      });

      // Mock FCM response
      mockSendEachForMulticast.mockResolvedValue({
        successCount: 2,
        failureCount: 0,
        responses: [
          { success: true },
          { success: true },
        ],
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
      expect(mockSendEachForMulticast).toHaveBeenCalledWith(
        expect.objectContaining({
          tokens: ["token-1", "token-2"],
          notification: expect.objectContaining({
            title: "New Surf Session Invite",
            body: expect.stringContaining("John Doe"),
          }),
          data: expect.objectContaining({
            type: "session_invite",
            session_id: "session-123",
          }),
        })
      );
    });

    it("should prune invalid device tokens", async () => {
      const mockDevices = [
        { device_token: "valid-token", platform: "ios", user_id: "user-1" },
        { device_token: "invalid-token", platform: "ios", user_id: "user-2" },
      ];

      const mockDelete = jest.fn<any>().mockReturnValue({
        in: jest.fn<any>().mockResolvedValue({ error: null }),
      });

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

      // Mock FCM response with one invalid token
      mockSendEachForMulticast.mockResolvedValue({
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

      // Verify invalid token was deleted
      expect(mockDelete).toHaveBeenCalled();
      expect((mockDelete as any)().in).toHaveBeenCalledWith("device_token", [
        "invalid-token",
      ]);
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

      mockSendEachForMulticast.mockResolvedValue({
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
      expect(mockSendEachForMulticast).toHaveBeenCalledWith(
        expect.objectContaining({
          tokens: ["token-1", "token-2"],
          notification: {
            title: "Test Notification",
            body: "This is a test",
          },
          data: { custom: "data" },
        })
      );
    });
  });
});

