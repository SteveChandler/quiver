/**
 * Tests for admin test push endpoint.
 *
 * Phase 5i migrated this route from `sendPushNotification` (direct FCM) to
 * `enqueueNotification` (centralized pipeline). The mock surface tracks that.
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

jest.mock("@/lib/notifications/enqueue", () => ({
  enqueueNotification: jest.fn(),
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

  it("enqueues an admin_test notification for the current admin user", async () => {
    const { authenticateAdmin } = await import("@/lib/auth/admin");
    const authenticateAdminMock =
      authenticateAdmin as unknown as jest.MockedFunction<typeof authenticateAdmin>;
    authenticateAdminMock.mockResolvedValue({
      success: true,
      user: { id: "admin-123", email: "admin@example.com" } as any,
    });

    const { enqueueNotification } = await import("@/lib/notifications/enqueue");
    const enqueueMock = enqueueNotification as unknown as jest.MockedFunction<
      typeof enqueueNotification
    >;
    enqueueMock.mockResolvedValue({
      enqueued: true,
      eventId: "evt-1",
    } as any);

    const { POST } = await import("@/app/api/admin/test-push/route");
    const res = await POST({
      json: async () => ({ title: "Hello", body: "Test" }),
    } as any);
    const json = await (res as Response).json();

    expect(json.success).toBe(true);
    expect(json.data).toEqual(
      expect.objectContaining({
        toUserId: "admin-123",
        eventId: "evt-1",
      })
    );
    expect(enqueueMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "admin_test",
        recipientUserId: "admin-123",
        payload: { title: "Hello", body: "Test" },
        dedupeKey: expect.stringMatching(/^admin_test:admin-123:/),
      })
    );
  });

  it("returns 500 when enqueue fails", async () => {
    const { authenticateAdmin } = await import("@/lib/auth/admin");
    const authenticateAdminMock =
      authenticateAdmin as unknown as jest.MockedFunction<typeof authenticateAdmin>;
    authenticateAdminMock.mockResolvedValue({
      success: true,
      user: { id: "admin-123", email: "admin@example.com" } as any,
    });

    const { enqueueNotification } = await import("@/lib/notifications/enqueue");
    const enqueueMock = enqueueNotification as unknown as jest.MockedFunction<
      typeof enqueueNotification
    >;
    enqueueMock.mockResolvedValue({
      enqueued: false,
      reason: "validation_failed",
      message: "bad payload",
    } as any);

    const { POST } = await import("@/app/api/admin/test-push/route");
    const res = await POST({
      json: async () => ({ title: "Hello", body: "Test" }),
    } as any);
    expect((res as any).status).toBe(500);
    const json = await (res as Response).json();
    expect(json.success).toBe(false);
  });
});
