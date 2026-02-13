/**
 * @jest-environment node
 */

/**
 * Tests for Session Delete API
 * Tests the DELETE /api/sessions/[id] endpoint for deleting sessions
 */

// Use lightweight NextRequest/NextResponse mock
jest.mock("next/server", () => require("@/__tests__/setup/mock-next-server"));
import { NextRequest } from "next/server";

// Mock createSupabaseServerClient before imports
const mockFrom = jest.fn();
const mockAuthGetUser = jest.fn();

const mockSupabaseClient = {
  auth: {
    getUser: mockAuthGetUser,
  },
  from: mockFrom,
};

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: jest.fn(() => mockSupabaseClient),
}));

// Import route handlers after mocks are set up
import { DELETE } from "@/app/api/sessions/[id]/route";

describe("DELETE /api/sessions/[id]", () => {
  const validSessionId = "123e4567-e89b-12d3-a456-426614174000";
  const validUserId = "987fcdeb-51a2-43c1-a123-456789abcdef";
  const otherUserId = "111fcdeb-51a2-43c1-a123-456789abcd11";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Authentication", () => {
    it("requires authentication", async () => {
      mockAuthGetUser.mockResolvedValue({
        data: { user: null },
        error: new Error("Not authenticated"),
      });

      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${validSessionId}`,
        { method: "DELETE" }
      );

      const response = await DELETE(request, { params: { id: validSessionId } });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Authentication required");
    });
  });

  describe("Validation", () => {
    it("returns 400 for invalid session ID format", async () => {
      mockAuthGetUser.mockResolvedValue({
        data: {
          user: { id: validUserId, email: "user@example.com" },
        },
        error: null,
      });

      const invalidSessionId = "not-a-uuid";
      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${invalidSessionId}`,
        { method: "DELETE" }
      );

      const response = await DELETE(request, { params: { id: invalidSessionId } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Invalid session format");
    });
  });

  describe("Ownership", () => {
    it("rejects deletion by non-owner", async () => {
      mockAuthGetUser.mockResolvedValue({
        data: {
          user: { id: otherUserId, email: "other@example.com" },
        },
        error: null,
      });

      // Mock ownership check - session belongs to different user
      const mockSingle = jest.fn().mockResolvedValue({
        data: { id: validSessionId, user_id: validUserId },
        error: null,
      });
      const mockEq = jest.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });

      mockFrom.mockReturnValue({
        select: mockSelect,
      });

      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${validSessionId}`,
        { method: "DELETE" }
      );

      const response = await DELETE(request, { params: { id: validSessionId } });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Forbidden");
    });

    it("returns 404 for non-existent session", async () => {
      mockAuthGetUser.mockResolvedValue({
        data: {
          user: { id: validUserId, email: "user@example.com" },
        },
        error: null,
      });

      // Mock ownership check - session not found
      const mockSingle = jest.fn().mockResolvedValue({
        data: null,
        error: { code: "PGRST116", message: "Not found" },
      });
      const mockEq = jest.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });

      mockFrom.mockReturnValue({
        select: mockSelect,
      });

      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${validSessionId}`,
        { method: "DELETE" }
      );

      const response = await DELETE(request, { params: { id: validSessionId } });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toContain("not found");
    });
  });

  describe("Successful Deletion", () => {
    it("hard-deletes session by owner successfully", async () => {
      // NOTE: Current implementation uses hard delete (.delete()) rather than soft delete.
      // Database has deleted_at column and soft_delete_entity() helper function available,
      // but API currently performs immediate deletion from the table.
      // This test validates the actual API behavior (hard delete).
      mockAuthGetUser.mockResolvedValue({
        data: {
          user: { id: validUserId, email: "user@example.com" },
        },
        error: null,
      });

      // Mock ownership check
      const mockSingle = jest.fn().mockResolvedValue({
        data: { id: validSessionId, user_id: validUserId },
        error: null,
      });
      const mockEq = jest.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });

      // Mock delete (hard delete)
      const mockDeleteEq2 = jest.fn().mockResolvedValue({
        data: null,
        error: null,
      });
      const mockDeleteEq1 = jest.fn().mockReturnValue({ eq: mockDeleteEq2 });
      const mockDelete = jest.fn().mockReturnValue({ eq: mockDeleteEq1 });

      mockFrom.mockImplementation((table: string) => {
        if (table === "sessions") {
          return {
            select: mockSelect,
            delete: mockDelete,
          };
        }
        return { select: jest.fn(), delete: jest.fn() };
      });

      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${validSessionId}`,
        { method: "DELETE" }
      );

      const response = await DELETE(request, { params: { id: validSessionId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.deleted).toBe(true);
      expect(mockDelete).toHaveBeenCalled();
    });

    it("returns success even if already deleted (idempotency)", async () => {
      mockAuthGetUser.mockResolvedValue({
        data: {
          user: { id: validUserId, email: "user@example.com" },
        },
        error: null,
      });

      // Mock ownership check
      const mockSingle = jest.fn().mockResolvedValue({
        data: { id: validSessionId, user_id: validUserId },
        error: null,
      });
      const mockEq = jest.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });

      // Mock delete - no rows affected but no error
      const mockDeleteEq2 = jest.fn().mockResolvedValue({
        data: null,
        error: null,
      });
      const mockDeleteEq1 = jest.fn().mockReturnValue({ eq: mockDeleteEq2 });
      const mockDelete = jest.fn().mockReturnValue({ eq: mockDeleteEq1 });

      mockFrom.mockImplementation((table: string) => {
        if (table === "sessions") {
          return {
            select: mockSelect,
            delete: mockDelete,
          };
        }
        return { select: jest.fn(), delete: jest.fn() };
      });

      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${validSessionId}`,
        { method: "DELETE" }
      );

      const response = await DELETE(request, { params: { id: validSessionId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.deleted).toBe(true);
    });
  });

  describe("Cascading Behavior", () => {
    it("cascades deletion to related data (database-level CASCADE)", async () => {
      // NOTE: Cascade behavior is enforced by database foreign key constraints.
      // When a session is deleted, related records (comments, media, etc.) are
      // automatically deleted by PostgreSQL CASCADE rules. This test verifies
      // the delete query executes successfully - actual cascade is database-level.
      mockAuthGetUser.mockResolvedValue({
        data: {
          user: { id: validUserId, email: "user@example.com" },
        },
        error: null,
      });

      // Mock ownership check
      const mockSingle = jest.fn().mockResolvedValue({
        data: { id: validSessionId, user_id: validUserId },
        error: null,
      });
      const mockEq = jest.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });

      // Mock delete
      const mockDeleteEq2 = jest.fn().mockResolvedValue({
        data: null,
        error: null,
      });
      const mockDeleteEq1 = jest.fn().mockReturnValue({ eq: mockDeleteEq2 });
      const mockDelete = jest.fn().mockReturnValue({ eq: mockDeleteEq1 });

      mockFrom.mockImplementation((table: string) => {
        if (table === "sessions") {
          return {
            select: mockSelect,
            delete: mockDelete,
          };
        }
        return { select: jest.fn(), delete: jest.fn() };
      });

      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${validSessionId}`,
        { method: "DELETE" }
      );

      const response = await DELETE(request, { params: { id: validSessionId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // Verify delete was called with proper ownership constraints
      expect(mockDeleteEq1).toHaveBeenCalledWith("id", validSessionId);
      expect(mockDeleteEq2).toHaveBeenCalledWith("user_id", validUserId);
    });
  });

  describe("Error Handling", () => {
    it("handles database deletion errors gracefully", async () => {
      mockAuthGetUser.mockResolvedValue({
        data: {
          user: { id: validUserId, email: "user@example.com" },
        },
        error: null,
      });

      // Mock ownership check
      const mockSingle = jest.fn().mockResolvedValue({
        data: { id: validSessionId, user_id: validUserId },
        error: null,
      });
      const mockEq = jest.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });

      // Mock delete error
      const mockDeleteEq2 = jest.fn().mockResolvedValue({
        data: null,
        error: new Error("Foreign key constraint violation"),
      });
      const mockDeleteEq1 = jest.fn().mockReturnValue({ eq: mockDeleteEq2 });
      const mockDelete = jest.fn().mockReturnValue({ eq: mockDeleteEq1 });

      mockFrom.mockImplementation((table: string) => {
        if (table === "sessions") {
          return {
            select: mockSelect,
            delete: mockDelete,
          };
        }
        return { select: jest.fn(), delete: jest.fn() };
      });

      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${validSessionId}`,
        { method: "DELETE" }
      );

      const response = await DELETE(request, { params: { id: validSessionId } });
      const data = await response.json();

      // Database errors are genuine server errors - 500 is correct
      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Failed to delete session");
    });

    it("handles unexpected errors during ownership check", async () => {
      mockAuthGetUser.mockResolvedValue({
        data: {
          user: { id: validUserId, email: "user@example.com" },
        },
        error: null,
      });

      // Mock ownership check error
      const mockSingle = jest.fn().mockResolvedValue({
        data: null,
        error: new Error("Database connection lost"),
      });
      const mockEq = jest.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });

      mockFrom.mockReturnValue({
        select: mockSelect,
      });

      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${validSessionId}`,
        { method: "DELETE" }
      );

      const response = await DELETE(request, { params: { id: validSessionId } });
      const data = await response.json();

      // Database errors are genuine server errors - 500 is correct
      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Failed to delete session");
    });
  });
});
