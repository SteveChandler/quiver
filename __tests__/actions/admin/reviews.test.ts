/**
 * @jest-environment node
 */

jest.mock("@/lib/auth/admin", () => ({
  getCurrentUser: jest.fn(),
  assertIsAdmin: jest.fn(),
}));

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(),
}));

import { createThenableQuery, QueryResult } from "./test-utils";

describe("admin reviews actions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  describe("listReviews", () => {
    test("default behavior excludes soft-deleted (deleted_at is null)", async () => {
      const { getCurrentUser } = await import("@/lib/auth/admin");
      const { createSupabaseServiceRoleClient } = await import("@/lib/supabase/server");

      (getCurrentUser as jest.Mock).mockResolvedValue({ id: "admin-1" });

      const query = createThenableQuery<any[]>({ data: [], error: null });
      (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue({
        from: jest.fn(() => query),
      });

      const { listReviews } = await import("@/actions/admin/reviews");
      const res = await listReviews({});

      expect(res.success).toBe(true);
      expect(query.is).toHaveBeenCalledWith("deleted_at", null);
    });

    test("applies filters correctly (beachId, userId, rating bounds, wave quality bounds)", async () => {
      const { getCurrentUser } = await import("@/lib/auth/admin");
      const { createSupabaseServiceRoleClient } = await import("@/lib/supabase/server");

      (getCurrentUser as jest.Mock).mockResolvedValue({ id: "admin-1" });

      const query = createThenableQuery<any[]>({ data: [], error: null });
      (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue({
        from: jest.fn(() => query),
      });

      const { listReviews } = await import("@/actions/admin/reviews");
      await listReviews({
        beachId: "22222222-2222-2222-2222-222222222222",
        userId: "11111111-1111-1111-1111-111111111111",
        minRating: 2,
        maxRating: 5,
        minWaveQuality: 3,
        maxWaveQuality: 4,
      });

      expect(query.eq).toHaveBeenCalledWith(
        "beach_id",
        "22222222-2222-2222-2222-222222222222"
      );
      expect(query.eq).toHaveBeenCalledWith(
        "user_id",
        "11111111-1111-1111-1111-111111111111"
      );
      expect(query.gte).toHaveBeenCalledWith("overall_rating", 2);
      expect(query.lte).toHaveBeenCalledWith("overall_rating", 5);
      expect(query.gte).toHaveBeenCalledWith("wave_quality_rating", 3);
      expect(query.lte).toHaveBeenCalledWith("wave_quality_rating", 4);
    });

    test("search filtering works across joined fields (email/name/beach_name/title/content)", async () => {
      const { getCurrentUser } = await import("@/lib/auth/admin");
      const { createSupabaseServiceRoleClient } = await import("@/lib/supabase/server");

      (getCurrentUser as jest.Mock).mockResolvedValue({ id: "admin-1" });

      const rows = [
        {
          id: "r1",
          beach_id: "b1",
          user_id: "u1",
          title: "Best spot",
          content: "Super fun",
          overall_rating: 5,
          wave_quality_rating: 5,
          crowd_density_rating: 2,
          parking_rating: 4,
          accessibility_rating: 4,
          helpful_count: 0,
          deleted_at: null,
          profiles: { email: "a@example.com", display_name: "Alice", full_name: null },
          beaches: { name: "Ocean Beach" },
        },
        {
          id: "r2",
          beach_id: "b2",
          user_id: "u2",
          title: "Meh",
          content: "Crowded",
          overall_rating: 2,
          wave_quality_rating: 2,
          crowd_density_rating: 5,
          parking_rating: 2,
          accessibility_rating: 2,
          helpful_count: 0,
          deleted_at: null,
          profiles: { email: "b@example.com", display_name: null, full_name: "Bob B" },
          beaches: { name: "Blacks Beach" },
        },
      ];

      const query = createThenableQuery<any[]>({ data: rows as any, error: null });
      (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue({
        from: jest.fn(() => query),
      });

      const { listReviews } = await import("@/actions/admin/reviews");

      const byEmail = await listReviews({ search: "a@example.com" });
      expect(byEmail.success).toBe(true);
      expect(byEmail.data?.map((r: any) => r.id)).toEqual(["r1"]);

      const byName = await listReviews({ search: "bob" });
      expect(byName.data?.map((r: any) => r.id)).toEqual(["r2"]);

      const byBeach = await listReviews({ search: "ocean" });
      expect(byBeach.data?.map((r: any) => r.id)).toEqual(["r1"]);

      const byTitle = await listReviews({ search: "meh" });
      expect(byTitle.data?.map((r: any) => r.id)).toEqual(["r2"]);

      const byContent = await listReviews({ search: "fun" });
      expect(byContent.data?.map((r: any) => r.id)).toEqual(["r1"]);
    });

    test("throws a clear error when Supabase returns an error (wrapped into success:false)", async () => {
      const { getCurrentUser } = await import("@/lib/auth/admin");
      const { createSupabaseServiceRoleClient } = await import("@/lib/supabase/server");

      (getCurrentUser as jest.Mock).mockResolvedValue({ id: "admin-1" });

      const query = createThenableQuery<any[]>({
        data: null,
        error: { message: "db err" },
      });
      (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue({
        from: jest.fn(() => query),
      });

      const { listReviews } = await import("@/actions/admin/reviews");
      const res = await listReviews({});

      expect(res.success).toBe(false);
      expect(res.error).toBe("Failed to fetch reviews: db err");
    });
  });

  describe("getReviewStats", () => {
    test("aggregations ignore deleted rows and handle empty dataset without divide-by-zero", async () => {
      const { getCurrentUser } = await import("@/lib/auth/admin");
      const { createSupabaseServiceRoleClient } = await import("@/lib/supabase/server");

      (getCurrentUser as jest.Mock).mockResolvedValue({ id: "admin-1" });

      // Empty dataset
      const queryEmpty = createThenableQuery<any[]>({ data: [], error: null });
      (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue({
        from: jest.fn(() => queryEmpty),
      });

      const { getReviewStats } = await import("@/actions/admin/reviews");
      const emptyRes = await getReviewStats({});

      expect(emptyRes.success).toBe(true);
      expect(emptyRes.data).toEqual({
        total: 0,
        deleted: 0,
        avgOverallRating: null,
        avgWaveQuality: null,
        avgCrowdDensity: null,
        avgParking: null,
        avgAccessibility: null,
        totalHelpfulVotes: 0,
      });

      // Mixed dataset (deleted + active)
      const rows = [
        {
          overall_rating: 5,
          wave_quality_rating: 4,
          crowd_density_rating: 2,
          parking_rating: 3,
          accessibility_rating: 4,
          helpful_count: 2,
          deleted_at: null,
        },
        {
          overall_rating: 1,
          wave_quality_rating: 1,
          crowd_density_rating: 5,
          parking_rating: 1,
          accessibility_rating: 1,
          helpful_count: 10,
          deleted_at: "2025-01-01T00:00:00Z",
        },
      ];

      const queryMixed = createThenableQuery<any[]>({ data: rows as any, error: null });
      (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue({
        from: jest.fn(() => queryMixed),
      });

      const mixedRes = await getReviewStats({});
      expect(mixedRes.success).toBe(true);
      expect(mixedRes.data?.total).toBe(1);
      expect(mixedRes.data?.deleted).toBe(1);
      expect(mixedRes.data?.totalHelpfulVotes).toBe(2); // deleted ignored
      expect(mixedRes.data?.avgOverallRating).toBe(5);
      expect(mixedRes.data?.avgWaveQuality).toBe(4);
    });
  });
});



