/**
 * @jest-environment node
 */

/**
 * Tests for Session Update API
 * Tests the PATCH /api/sessions/[id] endpoint for updating session details
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
import { PATCH } from "@/app/api/sessions/[id]/route";

describe("PATCH /api/sessions/[id]", () => {
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
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes: "Updated notes" }),
        }
      );

      const response = await PATCH(request, { params: { id: validSessionId } });
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
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes: "Updated notes" }),
        }
      );

      const response = await PATCH(request, { params: { id: invalidSessionId } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Invalid session format");
    });

    it("returns 400 for invalid Content-Type", async () => {
      mockAuthGetUser.mockResolvedValue({
        data: {
          user: { id: validUserId, email: "user@example.com" },
        },
        error: null,
      });

      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${validSessionId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "text/plain" },
          body: "not json",
        }
      );

      const response = await PATCH(request, { params: { id: validSessionId } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it("returns 400 for malformed JSON", async () => {
      mockAuthGetUser.mockResolvedValue({
        data: {
          user: { id: validUserId, email: "user@example.com" },
        },
        error: null,
      });

      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${validSessionId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: "{ invalid json }",
        }
      );

      const response = await PATCH(request, { params: { id: validSessionId } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it("validates max note length (5000 characters)", async () => {
      mockAuthGetUser.mockResolvedValue({
        data: {
          user: { id: validUserId, email: "user@example.com" },
        },
        error: null,
      });

      const longNotes = "a".repeat(5001);

      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${validSessionId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes: longNotes }),
        }
      );

      const response = await PATCH(request, { params: { id: validSessionId } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(typeof data.error).toBe("string");
    });

    it("accepts notes at max length boundary (5000 characters)", async () => {
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

      // Mock update
      const updatedSession = {
        id: validSessionId,
        user_id: validUserId,
        notes: "a".repeat(5000),
        updated_at: new Date().toISOString(),
      };
      const mockUpdateSingle = jest.fn().mockResolvedValue({
        data: updatedSession,
        error: null,
      });
      const mockUpdateSelect = jest.fn().mockReturnValue({
        single: mockUpdateSingle,
      });
      const mockUpdateEq2 = jest.fn().mockReturnValue({
        select: mockUpdateSelect,
      });
      const mockUpdateEq1 = jest.fn().mockReturnValue({ eq: mockUpdateEq2 });
      const mockUpdate = jest.fn().mockReturnValue({ eq: mockUpdateEq1 });

      mockFrom.mockImplementation((table: string) => {
        if (table === "sessions") {
          return {
            select: mockSelect,
            update: mockUpdate,
          };
        }
        return { select: jest.fn(), update: jest.fn() };
      });

      const maxNotes = "a".repeat(5000);
      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${validSessionId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes: maxNotes }),
        }
      );

      const response = await PATCH(request, { params: { id: validSessionId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it("validates rating range (0-5)", async () => {
      mockAuthGetUser.mockResolvedValue({
        data: {
          user: { id: validUserId, email: "user@example.com" },
        },
        error: null,
      });

      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${validSessionId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rating: 6 }),
        }
      );

      const response = await PATCH(request, { params: { id: validSessionId } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it("rejects negative rating", async () => {
      mockAuthGetUser.mockResolvedValue({
        data: {
          user: { id: validUserId, email: "user@example.com" },
        },
        error: null,
      });

      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${validSessionId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rating: -1 }),
        }
      );

      const response = await PATCH(request, { params: { id: validSessionId } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it("rejects immutable session fields", async () => {
      mockAuthGetUser.mockResolvedValue({
        data: {
          user: { id: validUserId, email: "user@example.com" },
        },
        error: null,
      });

      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${validSessionId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ beach_id: validSessionId }),
        }
      );

      const response = await PATCH(request, { params: { id: validSessionId } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it("rejects a future session time", async () => {
      mockAuthGetUser.mockResolvedValue({
        data: {
          user: { id: validUserId, email: "user@example.com" },
        },
        error: null,
      });

      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${validSessionId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ arrival_time: "2999-01-01T12:00:00.000Z" }),
        }
      );

      const response = await PATCH(request, { params: { id: validSessionId } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it("rejects a board that is not owned by the session owner", async () => {
      mockAuthGetUser.mockResolvedValue({
        data: {
          user: { id: validUserId, email: "user@example.com" },
        },
        error: null,
      });
      const boardId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
      const mockOwnershipSingle = jest.fn().mockResolvedValue({
        data: { id: validSessionId, user_id: validUserId },
        error: null,
      });
      const mockOwnershipEq = jest.fn().mockReturnValue({
        single: mockOwnershipSingle,
      });
      const mockOwnershipSelect = jest.fn().mockReturnValue({
        eq: mockOwnershipEq,
      });
      const mockBoardMaybeSingle = jest.fn().mockResolvedValue({
        data: null,
        error: null,
      });
      const mockBoardUserEq = jest.fn().mockReturnValue({
        maybeSingle: mockBoardMaybeSingle,
      });
      const mockBoardIdEq = jest.fn().mockReturnValue({
        eq: mockBoardUserEq,
      });
      const mockBoardSelect = jest.fn().mockReturnValue({
        eq: mockBoardIdEq,
      });
      const mockUpdate = jest.fn();
      mockFrom.mockImplementation((table: string) => {
        if (table === "boards") return { select: mockBoardSelect };
        return {
          select: mockOwnershipSelect,
          update: mockUpdate,
        };
      });

      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${validSessionId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ board_id: boardId }),
        }
      );

      const response = await PATCH(request, { params: { id: validSessionId } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe("Board not found");
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it("accepts rating boundaries (0 and 5)", async () => {
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

      // Mock update
      const updatedSession = {
        id: validSessionId,
        user_id: validUserId,
        rating: 5,
        updated_at: new Date().toISOString(),
      };
      const mockUpdateSingle = jest.fn().mockResolvedValue({
        data: updatedSession,
        error: null,
      });
      const mockUpdateSelect = jest.fn().mockReturnValue({
        single: mockUpdateSingle,
      });
      const mockUpdateEq2 = jest.fn().mockReturnValue({
        select: mockUpdateSelect,
      });
      const mockUpdateEq1 = jest.fn().mockReturnValue({ eq: mockUpdateEq2 });
      const mockUpdate = jest.fn().mockReturnValue({ eq: mockUpdateEq1 });

      mockFrom.mockImplementation((table: string) => {
        if (table === "sessions") {
          return {
            select: mockSelect,
            update: mockUpdate,
          };
        }
        return { select: jest.fn(), update: jest.fn() };
      });

      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${validSessionId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rating: 5 }),
        }
      );

      const response = await PATCH(request, { params: { id: validSessionId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.session.rating).toBe(5);
    });
  });

  describe("Ownership", () => {
    it("rejects update by non-owner", async () => {
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
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes: "Should not work" }),
        }
      );

      const response = await PATCH(request, { params: { id: validSessionId } });
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
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes: "Should not work" }),
        }
      );

      const response = await PATCH(request, { params: { id: validSessionId } });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toContain("not found");
    });
  });

  describe("Successful Updates", () => {
    it("updates the approved session edit fields and derives wave quality", async () => {
      mockAuthGetUser.mockResolvedValue({
        data: {
          user: { id: validUserId, email: "user@example.com" },
        },
        error: null,
      });

      const mockOwnershipSingle = jest.fn().mockResolvedValue({
        data: { id: validSessionId, user_id: validUserId },
        error: null,
      });
      const mockOwnershipEq = jest.fn().mockReturnValue({
        single: mockOwnershipSingle,
      });
      const mockOwnershipSelect = jest.fn().mockReturnValue({
        eq: mockOwnershipEq,
      });
      const updatedSession = {
        id: validSessionId,
        user_id: validUserId,
        wave_quality: 5,
      };
      const mockUpdateSingle = jest.fn().mockResolvedValue({
        data: updatedSession,
        error: null,
      });
      const mockUpdateSelect = jest.fn().mockReturnValue({
        single: mockUpdateSingle,
      });
      const mockUpdateEq2 = jest.fn().mockReturnValue({
        select: mockUpdateSelect,
      });
      const mockUpdateEq1 = jest.fn().mockReturnValue({ eq: mockUpdateEq2 });
      const mockUpdate = jest.fn().mockReturnValue({ eq: mockUpdateEq1 });

      mockFrom.mockReturnValue({
        select: mockOwnershipSelect,
        update: mockUpdate,
      });

      const updates = {
        arrival_time: "2026-07-20T17:30:00.000Z",
        duration_minutes: 90,
        rating: 5,
        wave_height_ft: 4,
        wave_characteristics: ["glassy", "peaky"],
        tide_height_ft: 2.2,
        tide_status: "rising",
        rip_current_observed: "light",
        crowd_level: 3,
        notes: "Clean lines",
        is_public: false,
      };
      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${validSessionId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        }
      );

      const response = await PATCH(request, { params: { id: validSessionId } });

      expect(response.status).toBe(200);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          ...updates,
          wave_quality: 5,
        })
      );
    });

    it("refreshes the board snapshot when the board changes", async () => {
      mockAuthGetUser.mockResolvedValue({
        data: {
          user: { id: validUserId, email: "user@example.com" },
        },
        error: null,
      });
      const boardId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
      const board = {
        name: "Daily Driver",
        board_type: "shortboard",
        size: "6'0",
        volume: 31,
        dimensions: "6'0 x 19 x 2 3/8",
      };
      const mockOwnershipSingle = jest.fn().mockResolvedValue({
        data: { id: validSessionId, user_id: validUserId },
        error: null,
      });
      const mockOwnershipEq = jest.fn().mockReturnValue({
        single: mockOwnershipSingle,
      });
      const mockOwnershipSelect = jest.fn().mockReturnValue({
        eq: mockOwnershipEq,
      });
      const mockBoardMaybeSingle = jest.fn().mockResolvedValue({
        data: board,
        error: null,
      });
      const mockBoardUserEq = jest.fn().mockReturnValue({
        maybeSingle: mockBoardMaybeSingle,
      });
      const mockBoardIdEq = jest.fn().mockReturnValue({
        eq: mockBoardUserEq,
      });
      const mockBoardSelect = jest.fn().mockReturnValue({
        eq: mockBoardIdEq,
      });
      const mockUpdateSingle = jest.fn().mockResolvedValue({
        data: { id: validSessionId, board_id: boardId, board_snapshot: board },
        error: null,
      });
      const mockUpdateSelect = jest.fn().mockReturnValue({
        single: mockUpdateSingle,
      });
      const mockUpdateEq2 = jest.fn().mockReturnValue({
        select: mockUpdateSelect,
      });
      const mockUpdateEq1 = jest.fn().mockReturnValue({ eq: mockUpdateEq2 });
      const mockUpdate = jest.fn().mockReturnValue({ eq: mockUpdateEq1 });

      mockFrom.mockImplementation((table: string) => {
        if (table === "boards") return { select: mockBoardSelect };
        return {
          select: mockOwnershipSelect,
          update: mockUpdate,
        };
      });

      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${validSessionId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ board_id: boardId }),
        }
      );

      const response = await PATCH(request, { params: { id: validSessionId } });

      expect(response.status).toBe(200);
      expect(mockBoardIdEq).toHaveBeenCalledWith("id", boardId);
      expect(mockBoardUserEq).toHaveBeenCalledWith("user_id", validUserId);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          board_id: boardId,
          board_snapshot: board,
        })
      );
    });

    it("clears the board snapshot when the board is removed", async () => {
      mockAuthGetUser.mockResolvedValue({
        data: {
          user: { id: validUserId, email: "user@example.com" },
        },
        error: null,
      });
      const mockOwnershipSingle = jest.fn().mockResolvedValue({
        data: { id: validSessionId, user_id: validUserId },
        error: null,
      });
      const mockOwnershipEq = jest.fn().mockReturnValue({
        single: mockOwnershipSingle,
      });
      const mockOwnershipSelect = jest.fn().mockReturnValue({
        eq: mockOwnershipEq,
      });
      const mockUpdateSingle = jest.fn().mockResolvedValue({
        data: { id: validSessionId, board_id: null, board_snapshot: null },
        error: null,
      });
      const mockUpdateSelect = jest.fn().mockReturnValue({
        single: mockUpdateSingle,
      });
      const mockUpdateEq2 = jest.fn().mockReturnValue({
        select: mockUpdateSelect,
      });
      const mockUpdateEq1 = jest.fn().mockReturnValue({ eq: mockUpdateEq2 });
      const mockUpdate = jest.fn().mockReturnValue({ eq: mockUpdateEq1 });
      mockFrom.mockReturnValue({
        select: mockOwnershipSelect,
        update: mockUpdate,
      });

      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${validSessionId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ board_id: null }),
        }
      );

      const response = await PATCH(request, { params: { id: validSessionId } });

      expect(response.status).toBe(200);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          board_id: null,
          board_snapshot: null,
        })
      );
    });

    it("updates session notes successfully", async () => {
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

      // Mock update
      const updatedSession = {
        id: validSessionId,
        user_id: validUserId,
        notes: "Updated notes",
        updated_at: new Date().toISOString(),
      };
      const mockUpdateSingle = jest.fn().mockResolvedValue({
        data: updatedSession,
        error: null,
      });
      const mockUpdateSelect = jest.fn().mockReturnValue({
        single: mockUpdateSingle,
      });
      const mockUpdateEq2 = jest.fn().mockReturnValue({
        select: mockUpdateSelect,
      });
      const mockUpdateEq1 = jest.fn().mockReturnValue({ eq: mockUpdateEq2 });
      const mockUpdate = jest.fn().mockReturnValue({ eq: mockUpdateEq1 });

      mockFrom.mockImplementation((table: string) => {
        if (table === "sessions") {
          return {
            select: mockSelect,
            update: mockUpdate,
          };
        }
        return { select: jest.fn(), update: jest.fn() };
      });

      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${validSessionId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes: "Updated notes" }),
        }
      );

      const response = await PATCH(request, { params: { id: validSessionId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.session).toMatchObject({
        id: validSessionId,
        notes: "Updated notes",
      });
      expect(data.data.session.notes).toBe("Updated notes");
      expect(mockUpdate).toHaveBeenCalled();
    });

    it("updates session rating (0-5 validation)", async () => {
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

      // Mock update
      const updatedSession = {
        id: validSessionId,
        user_id: validUserId,
        rating: 4,
        updated_at: new Date().toISOString(),
      };
      const mockUpdateSingle = jest.fn().mockResolvedValue({
        data: updatedSession,
        error: null,
      });
      const mockUpdateSelect = jest.fn().mockReturnValue({
        single: mockUpdateSingle,
      });
      const mockUpdateEq2 = jest.fn().mockReturnValue({
        select: mockUpdateSelect,
      });
      const mockUpdateEq1 = jest.fn().mockReturnValue({ eq: mockUpdateEq2 });
      const mockUpdate = jest.fn().mockReturnValue({ eq: mockUpdateEq1 });

      mockFrom.mockImplementation((table: string) => {
        if (table === "sessions") {
          return {
            select: mockSelect,
            update: mockUpdate,
          };
        }
        return { select: jest.fn(), update: jest.fn() };
      });

      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${validSessionId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rating: 4 }),
        }
      );

      const response = await PATCH(request, { params: { id: validSessionId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.session.rating).toBe(4);
    });

    it("updates session visibility (public/private)", async () => {
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

      // Mock update
      const updatedSession = {
        id: validSessionId,
        user_id: validUserId,
        is_public: false,
        updated_at: new Date().toISOString(),
      };
      const mockUpdateSingle = jest.fn().mockResolvedValue({
        data: updatedSession,
        error: null,
      });
      const mockUpdateSelect = jest.fn().mockReturnValue({
        single: mockUpdateSingle,
      });
      const mockUpdateEq2 = jest.fn().mockReturnValue({
        select: mockUpdateSelect,
      });
      const mockUpdateEq1 = jest.fn().mockReturnValue({ eq: mockUpdateEq2 });
      const mockUpdate = jest.fn().mockReturnValue({ eq: mockUpdateEq1 });

      mockFrom.mockImplementation((table: string) => {
        if (table === "sessions") {
          return {
            select: mockSelect,
            update: mockUpdate,
          };
        }
        return { select: jest.fn(), update: jest.fn() };
      });

      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${validSessionId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_public: false }),
        }
      );

      const response = await PATCH(request, { params: { id: validSessionId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.session.is_public).toBe(false);
    });

    it("updates multiple fields simultaneously", async () => {
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

      // Mock update
      const updatedSession = {
        id: validSessionId,
        user_id: validUserId,
        notes: "Great session!",
        rating: 5,
        is_public: true,
        updated_at: new Date().toISOString(),
      };
      const mockUpdateSingle = jest.fn().mockResolvedValue({
        data: updatedSession,
        error: null,
      });
      const mockUpdateSelect = jest.fn().mockReturnValue({
        single: mockUpdateSingle,
      });
      const mockUpdateEq2 = jest.fn().mockReturnValue({
        select: mockUpdateSelect,
      });
      const mockUpdateEq1 = jest.fn().mockReturnValue({ eq: mockUpdateEq2 });
      const mockUpdate = jest.fn().mockReturnValue({ eq: mockUpdateEq1 });

      mockFrom.mockImplementation((table: string) => {
        if (table === "sessions") {
          return {
            select: mockSelect,
            update: mockUpdate,
          };
        }
        return { select: jest.fn(), update: jest.fn() };
      });

      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${validSessionId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            notes: "Great session!",
            rating: 5,
            is_public: true,
          }),
        }
      );

      const response = await PATCH(request, { params: { id: validSessionId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.session.notes).toBe("Great session!");
      expect(data.data.session.rating).toBe(5);
      expect(data.data.session.is_public).toBe(true);
    });

    it("does not reference the nonexistent sessions.updated_at column", async () => {
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

      // Mock update
      const updatedSession = {
        id: validSessionId,
        user_id: validUserId,
        notes: "Updated",
      };
      const mockUpdateSingle = jest.fn().mockResolvedValue({
        data: updatedSession,
        error: null,
      });
      const mockUpdateSelect = jest.fn().mockReturnValue({
        single: mockUpdateSingle,
      });
      const mockUpdateEq2 = jest.fn().mockReturnValue({
        select: mockUpdateSelect,
      });
      const mockUpdateEq1 = jest.fn().mockReturnValue({ eq: mockUpdateEq2 });
      const mockUpdate = jest.fn().mockReturnValue({ eq: mockUpdateEq1 });

      mockFrom.mockImplementation((table: string) => {
        if (table === "sessions") {
          return {
            select: mockSelect,
            update: mockUpdate,
          };
        }
        return { select: jest.fn(), update: jest.fn() };
      });

      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${validSessionId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes: "Updated" }),
        }
      );

      const response = await PATCH(request, { params: { id: validSessionId } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockUpdate).toHaveBeenCalledWith({ notes: "Updated" });
      expect(mockUpdateSelect).toHaveBeenCalledWith(
        expect.not.stringContaining("updated_at")
      );
    });
  });

  describe("Error Handling", () => {
    it("handles database update errors gracefully", async () => {
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

      // Mock update error
      const mockUpdateSingle = jest.fn().mockResolvedValue({
        data: null,
        error: new Error("Database constraint violation"),
      });
      const mockUpdateSelect = jest.fn().mockReturnValue({
        single: mockUpdateSingle,
      });
      const mockUpdateEq2 = jest.fn().mockReturnValue({
        select: mockUpdateSelect,
      });
      const mockUpdateEq1 = jest.fn().mockReturnValue({ eq: mockUpdateEq2 });
      const mockUpdate = jest.fn().mockReturnValue({ eq: mockUpdateEq1 });

      mockFrom.mockImplementation((table: string) => {
        if (table === "sessions") {
          return {
            select: mockSelect,
            update: mockUpdate,
          };
        }
        return { select: jest.fn(), update: jest.fn() };
      });

      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${validSessionId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes: "Should fail" }),
        }
      );

      const response = await PATCH(request, { params: { id: validSessionId } });
      const data = await response.json();

      // Database errors are genuine server errors - 500 is correct
      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Failed to update session");
    });
  });
});
