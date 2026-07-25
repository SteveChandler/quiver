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

import { readFileSync } from "node:fs";
import { join } from "node:path";
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
const { POST } = require("@/app/api/events/link/route");

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const VALID_SESSION_ID = "84d3468b-c1ec-46ad-8621-d8507e5f167a";
const VALID_USER_ID = "550e8400-e29b-41d4-a716-446655440000";
const LINK_RESULT = {
  linked: 0,
  attribution_outcome: "no_evidence",
  signup_surface: "unknown",
  evidence_source: "none",
};
const VALID_SIGNUP_CONTEXT = {
  schema_version: 2,
  signup_surface: "web",
  method: "google",
  entrypoint: "landing_hero",
  source_capture_status: "captured",
  captured_at: "2026-07-25T18:00:00.000Z",
};

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------
describe("POST /api/events/link", () => {
  let cleanup: () => void;
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    const env = setupApiTestEnvironment();
    cleanup = env.cleanup;
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});

    // Fresh mock client for every test so auth state is isolated.
    mockSupabaseClient = createMockSupabaseClient();

    // Default: authenticated user.
    mockAuthenticatedUser(mockSupabaseClient, createMockUser({ id: VALID_USER_ID }));

    // Default: RPC succeeds without linked events or acquisition evidence.
    mockRpc.mockResolvedValue({ data: LINK_RESULT, error: null });
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    cleanup?.();
  });

  it("uses the shared API wrapper module for response helpers", () => {
    const source = readFileSync(
      join(process.cwd(), "app/api/events/link/route.ts"),
      "utf8"
    );

    expect(source).not.toMatch(/@\/lib\/api-utils/);
    expect(source).toMatch(/@\/lib\/middleware\/api-wrappers/);
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

      expect(res.status).toBe(400);
      await expectErrorResponse(res, 400, "Invalid or missing sessionId");
    });

    it("returns 400 for invalid sessionId format", async () => {
      const req = createMockRequest("POST", "http://localhost/api/events/link", {
        body: { sessionId: "not-a-uuid" },
      });

      const res = await POST(req);

      expect(res.status).toBe(400);
      await expectErrorResponse(res, 400, "Invalid or missing sessionId");
    });

    it("returns 400 for non-string sessionId (number)", async () => {
      const req = createMockRequest("POST", "http://localhost/api/events/link", {
        body: { sessionId: 12345 },
      });

      const res = await POST(req);

      expect(res.status).toBe(400);
      await expectErrorResponse(res, 400, "Invalid or missing sessionId");
    });

    it("returns 400 for null sessionId", async () => {
      const req = createMockRequest("POST", "http://localhost/api/events/link", {
        body: { sessionId: null },
      });

      const res = await POST(req);

      expect(res.status).toBe(400);
      await expectErrorResponse(res, 400, "Invalid or missing sessionId");
    });

    it("returns 400 for empty-string sessionId", async () => {
      const req = createMockRequest("POST", "http://localhost/api/events/link", {
        body: { sessionId: "" },
      });

      const res = await POST(req);

      expect(res.status).toBe(400);
      await expectErrorResponse(res, 400, "Invalid or missing sessionId");
    });

    it("returns 400 for malformed signupContext without calling the RPC", async () => {
      const req = createMockRequest("POST", "http://localhost/api/events/link", {
        body: {
          sessionId: VALID_SESSION_ID,
          signupContext: {
            schema_version: 2,
            signup_surface: "native_ios",
            method: "google",
          },
        },
      });

      const res = await POST(req);

      await expectErrorResponse(res, 400, "Invalid signupContext");
      expect(mockRpc).not.toHaveBeenCalled();
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
      mockRpc.mockResolvedValue({
        data: {
          linked: 5,
          attribution_outcome: "materialized",
          signup_surface: "web",
          evidence_source: "request_signup_context",
        },
        error: null,
      });

      const req = createMockRequest("POST", "http://localhost/api/events/link", {
        body: { sessionId: VALID_SESSION_ID },
      });

      const res = await POST(req);
      const body = await expectSuccessResponse(res, 200);

      expect(body.data).toEqual({
        ok: true,
        linked: 5,
        attributionOutcome: "materialized",
        signupSurface: "web",
        evidenceSource: "request_signup_context",
      });
    });

    it("returns linked: 0 when no events exist to link", async () => {
      mockRpc.mockResolvedValue({ data: LINK_RESULT, error: null });

      const req = createMockRequest("POST", "http://localhost/api/events/link", {
        body: { sessionId: VALID_SESSION_ID },
      });

      const res = await POST(req);
      const body = await expectSuccessResponse(res, 200);

      expect(body.data).toEqual({
        ok: true,
        linked: 0,
        attributionOutcome: "no_evidence",
        signupSurface: "unknown",
        evidenceSource: "none",
      });
    });

    it("returns linked: 0 when RPC returns null (no rows affected)", async () => {
      mockRpc.mockResolvedValue({ data: null, error: null });

      const req = createMockRequest("POST", "http://localhost/api/events/link", {
        body: { sessionId: VALID_SESSION_ID },
      });

      const res = await POST(req);
      const body = await expectSuccessResponse(res, 200);

      expect(body.data).toEqual({
        ok: true,
        linked: 0,
        attributionOutcome: "no_evidence",
        signupSurface: "unknown",
        evidenceSource: "none",
      });
    });

    it("passes the authenticated user and validated signup context to v2", async () => {
      mockRpc.mockResolvedValue({
        data: { ...LINK_RESULT, linked: 3 },
        error: null,
      });

      const req = createMockRequest("POST", "http://localhost/api/events/link", {
        body: {
          sessionId: VALID_SESSION_ID,
          signupContext: VALID_SIGNUP_CONTEXT,
        },
      });

      await POST(req);

      expect(mockRpc).toHaveBeenCalledWith("link_anonymous_events_v2", {
        p_session_id: VALID_SESSION_ID,
        p_user_id: VALID_USER_ID,
        p_signup_context: VALID_SIGNUP_CONTEXT,
      });
    });

    it("accepts a canonical native signup context at the shared link boundary", async () => {
      const nativeSignupContext = {
        ...VALID_SIGNUP_CONTEXT,
        signup_surface: "native_ios",
        source_capture_status: "missing",
      };
      const req = createMockRequest("POST", "http://localhost/api/events/link", {
        body: {
          sessionId: VALID_SESSION_ID,
          signupContext: nativeSignupContext,
        },
      });

      await POST(req);

      expect(mockRpc).toHaveBeenCalledWith("link_anonymous_events_v2", {
        p_session_id: VALID_SESSION_ID,
        p_user_id: VALID_USER_ID,
        p_signup_context: nativeSignupContext,
      });
    });

    it("uses the service-role client (not the auth-scoped client) for the RPC", async () => {
      mockRpc.mockResolvedValue({
        data: { ...LINK_RESULT, linked: 1 },
        error: null,
      });

      const req = createMockRequest("POST", "http://localhost/api/events/link", {
        body: { sessionId: VALID_SESSION_ID },
      });

      await POST(req);

      expect(createServiceRoleClient).toHaveBeenCalledTimes(1);
    });

    it("includes session and user ids in the structured link log for race diagnostics", async () => {
      mockRpc.mockResolvedValue({
        data: {
          linked: 3,
          attribution_outcome: "materialized",
          signup_surface: "web",
          evidence_source: "linked_web_signup_event",
        },
        error: null,
      });

      const req = createMockRequest("POST", "http://localhost/api/events/link", {
        body: { sessionId: VALID_SESSION_ID },
      });

      await POST(req);

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const logPayload = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(logPayload).toMatchObject({
        event: "events_link_attempt",
        session_id: VALID_SESSION_ID,
        user_id: VALID_USER_ID,
        duration_ms: expect.any(Number),
        events_updated: 3,
        attribution_outcome: "materialized",
        signup_surface: "web",
        evidence_source: "linked_web_signup_event",
        outcome: "success",
      });
      expect(logPayload).not.toHaveProperty("signup_context");
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

      const consoleErrorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      try {
        const res = await POST(req);

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          "Error linking anonymous events:",
          { message: "Database error" }
        );
        await expectErrorResponse(res, 500, "Failed to link events");
      } finally {
        consoleErrorSpy.mockRestore();
      }
    });

    it("returns 500 when the RPC call throws unexpectedly", async () => {
      mockRpc.mockRejectedValue(new Error("Unexpected DB failure"));

      const req = createMockRequest("POST", "http://localhost/api/events/link", {
        body: { sessionId: VALID_SESSION_ID },
      });

      const consoleErrorSpy = jest
        .spyOn(console, "error")
        .mockImplementation(() => {});

      try {
        const res = await POST(req);

        // withAuth catches unhandled errors and returns 500.
        expect(res.status).toBe(500);
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          "API Error:",
          "Unexpected DB failure"
        );
      } finally {
        consoleErrorSpy.mockRestore();
      }
    });
  });
});
