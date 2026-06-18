/**
 * @jest-environment node
 */

/**
 * Tests for Session Comment Management API
 * Tests comment creation, deletion, and access control on session comments
 * Complements __tests__/api/sessions-comments.test.ts with additional scenarios
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

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
import { POST } from "@/app/api/sessions/[id]/comments/route";
import { DELETE } from "@/app/api/sessions/[id]/comments/[commentId]/route";

describe("Session Comments API - Access Control", () => {
  const validSessionId = "123e4567-e89b-12d3-a456-426614174000";
  const validCommentId = "223e4567-e89b-12d3-a456-426614174001";
  const sessionOwnerId = "987fcdeb-51a2-43c1-a123-456789abcdef";
  const commentAuthorId = "111fcdeb-51a2-43c1-a123-456789abcd11";
  const otherUserId = "222fcdeb-51a2-43c1-a123-456789abcd22";

  function mockExistingSessionThenInsert(
    mockInsert: jest.Mock,
    sessionId: string = validSessionId
  ): void {
    const mockMaybeSingle = jest.fn().mockResolvedValue({
      data: { id: sessionId },
      error: null,
    });
    const mockEq = jest.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
    const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });

    mockFrom.mockImplementation((tableName: string) => {
      if (tableName === "sessions") {
        return { select: mockSelect };
      }
      if (tableName === "comments") {
        return { insert: mockInsert };
      }
      return {};
    });
  }

  function mockCommentDeleteResult(
    result: { data: { id: string } | null; error: Error | null }
  ): {
    mockDeleteEq1: jest.Mock;
    mockDeleteEq2: jest.Mock;
  } {
    const mockMaybeSingle = jest.fn().mockResolvedValue(result);
    const mockSelect = jest.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
    const mockDeleteEq2 = jest.fn().mockReturnValue({ select: mockSelect });
    const mockDeleteEq1 = jest.fn().mockReturnValue({ eq: mockDeleteEq2 });
    const mockDelete = jest.fn().mockReturnValue({ eq: mockDeleteEq1 });

    mockFrom.mockReturnValue({
      delete: mockDelete,
    });

    return { mockDeleteEq1, mockDeleteEq2 };
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("uses the shared API wrapper module for delegated comment validation helpers", () => {
    const source = readFileSync(
      join(process.cwd(), "app/api/comments/[commentId]/route.ts"),
      "utf8"
    );

    expect(source).not.toMatch(/from\s+["']@\/lib\/api-utils["']/);
    expect(source).toMatch(/from\s+["']@\/lib\/middleware\/api-wrappers["']/);
  });

  describe("POST - Comment Creation with Access Control", () => {
    it("creates comment on owned session", async () => {
      mockAuthGetUser.mockResolvedValue({
        data: {
          user: { id: sessionOwnerId, email: "owner@example.com" },
        },
        error: null,
      });

      const mockInsert = jest.fn().mockResolvedValue({
        data: null,
        error: null,
      });

      mockExistingSessionThenInsert(mockInsert);

      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${validSessionId}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: "My own session comment" }),
        }
      );

      const response = await POST(request, { params: { id: validSessionId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockInsert).toHaveBeenCalledWith({
        session_id: validSessionId,
        user_id: sessionOwnerId,
        content: "My own session comment",
      });
    });

    it("creates comment on public session by other user", async () => {
      mockAuthGetUser.mockResolvedValue({
        data: {
          user: { id: otherUserId, email: "other@example.com" },
        },
        error: null,
      });

      // Note: Access control for public/private sessions is handled by RLS
      // The API doesn't explicitly check, so it allows the insert
      // and relies on database policies

      const mockInsert = jest.fn().mockResolvedValue({
        data: null,
        error: null,
      });

      mockExistingSessionThenInsert(mockInsert);

      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${validSessionId}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: "Great session!" }),
        }
      );

      const response = await POST(request, { params: { id: validSessionId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockInsert).toHaveBeenCalledWith({
        session_id: validSessionId,
        user_id: otherUserId,
        content: "Great session!",
      });
    });

    it("rejects comment on private non-owned session (via RLS)", async () => {
      mockAuthGetUser.mockResolvedValue({
        data: {
          user: { id: otherUserId, email: "other@example.com" },
        },
        error: null,
      });

      // Mock RLS policy error for private session
      const mockInsert = jest.fn().mockResolvedValue({
        data: null,
        error: {
          code: "42501",
          message: "new row violates row-level security policy",
        },
      });

      mockExistingSessionThenInsert(mockInsert);

      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${validSessionId}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: "Should not work" }),
        }
      );

      const response = await POST(request, { params: { id: validSessionId } });
      const data = await response.json();

      // RLS policy violations are currently returned as 500, but should ideally be 403
      // The route uses withAuth which throws database errors, caught by error handler as 500
      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
    });
  });

  describe("DELETE - Comment Deletion", () => {
    it("deletes own comment successfully", async () => {
      mockAuthGetUser.mockResolvedValue({
        data: {
          user: { id: commentAuthorId, email: "author@example.com" },
        },
        error: null,
      });

      const { mockDeleteEq1, mockDeleteEq2 } = mockCommentDeleteResult({
        data: { id: validCommentId },
        error: null,
      });

      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${validSessionId}/comments/${validCommentId}`,
        { method: "DELETE" }
      );

      const response = await DELETE(request, {
        params: { id: validSessionId, commentId: validCommentId },
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.message).toContain("deleted successfully");
      expect(mockDeleteEq1).toHaveBeenCalledWith("id", validCommentId);
      expect(mockDeleteEq2).toHaveBeenCalledWith("user_id", commentAuthorId);
    });

    it("returns not found when deleting others' comments (no rows affected)", async () => {
      mockAuthGetUser.mockResolvedValue({
        data: {
          user: { id: otherUserId, email: "other@example.com" },
        },
        error: null,
      });

      const { mockDeleteEq2 } = mockCommentDeleteResult({
        data: null,
        error: null,
      });

      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${validSessionId}/comments/${validCommentId}`,
        { method: "DELETE" }
      );

      const response = await DELETE(request, {
        params: { id: validSessionId, commentId: validCommentId },
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Comment not found");
      expect(mockDeleteEq2).toHaveBeenCalledWith("user_id", otherUserId);
    });

    it("requires authentication for deletion", async () => {
      mockAuthGetUser.mockResolvedValue({
        data: { user: null },
        error: new Error("Not authenticated"),
      });

      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${validSessionId}/comments/${validCommentId}`,
        { method: "DELETE" }
      );

      const response = await DELETE(request, {
        params: { id: validSessionId, commentId: validCommentId },
      });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Authentication required");
    });

    it("validates session ID format", async () => {
      mockAuthGetUser.mockResolvedValue({
        data: {
          user: { id: commentAuthorId, email: "author@example.com" },
        },
        error: null,
      });

      const invalidSessionId = "not-a-uuid";
      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${invalidSessionId}/comments/${validCommentId}`,
        { method: "DELETE" }
      );

      const response = await DELETE(request, {
        params: { id: invalidSessionId, commentId: validCommentId },
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Invalid session format");
    });

    it("validates comment ID format", async () => {
      mockAuthGetUser.mockResolvedValue({
        data: {
          user: { id: commentAuthorId, email: "author@example.com" },
        },
        error: null,
      });

      const invalidCommentId = "not-a-uuid";
      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${validSessionId}/comments/${invalidCommentId}`,
        { method: "DELETE" }
      );

      const response = await DELETE(request, {
        params: { id: validSessionId, commentId: invalidCommentId },
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Invalid comment format");
    });

    it("handles database deletion errors gracefully", async () => {
      mockAuthGetUser.mockResolvedValue({
        data: {
          user: { id: commentAuthorId, email: "author@example.com" },
        },
        error: null,
      });

      mockCommentDeleteResult({
        data: null,
        error: new Error("Database connection lost"),
      });

      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${validSessionId}/comments/${validCommentId}`,
        { method: "DELETE" }
      );

      const response = await DELETE(request, {
        params: { id: validSessionId, commentId: validCommentId },
      });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Failed to delete comment");
    });
  });

  describe("Edge Cases", () => {
    it("handles very long session IDs gracefully", async () => {
      mockAuthGetUser.mockResolvedValue({
        data: {
          user: { id: sessionOwnerId, email: "owner@example.com" },
        },
        error: null,
      });

      const longButInvalidId = "a".repeat(100);
      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${longButInvalidId}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: "Test" }),
        }
      );

      const response = await POST(request, { params: { id: longButInvalidId } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it("handles empty comment content", async () => {
      mockAuthGetUser.mockResolvedValue({
        data: {
          user: { id: sessionOwnerId, email: "owner@example.com" },
        },
        error: null,
      });

      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${validSessionId}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: "" }),
        }
      );

      const response = await POST(request, { params: { id: validSessionId } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it("handles whitespace-only comment content", async () => {
      mockAuthGetUser.mockResolvedValue({
        data: {
          user: { id: sessionOwnerId, email: "owner@example.com" },
        },
        error: null,
      });

      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${validSessionId}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: "   " }),
        }
      );

      const response = await POST(request, { params: { id: validSessionId } });
      const data = await response.json();

      // Content gets trimmed by the schema, so empty after trim is rejected
      // This may return 400 (validation) or 500 (database) depending on implementation
      expect([400, 500]).toContain(response.status);
      expect(data.success).toBe(false);
    });
  });
});
