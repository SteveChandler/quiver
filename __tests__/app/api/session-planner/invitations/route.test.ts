import { NextRequest } from "next/server";
import { GET, POST, PATCH } from "@/app/api/session-planner/invitations/route";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  mockUser,
  mockFriends,
  mockInvitationsResponse,
  createMockRequest,
  createMockPostRequest,
  createMockPatchRequest,
  simulateAuthError,
  simulateDatabaseError,
  setupMockSupabase,
} from "../../../../setup/session-planner-test-utils";

// Mock the dependencies
jest.mock("@/lib/supabase/server");
jest.mock("@/lib/api-response-utils", () => ({
  createSuccessResponse: jest.fn((data) => ({
    json: async () => ({
      success: true,
      data,
    }),
    status: 200,
    ok: true,
  })),
  createErrorResponse: jest.fn((message, details, status = 500) => ({
    json: async () => ({
      success: false,
      error: message,
      details,
      status: status || 500,
    }),
    status: status || 500,
    ok: false,
  })),
}));

const mockSupabaseServerClient =
  createSupabaseServerClient as jest.MockedFunction<
    typeof createSupabaseServerClient
  >;

describe("/api/session-planner/invitations", () => {
  setupMockSupabase();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST - Send invitations", () => {
    const mockSessionData = {
      id: "session-123",
      user_id: mockUser.id,
      status: "planned",
      beach_name: "Ocean Beach",
      arrival_time: "2024-01-17T06:00:00Z",
    };

    it("should send invitations successfully for valid request", async () => {
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: jest.fn().mockImplementation((table: string) => {
          if (table === "sessions") {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: mockSessionData,
                error: null,
              }),
            };
          }
          if (table === "profiles") {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: mockFriends[0],
                error: null,
              }),
            };
          }
          if (table === "session_invitations") {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: null,
                error: null,
              }),
              insert: jest.fn().mockReturnThis(),
            };
          }
          return {};
        }),
      };

      mockSupabaseServerClient.mockResolvedValue(mockSupabase as any);

      const requestBody = {
        sessionId: "session-123",
        invitees: [
          {
            userId: "friend-1",
            email: "john@example.com",
            name: "John Surfer",
          },
          { email: "sarah@example.com", name: "Sarah Wave" },
        ],
        message: "Dawn patrol tomorrow!",
      };

      const request = createMockPostRequest(requestBody);
      const response = await POST(request as NextRequest);
      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.data.sessionId).toBe("session-123");
      expect(result.data.invitationsSent).toBeGreaterThan(0);
      expect(result.data.invitations).toBeInstanceOf(Array);
      expect(result.data.errors).toBeInstanceOf(Array);
    });

    it("should return error for missing session ID", async () => {
      const requestBody = {
        invitees: [{ email: "test@example.com" }],
      };

      const request = createMockPostRequest(requestBody);
      const response = await POST(request as NextRequest);
      const result = await response.json();

      expect(result.success).toBe(false);
      expect(result.error).toBe("Session ID and invitees are required");
      expect(result.status).toBe(400);
    });

    it("should return error for empty invitees array", async () => {
      const requestBody = {
        sessionId: "session-123",
        invitees: [],
      };

      const request = createMockPostRequest(requestBody);
      const response = await POST(request as NextRequest);
      const result = await response.json();

      expect(result.success).toBe(false);
      expect(result.error).toBe("Session ID and invitees are required");
      expect(result.status).toBe(400);
    });

    it("should return error for unauthenticated user", async () => {
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue(simulateAuthError()),
        },
      };

      mockSupabaseServerClient.mockResolvedValue(mockSupabase as any);

      const requestBody = {
        sessionId: "session-123",
        invitees: [{ email: "test@example.com" }],
      };

      const request = createMockPostRequest(requestBody);
      const response = await POST(request as NextRequest);
      const result = await response.json();

      expect(result.success).toBe(false);
      expect(result.error).toBe("Authentication required");
      expect(result.status).toBe(401);
    });

    it("should return error if session not found or not owned by user", async () => {
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: jest.fn().mockImplementation((table: string) => {
          if (table === "sessions") {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: null,
                error: new Error("Session not found"),
              }),
            };
          }
          return {};
        }),
      };

      mockSupabaseServerClient.mockResolvedValue(mockSupabase as any);

      const requestBody = {
        sessionId: "nonexistent-session",
        invitees: [{ email: "test@example.com" }],
      };

      const request = createMockPostRequest(requestBody);
      const response = await POST(request as NextRequest);
      const result = await response.json();

      expect(result.success).toBe(false);
      expect(result.error).toBe("Session not found or access denied");
      expect(result.status).toBe(404);
    });

    it("should return error if session is not planned", async () => {
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: jest.fn().mockImplementation((table: string) => {
          if (table === "sessions") {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: { ...mockSessionData, status: "completed" },
                error: null,
              }),
            };
          }
          return {};
        }),
      };

      mockSupabaseServerClient.mockResolvedValue(mockSupabase as any);

      const requestBody = {
        sessionId: "session-123",
        invitees: [{ email: "test@example.com" }],
      };

      const request = createMockPostRequest(requestBody);
      const response = await POST(request as NextRequest);
      const result = await response.json();

      expect(result.success).toBe(false);
      expect(result.error).toBe("Can only invite friends to planned sessions");
      expect(result.status).toBe(400);
    });

    it("should handle existing invitations gracefully", async () => {
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: jest.fn().mockImplementation((table: string) => {
          if (table === "sessions") {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: mockSessionData,
                error: null,
              }),
            };
          }
          if (table === "session_invitations") {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: { id: "existing-invitation" }, // Existing invitation
                error: null,
              }),
            };
          }
          return {};
        }),
      };

      mockSupabaseServerClient.mockResolvedValue(mockSupabase as any);

      const requestBody = {
        sessionId: "session-123",
        invitees: [{ email: "already-invited@example.com" }],
      };

      const request = createMockPostRequest(requestBody);
      const response = await POST(request as NextRequest);
      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.data.invitationsSent).toBe(0);
      expect(result.data.errors).toContain(
        "Invitation already sent to already-invited@example.com"
      );
    });

    it("should handle database errors when creating invitations", async () => {
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: jest.fn().mockImplementation((table: string) => {
          if (table === "sessions") {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: mockSessionData,
                error: null,
              }),
            };
          }
          if (table === "session_invitations") {
            const mockMethods = {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: null,
                error: null,
              }),
              insert: jest.fn().mockReturnThis(),
            };
            // On first call (checking existing), return no error
            // On second call (insert), return error
            mockMethods.single = jest
              .fn()
              .mockResolvedValueOnce({ data: null, error: null })
              .mockResolvedValue(simulateDatabaseError());
            return mockMethods;
          }
          return {};
        }),
      };

      mockSupabaseServerClient.mockResolvedValue(mockSupabase as any);

      const requestBody = {
        sessionId: "session-123",
        invitees: [{ email: "test@example.com" }],
      };

      const request = createMockPostRequest(requestBody);
      const response = await POST(request as NextRequest);
      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.data.invitationsSent).toBe(0);
      expect(result.data.errors.length).toBeGreaterThan(0);
    });
  });

  describe("GET - Fetch invitations", () => {
    const mockInvitation = {
      id: "invitation-1",
      session_id: "session-123",
      inviter_id: mockUser.id,
      invitee_id: "friend-1",
      status: "pending",
      created_at: "2024-01-16T12:00:00Z",
      session: mockInvitationsResponse.data.invitations[0],
      inviter: { id: mockUser.id, full_name: "Test User", avatar_url: null },
      invitee: mockFriends[0],
    };

    it("should fetch received invitations successfully", async () => {
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: jest.fn().mockImplementation(() => ({
          select: jest.fn().mockReturnThis(),
          or: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({
            data: [mockInvitation],
            error: null,
          }),
        })),
      };

      mockSupabaseServerClient.mockResolvedValue(mockSupabase as any);

      const request = createMockRequest({ type: "received" });
      const response = await GET(request as NextRequest);
      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.data.type).toBe("received");
      expect(result.data.invitations).toHaveLength(1);
      expect(result.data.invitations[0].id).toBe("invitation-1");
    });

    it("should fetch sent invitations successfully", async () => {
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: jest.fn().mockImplementation(() => ({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({
            data: [mockInvitation],
            error: null,
          }),
        })),
      };

      mockSupabaseServerClient.mockResolvedValue(mockSupabase as any);

      const request = createMockRequest({ type: "sent" });
      const response = await GET(request as NextRequest);
      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.data.type).toBe("sent");
      expect(result.data.invitations).toHaveLength(1);
    });

    it("should filter by session ID when provided", async () => {
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: jest.fn().mockImplementation(() => ({
          select: jest.fn().mockReturnThis(),
          or: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue({
            data: [mockInvitation],
            error: null,
          }),
        })),
      };

      mockSupabaseServerClient.mockResolvedValue(mockSupabase as any);

      const request = createMockRequest({
        type: "received",
        sessionId: "session-123",
      });
      const response = await GET(request as NextRequest);
      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.data.invitations).toHaveLength(1);
    });

    it("should return error for unauthenticated user", async () => {
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue(simulateAuthError()),
        },
      };

      mockSupabaseServerClient.mockResolvedValue(mockSupabase as any);

      const request = createMockRequest({ type: "received" });
      const response = await GET(request as NextRequest);
      const result = await response.json();

      expect(result.success).toBe(false);
      expect(result.error).toBe("Authentication required");
      expect(result.status).toBe(401);
    });

    it("should handle database errors when fetching invitations", async () => {
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: jest.fn().mockImplementation(() => ({
          select: jest.fn().mockReturnThis(),
          or: jest.fn().mockReturnThis(),
          order: jest.fn().mockResolvedValue(simulateDatabaseError()),
        })),
      };

      mockSupabaseServerClient.mockResolvedValue(mockSupabase as any);

      const request = createMockRequest({ type: "received" });
      const response = await GET(request as NextRequest);
      const result = await response.json();

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to fetch invitations");
    });
  });

  describe("PATCH - Respond to invitation", () => {
    const mockInvitation = {
      id: "invitation-1",
      session_id: "session-123",
      inviter_id: "other-user",
      invitee_id: mockUser.id,
      status: "pending",
      created_at: "2024-01-16T12:00:00Z",
    };

    it("should accept invitation successfully", async () => {
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: jest.fn().mockImplementation((table: string) => {
          if (table === "session_invitations") {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              or: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: mockInvitation,
                error: null,
              }),
              update: jest.fn().mockReturnThis(),
            };
          }
          return {};
        }),
      };

      mockSupabaseServerClient.mockResolvedValue(mockSupabase as any);

      const requestBody = {
        invitationId: "invitation-1",
        response: "accepted",
      };

      const request = createMockPatchRequest(requestBody);
      const response = await PATCH(request as NextRequest);
      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.data.message).toBe("Invitation accepted");
    });

    it("should decline invitation successfully", async () => {
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: jest.fn().mockImplementation((table: string) => {
          if (table === "session_invitations") {
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              or: jest.fn().mockReturnThis(),
              single: jest.fn().mockResolvedValue({
                data: mockInvitation,
                error: null,
              }),
              update: jest.fn().mockReturnThis(),
            };
          }
          return {};
        }),
      };

      mockSupabaseServerClient.mockResolvedValue(mockSupabase as any);

      const requestBody = {
        invitationId: "invitation-1",
        response: "declined",
      };

      const request = createMockPatchRequest(requestBody);
      const response = await PATCH(request as NextRequest);
      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.data.message).toBe("Invitation declined");
    });

    it("should return error for missing invitation ID", async () => {
      const requestBody = {
        response: "accepted",
      };

      const request = createMockPatchRequest(requestBody);
      const response = await PATCH(request as NextRequest);
      const result = await response.json();

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invitation ID and response are required");
      expect(result.status).toBe(400);
    });

    it("should return error for invalid response", async () => {
      const requestBody = {
        invitationId: "invitation-1",
        response: "invalid",
      };

      const request = createMockPatchRequest(requestBody);
      const response = await PATCH(request as NextRequest);
      const result = await response.json();

      expect(result.success).toBe(false);
      expect(result.error).toBe("Response must be 'accepted' or 'declined'");
      expect(result.status).toBe(400);
    });

    it("should return error for unauthenticated user", async () => {
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue(simulateAuthError()),
        },
      };

      mockSupabaseServerClient.mockResolvedValue(mockSupabase as any);

      const requestBody = {
        invitationId: "invitation-1",
        response: "accepted",
      };

      const request = createMockPatchRequest(requestBody);
      const response = await PATCH(request as NextRequest);
      const result = await response.json();

      expect(result.success).toBe(false);
      expect(result.error).toBe("Authentication required");
      expect(result.status).toBe(401);
    });

    it("should return error if invitation not found", async () => {
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: jest.fn().mockImplementation(() => ({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          or: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: null,
            error: new Error("Invitation not found"),
          }),
        })),
      };

      mockSupabaseServerClient.mockResolvedValue(mockSupabase as any);

      const requestBody = {
        invitationId: "nonexistent-invitation",
        response: "accepted",
      };

      const request = createMockPatchRequest(requestBody);
      const response = await PATCH(request as NextRequest);
      const result = await response.json();

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invitation not found or access denied");
      expect(result.status).toBe(404);
    });

    it("should return error if invitation already responded to", async () => {
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: jest.fn().mockImplementation(() => ({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          or: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { ...mockInvitation, status: "accepted" },
            error: null,
          }),
        })),
      };

      mockSupabaseServerClient.mockResolvedValue(mockSupabase as any);

      const requestBody = {
        invitationId: "invitation-1",
        response: "accepted",
      };

      const request = createMockPatchRequest(requestBody);
      const response = await PATCH(request as NextRequest);
      const result = await response.json();

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invitation has already been responded to");
      expect(result.status).toBe(400);
    });

    it("should handle database errors when updating invitation", async () => {
      const mockSupabase = {
        auth: {
          getUser: jest.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
        from: jest.fn().mockImplementation(() => ({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          or: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: mockInvitation,
            error: null,
          }),
          update: jest.fn().mockReturnThis(),
        })),
      };

      // Mock the update operation to fail
      const mockFrom = mockSupabase.from("session_invitations");
      mockFrom.single = jest
        .fn()
        .mockResolvedValueOnce({ data: mockInvitation, error: null })
        .mockResolvedValue(simulateDatabaseError());

      mockSupabaseServerClient.mockResolvedValue(mockSupabase as any);

      const requestBody = {
        invitationId: "invitation-1",
        response: "accepted",
      };

      const request = createMockPatchRequest(requestBody);
      const response = await PATCH(request as NextRequest);
      const result = await response.json();

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to update invitation");
    });
  });

  describe("Error handling", () => {
    it("should handle network errors gracefully", async () => {
      mockSupabaseServerClient.mockRejectedValue(new Error("Network error"));

      const request = createMockRequest({ type: "received" });
      const response = await GET(request as NextRequest);
      const result = await response.json();

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to fetch invitations");
      expect(result.details).toBe("Network error");
    });

    it("should handle malformed JSON in POST requests", async () => {
      const request = new Request("http://localhost:3000/api/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "invalid json",
      });

      const response = await POST(request as NextRequest);
      const result = await response.json();

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to send invitations");
    });
  });
});
