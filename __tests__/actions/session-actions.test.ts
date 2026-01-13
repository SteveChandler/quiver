import { describe, it, expect, beforeEach, jest } from "@jest/globals";

/**
 * Session Actions Test Suite
 *
 * These tests focus on the addFeaturedPhotoToSessions utility which is a pure
 * function that accepts a Supabase client - making it easy to test.
 *
 * Note: Full integration tests for createLoggedSession/createPlannedSession
 * require complex Supabase mocking due to withAuthenticatedAction wrapper.
 * Those are tested via E2E tests in e2e/session-wizard.spec.ts.
 *
 * Security properties (sanitizePayload) are verified in E2E tests that run
 * against a real database with RLS policies enabled.
 */

// Import the module for testing
import * as sessionActionsModule from "@/actions/session-actions";

// Helper to create mock Supabase client for addFeaturedPhotoToSessions
function createMockSupabaseClient(mockResult: { data: any; error: any }) {
  const chain = {
    from: jest.fn(() => chain),
    select: jest.fn(() => chain),
    in: jest.fn(() => chain),
    order: jest.fn(() => Promise.resolve(mockResult)),
  };
  return chain as any;
}

describe("session-actions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("addFeaturedPhotoToSessions", () => {
    it("returns empty array for empty input", async () => {
      const mockClient = createMockSupabaseClient({ data: [], error: null });

      const result = await sessionActionsModule.addFeaturedPhotoToSessions(mockClient, []);
      expect(result).toEqual([]);
      // Should not make any database calls for empty input
      expect(mockClient.from).not.toHaveBeenCalled();
    });

    it("returns sessions unchanged when all have featured_photo_url", async () => {
      const mockClient = createMockSupabaseClient({ data: [], error: null });

      const sessions = [
        { id: "s1", featured_photo_url: "existing-photo-1.jpg" },
        { id: "s2", featured_photo_url: "existing-photo-2.jpg" },
      ];

      const result = await sessionActionsModule.addFeaturedPhotoToSessions(mockClient, sessions);

      expect(result[0].featured_photo_url).toBe("existing-photo-1.jpg");
      expect(result[1].featured_photo_url).toBe("existing-photo-2.jpg");
    });

    it("preserves existing featured_photo_url and does not overwrite", async () => {
      const mockClient = createMockSupabaseClient({
        data: [
          // Even if database returns a different photo, existing should be preserved
          { session_id: "s1", public_url: "new-photo.jpg", media_type: "photo" },
        ],
        error: null,
      });

      const sessions = [
        { id: "s1", featured_photo_url: "existing-photo.jpg" },
      ];

      const result = await sessionActionsModule.addFeaturedPhotoToSessions(mockClient, sessions);
      expect(result[0].featured_photo_url).toBe("existing-photo.jpg");
    });

    it("adds featured_photo_url from session_media when not present", async () => {
      const mockClient = createMockSupabaseClient({
        data: [
          { session_id: "s1", public_url: "fetched-photo.jpg", media_type: "photo" },
        ],
        error: null,
      });

      const sessions = [{ id: "s1" }]; // No featured_photo_url

      const result = await sessionActionsModule.addFeaturedPhotoToSessions(mockClient, sessions);
      expect(result[0].featured_photo_url).toBe("fetched-photo.jpg");
    });

    it("handles database errors gracefully", async () => {
      const mockClient = createMockSupabaseClient({
        data: null,
        error: { message: "DB error" },
      });

      const sessions = [{ id: "s1" }];

      // Should not throw, just return sessions without featured photos
      const result = await sessionActionsModule.addFeaturedPhotoToSessions(mockClient, sessions);
      expect(result).toHaveLength(1);
      expect(result[0].featured_photo_url).toBeUndefined();
    });

    it("handles null data gracefully", async () => {
      const mockClient = createMockSupabaseClient({
        data: null,
        error: null,
      });

      const sessions = [{ id: "s1" }];

      const result = await sessionActionsModule.addFeaturedPhotoToSessions(mockClient, sessions);
      expect(result).toHaveLength(1);
      // Implementation sets null for missing photos
      expect(result[0].featured_photo_url).toBeNull();
    });

    it("handles multiple sessions correctly", async () => {
      const mockClient = createMockSupabaseClient({
        data: [
          { session_id: "s1", public_url: "photo1.jpg", media_type: "photo" },
          { session_id: "s3", public_url: "photo3.jpg", media_type: "photo" },
        ],
        error: null,
      });

      const sessions = [
        { id: "s1" },
        { id: "s2", featured_photo_url: "existing.jpg" },
        { id: "s3" },
      ];

      const result = await sessionActionsModule.addFeaturedPhotoToSessions(mockClient, sessions);

      expect(result[0].featured_photo_url).toBe("photo1.jpg");
      expect(result[1].featured_photo_url).toBe("existing.jpg"); // Preserved
      expect(result[2].featured_photo_url).toBe("photo3.jpg");
    });

    it("uses first photo for each session (ordered by created_at desc)", async () => {
      // Since we order by created_at DESC, first result is most recent
      const mockClient = createMockSupabaseClient({
        data: [
          { session_id: "s1", public_url: "newest-photo.jpg", media_type: "photo" },
          { session_id: "s1", public_url: "older-photo.jpg", media_type: "photo" },
        ],
        error: null,
      });

      const sessions = [{ id: "s1" }];

      const result = await sessionActionsModule.addFeaturedPhotoToSessions(mockClient, sessions);
      expect(result[0].featured_photo_url).toBe("newest-photo.jpg");
    });

    it("filters by session_id correctly", async () => {
      const mockClient = createMockSupabaseClient({
        data: [
          { session_id: "s1", public_url: "photo1.jpg", media_type: "photo" },
          // s2 has no photo in results
        ],
        error: null,
      });

      const sessions = [
        { id: "s1" },
        { id: "s2" }, // No photo for this session
      ];

      const result = await sessionActionsModule.addFeaturedPhotoToSessions(mockClient, sessions);

      expect(result[0].featured_photo_url).toBe("photo1.jpg");
      // Implementation sets null for sessions without photos
      expect(result[1].featured_photo_url).toBeNull();
    });

    it("handles sessions with null IDs", async () => {
      const mockClient = createMockSupabaseClient({ data: [], error: null });

      const sessions = [
        { id: "s1" },
        { id: null as any }, // Invalid session
        { id: "s3" },
      ];

      // Should not throw
      const result = await sessionActionsModule.addFeaturedPhotoToSessions(mockClient, sessions);
      expect(result).toHaveLength(3);
    });

    it("handles image_url fallback field", async () => {
      // Some sessions might have image_url instead of featured_photo_url
      const mockClient = createMockSupabaseClient({
        data: [],
        error: null,
      });

      const sessions = [
        { id: "s1", image_url: "legacy-image.jpg" },
      ];

      const result = await sessionActionsModule.addFeaturedPhotoToSessions(mockClient, sessions);
      // image_url should be preserved as-is
      expect(result[0].image_url).toBe("legacy-image.jpg");
    });

    it("queries session_media table with correct parameters", async () => {
      const mockClient = createMockSupabaseClient({
        data: [],
        error: null,
      });

      const sessions = [{ id: "test-session-id" }];

      await sessionActionsModule.addFeaturedPhotoToSessions(mockClient, sessions);

      expect(mockClient.from).toHaveBeenCalledWith("session_media");
      expect(mockClient.select).toHaveBeenCalled();
      expect(mockClient.in).toHaveBeenCalledWith("session_id", ["test-session-id"]);
      expect(mockClient.in).toHaveBeenCalledWith("media_type", ["photo"]);
    });
  });
});
