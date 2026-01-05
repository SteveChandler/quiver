/**
 * @jest-environment node
 */

import { createThenableQuery } from "@/__tests__/setup/admin-action-test-utils";

jest.mock("@/lib/auth/admin", () => ({
  getCurrentUser: jest.fn(),
  assertIsAdmin: jest.fn(),
}));

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(),
}));

describe("admin sessions actions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  describe("listSessions", () => {
    test("default behavior excludes soft-deleted (deleted_at is null)", async () => {
      const { getCurrentUser } = await import("@/lib/auth/admin");
      const { createSupabaseServiceRoleClient } = await import("@/lib/supabase/server");

      (getCurrentUser as jest.Mock).mockResolvedValue({ id: "admin-1" });

      const query = createThenableQuery<any[]>({ data: [], error: null });
      (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue({
        from: jest.fn(() => query),
      });

      const { listSessions } = await import("@/actions/admin/sessions");
      const res = await listSessions({});

      expect(res.success).toBe(true);
      expect(query.is).toHaveBeenCalledWith("deleted_at", null);
    });

    test("applies filters correctly (userId, beachId, status, isPublic, dateFrom/dateTo, rating bounds)", async () => {
      const { getCurrentUser } = await import("@/lib/auth/admin");
      const { createSupabaseServiceRoleClient } = await import("@/lib/supabase/server");

      (getCurrentUser as jest.Mock).mockResolvedValue({ id: "admin-1" });

      const query = createThenableQuery<any[]>({ data: [], error: null });
      (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue({
        from: jest.fn(() => query),
      });

      const { listSessions } = await import("@/actions/admin/sessions");
      await listSessions({
        userId: "11111111-1111-1111-1111-111111111111",
        beachId: "22222222-2222-2222-2222-222222222222",
        status: "logged",
        isPublic: false,
        dateFrom: "2025-01-01T00:00:00Z",
        dateTo: "2025-01-31T23:59:59Z",
        minRating: 2,
        maxRating: 5,
      });

      expect(query.eq).toHaveBeenCalledWith(
        "user_id",
        "11111111-1111-1111-1111-111111111111"
      );
      expect(query.eq).toHaveBeenCalledWith(
        "beach_id",
        "22222222-2222-2222-2222-222222222222"
      );
      expect(query.eq).toHaveBeenCalledWith("status", "logged");
      expect(query.eq).toHaveBeenCalledWith("is_public", false);
      expect(query.gte).toHaveBeenCalledWith("arrival_time", "2025-01-01T00:00:00Z");
      expect(query.lte).toHaveBeenCalledWith("arrival_time", "2025-01-31T23:59:59Z");
      expect(query.gte).toHaveBeenCalledWith("rating", 2);
      expect(query.lte).toHaveBeenCalledWith("rating", 5);
    });

    test("search filtering works across joined fields and text fields (email/name/beach_name/description/notes)", async () => {
      const { getCurrentUser } = await import("@/lib/auth/admin");
      const { createSupabaseServiceRoleClient } = await import("@/lib/supabase/server");

      (getCurrentUser as jest.Mock).mockResolvedValue({ id: "admin-1" });

      const rows = [
        {
          id: "s1",
          user_id: "u1",
          beach_id: "b1",
          beach_name: "Ocean Beach",
          description: "Great session",
          notes: "met friends",
          profiles: { email: "a@example.com", display_name: "Alice", full_name: null },
          likes_count: 0,
          comments_count: 0,
          arrival_time: "2025-01-01T10:00:00Z",
          duration_minutes: 60,
          rating: 4,
          wave_quality: null,
          crowd_level: null,
          is_public: true,
          created_at: "2025-01-01T10:00:00Z",
          deleted_at: null,
          goals: [],
          invitee_ids: [],
          image_url: null,
        },
        {
          id: "s2",
          user_id: "u2",
          beach_id: "b2",
          beach_name: "Blacks Beach",
          description: "Charged",
          notes: "heavy",
          profiles: { email: "b@example.com", display_name: null, full_name: "Bob B" },
          likes_count: 0,
          comments_count: 0,
          arrival_time: "2025-01-02T10:00:00Z",
          duration_minutes: 60,
          rating: 5,
          wave_quality: null,
          crowd_level: null,
          is_public: true,
          created_at: "2025-01-02T10:00:00Z",
          deleted_at: null,
          goals: [],
          invitee_ids: [],
          image_url: null,
        },
      ];

      const query = createThenableQuery<any[]>({ data: rows as any, error: null });
      (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue({
        from: jest.fn(() => query),
      });

      const { listSessions } = await import("@/actions/admin/sessions");

      const byEmail = await listSessions({ search: "a@example.com" });
      expect(byEmail.success).toBe(true);
      expect(byEmail.data?.map((s: any) => s.id)).toEqual(["s1"]);

      const byName = await listSessions({ search: "bob" });
      expect(byName.data?.map((s: any) => s.id)).toEqual(["s2"]);

      const byBeach = await listSessions({ search: "ocean" });
      expect(byBeach.data?.map((s: any) => s.id)).toEqual(["s1"]);

      const byNotes = await listSessions({ search: "heavy" });
      expect(byNotes.data?.map((s: any) => s.id)).toEqual(["s2"]);
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

      const { listSessions } = await import("@/actions/admin/sessions");
      const res = await listSessions({});

      expect(res.success).toBe(false);
      expect(res.error).toBe("Failed to fetch sessions: db err");
    });
  });

  describe("getSessionStats", () => {
    test("aggregations ignore deleted rows and handle empty dataset without divide-by-zero", async () => {
      const { getCurrentUser } = await import("@/lib/auth/admin");
      const { createSupabaseServiceRoleClient } = await import("@/lib/supabase/server");

      (getCurrentUser as jest.Mock).mockResolvedValue({ id: "admin-1" });

      // Empty dataset
      const queryEmpty = createThenableQuery<any[]>({ data: [], error: null });
      (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue({
        from: jest.fn(() => queryEmpty),
      });

      const { getSessionStats } = await import("@/actions/admin/sessions");
      const emptyRes = await getSessionStats({});

      expect(emptyRes.success).toBe(true);
      expect(emptyRes.data).toEqual({
        total: 0,
        public: 0,
        private: 0,
        planned: 0,
        logged: 0,
        cancelled: 0,
        deleted: 0,
        avgRating: null,
        totalLikes: 0,
        totalComments: 0,
      });

      // Mixed dataset (deleted + active)
      const rows = [
        {
          is_public: true,
          status: "logged",
          rating: 4,
          likes_count: 2,
          comments_count: 1,
          deleted_at: null,
        },
        {
          is_public: false,
          status: "planned",
          rating: 2,
          likes_count: 5,
          comments_count: 0,
          deleted_at: "2025-01-01T00:00:00Z",
        },
      ];

      const queryMixed = createThenableQuery<any[]>({ data: rows as any, error: null });
      (createSupabaseServiceRoleClient as jest.Mock).mockReturnValue({
        from: jest.fn(() => queryMixed),
      });

      const mixedRes = await getSessionStats({});
      expect(mixedRes.success).toBe(true);
      expect(mixedRes.data?.total).toBe(1);
      expect(mixedRes.data?.deleted).toBe(1);
      expect(mixedRes.data?.public).toBe(1);
      expect(mixedRes.data?.private).toBe(0);
      expect(mixedRes.data?.logged).toBe(1);
      expect(mixedRes.data?.planned).toBe(0);
      expect(mixedRes.data?.totalLikes).toBe(2); // deleted ignored
      expect(mixedRes.data?.totalComments).toBe(1);
    });
  });
});



