import {
  uploadSessionPhoto,
  uploadMultiplePhotos,
  deleteSessionPhoto,
  getSessionPhotos,
  updatePhotoCaption,
  getUserStorageUsage,
  type UploadResult,
  type SessionPhoto,
  type StorageUsageInfo,
} from "@/lib/supabase/storage";

// Mock Supabase client
jest.mock("@/lib/supabase/client", () => ({
  supabase: {
    storage: {
      from: jest.fn().mockReturnThis(),
      upload: jest.fn(),
      remove: jest.fn(),
      getPublicUrl: jest.fn(),
    },
    from: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    order: jest.fn().mockReturnThis(),
    rpc: jest.fn(),
  },
}));

// Mock image-conversion
jest.mock("image-conversion", () => ({
  compress: jest.fn(),
}));

import { supabase } from "@/lib/supabase/client";
import { compress } from "image-conversion";

const mockSupabase = supabase as any;
const mockCompress = compress as jest.MockedFunction<typeof compress>;

describe("Supabase Storage Utilities", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("uploadSessionPhoto", () => {
    const mockFile = new File(["test"], "test.jpg", { type: "image/jpeg" });
    const sessionId = "session-123";
    const userId = "user-123";

    beforeEach(() => {
      // Mock successful compression
      mockCompress.mockResolvedValue(
        new File(["compressed"], "test.jpg", { type: "image/jpeg" })
      );

      // Mock successful storage upload
      mockSupabase.storage.upload.mockResolvedValue({
        data: { path: "session-123/user-123/123456.jpg" },
        error: null,
      });

      // Mock public URL generation
      mockSupabase.storage.getPublicUrl.mockReturnValue({
        data: { publicUrl: "https://example.com/image.jpg" },
      });

      // Mock storage usage check
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { total_bytes: 1000, image_count: 1 },
              error: null,
            }),
          }),
        }),
      });

      // Mock RPC call for storage update
      mockSupabase.rpc.mockResolvedValue({ error: null });
    });

    it("should successfully upload a valid image file", async () => {
      const result = await uploadSessionPhoto(mockFile, sessionId, userId);

      expect(result.success).toBe(true);
      expect(result.url).toBe("https://example.com/image.jpg");
      expect(result.path).toBe("session-123/user-123/123456.jpg");
      expect(mockCompress).toHaveBeenCalledWith(mockFile, {
        quality: 0.8,
        maxWidth: 1920,
        maxHeight: 1080,
        type: "image/jpeg",
      });
    });

    it("should reject invalid file types", async () => {
      const invalidFile = new File(["test"], "test.txt", {
        type: "text/plain",
      });

      const result = await uploadSessionPhoto(invalidFile, sessionId, userId);

      expect(result.success).toBe(false);
      expect(result.error).toContain(
        "Only JPEG, PNG, and WebP images are allowed"
      );
    });

    it("should reject files that are too large", async () => {
      const largeFile = new File(["x".repeat(20 * 1024 * 1024)], "large.jpg", {
        type: "image/jpeg",
      });

      const result = await uploadSessionPhoto(largeFile, sessionId, userId);

      expect(result.success).toBe(false);
      expect(result.error).toContain("File is too large");
    });

    it("should handle storage quota exceeded", async () => {
      // Mock storage usage that exceeds quota
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { total_bytes: 100 * 1024 * 1024, image_count: 100 },
              error: null,
            }),
          }),
        }),
      });

      const result = await uploadSessionPhoto(mockFile, sessionId, userId);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Storage quota exceeded");
    });

    it("should handle compression failure", async () => {
      mockCompress.mockRejectedValue(new Error("Compression failed"));

      const result = await uploadSessionPhoto(mockFile, sessionId, userId);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to compress image");
    });

    it("should handle storage upload failure", async () => {
      mockSupabase.storage.upload.mockResolvedValue({
        data: null,
        error: new Error("Upload failed"),
      });

      const result = await uploadSessionPhoto(mockFile, sessionId, userId);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Upload failed");
    });
  });

  describe("uploadMultiplePhotos", () => {
    const mockFiles = [
      new File(["test1"], "test1.jpg", { type: "image/jpeg" }),
      new File(["test2"], "test2.jpg", { type: "image/jpeg" }),
    ];
    const sessionId = "session-123";
    const userId = "user-123";

    beforeEach(() => {
      // Mock existing photos check
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
      });

      // Set up successful upload mocks for individual files
      mockCompress.mockResolvedValue(
        new File(["compressed"], "test.jpg", { type: "image/jpeg" })
      );

      mockSupabase.storage.upload.mockResolvedValue({
        data: { path: "session-123/user-123/123456.jpg" },
        error: null,
      });

      mockSupabase.storage.getPublicUrl.mockReturnValue({
        data: { publicUrl: "https://example.com/image.jpg" },
      });

      mockSupabase.rpc.mockResolvedValue({ error: null });
    });

    it("should upload multiple files successfully", async () => {
      const results = await uploadMultiplePhotos(mockFiles, sessionId, userId);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
    });

    it("should reject too many files", async () => {
      const tooManyFiles = Array(10).fill(mockFiles[0]);

      await expect(
        uploadMultiplePhotos(tooManyFiles, sessionId, userId)
      ).rejects.toThrow("Maximum 5 images allowed per session");
    });

    it("should handle upload failures", async () => {
      // Mock compression failure for second file
      mockCompress
        .mockResolvedValueOnce(
          new File(["compressed"], "test1.jpg", { type: "image/jpeg" })
        )
        .mockRejectedValueOnce(new Error("Compression failed"));

      const results = await uploadMultiplePhotos(mockFiles, sessionId, userId);

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[1].error).toContain("Failed to compress image");
    });
  });

  describe("deleteSessionPhoto", () => {
    const storagePath = "session-123/user-123/photo.jpg";
    const userId = "user-123";

    beforeEach(() => {
      // Mock storage deletion
      mockSupabase.storage.remove.mockResolvedValue({ error: null });

      // Mock storage usage update
      mockSupabase.rpc.mockResolvedValue({ error: null });
    });

    it("should successfully delete a photo", async () => {
      // Mock file info retrieval and database deletion
      mockSupabase.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { file_size: 1000 },
                  error: null,
                }),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          delete: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ error: null }),
            }),
          }),
        });

      const result = await deleteSessionPhoto(storagePath, userId);

      expect(result.success).toBe(true);
      expect(mockSupabase.storage.remove).toHaveBeenCalledWith([storagePath]);
    });

    it("should handle storage deletion failure", async () => {
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { file_size: 1000 },
                error: null,
              }),
            }),
          }),
        }),
      });

      mockSupabase.storage.remove.mockResolvedValue({
        error: new Error("Delete failed"),
      });

      const result = await deleteSessionPhoto(storagePath, userId);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Delete failed");
    });

    it("should handle database deletion failure", async () => {
      mockSupabase.from
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { file_size: 1000 },
                  error: null,
                }),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          delete: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                error: new Error("Database delete failed"),
              }),
            }),
          }),
        });

      const result = await deleteSessionPhoto(storagePath, userId);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Database delete failed");
    });
  });

  describe("getSessionPhotos", () => {
    const sessionId = "session-123";

    it("should retrieve session photos successfully", async () => {
      const mockPhotos = [
        {
          id: "photo-1",
          session_id: sessionId,
          user_id: "user-1",
          public_url: "https://example.com/photo1.jpg",
          storage_path: "path/photo1.jpg",
          caption: "Test photo 1",
          file_size: 1000,
          created_at: "2024-01-01T00:00:00Z",
        },
        {
          id: "photo-2",
          session_id: sessionId,
          user_id: "user-1",
          public_url: "https://example.com/photo2.jpg",
          storage_path: "path/photo2.jpg",
          caption: "Test photo 2",
          file_size: 2000,
          created_at: "2024-01-01T01:00:00Z",
        },
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: mockPhotos,
              error: null,
            }),
          }),
        }),
      });

      const result = await getSessionPhotos(sessionId);

      expect(result).toEqual(mockPhotos);
      expect(result).toHaveLength(2);
    });

    it("should handle database query failure", async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: null,
              error: new Error("Query failed"),
            }),
          }),
        }),
      });

      const result = await getSessionPhotos(sessionId);

      expect(result).toEqual([]);
    });

    it("should return empty array when no photos exist", async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
        }),
      });

      const result = await getSessionPhotos(sessionId);

      expect(result).toEqual([]);
    });
  });

  describe("updatePhotoCaption", () => {
    const photoId = "photo-123";
    const caption = "Updated caption";
    const userId = "user-123";

    it("should successfully update photo caption", async () => {
      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ error: null }),
          }),
        }),
      });

      const result = await updatePhotoCaption(photoId, caption, userId);

      expect(result.success).toBe(true);
    });

    it("should handle update failure", async () => {
      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              error: new Error("Update failed"),
            }),
          }),
        }),
      });

      const result = await updatePhotoCaption(photoId, caption, userId);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Update failed");
    });
  });

  describe("getUserStorageUsage", () => {
    const userId = "user-123";

    it("should return user storage usage", async () => {
      const mockUsage = {
        total_bytes: 50000000,
        image_count: 10,
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockUsage,
              error: null,
            }),
          }),
        }),
      });

      const result = await getUserStorageUsage(userId);

      expect(result.total_bytes).toBe(50000000);
      expect(result.image_count).toBe(10);
      expect(result.remaining_bytes).toBe(54857600); // 100MB - 50MB = 52.4MB
      expect(result.can_upload).toBe(true);
    });

    it("should handle user with no storage usage", async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { code: "PGRST116" }, // Not found
            }),
          }),
        }),
      });

      const result = await getUserStorageUsage(userId);

      expect(result.total_bytes).toBe(0);
      expect(result.image_count).toBe(0);
      expect(result.remaining_bytes).toBe(100 * 1024 * 1024);
      expect(result.can_upload).toBe(true);
    });

    it("should handle storage quota exceeded", async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                total_bytes: 99 * 1024 * 1024, // 99MB used
                image_count: 50,
              },
              error: null,
            }),
          }),
        }),
      });

      const result = await getUserStorageUsage(userId);

      expect(result.can_upload).toBe(false);
      expect(result.remaining_bytes).toBe(1024 * 1024); // 1MB remaining
    });
  });
});
