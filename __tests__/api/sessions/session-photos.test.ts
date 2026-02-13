/**
 * @jest-environment node
 */

/**
 * Tests for Session Photos API
 * Tests the GET /api/sessions/[id]/photos endpoint for retrieving session photos
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

// Mock getSessionPhotos helper
jest.mock("@/lib/supabase/storage", () => ({
  getSessionPhotos: jest.fn(),
}));

// Import route handlers after mocks are set up
import { GET } from "@/app/api/sessions/[id]/photos/route";
import { getSessionPhotos as mockGetSessionPhotos } from "@/lib/supabase/storage";

describe("GET /api/sessions/[id]/photos", () => {
  const validSessionId = "123e4567-e89b-12d3-a456-426614174000";
  const sessionOwnerId = "987fcdeb-51a2-43c1-a123-456789abcdef";
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
        `http://localhost:3000/api/sessions/${validSessionId}/photos`,
        { method: "GET" }
      );

      const response = await GET(request, { params: Promise.resolve({ id: validSessionId }) });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Authentication required");
    });
  });

  describe("Validation", () => {
    it("validates session ID format", async () => {
      mockAuthGetUser.mockResolvedValue({
        data: {
          user: { id: sessionOwnerId, email: "owner@example.com" },
        },
        error: null,
      });

      const invalidSessionId = "not-a-uuid";
      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${invalidSessionId}/photos`,
        { method: "GET" }
      );

      const response = await GET(request, { params: Promise.resolve({ id: invalidSessionId }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Invalid session id format");
    });
  });

  describe("Access Control", () => {
    it("allows owner to view photos", async () => {
      mockAuthGetUser.mockResolvedValue({
        data: {
          user: { id: sessionOwnerId, email: "owner@example.com" },
        },
        error: null,
      });

      // Mock session check - owned by user
      const mockSingle = jest.fn().mockResolvedValue({
        data: {
          id: validSessionId,
          user_id: sessionOwnerId,
          is_public: false,
        },
        error: null,
      });
      const mockEq = jest.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });

      mockFrom.mockReturnValue({
        select: mockSelect,
      });

      // Mock photos
      const mockPhotos = [
        {
          id: "photo-1",
          url: "https://example.com/photo1.jpg",
          created_at: "2024-01-01T12:00:00Z",
        },
        {
          id: "photo-2",
          url: "https://example.com/photo2.jpg",
          created_at: "2024-01-01T13:00:00Z",
        },
      ];
      (mockGetSessionPhotos as jest.Mock).mockResolvedValue(mockPhotos);

      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${validSessionId}/photos`,
        { method: "GET" }
      );

      const response = await GET(request, { params: Promise.resolve({ id: validSessionId }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.photos).toHaveLength(2);
      expect(mockGetSessionPhotos).toHaveBeenCalledWith(
        validSessionId,
        mockSupabaseClient
      );
    });

    it("allows other users to view public session photos", async () => {
      mockAuthGetUser.mockResolvedValue({
        data: {
          user: { id: otherUserId, email: "other@example.com" },
        },
        error: null,
      });

      // Mock session check - public session
      const mockSingle = jest.fn().mockResolvedValue({
        data: {
          id: validSessionId,
          user_id: sessionOwnerId,
          is_public: true,
        },
        error: null,
      });
      const mockEq = jest.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });

      mockFrom.mockReturnValue({
        select: mockSelect,
      });

      const mockPhotos = [
        {
          id: "photo-1",
          url: "https://example.com/photo1.jpg",
          created_at: "2024-01-01T12:00:00Z",
        },
      ];
      (mockGetSessionPhotos as jest.Mock).mockResolvedValue(mockPhotos);

      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${validSessionId}/photos`,
        { method: "GET" }
      );

      const response = await GET(request, { params: Promise.resolve({ id: validSessionId }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.photos).toHaveLength(1);
    });

    it("rejects access to private session photos by non-owner", async () => {
      mockAuthGetUser.mockResolvedValue({
        data: {
          user: { id: otherUserId, email: "other@example.com" },
        },
        error: null,
      });

      // Mock session check - private session, different owner
      const mockSingle = jest.fn().mockResolvedValue({
        data: {
          id: validSessionId,
          user_id: sessionOwnerId,
          is_public: false,
        },
        error: null,
      });
      const mockEq = jest.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });

      mockFrom.mockReturnValue({
        select: mockSelect,
      });

      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${validSessionId}/photos`,
        { method: "GET" }
      );

      const response = await GET(request, { params: Promise.resolve({ id: validSessionId }) });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Forbidden");
    });

    it("returns 404 for non-existent session", async () => {
      mockAuthGetUser.mockResolvedValue({
        data: {
          user: { id: sessionOwnerId, email: "owner@example.com" },
        },
        error: null,
      });

      // Mock session check - not found
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
        `http://localhost:3000/api/sessions/${validSessionId}/photos`,
        { method: "GET" }
      );

      const response = await GET(request, { params: Promise.resolve({ id: validSessionId }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Session not found");
    });
  });

  describe("Photo Retrieval", () => {
    it("returns empty array when session has no photos", async () => {
      mockAuthGetUser.mockResolvedValue({
        data: {
          user: { id: sessionOwnerId, email: "owner@example.com" },
        },
        error: null,
      });

      // Mock session check
      const mockSingle = jest.fn().mockResolvedValue({
        data: {
          id: validSessionId,
          user_id: sessionOwnerId,
          is_public: true,
        },
        error: null,
      });
      const mockEq = jest.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });

      mockFrom.mockReturnValue({
        select: mockSelect,
      });

      (mockGetSessionPhotos as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${validSessionId}/photos`,
        { method: "GET" }
      );

      const response = await GET(request, { params: Promise.resolve({ id: validSessionId }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.photos).toEqual([]);
    });

    it("returns photos with correct structure", async () => {
      mockAuthGetUser.mockResolvedValue({
        data: {
          user: { id: sessionOwnerId, email: "owner@example.com" },
        },
        error: null,
      });

      // Mock session check
      const mockSingle = jest.fn().mockResolvedValue({
        data: {
          id: validSessionId,
          user_id: sessionOwnerId,
          is_public: true,
        },
        error: null,
      });
      const mockEq = jest.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });

      mockFrom.mockReturnValue({
        select: mockSelect,
      });

      const mockPhotos = [
        {
          id: "photo-1",
          url: "https://example.com/photo1.jpg",
          thumbnail_url: "https://example.com/thumb1.jpg",
          created_at: "2024-01-01T12:00:00Z",
          metadata: { width: 1920, height: 1080 },
        },
        {
          id: "photo-2",
          url: "https://example.com/photo2.jpg",
          thumbnail_url: "https://example.com/thumb2.jpg",
          created_at: "2024-01-01T13:00:00Z",
          metadata: { width: 1920, height: 1080 },
        },
      ];
      (mockGetSessionPhotos as jest.Mock).mockResolvedValue(mockPhotos);

      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${validSessionId}/photos`,
        { method: "GET" }
      );

      const response = await GET(request, { params: Promise.resolve({ id: validSessionId }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.photos).toHaveLength(2);
      expect(data.data.photos[0]).toHaveProperty("id");
      expect(data.data.photos[0]).toHaveProperty("url");
      expect(data.data.photos[0]).toHaveProperty("thumbnail_url");
      expect(data.data.photos[0]).toHaveProperty("created_at");
    });

    it("handles multiple photos correctly", async () => {
      mockAuthGetUser.mockResolvedValue({
        data: {
          user: { id: sessionOwnerId, email: "owner@example.com" },
        },
        error: null,
      });

      // Mock session check
      const mockSingle = jest.fn().mockResolvedValue({
        data: {
          id: validSessionId,
          user_id: sessionOwnerId,
          is_public: true,
        },
        error: null,
      });
      const mockEq = jest.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });

      mockFrom.mockReturnValue({
        select: mockSelect,
      });

      // Create 10 photos
      const mockPhotos = Array.from({ length: 10 }, (_, i) => ({
        id: `photo-${i + 1}`,
        url: `https://example.com/photo${i + 1}.jpg`,
        created_at: new Date(2024, 0, 1, 12, i).toISOString(),
      }));
      (mockGetSessionPhotos as jest.Mock).mockResolvedValue(mockPhotos);

      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${validSessionId}/photos`,
        { method: "GET" }
      );

      const response = await GET(request, { params: Promise.resolve({ id: validSessionId }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.photos).toHaveLength(10);
    });
  });

  describe("Error Handling", () => {
    it("handles database query errors gracefully", async () => {
      mockAuthGetUser.mockResolvedValue({
        data: {
          user: { id: sessionOwnerId, email: "owner@example.com" },
        },
        error: null,
      });

      // Mock session check error
      const mockSingle = jest.fn().mockResolvedValue({
        data: null,
        error: new Error("Database connection failed"),
      });
      const mockEq = jest.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });

      mockFrom.mockReturnValue({
        select: mockSelect,
      });

      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${validSessionId}/photos`,
        { method: "GET" }
      );

      const response = await GET(request, { params: Promise.resolve({ id: validSessionId }) });
      const data = await response.json();

      // Database errors are genuine server errors - 500 is correct
      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Failed to load session photos");
    });

    it("handles storage retrieval errors gracefully", async () => {
      mockAuthGetUser.mockResolvedValue({
        data: {
          user: { id: sessionOwnerId, email: "owner@example.com" },
        },
        error: null,
      });

      // Mock session check
      const mockSingle = jest.fn().mockResolvedValue({
        data: {
          id: validSessionId,
          user_id: sessionOwnerId,
          is_public: true,
        },
        error: null,
      });
      const mockEq = jest.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });

      mockFrom.mockReturnValue({
        select: mockSelect,
      });

      // Mock storage error
      (mockGetSessionPhotos as jest.Mock).mockRejectedValue(
        new Error("Storage service unavailable")
      );

      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${validSessionId}/photos`,
        { method: "GET" }
      );

      const response = await GET(request, { params: Promise.resolve({ id: validSessionId }) });
      const data = await response.json();

      // Storage service errors are genuine server errors - 500 is correct
      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toContain("Failed to load session photos");
    });
  });

  describe("Edge Cases", () => {
    it("handles very long session ID gracefully", async () => {
      mockAuthGetUser.mockResolvedValue({
        data: {
          user: { id: sessionOwnerId, email: "owner@example.com" },
        },
        error: null,
      });

      const longButInvalidId = "a".repeat(100);
      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${longButInvalidId}/photos`,
        { method: "GET" }
      );

      const response = await GET(request, { params: Promise.resolve({ id: longButInvalidId }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it("handles null is_public field gracefully", async () => {
      mockAuthGetUser.mockResolvedValue({
        data: {
          user: { id: otherUserId, email: "other@example.com" },
        },
        error: null,
      });

      // Mock session check - is_public is null
      const mockSingle = jest.fn().mockResolvedValue({
        data: {
          id: validSessionId,
          user_id: sessionOwnerId,
          is_public: null,
        },
        error: null,
      });
      const mockEq = jest.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });

      mockFrom.mockReturnValue({
        select: mockSelect,
      });

      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${validSessionId}/photos`,
        { method: "GET" }
      );

      const response = await GET(request, { params: Promise.resolve({ id: validSessionId }) });
      const data = await response.json();

      // Should treat null as false (private)
      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
    });

    it("handles missing session fields gracefully", async () => {
      mockAuthGetUser.mockResolvedValue({
        data: {
          user: { id: sessionOwnerId, email: "owner@example.com" },
        },
        error: null,
      });

      // Mock session check - missing fields
      const mockSingle = jest.fn().mockResolvedValue({
        data: {
          id: validSessionId,
          // user_id and is_public missing
        },
        error: null,
      });
      const mockEq = jest.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });

      mockFrom.mockReturnValue({
        select: mockSelect,
      });

      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${validSessionId}/photos`,
        { method: "GET" }
      );

      const response = await GET(request, { params: Promise.resolve({ id: validSessionId }) });
      const data = await response.json();

      // Should handle gracefully (likely 403 or error)
      expect([403, 500]).toContain(response.status);
      expect(data.success).toBe(false);
    });
  });
});
