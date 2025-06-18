// Mock Supabase client
const mockSupabaseClient = {
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        order: jest.fn(() => ({
          // This will be mocked in individual tests
        })),
        single: jest.fn(() => ({
          // This will be mocked in individual tests
        })),
      })),
      order: jest.fn(() => ({
        // This will be mocked in individual tests
      })),
    })),
    insert: jest.fn(() => ({
      select: jest.fn(() => ({
        single: jest.fn(() => ({
          // This will be mocked in individual tests
        })),
      })),
    })),
    update: jest.fn(() => ({
      eq: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => ({
            // This will be mocked in individual tests
          })),
        })),
      })),
    })),
    delete: jest.fn(() => ({
      eq: jest.fn(() => ({
        // This will be mocked in individual tests
      })),
    })),
  })),
};

// Mock revalidatePath
jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
}));

jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(() => Promise.resolve(mockSupabaseClient)),
}));

// Import after mocking
import {
  getBeachReviews,
  getUserReviewForBeach,
  createBeachReview,
  updateBeachReview,
  deleteBeachReview,
  getBeachReviewStats,
} from "@/actions/beach-review-actions";
import { revalidatePath } from "next/cache";
import type { BeachReview, BeachReviewWithUser } from "@/types/database";

const mockReview: BeachReview = {
  id: "review-1",
  beach_id: "beach-1",
  user_id: "user-1",
  overall_rating: 4,
  wave_quality_rating: 4,
  crowd_density_rating: 3,
  parking_rating: 3,
  accessibility_rating: 4,
  title: "Great surfing experience",
  content:
    "Had an amazing time surfing here. Waves were perfect and not too crowded.",
  visit_date: "2024-01-15",
  created_at: "2024-01-16T10:00:00Z",
  updated_at: "2024-01-16T10:00:00Z",
};

const mockReviewWithUser: BeachReviewWithUser = {
  ...mockReview,
  user: {
    full_name: "John Doe",
    avatar_url: "https://example.com/avatar.jpg",
    email: "john@example.com",
  },
};

const mockReviews: BeachReviewWithUser[] = [
  mockReviewWithUser,
  {
    ...mockReviewWithUser,
    id: "review-2",
    overall_rating: 5,
    title: "Epic waves!",
    content: "Best session of the year!",
  },
];

describe("Beach Review Actions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getBeachReviews", () => {
    it("should return all reviews for a beach", async () => {
      const mockOrder = jest.fn().mockResolvedValue({
        data: mockReviews,
        error: null,
      });

      const mockEq = jest.fn().mockReturnValue({
        order: mockOrder,
      });

      const mockSelect = jest.fn().mockReturnValue({
        eq: mockEq,
      });

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
      });

      const result = await getBeachReviews("beach-1");

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockReviews);

      expect(mockSupabaseClient.from).toHaveBeenCalledWith("beach_reviews");
      expect(mockSelect).toHaveBeenCalledWith(`
        *,
        user:profiles(full_name, avatar_url, email)
      `);
      expect(mockEq).toHaveBeenCalledWith("beach_id", "beach-1");
      expect(mockOrder).toHaveBeenCalledWith("created_at", {
        ascending: false,
      });
    });

    it("should handle empty results", async () => {
      const mockOrder = jest.fn().mockResolvedValue({
        data: [],
        error: null,
      });

      const mockEq = jest.fn().mockReturnValue({
        order: mockOrder,
      });

      const mockSelect = jest.fn().mockReturnValue({
        eq: mockEq,
      });

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
      });

      const result = await getBeachReviews("beach-1");

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it("should handle database errors", async () => {
      const mockOrder = jest.fn().mockResolvedValue({
        data: null,
        error: new Error("Database error"),
      });

      const mockEq = jest.fn().mockReturnValue({
        order: mockOrder,
      });

      const mockSelect = jest.fn().mockReturnValue({
        eq: mockEq,
      });

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
      });

      const result = await getBeachReviews("beach-1");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Database error");
    });
  });

  describe("getUserReviewForBeach", () => {
    it("should return user's review for a beach", async () => {
      const mockSingle = jest.fn().mockResolvedValue({
        data: mockReviewWithUser,
        error: null,
      });

      const mockEq2 = jest.fn().mockReturnValue({
        single: mockSingle,
      });

      const mockEq1 = jest.fn().mockReturnValue({
        eq: mockEq2,
      });

      const mockSelect = jest.fn().mockReturnValue({
        eq: mockEq1,
      });

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
      });

      const result = await getUserReviewForBeach("beach-1", "user-1");

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockReviewWithUser);

      expect(mockEq1).toHaveBeenCalledWith("beach_id", "beach-1");
      expect(mockEq2).toHaveBeenCalledWith("user_id", "user-1");
    });

    it("should handle no review found", async () => {
      const mockSingle = jest.fn().mockResolvedValue({
        data: null,
        error: { code: "PGRST116" }, // No rows returned
      });

      const mockEq2 = jest.fn().mockReturnValue({
        single: mockSingle,
      });

      const mockEq1 = jest.fn().mockReturnValue({
        eq: mockEq2,
      });

      const mockSelect = jest.fn().mockReturnValue({
        eq: mockEq1,
      });

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
      });

      const result = await getUserReviewForBeach("beach-1", "user-1");

      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });

    it("should handle other database errors", async () => {
      const mockSingle = jest.fn().mockResolvedValue({
        data: null,
        error: new Error("Database connection failed"),
      });

      const mockEq2 = jest.fn().mockReturnValue({
        single: mockSingle,
      });

      const mockEq1 = jest.fn().mockReturnValue({
        eq: mockEq2,
      });

      const mockSelect = jest.fn().mockReturnValue({
        eq: mockEq1,
      });

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
      });

      const result = await getUserReviewForBeach("beach-1", "user-1");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Database connection failed");
    });
  });

  describe("createBeachReview", () => {
    const reviewData = {
      beach_id: "beach-1",
      user_id: "user-1",
      overall_rating: 4,
      wave_quality_rating: 4,
      crowd_density_rating: 3,
      parking_rating: 3,
      accessibility_rating: 4,
      title: "Great experience",
      content: "Really enjoyed surfing here!",
      visit_date: "2024-01-15",
    };

    it("should create a new review successfully", async () => {
      const mockSingle = jest.fn().mockResolvedValue({
        data: mockReviewWithUser,
        error: null,
      });

      const mockSelect = jest.fn().mockReturnValue({
        single: mockSingle,
      });

      const mockInsert = jest.fn().mockReturnValue({
        select: mockSelect,
      });

      // Mock beach update for average ratings
      const mockUpdateBeach = jest.fn().mockResolvedValue({
        data: {},
        error: null,
      });

      const mockUpdateEq = jest.fn().mockReturnValue(mockUpdateBeach);

      const mockUpdate = jest.fn().mockReturnValue({
        eq: mockUpdateEq,
      });

      mockSupabaseClient.from
        .mockReturnValueOnce({
          insert: mockInsert,
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              data: [mockReview],
              error: null,
            }),
          }),
        })
        .mockReturnValueOnce({
          update: mockUpdate,
        });

      const result = await createBeachReview(reviewData);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockReviewWithUser);

      expect(mockInsert).toHaveBeenCalledWith(reviewData);
      expect(revalidatePath).toHaveBeenCalledWith("/beach/beach-1");
      expect(revalidatePath).toHaveBeenCalledWith("/map");
    });

    it("should handle creation errors", async () => {
      const mockSingle = jest.fn().mockResolvedValue({
        data: null,
        error: new Error("Insert failed"),
      });

      const mockSelect = jest.fn().mockReturnValue({
        single: mockSingle,
      });

      const mockInsert = jest.fn().mockReturnValue({
        select: mockSelect,
      });

      mockSupabaseClient.from.mockReturnValue({
        insert: mockInsert,
      });

      const result = await createBeachReview(reviewData);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Insert failed");
    });
  });

  describe("updateBeachReview", () => {
    const updateData = {
      title: "Updated title",
      content: "Updated content",
      overall_rating: 5,
    };

    it("should update review successfully", async () => {
      const updatedReview = { ...mockReviewWithUser, ...updateData };

      const mockSingle = jest.fn().mockResolvedValue({
        data: updatedReview,
        error: null,
      });

      const mockSelect = jest.fn().mockReturnValue({
        single: mockSingle,
      });

      const mockEq = jest.fn().mockReturnValue({
        select: mockSelect,
      });

      const mockUpdate = jest.fn().mockReturnValue({
        eq: mockEq,
      });

      // Mock beach average rating update
      mockSupabaseClient.from
        .mockReturnValueOnce({
          update: mockUpdate,
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              data: [mockReview],
              error: null,
            }),
          }),
        })
        .mockReturnValueOnce({
          update: jest.fn().mockReturnValue({
            eq: jest.fn(),
          }),
        });

      const result = await updateBeachReview("review-1", updateData);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(updatedReview);

      expect(mockUpdate).toHaveBeenCalledWith(updateData);
      expect(mockEq).toHaveBeenCalledWith("id", "review-1");
    });

    it("should handle update errors", async () => {
      const mockSingle = jest.fn().mockResolvedValue({
        data: null,
        error: new Error("Update failed"),
      });

      const mockSelect = jest.fn().mockReturnValue({
        single: mockSingle,
      });

      const mockEq = jest.fn().mockReturnValue({
        select: mockSelect,
      });

      const mockUpdate = jest.fn().mockReturnValue({
        eq: mockEq,
      });

      mockSupabaseClient.from.mockReturnValue({
        update: mockUpdate,
      });

      const result = await updateBeachReview("review-1", updateData);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Update failed");
    });
  });

  describe("deleteBeachReview", () => {
    it("should delete review successfully", async () => {
      // Mock fetching beach_id before delete
      const mockSingle = jest.fn().mockResolvedValue({
        data: { beach_id: "beach-1" },
        error: null,
      });

      const mockSelectEq = jest.fn().mockReturnValue({
        single: mockSingle,
      });

      const mockSelect = jest.fn().mockReturnValue({
        eq: mockSelectEq,
      });

      // Mock delete operation
      const mockDeleteEq = jest.fn().mockResolvedValue({
        error: null,
      });

      const mockDelete = jest.fn().mockReturnValue({
        eq: mockDeleteEq,
      });

      mockSupabaseClient.from
        .mockReturnValueOnce({
          select: mockSelect,
        })
        .mockReturnValueOnce({
          delete: mockDelete,
        })
        .mockReturnValueOnce({
          select: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              data: [mockReview],
              error: null,
            }),
          }),
        })
        .mockReturnValueOnce({
          update: jest.fn().mockReturnValue({
            eq: jest.fn(),
          }),
        });

      const result = await deleteBeachReview("review-1");

      expect(result.success).toBe(true);
      expect(mockDelete).toHaveBeenCalled();
      expect(mockDeleteEq).toHaveBeenCalledWith("id", "review-1");
      expect(revalidatePath).toHaveBeenCalledWith("/beach/beach-1");
    });

    it("should handle review not found", async () => {
      const mockSingle = jest.fn().mockResolvedValue({
        data: null,
        error: new Error("Not found"),
      });

      const mockSelectEq = jest.fn().mockReturnValue({
        single: mockSingle,
      });

      const mockSelect = jest.fn().mockReturnValue({
        eq: mockSelectEq,
      });

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
      });

      const result = await deleteBeachReview("review-1");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Review not found");
    });
  });

  describe("getBeachReviewStats", () => {
    it("should return review statistics", async () => {
      const mockReviewData = [
        {
          overall_rating: 4,
          wave_quality_rating: 4,
          crowd_density_rating: 3,
          parking_rating: 3,
          accessibility_rating: 4,
        },
        {
          overall_rating: 5,
          wave_quality_rating: 5,
          crowd_density_rating: 4,
          parking_rating: 4,
          accessibility_rating: 5,
        },
      ];

      const mockEq = jest.fn().mockResolvedValue({
        data: mockReviewData,
        error: null,
      });

      const mockSelect = jest.fn().mockReturnValue({
        eq: mockEq,
      });

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
      });

      const result = await getBeachReviewStats("beach-1");

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        total_reviews: 2,
        average_overall: 4.5,
        average_wave_quality: 4.5,
        average_crowd_density: 3.5,
        average_parking: 3.5,
        average_accessibility: 4.5,
      });
    });

    it("should handle no reviews", async () => {
      const mockEq = jest.fn().mockResolvedValue({
        data: [],
        error: null,
      });

      const mockSelect = jest.fn().mockReturnValue({
        eq: mockEq,
      });

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
      });

      const result = await getBeachReviewStats("beach-1");

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        total_reviews: 0,
        average_overall: 0,
        average_wave_quality: 0,
        average_crowd_density: 0,
        average_parking: 0,
        average_accessibility: 0,
      });
    });

    it("should handle database errors", async () => {
      const mockEq = jest.fn().mockResolvedValue({
        data: null,
        error: new Error("Stats query failed"),
      });

      const mockSelect = jest.fn().mockReturnValue({
        eq: mockEq,
      });

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
      });

      const result = await getBeachReviewStats("beach-1");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Stats query failed");
    });
  });

  describe("Edge cases", () => {
    it("should handle network timeouts", async () => {
      const mockOrder = jest
        .fn()
        .mockRejectedValue(new Error("Request timeout"));

      const mockEq = jest.fn().mockReturnValue({
        order: mockOrder,
      });

      const mockSelect = jest.fn().mockReturnValue({
        eq: mockEq,
      });

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
      });

      const result = await getBeachReviews("beach-1");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to fetch reviews");
    });

    it("should handle malformed data gracefully", async () => {
      const malformedData = [
        {
          id: "review-1",
          beach_id: "beach-1",
          // Missing required fields
          title: null,
          content: "",
        },
      ];

      const mockOrder = jest.fn().mockResolvedValue({
        data: malformedData,
        error: null,
      });

      const mockEq = jest.fn().mockReturnValue({
        order: mockOrder,
      });

      const mockSelect = jest.fn().mockReturnValue({
        eq: mockEq,
      });

      mockSupabaseClient.from.mockReturnValue({
        select: mockSelect,
      });

      const result = await getBeachReviews("beach-1");

      expect(result.success).toBe(true);
      expect(result.data).toEqual(malformedData);
    });
  });
});
