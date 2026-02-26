/**
 * Tests for admin test push endpoint
 */

// Use lightweight NextResponse mock (NextResponse.json)
jest.mock("next/server", () => require("@/__tests__/setup/mock-next-server"));

import { jest } from "@jest/globals";

jest.mock("@/lib/auth/admin", () => ({
  authenticateAdmin: jest.fn(),
}));

// Prevent real Supabase client creation in CI (no env vars)
jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: jest.fn(() => Promise.resolve({})),
  createSupabaseServiceRoleClient: jest.fn(() => ({})),
}));

jest.mock("@/lib/services/push-notifications", () => ({
  sendPushNotification: jest.fn(),
}));

describe("POST /api/admin/test-push", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401/403 when not authorized", async () => {
    const { authenticateAdmin } = await import("@/lib/auth/admin");
    const authenticateAdminMock =
      authenticateAdmin as unknown as jest.MockedFunction<typeof authenticateAdmin>;
    authenticateAdminMock.mockResolvedValue({
      success: false,
      error: "Admin access required",
      status: 403,
    });

    const { POST } = await import("@/app/api/admin/test-push/route");
    const res = await POST({} as any);
    expect((res as any).status).toBe(403);
  });

  it("sends push to the current admin user", async () => {
    const { authenticateAdmin } = await import("@/lib/auth/admin");
    const authenticateAdminMock =
      authenticateAdmin as unknown as jest.MockedFunction<typeof authenticateAdmin>;
    authenticateAdminMock.mockResolvedValue({
      success: true,
      user: { id: "admin-123", email: "admin@example.com" } as any,
    });

    const { sendPushNotification } = await import("@/lib/services/push-notifications");
    const sendPushNotificationMock =
      sendPushNotification as unknown as jest.MockedFunction<typeof sendPushNotification>;
    sendPushNotificationMock.mockResolvedValue({
      success: 1,
      failed: 0,
    });

    const { POST } = await import("@/app/api/admin/test-push/route");
    const res = await POST({
      json: async () => ({ title: "Hello", body: "Test" }),
    } as any);
    const json = await (res as Response).json();

    expect(json.success).toBe(true);
    expect(sendPushNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userIds: ["admin-123"],
        title: "Hello",
        body: "Test",
        data: expect.objectContaining({
          type: "test_push",
          url: "/profile",
        }),
      })
    );
  });
});


