/**
 * @jest-environment node
 */

/**
 * Tests for Session Photos API
 * Tests the GET /api/sessions/[id]/photos endpoint for retrieving session photos
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

// Use lightweight NextRequest/NextResponse mock
jest.mock("next/server", () => require("@/__tests__/setup/mock-next-server"));
import { NextRequest } from "next/server";

// Mock createSupabaseServerClient before imports
const mockFrom = jest.fn();
const mockAuthGetUser = jest.fn();
const mockStorageUpload = jest.fn();
const mockStorageGetPublicUrl = jest.fn();
const mockStorageRemove = jest.fn();
const mockStorageFrom = jest.fn(() => ({
  upload: mockStorageUpload,
  getPublicUrl: mockStorageGetPublicUrl,
  remove: mockStorageRemove,
}));

const mockSupabaseClient = {
  auth: {
    getUser: mockAuthGetUser,
  },
  from: mockFrom,
  storage: {
    from: mockStorageFrom,
  },
};

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: jest.fn(() => mockSupabaseClient),
}));

// Route is now withAuth({ optional: true }): auth.getUser() is consulted,
// but a null user still reaches the handler. Private-session ownership
// check is enforced inside the handler.
jest.mock("@/lib/middleware/api-wrappers", () => {
  const actual = jest.requireActual("@/lib/middleware/api-wrappers");
  return {
    ...actual,
    withAuth:
      (handler: any, options: any = {}) =>
      async (request: any, context: any) => {
        try {
          const { data, error } = await mockSupabaseClient.auth.getUser();
          const user = error ? null : data?.user ?? null;
          if (!options.optional && !user) {
            const { createAuthError } = jest.requireActual("@/lib/api-utils");
            return createAuthError(
              options.authErrorMessage ?? "Authentication required"
            );
          }
          const resolvedParams = context?.params
            ? typeof context.params === "object" && "then" in context.params
              ? await context.params
              : context.params
            : {};
          return await handler(request, {
            params: resolvedParams,
            user,
            supabase: mockSupabaseClient,
          });
        } catch (err: any) {
          const { handleApiError } = jest.requireActual("@/lib/api-utils");
          return handleApiError(err, options?.errorMessage ?? "Internal error");
        }
      },
  };
});

// Mock getSessionPhotos helper
jest.mock("@/lib/supabase/storage", () => ({
  getSessionPhotos: jest.fn(),
}));

// Import route handlers after mocks are set up
import { GET, POST } from "@/app/api/sessions/[id]/photos/route";
import { getSessionPhotos as mockGetSessionPhotos } from "@/lib/supabase/storage";

function createPhotoForm(files: File[]): FormData {
  const formData = new FormData();
  files.forEach((file) => formData.append("photos", file));
  return formData;
}

function createImageFile(
  name = "session.jpg",
  type = "image/jpeg",
  size = 1024
): File {
  return new File([new Uint8Array(size)], name, { type });
}

function createResolvedChain(result: unknown) {
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(result),
    then: jest.fn((onResolve: any) => onResolve(result)),
  };
  return chain;
}

describe("GET /api/sessions/[id]/photos", () => {
  const validSessionId = "123e4567-e89b-12d3-a456-426614174000";
  const sessionOwnerId = "987fcdeb-51a2-43c1-a123-456789abcdef";
  const otherUserId = "111fcdeb-51a2-43c1-a123-456789abcd11";

  it("uses the shared API wrapper module for response and validation helpers", () => {
    const source = readFileSync(
      join(process.cwd(), "app/api/sessions/[id]/photos/route.ts"),
      "utf8"
    );

    expect(source).not.toMatch(/from\s+["']@\/lib\/api-utils["']/);
    expect(source).toMatch(/from\s+["']@\/lib\/middleware\/api-wrappers["']/);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Authentication", () => {
    it("requires authentication for PRIVATE sessions", async () => {
      mockAuthGetUser.mockResolvedValue({
        data: { user: null },
        error: new Error("Not authenticated"),
      });

      // Private session — anonymous viewer must be rejected.
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
      mockFrom.mockReturnValue({ select: mockSelect });

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

    it("allows ANONYMOUS viewers to read photos for PUBLIC sessions", async () => {
      // Guest mode: beach detail page's RecentSessionsSection carousel
      // renders SessionCardWrapper for public sessions, which calls
      // useSessionPhotos for each. Previously the route rejected every
      // unauthenticated request with 401, breaking the guest feed.
      mockAuthGetUser.mockResolvedValue({
        data: { user: null },
        error: new Error("Not authenticated"),
      });

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
      mockFrom.mockReturnValue({ select: mockSelect });

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
      // Route is now `withAuth({ optional: true })`, so auth.getUser() IS
      // called to determine whether a Bearer/cookie session exists — but a
      // null user still reaches the handler, and public sessions skip the
      // ownership check. The assertion that matters is that an anonymous
      // caller successfully reads photos from a public session.
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

  describe("POST /api/sessions/[id]/photos", () => {
    beforeEach(() => {
      mockStorageUpload.mockResolvedValue({
        data: { path: `${validSessionId}/${sessionOwnerId}/1700000000000-0.jpg` },
        error: null,
      });
      mockStorageGetPublicUrl.mockReturnValue({
        data: {
          publicUrl:
            "https://vawdnbbgawichorsjiwe.supabase.co/storage/v1/object/public/session-media/photo.jpg",
        },
      });
      mockStorageRemove.mockResolvedValue({ data: [], error: null });
    });

    it("requires authentication for native photo uploads", async () => {
      mockAuthGetUser.mockResolvedValue({
        data: { user: null },
        error: new Error("Not authenticated"),
      });

      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${validSessionId}/photos`,
        {
          method: "POST",
          body: createPhotoForm([createImageFile()]) as any,
        }
      );

      const response = await POST(request, {
        params: Promise.resolve({ id: validSessionId }),
      });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(mockStorageUpload).not.toHaveBeenCalled();
    });

    it("rejects invalid session ids before reading multipart data", async () => {
      mockAuthGetUser.mockResolvedValue({
        data: { user: { id: sessionOwnerId, email: "owner@example.com" } },
        error: null,
      });

      const request = new NextRequest(
        "http://localhost:3000/api/sessions/not-a-uuid/photos",
        {
          method: "POST",
          body: createPhotoForm([createImageFile()]) as any,
        }
      );

      const response = await POST(request, {
        params: Promise.resolve({ id: "not-a-uuid" }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.details).toEqual({
        stage: "validation",
        error_code: "invalid_session_id",
      });
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it("rejects empty multipart uploads", async () => {
      mockAuthGetUser.mockResolvedValue({
        data: { user: { id: sessionOwnerId, email: "owner@example.com" } },
        error: null,
      });

      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${validSessionId}/photos`,
        {
          method: "POST",
          body: createPhotoForm([]) as any,
        }
      );

      const response = await POST(request, {
        params: Promise.resolve({ id: validSessionId }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.details).toEqual({
        stage: "validation",
        error_code: "no_photos",
      });
      expect(mockStorageUpload).not.toHaveBeenCalled();
    });

    it("rejects unsupported photo MIME types", async () => {
      mockAuthGetUser.mockResolvedValue({
        data: { user: { id: sessionOwnerId, email: "owner@example.com" } },
        error: null,
      });

      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${validSessionId}/photos`,
        {
          method: "POST",
          body: createPhotoForm([createImageFile("notes.txt", "text/plain")]) as any,
        }
      );

      const response = await POST(request, {
        params: Promise.resolve({ id: validSessionId }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.details).toEqual({
        stage: "validation",
        error_code: "invalid_file_type",
      });
      expect(mockStorageUpload).not.toHaveBeenCalled();
    });

    it("rejects oversized photo files", async () => {
      mockAuthGetUser.mockResolvedValue({
        data: { user: { id: sessionOwnerId, email: "owner@example.com" } },
        error: null,
      });

      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${validSessionId}/photos`,
        {
          method: "POST",
          body: createPhotoForm([
            createImageFile("huge.jpg", "image/jpeg", 10 * 1024 * 1024 + 1),
          ]) as any,
        }
      );

      const response = await POST(request, {
        params: Promise.resolve({ id: validSessionId }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.details).toEqual({
        stage: "validation",
        error_code: "file_too_large",
      });
      expect(mockStorageUpload).not.toHaveBeenCalled();
    });

    it("accepts input through 10 MiB before storage handling", async () => {
      mockAuthGetUser.mockResolvedValue({
        data: { user: { id: sessionOwnerId, email: "owner@example.com" } },
        error: null,
      });

      for (const size of [5 * 1024 * 1024 + 1, 10 * 1024 * 1024]) {
        const sessionChain = createResolvedChain({
          data: {
            id: validSessionId,
            user_id: sessionOwnerId,
            image_url: null,
          },
          error: null,
        });
        const existingMediaChain = createResolvedChain({ data: [], error: null });
        const sessionChains = [sessionChain];
        const mediaChains = [existingMediaChain];
        mockFrom.mockImplementation((table: string) => {
          if (table === "sessions") return sessionChains.shift();
          if (table === "session_media") return mediaChains.shift();
          throw new Error(`Unexpected table ${table}`);
        });
        mockStorageUpload.mockResolvedValueOnce({
          data: null,
          error: new Error("storage unavailable"),
        });
        const photo = createImageFile("storage-large.jpg", "image/jpeg", size);

        const request = new NextRequest(
          `http://localhost:3000/api/sessions/${validSessionId}/photos`,
          {
            method: "POST",
            body: createPhotoForm([photo]) as any,
          },
        );

        const response = await POST(request, {
          params: Promise.resolve({ id: validSessionId }),
        });
        const data = await response.json();

        expect(response.status).toBe(502);
        expect(data.details).toEqual({
          stage: "storage_upload",
          error_code: "storage_upload_failed",
        });
        expect(mockStorageUpload).toHaveBeenLastCalledWith(
          expect.any(String),
          photo,
          expect.objectContaining({
            cacheControl: "3600",
            contentType: "image/jpeg",
            upsert: false,
          }),
        );
        const [, uploadedPhoto] = mockStorageUpload.mock.calls.at(-1) as [
          string,
          File,
        ];
        expect(uploadedPhoto).toBe(photo);
        expect(uploadedPhoto.size).toBe(size);
        expect(uploadedPhoto.type).toBe("image/jpeg");
      }
    });

    it("rejects uploads that would exceed five photos on the session", async () => {
      mockAuthGetUser.mockResolvedValue({
        data: { user: { id: sessionOwnerId, email: "owner@example.com" } },
        error: null,
      });

      const sessionChain = createResolvedChain({
        data: {
          id: validSessionId,
          user_id: sessionOwnerId,
          image_url: null,
        },
        error: null,
      });
      const existingMediaChain = createResolvedChain({
        data: [{ id: "existing-1" }, { id: "existing-2" }],
        error: null,
      });
      const sessionChains = [sessionChain];
      const mediaChains = [existingMediaChain];
      mockFrom.mockImplementation((table: string) => {
        if (table === "sessions") return sessionChains.shift();
        if (table === "session_media") return mediaChains.shift();
        throw new Error(`Unexpected table ${table}`);
      });

      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${validSessionId}/photos`,
        {
          method: "POST",
          body: createPhotoForm([
            createImageFile("1.jpg"),
            createImageFile("2.jpg"),
            createImageFile("3.jpg"),
            createImageFile("4.jpg"),
          ]) as any,
        }
      );

      const response = await POST(request, {
        params: Promise.resolve({ id: validSessionId }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.details).toEqual({
        stage: "validation",
        error_code: "too_many_photos",
      });
      expect(mockStorageUpload).not.toHaveBeenCalled();
    });

    it("rejects non-owner uploads to private sessions", async () => {
      mockAuthGetUser.mockResolvedValue({
        data: { user: { id: otherUserId, email: "other@example.com" } },
        error: null,
      });

      const sessionChain = createResolvedChain({
        data: {
          id: validSessionId,
          user_id: sessionOwnerId,
          image_url: null,
        },
        error: null,
      });
      mockFrom.mockReturnValue(sessionChain);

      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${validSessionId}/photos`,
        {
          method: "POST",
          body: createPhotoForm([createImageFile()]) as any,
        }
      );

      const response = await POST(request, {
        params: Promise.resolve({ id: validSessionId }),
      });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe("Forbidden");
      expect(mockStorageUpload).not.toHaveBeenCalled();
    });

    it("uploads photos, inserts session_media, and attaches the first photo as hero image", async () => {
      const nowSpy = jest.spyOn(Date, "now").mockReturnValue(1700000000000);
      mockAuthGetUser.mockResolvedValue({
        data: { user: { id: sessionOwnerId, email: "owner@example.com" } },
        error: null,
      });

      const sessionChain = createResolvedChain({
        data: {
          id: validSessionId,
          user_id: sessionOwnerId,
          image_url: null,
        },
        error: null,
      });
      const existingMediaChain = createResolvedChain({ data: [], error: null });
      const mediaInsertChain = createResolvedChain({
        data: [
          {
            id: "media-1",
            public_url:
              "https://vawdnbbgawichorsjiwe.supabase.co/storage/v1/object/public/session-media/photo.jpg",
            storage_path: `${validSessionId}/${sessionOwnerId}/1700000000000-0.jpg`,
            file_size: 1024,
            media_type: "photo",
          },
        ],
        error: null,
      });
      const sessionUpdateChain = createResolvedChain({ data: [], error: null });
      const sessionChains = [sessionChain, sessionUpdateChain];
      const mediaChains = [existingMediaChain, mediaInsertChain];
      mockFrom.mockImplementation((table: string) => {
        if (table === "sessions") return sessionChains.shift();
        if (table === "session_media") return mediaChains.shift();
        throw new Error(`Unexpected table ${table}`);
      });

      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${validSessionId}/photos`,
        {
          method: "POST",
          body: createPhotoForm([createImageFile()]) as any,
        }
      );

      const response = await POST(request, {
        params: Promise.resolve({ id: validSessionId }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.uploaded_count).toBe(1);
      expect(data.data.hero_attached).toBe(true);
      expect(data.data.photos[0]).toMatchObject({
        id: "media-1",
        storage_path: `${validSessionId}/${sessionOwnerId}/1700000000000-0.jpg`,
        file_size: 1024,
        media_type: "photo",
      });
      expect(mockStorageFrom).toHaveBeenCalledWith("session-media");
      expect(mockStorageUpload).toHaveBeenCalledWith(
        `${validSessionId}/${sessionOwnerId}/1700000000000-0.jpg`,
        expect.any(File),
        {
          cacheControl: "3600",
          contentType: "image/jpeg",
          upsert: false,
        }
      );
      expect(mediaInsertChain.insert).toHaveBeenCalledWith([
        expect.objectContaining({
          session_id: validSessionId,
          user_id: sessionOwnerId,
          storage_path: `${validSessionId}/${sessionOwnerId}/1700000000000-0.jpg`,
          file_size: 1024,
          media_type: "photo",
        }),
      ]);
      expect(sessionUpdateChain.update).toHaveBeenCalledWith({
        image_url:
          "https://vawdnbbgawichorsjiwe.supabase.co/storage/v1/object/public/session-media/photo.jpg",
      });

      nowSpy.mockRestore();
    });

    it("does not overwrite an existing session hero image", async () => {
      const nowSpy = jest.spyOn(Date, "now").mockReturnValue(1700000000000);
      mockAuthGetUser.mockResolvedValue({
        data: { user: { id: sessionOwnerId, email: "owner@example.com" } },
        error: null,
      });

      const sessionChain = createResolvedChain({
        data: {
          id: validSessionId,
          user_id: sessionOwnerId,
          image_url: "https://example.com/existing.jpg",
        },
        error: null,
      });
      const existingMediaChain = createResolvedChain({ data: [], error: null });
      const mediaInsertChain = createResolvedChain({
        data: [
          {
            id: "media-1",
            public_url:
              "https://vawdnbbgawichorsjiwe.supabase.co/storage/v1/object/public/session-media/photo.jpg",
            storage_path: `${validSessionId}/${sessionOwnerId}/1700000000000-0.jpg`,
            file_size: 1024,
            media_type: "photo",
          },
        ],
        error: null,
      });
      const sessionUpdateChain = createResolvedChain({ data: [], error: null });
      const mediaChains = [existingMediaChain, mediaInsertChain];
      mockFrom.mockImplementation((table: string) => {
        if (table === "sessions") return sessionChain;
        if (table === "session_media") return mediaChains.shift();
        throw new Error(`Unexpected table ${table}`);
      });

      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${validSessionId}/photos`,
        {
          method: "POST",
          body: createPhotoForm([createImageFile()]) as any,
        }
      );

      const response = await POST(request, {
        params: Promise.resolve({ id: validSessionId }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.hero_attached).toBe(false);
      expect(sessionUpdateChain.update).not.toHaveBeenCalled();

      nowSpy.mockRestore();
    });

    it("cleans up uploaded storage objects when session_media insert fails", async () => {
      const nowSpy = jest.spyOn(Date, "now").mockReturnValue(1700000000000);
      mockAuthGetUser.mockResolvedValue({
        data: { user: { id: sessionOwnerId, email: "owner@example.com" } },
        error: null,
      });

      const sessionChain = createResolvedChain({
        data: {
          id: validSessionId,
          user_id: sessionOwnerId,
          image_url: null,
        },
        error: null,
      });
      const existingMediaChain = createResolvedChain({ data: [], error: null });
      const mediaInsertChain = createResolvedChain({
        data: null,
        error: { message: "new row violates row-level security policy" },
      });
      const sessionChains = [sessionChain];
      const mediaChains = [existingMediaChain, mediaInsertChain];
      mockFrom.mockImplementation((table: string) => {
        if (table === "sessions") return sessionChains.shift();
        if (table === "session_media") return mediaChains.shift();
        throw new Error(`Unexpected table ${table}`);
      });

      const request = new NextRequest(
        `http://localhost:3000/api/sessions/${validSessionId}/photos`,
        {
          method: "POST",
          body: createPhotoForm([createImageFile()]) as any,
        }
      );

      const response = await POST(request, {
        params: Promise.resolve({ id: validSessionId }),
      });
      const data = await response.json();

      expect(response.status).toBe(502);
      expect(data.details).toEqual({
        stage: "media_insert",
        error_code: "media_insert_failed",
      });
      expect(mockStorageRemove).toHaveBeenCalledWith([
        `${validSessionId}/${sessionOwnerId}/1700000000000-0.jpg`,
      ]);

      nowSpy.mockRestore();
    });
  });
});
