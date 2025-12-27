/**
 * Tests for admin test push endpoint
 */

// Use lightweight NextResponse mock (NextResponse.json)
jest.mock("next/server", () => require("@/__tests__/setup/mock-next-server"));

import { jest } from "@jest/globals";

jest.mock("@/lib/auth/admin", () => ({
  authenticateAdmin: jest.fn(),
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
    (authenticateAdmin as jest.Mock).mockResolvedValue({
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
    (authenticateAdmin as jest.Mock).mockResolvedValue({
      success: true,
      user: { id: "admin-123", email: "admin@example.com" },
    });

    const { sendPushNotification } = await import("@/lib/services/push-notifications");
    (sendPushNotification as jest.Mock).mockResolvedValue({
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


