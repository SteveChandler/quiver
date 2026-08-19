/**
 * @jest-environment node
 *
 * Phase 5i: admin broadcast push enqueues one notification per active user
 * via the centralized pipeline instead of dispatching FCM in batches.
 */

jest.mock("@/lib/auth/admin", () => ({
  authenticateAdmin: jest.fn(),
}));

const mockEnqueueNotification = jest.fn();
jest.mock("@/lib/notifications/enqueue", () => ({
  enqueueNotification: (...args: unknown[]) => mockEnqueueNotification(...args),
}));

const mockSelect = jest.fn();
const mockIs = jest.fn();
const mockFrom = jest.fn(() => ({ select: mockSelect }));
const mockServiceRole = { from: mockFrom };
jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(() => mockServiceRole),
}));

import { POST, GET } from "@/app/api/admin/broadcast-push/route";
import {
  createMockAdminUser,
  createMockRequest,
  setupApiTestEnvironment,
} from "@/test-utils/api-test-helpers";

const mockAuthenticateAdmin = require("@/lib/auth/admin").authenticateAdmin;

describe("/api/admin/broadcast-push (Phase 5i — pipeline path)", () => {
  let cleanup: () => void;

  beforeEach(() => {
    const env = setupApiTestEnvironment();
    cleanup = env.cleanup;
    jest.clearAllMocks();
    mockEnqueueNotification.mockResolvedValue({
      enqueued: true,
      eventId: "evt-bc-1",
    });
    // Default user_devices select returns three distinct user_ids.
    mockSelect.mockReturnValue({ is: mockIs });
    mockIs.mockResolvedValue({
      data: [
        { user_id: "user-A" },
        { user_id: "user-B" },
        { user_id: "user-A" }, // duplicate — should be deduped
        { user_id: "user-C" },
      ],
      error: null,
    });
  });

  afterEach(() => cleanup?.());

  it("requires admin authentication", async () => {
    mockAuthenticateAdmin.mockResolvedValue({
      success: false,
      error: "Unauthorized",
      status: 401,
    });
    const req = createMockRequest(
      "POST",
      "http://localhost:3000/api/admin/broadcast-push",
      { body: { title: "x", body: "y" } },
    );
    const res = await POST(req);
    expect(res.status).toBe(401);
    expect(mockEnqueueNotification).not.toHaveBeenCalled();
  });

  it("enqueues exactly one admin_broadcast per distinct user_id", async () => {
    const adminUser = createMockAdminUser();
    mockAuthenticateAdmin.mockResolvedValue({ success: true, user: adminUser });

    const req = createMockRequest(
      "POST",
      "http://localhost:3000/api/admin/broadcast-push",
      { body: { title: "Outage", body: "Quiver is down" } },
    );
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.data.totalUsers).toBe(3); // user-A deduped
    expect(data.data.enqueued).toBe(3);
    expect(mockEnqueueNotification).toHaveBeenCalledTimes(3);
    // All three calls share the same broadcastId in the dedupe key — re-running
    // the same broadcast (same broadcastId) is dedup-safe.
    const broadcastId = data.data.broadcastId;
    expect(broadcastId).toMatch(/^[0-9a-f-]{36}$/i);
    for (const userId of ["user-A", "user-B", "user-C"]) {
      expect(mockEnqueueNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "admin_broadcast",
          recipientUserId: userId,
          dedupeKey: `admin_broadcast:${userId}:${broadcastId}`,
        }),
      );
    }
  });

  it("counts duplicate / invalid / failed enqueue outcomes separately", async () => {
    const adminUser = createMockAdminUser();
    mockAuthenticateAdmin.mockResolvedValue({ success: true, user: adminUser });

    mockEnqueueNotification
      .mockResolvedValueOnce({ enqueued: true, eventId: "evt-1" })
      .mockResolvedValueOnce({ enqueued: false, reason: "duplicate" })
      .mockResolvedValueOnce({
        enqueued: false,
        reason: "internal_error",
        message: "boom",
      });

    const req = createMockRequest(
      "POST",
      "http://localhost:3000/api/admin/broadcast-push",
      { body: { title: "x", body: "y" } },
    );
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.data.enqueued).toBe(1);
    expect(data.data.duplicates).toBe(1);
    expect(data.data.failed).toBe(1);
  });

  it("respects maxUsers cap", async () => {
    const adminUser = createMockAdminUser();
    mockAuthenticateAdmin.mockResolvedValue({ success: true, user: adminUser });

    const req = createMockRequest(
      "POST",
      "http://localhost:3000/api/admin/broadcast-push",
      { body: { title: "x", body: "y", maxUsers: 1 } },
    );
    const res = await POST(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.data.totalUsers).toBe(1);
    expect(mockEnqueueNotification).toHaveBeenCalledTimes(1);
  });

  it("rejects title > 80 chars via Zod", async () => {
    const adminUser = createMockAdminUser();
    mockAuthenticateAdmin.mockResolvedValue({ success: true, user: adminUser });

    const req = createMockRequest(
      "POST",
      "http://localhost:3000/api/admin/broadcast-push",
      { body: { title: "A".repeat(100), body: "y" } },
    );
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(mockEnqueueNotification).not.toHaveBeenCalled();
  });

  it("forwards url and data to the enqueue payload", async () => {
    const adminUser = createMockAdminUser();
    mockAuthenticateAdmin.mockResolvedValue({ success: true, user: adminUser });
    mockIs.mockResolvedValue({ data: [{ user_id: "u1" }], error: null });

    const req = createMockRequest(
      "POST",
      "http://localhost:3000/api/admin/broadcast-push",
      {
        body: {
          title: "x",
          body: "y",
          url: "/profile",
          data: { campaign: "april" },
        },
      },
    );
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockEnqueueNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "admin_broadcast",
        payload: expect.objectContaining({
          title: "x",
          body: "y",
          url: "/profile",
          data: { campaign: "april" },
        }),
      }),
    );
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
        "http://localhost:3000/api/admin/broadcast-push",
      );
      const res = await GET(req);
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.endpoint).toBe("/api/admin/broadcast-push");
    });
  });
});
