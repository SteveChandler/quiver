/**
 * @jest-environment node
 */

const mockSupabaseClient = {
  from: jest.fn(),
  rpc: jest.fn(),
  auth: {
    getUser: jest.fn(),
  },
};

const mockServiceRoleClient = {
  from: jest.fn(),
};

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: jest.fn(() => mockSupabaseClient),
  createSupabaseServiceRoleClient: jest.fn(() => mockServiceRoleClient),
}));

jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
}));

import { revalidatePath } from "next/cache";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

const BEACH_ID = "550e8400-e29b-41d4-a716-446655440000";
const USER_ID = "user-123";

function mockAuthenticatedUser(userId = USER_ID): void {
  (mockSupabaseClient.auth.getUser as jest.Mock).mockResolvedValue({
    data: { user: { id: userId } },
    error: null,
  });
}

function mockProfileLookup(isMock: boolean): void {
  (mockSupabaseClient.from as jest.Mock).mockImplementation((table: string) => {
    if (table !== "profiles") {
      throw new Error(`Unexpected table for auth client: ${table}`);
    }

    return {
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { is_mock: isMock },
            error: null,
          }),
        }),
      }),
    };
  });
}

function mockManualFavoritePath(options: {
  existingFavorite?: { id: string } | null;
  ranks?: Array<{ rank: number | null }>;
  insertError?: { message: string } | null;
  deleteError?: { message: string } | null;
} = {}): jest.Mock {
  const {
    existingFavorite = null,
    ranks = [],
    insertError = null,
    deleteError = null,
  } = options;

  const favoriteFrom = jest.fn().mockImplementation((table: string) => {
    if (table !== "favorite_beaches") {
      throw new Error(`Unexpected table for service role client: ${table}`);
    }

    return {
      select: jest.fn().mockImplementation((columns: string) => {
        if (columns === "id") {
          return {
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                maybeSingle: jest.fn().mockResolvedValue({
                  data: existingFavorite,
                  error: null,
                }),
              }),
            }),
          };
        }

        if (columns === "rank") {
          return {
            eq: jest.fn().mockResolvedValue({
              data: ranks,
              error: null,
            }),
          };
        }

        throw new Error(`Unexpected select: ${columns}`);
      }),
      insert: jest.fn().mockResolvedValue({ error: insertError }),
      delete: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: deleteError }),
        }),
      }),
    };
  });

  mockServiceRoleClient.from = favoriteFrom;
  return favoriteFrom;
}

describe("POST /api/beaches/[id]/favorite/toggle", () => {
  let POST: any;
  let NextRequest: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    delete process.env.ALLOW_E2E_MUTATIONS_DEV;

    const route = await import("@/app/api/beaches/[id]/favorite/toggle/route");
    POST = route.POST;

    const nextServer = await import("next/server");
    NextRequest = nextServer.NextRequest;

    mockAuthenticatedUser();
    (mockSupabaseClient.rpc as jest.Mock).mockResolvedValue({
      data: "added",
      error: null,
    });
  });

  afterEach(() => {
    delete process.env.ALLOW_E2E_MUTATIONS_DEV;
  });

  async function postFavorite(beachId = BEACH_ID) {
    const req = new NextRequest(
      new URL(`http://localhost/api/beaches/${beachId}/favorite/toggle`)
    );

    return POST(req, { params: { id: beachId } });
  }

  describe("Authentication", () => {
    it("returns 401 when user is not authenticated", async () => {
      (mockSupabaseClient.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: null },
        error: { message: "Not authenticated" },
      });

      const res = await postFavorite();

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toMatch(/authentication required/i);
      expect(mockSupabaseClient.rpc).not.toHaveBeenCalled();
    });
  });

  describe("UUID Validation", () => {
    it("returns 400 for invalid UUID format", async () => {
      const res = await postFavorite("not-a-uuid");

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toMatch(/invalid.*beach/i);
      expect(mockSupabaseClient.rpc).not.toHaveBeenCalled();
    });
  });

  describe("Guarded RPC path", () => {
    it("adds a favorite from the guarded RPC text return", async () => {
      (mockSupabaseClient.rpc as jest.Mock).mockResolvedValue({
        data: "added",
        error: null,
      });

      const res = await postFavorite();

      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith(
        "toggle_favorite_beach_guarded",
        { p_beach_id: BEACH_ID }
      );
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data).toEqual({ action: "added" });
    });

    it("removes a favorite from the guarded RPC text return", async () => {
      (mockSupabaseClient.rpc as jest.Mock).mockResolvedValue({
        data: "removed",
        error: null,
      });

      const res = await postFavorite();

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data).toEqual({ action: "removed" });
    });

    it("revalidates favorite surfaces after a successful RPC toggle", async () => {
      await postFavorite();

      expect(revalidatePath).toHaveBeenCalledWith("/profile");
      expect(revalidatePath).toHaveBeenCalledWith("/");
    });

    it("maps favorite quota errors from message to 403 with typed details", async () => {
      (mockSupabaseClient.rpc as jest.Mock).mockResolvedValue({
        data: null,
        error: { message: "favorite_quota_exceeded" },
      });

      const res = await postFavorite();

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.details).toEqual({
        code: "favorite_quota_exceeded",
        limit: 3,
      });
    });

    it("maps favorite quota errors from details to 403 with typed details", async () => {
      (mockSupabaseClient.rpc as jest.Mock).mockResolvedValue({
        data: null,
        error: {
          message: "quota failed",
          details: "free_favorites_limit",
        },
      });

      const res = await postFavorite();

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.details).toEqual({
        code: "favorite_quota_exceeded",
        limit: 3,
      });
    });

    it("returns 500 for non-quota RPC errors", async () => {
      const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      (mockSupabaseClient.rpc as jest.Mock).mockResolvedValue({
        data: null,
        error: { message: "database unavailable" },
      });

      try {
        const res = await postFavorite();

        expect(res.status).toBe(500);
        const json = await res.json();
        expect(json.success).toBe(false);
        expect(json.error).toMatch(/failed to toggle favorite/i);
      } finally {
        errorSpy.mockRestore();
      }
    });
  });

  describe("Dev E2E Bypass (Mock User with Service Role)", () => {
    beforeEach(() => {
      process.env.ALLOW_E2E_MUTATIONS_DEV = "1";
    });

    it("preserves the service-role manual add path for mock users", async () => {
      mockAuthenticatedUser("mock-user-123");
      mockProfileLookup(true);
      const serviceFrom = mockManualFavoritePath({
        existingFavorite: null,
        ranks: [{ rank: 1 }, { rank: 3 }],
      });

      const res = await postFavorite();

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data).toEqual({ action: "added" });
      expect(createSupabaseServiceRoleClient).toHaveBeenCalled();
      expect(serviceFrom).toHaveBeenCalledWith("favorite_beaches");
      expect(mockSupabaseClient.rpc).not.toHaveBeenCalled();
    });

    it("preserves the service-role manual remove path for mock users", async () => {
      mockAuthenticatedUser("mock-user-123");
      mockProfileLookup(true);
      mockManualFavoritePath({
        existingFavorite: { id: "favorite-id-123" },
      });

      const res = await postFavorite();

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data).toEqual({ action: "removed" });
      expect(createSupabaseServiceRoleClient).toHaveBeenCalled();
      expect(mockSupabaseClient.rpc).not.toHaveBeenCalled();
    });

    it("uses the guarded RPC for non-mock users even when the E2E flag is enabled", async () => {
      mockProfileLookup(false);
      (mockSupabaseClient.rpc as jest.Mock).mockResolvedValue({
        data: "removed",
        error: null,
      });

      const res = await postFavorite();

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.data).toEqual({ action: "removed" });
      expect(createSupabaseServiceRoleClient).not.toHaveBeenCalled();
      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith(
        "toggle_favorite_beach_guarded",
        { p_beach_id: BEACH_ID }
      );
    });
  });
});
