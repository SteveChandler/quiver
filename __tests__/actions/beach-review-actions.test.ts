import { SupabaseMockBuilder } from "@/__tests__/setup/supabase-mock";
import type { BeachReview, BeachReviewWithUser } from "@/types/database";

// Create a mock Supabase client using the builder
const mockSupabaseBuilder = new SupabaseMockBuilder();
let mockSupabaseClient = mockSupabaseBuilder.build();

// Mock revalidatePath
jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
}));

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: jest.fn(() =>
    Promise.resolve(mockSupabaseClient)
  ),
}));

// Import after mocking
import {
  getBeachReviews,
  getUserReviewForBeach,
  createBeachReview,
  updateBeachReview,
  deleteBeachReview,
  getBeachReviewStats,
  getMultipleBeachReviewStats,
} from "@/actions/beach-review-actions";
import { revalidatePath } from "next/cache";

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
  deleted_at: null,
  helpful_count: 0,
};

const mockReviewWithUser: BeachReviewWithUser = {
  ...mockReview,
  profiles: {
    id: "user-1",
    full_name: "John Doe",
    avatar_url: "https://example.com/avatar.jpg",
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
    mockSupabaseBuilder.reset();
    mockSupabaseClient = mockSupabaseBuilder.build();
  });

  describe("getBeachReviews", () => {
    it("should return all reviews for a beach", async () => {
      mockSupabaseClient = mockSupabaseBuilder
        .withSelect("beach-1", mockReviews, null)
        .build();

      const result = await getBeachReviews("beach-1");

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockReviews);
    });

    it("should handle empty results", async () => {
      mockSupabaseClient = mockSupabaseBuilder
        .withSelect("beach-1", [], null)
        .build();

      const result = await getBeachReviews("beach-1");

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it("should handle database errors", async () => {
      mockSupabaseClient = mockSupabaseBuilder
        .withSelect("beach-1", null, new Error("Database error"))
        .build();

      const result = await getBeachReviews("beach-1");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Database error");
    });
  });

  describe("getUserReviewForBeach", () => {
    it("should return user's review for a beach", async () => {
      mockSupabaseClient = mockSupabaseBuilder
        .withSelectSingle("beach-1", "user-1", mockReviewWithUser, null)
        .build();

      const result = await getUserReviewForBeach("beach-1", "user-1");

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockReviewWithUser);
    });

    it("should handle no review found", async () => {
      mockSupabaseClient = mockSupabaseBuilder
        .withSelectSingle("beach-1", "user-1", null, { message: "No rows returned", code: "PGRST116" })
        .build();

      const result = await getUserReviewForBeach("beach-1", "user-1");

      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });

    it("should handle other database errors", async () => {
      mockSupabaseClient = mockSupabaseBuilder
        .withSelectSingle(
          "beach-1",
          "user-1",
          null,
          new Error("Database connection failed")
        )
        .build();

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
      mockSupabaseClient = mockSupabaseBuilder
        .withInsert(mockReviewWithUser, null)
        .build();

      const result = await createBeachReview(reviewData);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockReviewWithUser);
      expect(revalidatePath).toHaveBeenCalledWith("/beach/beach-1");
      expect(revalidatePath).toHaveBeenCalledWith("/map");
    });

    it("should handle creation errors", async () => {
      mockSupabaseClient = mockSupabaseBuilder
        .withInsert(null, new Error("Insert failed"))
        .build();

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

      mockSupabaseClient = mockSupabaseBuilder
        .withUpdate(updatedReview, null)
        .build();

      const result = await updateBeachReview("review-1", updateData);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(updatedReview);
    });

    it("should handle update errors", async () => {
      mockSupabaseClient = mockSupabaseBuilder
        .withUpdate(null, new Error("Update failed"))
        .build();

      const result = await updateBeachReview("review-1", updateData);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Update failed");
    });
  });

  describe("deleteBeachReview", () => {
    it("should delete review successfully", async () => {
      mockSupabaseClient = mockSupabaseBuilder
        .withDelete("beach-1", null)
        .build();

      const result = await deleteBeachReview("review-1");

      expect(result.success).toBe(true);
      expect(revalidatePath).toHaveBeenCalledWith("/beach/beach-1");
    });

    it("should handle review not found", async () => {
      mockSupabaseClient = mockSupabaseBuilder
        .withDeleteError(new Error("Not found"))
        .build();

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

      mockSupabaseClient = mockSupabaseBuilder
        .withSelectEq("beach-1", mockReviewData, null)
        .build();

      const result = await getBeachReviewStats("beach-1");

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        total_reviews: 2,
        average_overall: 4.5,
        average_wave_quality: 4.5,
        average_crowd_density: 3.5,
        average_parking: 3.5,
        average_accessibility: 4.5,
        distribution: [
          { rating: 5, count: 1 },
          { rating: 4, count: 1 },
          { rating: 3, count: 0 },
          { rating: 2, count: 0 },
          { rating: 1, count: 0 },
        ],
      });
    });

    it("should handle no reviews", async () => {
      mockSupabaseClient = mockSupabaseBuilder
        .withSelectEq("beach-1", [], null)
        .build();

      const result = await getBeachReviewStats("beach-1");

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        total_reviews: 0,
        average_overall: 0,
        average_wave_quality: 0,
        average_crowd_density: 0,
        average_parking: 0,
        average_accessibility: 0,
        distribution: [
          { rating: 5, count: 0 },
          { rating: 4, count: 0 },
          { rating: 3, count: 0 },
          { rating: 2, count: 0 },
          { rating: 1, count: 0 },
        ],
      });
    });

    it("should handle database errors", async () => {
      mockSupabaseClient = mockSupabaseBuilder
        .withSelectEq("beach-1", null, new Error("Stats query failed"))
        .build();

      const result = await getBeachReviewStats("beach-1");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Stats query failed");
    });
  });

  describe("getMultipleBeachReviewStats", () => {
    it("should fetch and calculate stats for multiple beaches", async () => {
      const mockReviews = [
        {
          beach_id: "beach-1",
          overall_rating: 4,
          wave_quality_rating: 5,
          crowd_density_rating: 3,
          parking_rating: 4,
          accessibility_rating: 5,
        },
        {
          beach_id: "beach-1",
          overall_rating: 5,
          wave_quality_rating: 4,
          crowd_density_rating: 3,
          parking_rating: 3,
          accessibility_rating: 4,
        },
        {
          beach_id: "beach-2",
          overall_rating: 3,
          wave_quality_rating: 3,
          crowd_density_rating: 4,
          parking_rating: 2,
          accessibility_rating: 3,
        },
      ];

      mockSupabaseClient = mockSupabaseBuilder
        .withMultipleBeachStats(
          ["beach-1", "beach-2", "beach-3"],
          mockReviews,
          null
        )
        .build();

      const result = await getMultipleBeachReviewStats([
        "beach-1",
        "beach-2",
        "beach-3",
      ]);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        "beach-1": {
          total_reviews: 2,
          average_overall: 4.5,
          average_wave_quality: 4.5,
          average_crowd_density: 3,
          average_parking: 3.5,
          average_accessibility: 4.5,
          distribution: [
            { rating: 5, count: 1 },
            { rating: 4, count: 1 },
            { rating: 3, count: 0 },
            { rating: 2, count: 0 },
            { rating: 1, count: 0 },
          ],
        },
        "beach-2": {
          total_reviews: 1,
          average_overall: 3,
          average_wave_quality: 3,
          average_crowd_density: 4,
          average_parking: 2,
          average_accessibility: 3,
          distribution: [
            { rating: 5, count: 0 },
            { rating: 4, count: 0 },
            { rating: 3, count: 1 },
            { rating: 2, count: 0 },
            { rating: 1, count: 0 },
          ],
        },
        "beach-3": {
          total_reviews: 0,
          average_overall: 0,
          average_wave_quality: 0,
          average_crowd_density: 0,
          average_parking: 0,
          average_accessibility: 0,
          distribution: [
            { rating: 5, count: 0 },
            { rating: 4, count: 0 },
            { rating: 3, count: 0 },
            { rating: 2, count: 0 },
            { rating: 1, count: 0 },
          ],
        },
      });
    });

    it("should return empty object when no beach IDs provided", async () => {
      const result = await getMultipleBeachReviewStats([]);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({});
    });

    it("should handle errors when fetching multiple beach stats", async () => {
      mockSupabaseClient = mockSupabaseBuilder
        .withMultipleBeachStats(
          ["beach-1", "beach-2"],
          null,
          new Error("Database error")
        )
        .build();

      const result = await getMultipleBeachReviewStats(["beach-1", "beach-2"]);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Database error");
    });

    it("should initialize all beaches with zero stats even if no reviews exist", async () => {
      mockSupabaseClient = mockSupabaseBuilder
        .withMultipleBeachStats(["beach-1", "beach-2"], [], null)
        .build();

      const result = await getMultipleBeachReviewStats(["beach-1", "beach-2"]);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        "beach-1": {
          total_reviews: 0,
          average_overall: 0,
          average_wave_quality: 0,
          average_crowd_density: 0,
          average_parking: 0,
          average_accessibility: 0,
          distribution: [
            { rating: 5, count: 0 },
            { rating: 4, count: 0 },
            { rating: 3, count: 0 },
            { rating: 2, count: 0 },
            { rating: 1, count: 0 },
          ],
        },
        "beach-2": {
          total_reviews: 0,
          average_overall: 0,
          average_wave_quality: 0,
          average_crowd_density: 0,
          average_parking: 0,
          average_accessibility: 0,
          distribution: [
            { rating: 5, count: 0 },
            { rating: 4, count: 0 },
            { rating: 3, count: 0 },
            { rating: 2, count: 0 },
            { rating: 1, count: 0 },
          ],
        },
      });
    });
  });

  describe("Edge cases", () => {
    it("should handle network timeouts", async () => {
      mockSupabaseClient = mockSupabaseBuilder
        .withSelect("beach-1", null, new Error("Request timeout"))
        .build();

      const result = await getBeachReviews("beach-1");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Request timeout");
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

      mockSupabaseClient = mockSupabaseBuilder
        .withSelect("beach-1", malformedData, null)
        .build();

      const result = await getBeachReviews("beach-1");

      expect(result.success).toBe(true);
      expect(result.data).toEqual(malformedData);
    });
  });
});
