/**
 * @jest-environment node
 *
 * Phase 5i: admin test push goes through the centralized notifications
 * pipeline (enqueueNotification → worker dispatch) rather than calling
 * sendPushNotification directly.
 */

// Mock admin authentication.
jest.mock("@/lib/auth/admin", () => ({
  authenticateAdmin: jest.fn(),
}));

// Phase 5i: route now calls enqueueNotification, not sendPushNotification.
const mockEnqueueNotification = jest.fn();
jest.mock("@/lib/notifications/enqueue", () => ({
  enqueueNotification: (...args: unknown[]) => mockEnqueueNotification(...args),
}));

// Defensive guard: catch a regression that wires direct FCM back in.
const mockSendPushNotification = jest.fn();
jest.mock("@/lib/services/push-notifications", () => ({
  sendPushNotification: (...args: unknown[]) =>
    mockSendPushNotification(...args),
}));

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(() => ({})),
}));

import { GET, POST } from "@/app/api/admin/test-push/route";
import {
  createMockAdminUser,
  createMockRequest,
  setupApiTestEnvironment,
} from "@/test-utils/api-test-helpers";

const mockAuthenticateAdmin = require("@/lib/auth/admin").authenticateAdmin;

describe("/api/admin/test-push (Phase 5i — pipeline path)", () => {
  let cleanup: () => void;

  beforeEach(() => {
    const env = setupApiTestEnvironment();
    cleanup = env.cleanup;
    jest.clearAllMocks();
    mockEnqueueNotification.mockResolvedValue({
      enqueued: true,
      eventId: "evt-test-1",
    });
  });

  afterEach(() => cleanup?.());

  it("requires admin authentication", async () => {
    mockAuthenticateAdmin.mockResolvedValue({
      success: false,
      error: "Unauthorized - Admin access required",
      status: 401,
    });

    const req = createMockRequest(
      "POST",
      "http://localhost:3000/api/admin/test-push",
      { body: {} },
    );
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(401);
    expect(data.error).toContain("Unauthorized");
    expect(mockEnqueueNotification).not.toHaveBeenCalled();
    expect(mockSendPushNotification).not.toHaveBeenCalled();
  });

  it("enqueues an admin_test event for the authenticated admin user", async () => {
    const adminUser = createMockAdminUser();
    mockAuthenticateAdmin.mockResolvedValue({ success: true, user: adminUser });

    const req = createMockRequest(
      "POST",
      "http://localhost:3000/api/admin/test-push",
      { body: {} },
    );
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.data.toUserId).toBe(adminUser.id);
    expect(data.data.eventId).toBe("evt-test-1");
    expect(mockEnqueueNotification).toHaveBeenCalledTimes(1);
    expect(mockEnqueueNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "admin_test",
        recipientUserId: adminUser.id,
        // Per-call unique key — fire as many test pushes as you want.
        dedupeKey: expect.stringMatching(
          new RegExp(`^admin_test:${adminUser.id}:`),
        ),
      }),
    );
    // Phase 5i regression guard: route never touches direct FCM.
    expect(mockSendPushNotification).not.toHaveBeenCalled();
  });

  it("forwards optional title/body into the enqueue payload", async () => {
    const adminUser = createMockAdminUser();
    mockAuthenticateAdmin.mockResolvedValue({ success: true, user: adminUser });

    const req = createMockRequest(
      "POST",
      "http://localhost:3000/api/admin/test-push",
      { body: { title: "Hello", body: "World" } },
    );
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockEnqueueNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "admin_test",
        payload: { title: "Hello", body: "World" },
      }),
    );
  });

  it("rejects title > 80 chars (Zod schema)", async () => {
    const adminUser = createMockAdminUser();
    mockAuthenticateAdmin.mockResolvedValue({ success: true, user: adminUser });

    const req = createMockRequest(
      "POST",
      "http://localhost:3000/api/admin/test-push",
      { body: { title: "A".repeat(100) } },
    );
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(mockEnqueueNotification).not.toHaveBeenCalled();
  });

  it("returns 500 when enqueue fails for a non-duplicate reason", async () => {
    const adminUser = createMockAdminUser();
    mockAuthenticateAdmin.mockResolvedValue({ success: true, user: adminUser });
    mockEnqueueNotification.mockResolvedValueOnce({
      enqueued: false,
      reason: "internal_error",
      message: "supabase blew up",
    });

    const req = createMockRequest(
      "POST",
      "http://localhost:3000/api/admin/test-push",
      { body: {} },
    );
    const res = await POST(req);
    const data = await res.json();
    expect(res.status).toBe(500);
    expect(data.error).toMatch(/Failed to enqueue/);
    expect(data.message).toBe("supabase blew up");
  });

  describe("GET", () => {
    it("returns endpoint info when authenticated", async () => {
      const adminUser = createMockAdminUser();
      mockAuthenticateAdmin.mockResolvedValue({
        success: true,
        user: adminUser,
      });

      const req = createMockRequest(
        "GET",
        "http://localhost:3000/api/admin/test-push",
      );
      const res = await GET(req);
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.endpoint).toBe("/api/admin/test-push");
      expect(data.method).toBe("POST");
    });

    it("requires admin authentication", async () => {
      mockAuthenticateAdmin.mockResolvedValue({
        success: false,
        error: "Unauthorized - Admin access required",
        status: 401,
      });
      const req = createMockRequest(
        "GET",
        "http://localhost:3000/api/admin/test-push",
      );
      const res = await GET(req);
      expect(res.status).toBe(401);
    });
  });
});
