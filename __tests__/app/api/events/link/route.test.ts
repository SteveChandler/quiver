/**
 * @jest-environment node
 *
 * Tests for POST /api/events/link
 *
 * This route links anonymous events (tracked by sessionId) to an authenticated
 * user after sign-in, attributing pre-auth behavior to the new account.
 *
 * Auth model: uses `withAuth`, which calls createSupabaseServerClient() internally
 * and returns 401 when auth.getUser() returns no user. The service-role client
 * (createServiceRoleClient) is a separate mock used for the RPC call.
 */

import {
  createMockSupabaseClient,
  createMockRequest,
  createMockUser,
  mockAuthenticatedUser,
  mockUnauthenticatedUser,
  expectSuccessResponse,
  expectErrorResponse,
  setupApiTestEnvironment,
  type MockSupabaseClient,
} from "@/test-utils/api-test-helpers";
import { expectConsoleErrors } from "@/__tests__/setup/test-utils";
import { createServiceRoleClient } from "@/lib/supabase";

// ---------------------------------------------------------------------------
// Mock @/lib/supabase/server so withAuth resolves auth via our mock client.
// ---------------------------------------------------------------------------
let mockSupabaseClient: MockSupabaseClient;

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: jest.fn(() => mockSupabaseClient),
}));

// ---------------------------------------------------------------------------
// Mock @/lib/supabase so createServiceRoleClient returns a controllable stub.
// The RPC call is the only thing the route does with the service client.
// ---------------------------------------------------------------------------
const mockRpc = jest.fn();

jest.mock("@/lib/supabase", () => ({
  createServiceRoleClient: jest.fn(() => ({ rpc: mockRpc })),
}));

// ---------------------------------------------------------------------------
// Import the route handler *after* mocks are registered.
// ---------------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { POST } = require("@/app/api/events/link/route");

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const VALID_SESSION_ID = "84d3468b-c1ec-46ad-8621-d8507e5f167a";
const VALID_USER_ID = "550e8400-e29b-41d4-a716-446655440000";

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------
describe("POST /api/events/link", () => {
  let cleanup: () => void;

  beforeEach(() => {
    const env = setupApiTestEnvironment();
    cleanup = env.cleanup;

    // Fresh mock client for every test so auth state is isolated.
    mockSupabaseClient = createMockSupabaseClient();

    // Default: authenticated user.
    mockAuthenticatedUser(mockSupabaseClient, createMockUser({ id: VALID_USER_ID }));

    // Default: RPC succeeds returning 0.
    mockRpc.mockResolvedValue({ data: 0, error: null });
  });

  afterEach(() => {
    cleanup?.();
  });

  // -------------------------------------------------------------------------
  // Validation — missing / invalid sessionId
  // -------------------------------------------------------------------------

  describe("input validation", () => {
    it("returns 400 for missing sessionId", async () => {
      const req = createMockRequest("POST", "http://localhost/api/events/link", {
        body: {},
      });

      const res = await POST(req);

      await expectErrorResponse(res, 400, "Invalid or missing sessionId");
    });

    it("returns 400 for invalid sessionId format", async () => {
      const req = createMockRequest("POST", "http://localhost/api/events/link", {
        body: { sessionId: "not-a-uuid" },
      });

      const res = await POST(req);

      await expectErrorResponse(res, 400, "Invalid or missing sessionId");
    });

    it("returns 400 for non-string sessionId (number)", async () => {
      const req = createMockRequest("POST", "http://localhost/api/events/link", {
        body: { sessionId: 12345 },
      });

      const res = await POST(req);

      await expectErrorResponse(res, 400, "Invalid or missing sessionId");
    });

    it("returns 400 for null sessionId", async () => {
      const req = createMockRequest("POST", "http://localhost/api/events/link", {
        body: { sessionId: null },
      });

      const res = await POST(req);

      await expectErrorResponse(res, 400, "Invalid or missing sessionId");
    });

    it("returns 400 for empty-string sessionId", async () => {
      const req = createMockRequest("POST", "http://localhost/api/events/link", {
        body: { sessionId: "" },
      });

      const res = await POST(req);

      await expectErrorResponse(res, 400, "Invalid or missing sessionId");
    });
  });

  // -------------------------------------------------------------------------
  // Authentication
  // -------------------------------------------------------------------------

  describe("authentication", () => {
    it("returns 401 when the user is not authenticated", async () => {
      mockUnauthenticatedUser(mockSupabaseClient);

      const req = createMockRequest("POST", "http://localhost/api/events/link", {
        body: { sessionId: VALID_SESSION_ID },
      });

      const res = await POST(req);

      expect(res.status).toBe(401);
    });
  });

  // -------------------------------------------------------------------------
  // Successful linking
  // -------------------------------------------------------------------------

  describe("successful event linking", () => {
    it("links events and returns count when RPC returns a positive number", async () => {
      mockRpc.mockResolvedValue({ data: 5, error: null });

      const req = createMockRequest("POST", "http://localhost/api/events/link", {
        body: { sessionId: VALID_SESSION_ID },
      });

      const res = await POST(req);
      const body = await expectSuccessResponse(res, 200);

      expect(body.data).toEqual({ ok: true, linked: 5 });
    });

    it("returns linked: 0 when no events exist to link", async () => {
      mockRpc.mockResolvedValue({ data: 0, error: null });

      const req = createMockRequest("POST", "http://localhost/api/events/link", {
        body: { sessionId: VALID_SESSION_ID },
      });

      const res = await POST(req);
      const body = await expectSuccessResponse(res, 200);

      expect(body.data).toEqual({ ok: true, linked: 0 });
    });

    it("returns linked: 0 when RPC returns null (no rows affected)", async () => {
      mockRpc.mockResolvedValue({ data: null, error: null });

      const req = createMockRequest("POST", "http://localhost/api/events/link", {
        body: { sessionId: VALID_SESSION_ID },
      });

      const res = await POST(req);
      const body = await expectSuccessResponse(res, 200);

      // The route uses `data ?? 0` so null should produce 0.
      expect(body.data).toEqual({ ok: true, linked: 0 });
    });

    it("passes the correct arguments to the RPC call", async () => {
      mockRpc.mockResolvedValue({ data: 3, error: null });

      const req = createMockRequest("POST", "http://localhost/api/events/link", {
        body: { sessionId: VALID_SESSION_ID },
      });

      await POST(req);

      expect(mockRpc).toHaveBeenCalledWith("link_anonymous_events", {
        p_session_id: VALID_SESSION_ID,
        p_user_id: VALID_USER_ID,
      });
    });

    it("uses the service-role client (not the auth-scoped client) for the RPC", async () => {
      mockRpc.mockResolvedValue({ data: 1, error: null });

      const req = createMockRequest("POST", "http://localhost/api/events/link", {
        body: { sessionId: VALID_SESSION_ID },
      });

      await POST(req);

      expect(createServiceRoleClient).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // RPC error handling
  // -------------------------------------------------------------------------

  describe("error handling", () => {
    it("returns 500 when the RPC call returns an error", async () => {
      mockRpc.mockResolvedValue({
        data: null,
        error: { message: "Database error" },
      });

      const req = createMockRequest("POST", "http://localhost/api/events/link", {
        body: { sessionId: VALID_SESSION_ID },
      });

      const res = await POST(req);

      // The route calls console.error('Error linking anonymous events:', error)
      // on RPC failure — declare that as intentional so the afterEach guard passes.
      expectConsoleErrors([/Error linking anonymous events/]);

      await expectErrorResponse(res, 500, "Failed to link events");
    });

    it("returns 500 when the RPC call throws unexpectedly", async () => {
      mockRpc.mockRejectedValue(new Error("Unexpected DB failure"));

      const req = createMockRequest("POST", "http://localhost/api/events/link", {
        body: { sessionId: VALID_SESSION_ID },
      });

      const res = await POST(req);

      // withAuth catches unhandled errors and returns 500.
      expect(res.status).toBe(500);
    });
  });
});
