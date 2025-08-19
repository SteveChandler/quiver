import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/session-planner/invitations/route";
import { createAPIServerClient } from "@/lib/supabase/api-server-client";

// Mock dependencies
jest.mock("@/lib/supabase/api-server-client", () => ({
  createAPIServerClient: jest.fn(),
}));

jest.mock("@/lib/api-utils", () => ({
  createSuccessResponse: jest.fn((data) => ({
    json: () => Promise.resolve({ success: true, data }),
  })),
  createErrorResponse: jest.fn((message, details, status = 500) => ({
    json: () => Promise.resolve({ success: false, error: message, details }),
  })),
}));

describe("/api/session-planner/invitations", () => {
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockSupabase = {
      auth: {
        getUser: jest.fn(),
      },
      from: jest.fn(),
    };

    (createAPIServerClient as jest.Mock).mockReturnValue(mockSupabase);
  });

  describe("GET endpoint", () => {
    describe("type=friends", () => {
      it("should return user's friends list when authenticated", async () => {
        // Mock authenticated user
        mockSupabase.auth.getUser.mockResolvedValue({
          data: { user: { id: "user-123", email: "test@example.com" } },
          error: null,
        });

        // Mock friends query
        const mockFriendsData = [
          { following: { id: "friend-1", full_name: "John Doe" } },
          { following: { id: "friend-2", full_name: "Jane Smith" } },
        ];

        mockSupabase.from.mockReturnValue({
          select: () => ({
            eq: () => ({
              limit: () => ({ data: mockFriendsData, error: null }),
            }),
          }),
        });

        const request = new NextRequest("http://localhost:3000/api/session-planner/invitations?type=friends");
        const response = await GET(request);
        const data = await response.json();

        expect(data.success).toBe(true);
        expect(data.data).toHaveLength(2);
        expect(data.data[0].full_name).toBe("John Doe");
        expect(data.data[1].full_name).toBe("Jane Smith");
      });

      it("should return empty array when user has no friends", async () => {
        // Mock authenticated user
        mockSupabase.auth.getUser.mockResolvedValue({
          data: { user: { id: "user-123", email: "test@example.com" } },
          error: null,
        });

        // Mock empty friends query
        mockSupabase.from.mockReturnValue({
          select: () => ({
            eq: () => ({
              limit: () => ({ data: [], error: null }),
            }),
          }),
        });

        const request = new NextRequest("http://localhost:3000/api/session-planner/invitations?type=friends");
        const response = await GET(request);
        const data = await response.json();

        expect(data.success).toBe(true);
        expect(data.data).toEqual([]);
      });

      it("should handle database errors gracefully", async () => {
        // Mock authenticated user
        mockSupabase.auth.getUser.mockResolvedValue({
          data: { user: { id: "user-123", email: "test@example.com" } },
          error: null,
        });

        // Mock database error
        mockSupabase.from.mockReturnValue({
          select: () => ({
            eq: () => ({
              limit: () => ({ data: null, error: { message: "Database error" } }),
            }),
          }),
        });

        const request = new NextRequest("http://localhost:3000/api/session-planner/invitations?type=friends");
        const response = await GET(request);
        const data = await response.json();

        expect(data.success).toBe(false);
        expect(data.error).toBe("Failed to fetch friends");
      });

      it("should require authentication", async () => {
        // Mock unauthenticated user
        mockSupabase.auth.getUser.mockResolvedValue({
          data: { user: null },
          error: { message: "No user" },
        });

        const request = new NextRequest("http://localhost:3000/api/session-planner/invitations?type=friends");
        const response = await GET(request);
        const data = await response.json();

        expect(data.success).toBe(false);
        expect(data.error).toBe("Authentication required");
      });
    });

    describe("type=sent", () => {
      it("should return sent invitations", async () => {
        // Mock authenticated user
        mockSupabase.auth.getUser.mockResolvedValue({
          data: { user: { id: "user-123", email: "test@example.com" } },
          error: null,
        });

        // Mock sent invitations query
        const mockInvitations = [
          {
            id: "invitation-1",
            status: "pending",
            message: "Let's surf!",
            created_at: "2025-08-19T12:00:00Z",
            session: { id: "session-1", beach_name: "Ocean Beach", arrival_time: "2025-08-20T06:00:00Z" },
            inviter: { id: "user-123", full_name: "Test User", email: "test@example.com" }
          }
        ];

        mockSupabase.from.mockReturnValue({
          select: () => ({
            eq: () => ({
              order: () => ({ data: mockInvitations, error: null }),
            }),
          }),
        });

        const request = new NextRequest("http://localhost:3000/api/session-planner/invitations?type=sent");
        const response = await GET(request);
        const data = await response.json();

        expect(data.success).toBe(true);
        expect(data.data.invitations).toHaveLength(1);
        expect(data.data.invitations[0].message).toBe("Let's surf!");
      });
    });

    describe("type=received", () => {
      it("should return received invitations", async () => {
        // Mock authenticated user
        mockSupabase.auth.getUser.mockResolvedValue({
          data: { user: { id: "user-123", email: "test@example.com" } },
          error: null,
        });

        // Mock received invitations queries (by ID and by email)
        const mockInvitationsById = [
          {
            id: "invitation-1",
            status: "pending",
            session: { id: "session-1", beach_name: "Blacks" }
          }
        ];

        const mockInvitationsByEmail = [];

        // Mock the sequential queries
        mockSupabase.from.mockReturnValueOnce({
          select: () => ({
            eq: () => ({
              order: () => ({ data: mockInvitationsById, error: null }),
            }),
          }),
        });

        mockSupabase.from.mockReturnValueOnce({
          select: () => ({
            eq: () => ({
              order: () => ({ data: mockInvitationsByEmail, error: null }),
            }),
          }),
        });

        const request = new NextRequest("http://localhost:3000/api/session-planner/invitations?type=received");
        const response = await GET(request);
        const data = await response.json();

        expect(data.success).toBe(true);
        expect(data.data.invitations).toHaveLength(1);
      });
    });
  });

  describe("POST endpoint", () => {
    it("should send invitations to friends", async () => {
      // Mock authenticated user
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: "user-123", email: "test@example.com" } },
        error: null,
      });

      // Mock session ownership verification
      mockSupabase.from.mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            eq: () => ({
              single: () => ({ 
                data: { 
                  id: "session-123", 
                  user_id: "user-123", 
                  status: "planned" 
                }, 
                error: null 
              }),
            }),
          }),
        }),
      });

      // Mock existing invitation check (none exists)
      mockSupabase.from.mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            eq: () => ({
              single: () => ({ data: null, error: null }),
            }),
          }),
        }),
      });

      // Mock invitation creation
      mockSupabase.from.mockReturnValueOnce({
        insert: () => ({
          select: () => ({
            single: () => ({ 
              data: { id: "invitation-123" }, 
              error: null 
            }),
          }),
        }),
      });

      const requestBody = {
        sessionId: "session-123",
        invitees: [{ userId: "friend-1", name: "John Doe" }],
        message: "Let's surf together!"
      };

      const request = new NextRequest("http://localhost:3000/api/session-planner/invitations", {
        method: "POST",
        body: JSON.stringify(requestBody),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.success).toBe(true);
      expect(data.data.invitations).toHaveLength(1);
    });

    it("should validate required fields", async () => {
      const request = new NextRequest("http://localhost:3000/api/session-planner/invitations", {
        method: "POST",
        body: JSON.stringify({}),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.error).toContain("Session ID and invitees are required");
    });

    it("should verify session ownership", async () => {
      // Mock authenticated user
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: "user-123", email: "test@example.com" } },
        error: null,
      });

      // Mock session not found or not owned
      mockSupabase.from.mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            eq: () => ({
              single: () => ({ data: null, error: null }),
            }),
          }),
        }),
      });

      const requestBody = {
        sessionId: "session-123",
        invitees: [{ userId: "friend-1" }],
      };

      const request = new NextRequest("http://localhost:3000/api/session-planner/invitations", {
        method: "POST", 
        body: JSON.stringify(requestBody),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.error).toContain("Session not found or access denied");
    });

    it("should only allow invitations to planned sessions", async () => {
      // Mock authenticated user
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: { id: "user-123", email: "test@example.com" } },
        error: null,
      });

      // Mock completed session (not planned)
      mockSupabase.from.mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            eq: () => ({
              single: () => ({ 
                data: { 
                  id: "session-123", 
                  user_id: "user-123", 
                  status: "completed" 
                }, 
                error: null 
              }),
            }),
          }),
        }),
      });

      const requestBody = {
        sessionId: "session-123",
        invitees: [{ userId: "friend-1" }],
      };

      const request = new NextRequest("http://localhost:3000/api/session-planner/invitations", {
        method: "POST",
        body: JSON.stringify(requestBody),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(data.success).toBe(false);
      expect(data.error).toContain("Can only invite friends to planned sessions");
    });
  });
});
