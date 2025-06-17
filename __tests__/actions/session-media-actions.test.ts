import {
  uploadSessionPhotosAction,
  deleteSessionPhotoAction,
  updatePhotoCaptionAction,
  getSessionPhotosAction,
  getUserStorageUsageAction,
  getStorageStatsAction,
  cleanupOrphanedMediaAction,
  batchUpdatePhotoCaptionsAction,
} from "@/actions/session-media-actions";

// Mock the authentication wrapper
jest.mock("@/lib/server-action-utils", () => ({
  withAuthenticatedAction: jest.fn((callback) => {
    return async (...args: any[]) => {
      // Mock authenticated user and supabase client
      const mockUser = { id: "user-123", email: "test@example.com" };
      const mockSupabase = {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn(),
        insert: jest.fn(),
        rpc: jest.fn(),
      };
      return callback(mockUser, mockSupabase, ...args);
    };
  }),
}));

// Mock the storage utilities
jest.mock("@/lib/supabase/storage", () => ({
  uploadMultiplePhotos: jest.fn(),
  deleteSessionPhoto: jest.fn(),
  getSessionPhotos: jest.fn(),
  updatePhotoCaption: jest.fn(),
  getUserStorageUsage: jest.fn(),
}));

// Mock createSupabaseServerClient
jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: jest.fn(),
}));

// Mock Next.js cache functions
jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
}));

import { revalidatePath } from "next/cache";
import {
  uploadMultiplePhotos,
  deleteSessionPhoto,
  getSessionPhotos,
  updatePhotoCaption,
  getUserStorageUsage,
} from "@/lib/supabase/storage";
const mockRevalidatePath = revalidatePath as jest.MockedFunction<
  typeof revalidatePath
>;
const mockUploadMultiplePhotos = uploadMultiplePhotos as jest.MockedFunction<
  typeof uploadMultiplePhotos
>;
const mockDeleteSessionPhoto = deleteSessionPhoto as jest.MockedFunction<
  typeof deleteSessionPhoto
>;
const mockGetSessionPhotos = getSessionPhotos as jest.MockedFunction<
  typeof getSessionPhotos
>;
const mockUpdatePhotoCaption = updatePhotoCaption as jest.MockedFunction<
  typeof updatePhotoCaption
>;
const mockGetUserStorageUsage = getUserStorageUsage as jest.MockedFunction<
  typeof getUserStorageUsage
>;

describe("Session Media Actions", () => {
  const sessionId = "session-123";
  const userId = "user-123";
  const photoId = "photo-123";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("uploadSessionPhotosAction", () => {
    beforeEach(() => {
      // Mock session ownership check
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { user_id: userId },
              error: null,
            }),
          }),
        }),
        insert: jest.fn().mockResolvedValue({ error: null }),
      });
    });

    it("should successfully upload session photos", async () => {
      const formData = new FormData();
      formData.append("fileCount", "2");
      formData.append(
        "file_0",
        new File(["test1"], "test1.jpg", { type: "image/jpeg" })
      );
      formData.append(
        "file_1",
        new File(["test2"], "test2.jpg", { type: "image/jpeg" })
      );

      mockUploadMultiplePhotos.mockResolvedValue([
        { success: true, url: "url1", path: "path1", fileSize: 1000 },
        { success: true, url: "url2", path: "path2", fileSize: 2000 },
      ]);

      const result = await uploadSessionPhotosAction(sessionId, formData);

      expect(result.success).toBe(true);
      expect(result.data.uploaded).toBe(2);
      expect(result.data.failed).toBe(0);
      expect(mockRevalidatePath).toHaveBeenCalledWith(`/sessions/${sessionId}`);
    });

    it("should reject upload for non-owned session", async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { user_id: "other-user" },
              error: null,
            }),
          }),
        }),
      });

      const formData = new FormData();
      formData.append("fileCount", "1");

      const result = await uploadSessionPhotosAction(sessionId, formData);

      expect(result.success).toBe(false);
      expect(result.error).toBe("You can only add photos to your own sessions");
    });

    it("should handle session not found", async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: new Error("Not found"),
            }),
          }),
        }),
      });

      const formData = new FormData();
      const result = await uploadSessionPhotosAction(sessionId, formData);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Session not found");
    });

    it("should handle no files selected", async () => {
      const formData = new FormData();
      formData.append("fileCount", "0");

      const result = await uploadSessionPhotosAction(sessionId, formData);

      expect(result.success).toBe(false);
      expect(result.error).toBe("No files selected");
    });

    it("should handle partial upload failures", async () => {
      const formData = new FormData();
      formData.append("fileCount", "2");
      formData.append(
        "file_0",
        new File(["test1"], "test1.jpg", { type: "image/jpeg" })
      );
      formData.append(
        "file_1",
        new File(["test2"], "test2.jpg", { type: "image/jpeg" })
      );

      mockUploadMultiplePhotos.mockResolvedValue([
        { success: true, url: "url1", path: "path1", fileSize: 1000 },
        { success: false, error: "Upload failed" },
      ]);

      const result = await uploadSessionPhotosAction(sessionId, formData);

      expect(result.success).toBe(true);
      expect(result.data.uploaded).toBe(1);
      expect(result.data.failed).toBe(1);
      expect(result.data.errors).toContain("Upload failed");
    });

    it("should handle database insert failure", async () => {
      const formData = new FormData();
      formData.append("fileCount", "1");
      formData.append(
        "file_0",
        new File(["test"], "test.jpg", { type: "image/jpeg" })
      );

      mockUploadMultiplePhotos.mockResolvedValue([
        { success: true, url: "url1", path: "path1", fileSize: 1000 },
      ]);

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { user_id: userId },
              error: null,
            }),
          }),
        }),
        insert: jest.fn().mockResolvedValue({
          error: new Error("Database insert failed"),
        }),
      });

      const result = await uploadSessionPhotosAction(sessionId, formData);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to save photo records");
    });
  });

  describe("deleteSessionPhotoAction", () => {
    beforeEach(() => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                storage_path: "path/photo.jpg",
                session_id: sessionId,
                user_id: userId,
              },
              error: null,
            }),
          }),
        }),
      });
    });

    it("should successfully delete a photo", async () => {
      mockDeleteSessionPhoto.mockResolvedValue({ success: true });

      const result = await deleteSessionPhotoAction(photoId);

      expect(result.success).toBe(true);
      expect(mockDeleteSessionPhoto).toHaveBeenCalledWith(
        "path/photo.jpg",
        userId
      );
      expect(mockRevalidatePath).toHaveBeenCalledWith(`/sessions/${sessionId}`);
    });

    it("should reject deletion of non-owned photo", async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                storage_path: "path/photo.jpg",
                session_id: sessionId,
                user_id: "other-user",
              },
              error: null,
            }),
          }),
        }),
      });

      const result = await deleteSessionPhotoAction(photoId);

      expect(result.success).toBe(false);
      expect(result.error).toBe("You can only delete your own photos");
    });

    it("should handle photo not found", async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: new Error("Not found"),
            }),
          }),
        }),
      });

      const result = await deleteSessionPhotoAction(photoId);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Photo not found");
    });

    it("should handle storage deletion failure", async () => {
      mockDeleteSessionPhoto.mockResolvedValue({
        success: false,
        error: "Storage deletion failed",
      });

      const result = await deleteSessionPhotoAction(photoId);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Storage deletion failed");
    });
  });

  describe("updatePhotoCaptionAction", () => {
    const caption = "New caption";

    beforeEach(() => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { session_id: sessionId },
              error: null,
            }),
          }),
        }),
      });
    });

    it("should successfully update photo caption", async () => {
      mockUpdatePhotoCaption.mockResolvedValue({ success: true });

      const result = await updatePhotoCaptionAction(photoId, caption);

      expect(result.success).toBe(true);
      expect(mockUpdatePhotoCaption).toHaveBeenCalledWith(
        photoId,
        caption,
        userId
      );
      expect(mockRevalidatePath).toHaveBeenCalledWith(`/sessions/${sessionId}`);
    });

    it("should handle caption update failure", async () => {
      mockUpdatePhotoCaption.mockResolvedValue({
        success: false,
        error: "Update failed",
      });

      const result = await updatePhotoCaptionAction(photoId, caption);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Update failed");
    });

    it("should handle missing photo for revalidation", async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: null,
            }),
          }),
        }),
      });

      mockUpdatePhotoCaption.mockResolvedValue({ success: true });

      const result = await updatePhotoCaptionAction(photoId, caption);

      expect(result.success).toBe(true);
      // Should not call revalidatePath if photo not found
      expect(mockRevalidatePath).not.toHaveBeenCalled();
    });
  });

  describe("getSessionPhotosAction", () => {
    it("should successfully get session photos", async () => {
      const mockPhotos = [
        { id: "photo-1", session_id: sessionId, caption: "Photo 1" },
        { id: "photo-2", session_id: sessionId, caption: "Photo 2" },
      ];

      mockGetSessionPhotos.mockResolvedValue(mockPhotos);

      const result = await getSessionPhotosAction(sessionId);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockPhotos);
      expect(mockGetSessionPhotos).toHaveBeenCalledWith(sessionId);
    });

    it("should handle get photos failure", async () => {
      mockGetSessionPhotos.mockRejectedValue(new Error("Query failed"));

      const result = await getSessionPhotosAction(sessionId);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Query failed");
    });
  });

  describe("getUserStorageUsageAction", () => {
    it("should successfully get user storage usage", async () => {
      const mockUsage = {
        total_bytes: 1000000,
        image_count: 10,
        remaining_bytes: 99000000,
        can_upload: true,
      };

      mockGetUserStorageUsage.mockResolvedValue(mockUsage);

      const result = await getUserStorageUsageAction();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockUsage);
      expect(mockGetUserStorageUsage).toHaveBeenCalledWith(userId);
    });

    it("should handle storage usage query failure", async () => {
      mockGetUserStorageUsage.mockRejectedValue(new Error("Query failed"));

      const result = await getUserStorageUsageAction();

      expect(result.success).toBe(false);
      expect(result.error).toBe("Query failed");
    });
  });

  describe("getStorageStatsAction", () => {
    it("should successfully get storage statistics", async () => {
      const mockStats = {
        total_bytes: 1000000,
        image_count: 10,
        remaining_bytes: 99000000,
        usage_percentage: 1.0,
      };

      mockSupabase.rpc.mockResolvedValue({
        data: [mockStats],
        error: null,
      });

      const result = await getStorageStatsAction();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockStats);
      expect(mockSupabase.rpc).toHaveBeenCalledWith("get_user_storage_stats", {
        p_user_id: userId,
      });
    });

    it("should handle RPC call failure", async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: new Error("RPC failed"),
      });

      const result = await getStorageStatsAction();

      expect(result.success).toBe(false);
      expect(result.error).toBe("RPC failed");
    });
  });

  describe("cleanupOrphanedMediaAction", () => {
    it("should successfully cleanup orphaned media", async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: 5, // 5 records cleaned up
        error: null,
      });

      const result = await cleanupOrphanedMediaAction();

      expect(result.success).toBe(true);
      expect(result.data.deleted_count).toBe(5);
      expect(result.data.message).toBe("Cleaned up 5 orphaned media records");
      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        "cleanup_orphaned_session_media"
      );
    });

    it("should handle cleanup failure", async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: new Error("Cleanup failed"),
      });

      const result = await cleanupOrphanedMediaAction();

      expect(result.success).toBe(false);
      expect(result.error).toBe("Cleanup failed");
    });
  });

  describe("batchUpdatePhotoCaptionsAction", () => {
    const updates = [
      { photoId: "photo-1", caption: "Caption 1" },
      { photoId: "photo-2", caption: "Caption 2" },
    ];

    it("should successfully batch update captions", async () => {
      mockUpdatePhotoCaption
        .mockResolvedValueOnce({ success: true })
        .mockResolvedValueOnce({ success: true });

      const result = await batchUpdatePhotoCaptionsAction(updates);

      expect(result.success).toBe(true);
      expect(result.data.successful).toBe(2);
      expect(result.data.failed).toBe(0);
      expect(mockUpdatePhotoCaption).toHaveBeenCalledTimes(2);
    });

    it("should handle partial batch update failures", async () => {
      mockUpdatePhotoCaption
        .mockResolvedValueOnce({ success: true })
        .mockResolvedValueOnce({ success: false, error: "Update failed" });

      const result = await batchUpdatePhotoCaptionsAction(updates);

      expect(result.success).toBe(false);
      expect(result.data.successful).toBe(1);
      expect(result.data.failed).toBe(1);
      expect(result.data.errors).toContain("Update failed");
    });

    it("should handle complete batch update failure", async () => {
      mockUpdatePhotoCaption.mockRejectedValue(new Error("Batch failed"));

      const result = await batchUpdatePhotoCaptionsAction(updates);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Batch failed");
    });
  });
});
