// Mock Supabase client
const mockSupabaseClient = {
  from: jest.fn(),
  storage: {
    from: jest.fn(() => ({
      getPublicUrl: jest.fn(),
    })),
  },
};

jest.mock("@/lib/server-action-utils", () => ({
  withDatabaseOperation: jest.fn((callback) => callback(mockSupabaseClient)),
}));

// Import after mocking
import { getBestBeachPhotosAction } from "@/actions/beach-media-actions";

describe("beach-media-actions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getBestBeachPhotosAction", () => {
    const mockBeachId = "beach-123";

    it("should fetch photos from beach_photos table when available", async () => {
      const mockBeachPhotos = [
        {
          id: "photo-1",
          image_url: "https://example.com/photo1.jpg",
          thumb_url: "https://example.com/photo1_thumb.jpg",
          fetched_at: "2024-01-01T00:00:00Z",
        },
        {
          id: "photo-2",
          image_url: "https://example.com/photo2.jpg",
          thumb_url: null,
          fetched_at: "2024-01-02T00:00:00Z",
        },
      ];

      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({
              data: mockBeachPhotos,
              error: null,
            }),
          }),
        }),
      });

      const result = await getBestBeachPhotosAction(mockBeachId, 12);

      expect(result).toEqual({
        data: [
          {
            id: "photo-1",
            created_at: "2024-01-01T00:00:00Z",
            public_url: "https://example.com/photo1_thumb.jpg", // Uses thumb_url
          },
          {
            id: "photo-2",
            created_at: "2024-01-02T00:00:00Z",
            public_url: "https://example.com/photo2.jpg", // Falls back to image_url
          },
        ],
        error: null,
      });

      expect(mockSupabaseClient.from).toHaveBeenCalledWith("beach_photos");
    });

    it("should fallback to session_media when beach_photos is empty", async () => {
      const mockSessionMedia = [
        {
          id: "session-photo-1",
          created_at: "2024-01-01T00:00:00Z",
          storage_path: "path/to/photo1.jpg",
          media_type: "photo",
          session: {
            id: "session-1",
            beach_id: mockBeachId,
          },
        },
      ];

      let callCount = 0;
      mockSupabaseClient.from.mockImplementation((tableName: string) => {
        callCount++;
        if (tableName === "beach_photos") {
          // First call: beach_photos returns empty
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnThis(),
              order: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              }),
            }),
          };
        } else {
          // Second call: session_media returns data
          return {
            select: jest.fn().mockReturnValue({
              in: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  order: jest.fn().mockReturnValue({
                    limit: jest.fn().mockResolvedValue({
                      data: mockSessionMedia,
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          };
        }
      });

      mockSupabaseClient.storage.from.mockReturnValue({
        getPublicUrl: jest.fn().mockReturnValue({
          data: { publicUrl: "https://storage.example.com/path/to/photo1.jpg" },
        }),
      });

      const result = await getBestBeachPhotosAction(mockBeachId, 12);

      expect(result).toEqual({
        data: [
          {
            id: "session-photo-1",
            created_at: "2024-01-01T00:00:00Z",
            public_url: "https://storage.example.com/path/to/photo1.jpg",
          },
        ],
        error: null,
      });

      expect(mockSupabaseClient.from).toHaveBeenCalledWith("beach_photos");
      expect(mockSupabaseClient.from).toHaveBeenCalledWith("session_media");
    });

    it("should handle beach_photos error gracefully and fallback to session_media", async () => {
      const mockSessionMedia = [
        {
          id: "session-photo-1",
          created_at: "2024-01-01T00:00:00Z",
          storage_path: "path/to/photo1.jpg",
          media_type: "photo",
          session: {
            id: "session-1",
            beach_id: mockBeachId,
          },
        },
      ];

      mockSupabaseClient.from.mockImplementation((tableName: string) => {
        if (tableName === "beach_photos") {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnThis(),
              order: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue({
                  data: null,
                  error: { message: "Table not found" },
                }),
              }),
            }),
          };
        } else {
          return {
            select: jest.fn().mockReturnValue({
              in: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  order: jest.fn().mockReturnValue({
                    limit: jest.fn().mockResolvedValue({
                      data: mockSessionMedia,
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
          };
        }
      });

      mockSupabaseClient.storage.from.mockReturnValue({
        getPublicUrl: jest.fn().mockReturnValue({
          data: { publicUrl: "https://storage.example.com/path/to/photo1.jpg" },
        }),
      });

      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

      const result = await getBestBeachPhotosAction(mockBeachId, 12);

      expect(result).toEqual({
        data: [
          {
            id: "session-photo-1",
            created_at: "2024-01-01T00:00:00Z",
            public_url: "https://storage.example.com/path/to/photo1.jpg",
          },
        ],
        error: null,
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[getBestBeachPhotosAction] Error fetching beach photos:",
        { message: "Table not found" }
      );

      consoleErrorSpy.mockRestore();
    });

    it("should return error when session_media query fails", async () => {
      mockSupabaseClient.from.mockImplementation((tableName: string) => {
        if (tableName === "beach_photos") {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnThis(),
              order: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              }),
            }),
          };
        } else {
          return {
            select: jest.fn().mockReturnValue({
              in: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  order: jest.fn().mockReturnValue({
                    limit: jest.fn().mockResolvedValue({
                      data: null,
                      error: { message: "Session media query failed" },
                    }),
                  }),
                }),
              }),
            }),
          };
        }
      });

      const result = await getBestBeachPhotosAction(mockBeachId, 12);

      expect(result).toEqual({
        data: null,
        error: { message: "Session media query failed" },
      });
    });

    it("should respect the limit parameter", async () => {
      const mockBeachPhotos = Array.from({ length: 20 }, (_, i) => ({
        id: `photo-${i}`,
        image_url: `https://example.com/photo${i}.jpg`,
        thumb_url: `https://example.com/photo${i}_thumb.jpg`,
        fetched_at: `2024-01-0${i + 1}T00:00:00Z`,
      }));

      const mockLimit = jest.fn().mockResolvedValue({
        data: mockBeachPhotos.slice(0, 5),
        error: null,
      });

      mockSupabaseClient.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnValue({
            limit: mockLimit,
          }),
        }),
      });

      await getBestBeachPhotosAction(mockBeachId, 5);

      expect(mockLimit).toHaveBeenCalledWith(5);
    });

    it("should filter by beach_id correctly", async () => {
      const mockEq = jest.fn().mockReturnThis();
      const mockOrder = jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      });

      // Mock for beach_photos table
      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: mockEq,
          order: mockOrder,
        }),
      });

      // Mock for session_media fallback
      mockSupabaseClient.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          in: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              }),
            }),
          }),
        }),
      });

      await getBestBeachPhotosAction(mockBeachId, 12);

      expect(mockEq).toHaveBeenCalledWith("beach_id", mockBeachId);
      expect(mockEq).toHaveBeenCalledWith("approved", true);
    });

    it("should return empty array when both sources have no photos", async () => {
      mockSupabaseClient.from.mockImplementation(() => ({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnThis(),
          in: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
        }),
      }));

      const result = await getBestBeachPhotosAction(mockBeachId, 12);

      expect(result).toEqual({
        data: [],
        error: null,
      });
    });
  });
});
