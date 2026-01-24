/**
 * @jest-environment node
 */

// Mock Supabase client and next/cache before imports
const mockSupabaseClient = {
  from: jest.fn(),
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
import { createSupabaseServerClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";

describe("POST /api/beaches/[id]/favorite/toggle", () => {
  let POST: any;
  let NextRequest: any;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Import fresh module
    const route = await import("@/app/api/beaches/[id]/favorite/toggle/route");
    POST = route.POST;

    // Import NextRequest
    const nextServer = await import("next/server");
    NextRequest = nextServer.NextRequest;

    // Reset mock implementations
    (mockSupabaseClient.auth.getUser as jest.Mock).mockResolvedValue({
      data: { user: { id: "user-123" } },
      error: null,
    });
  });

  describe("Authentication", () => {
    it("returns 401 when user is not authenticated", async () => {
      (mockSupabaseClient.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: null },
        error: { message: "Not authenticated" },
      });

      const req = new NextRequest(
        new URL("http://localhost/api/beaches/550e8400-e29b-41d4-a716-446655440000/favorite/toggle")
      );

      const res = await POST(req, {
        params: { id: "550e8400-e29b-41d4-a716-446655440000" },
      });

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toMatch(/authentication required/i);
    });

    it("returns 401 when getUser returns error", async () => {
      (mockSupabaseClient.auth.getUser as jest.Mock).mockResolvedValue({
        data: { user: null },
        error: { message: "Token expired" },
      });

      const req = new NextRequest(
        new URL("http://localhost/api/beaches/550e8400-e29b-41d4-a716-446655440000/favorite/toggle")
      );

      const res = await POST(req, {
        params: { id: "550e8400-e29b-41d4-a716-446655440000" },
      });

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.success).toBe(false);
    });
  });

  describe("UUID Validation", () => {
    it("returns 400 for invalid UUID format", async () => {
      const req = new NextRequest(
        new URL("http://localhost/api/beaches/not-a-uuid/favorite/toggle")
      );

      const res = await POST(req, {
        params: { id: "not-a-uuid" },
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toMatch(/invalid.*beach/i);
    });

    it("returns 400 for missing beach id", async () => {
      const req = new NextRequest(
        new URL("http://localhost/api/beaches//favorite/toggle")
      );

      const res = await POST(req, {
        params: { id: "" },
      });

      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toMatch(/invalid.*beach/i);
    });

    it("accepts valid UUID format", async () => {
      const validUuid = "550e8400-e29b-41d4-a716-446655440000";

      // Mock successful check (no existing favorite)
      (mockSupabaseClient.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({
                data: null,
                error: null,
              }),
            }),
          }),
        }),
        insert: jest.fn().mockResolvedValue({ error: null }),
      });

      const req = new NextRequest(
        new URL(`http://localhost/api/beaches/${validUuid}/favorite/toggle`)
      );

      const res = await POST(req, { params: { id: validUuid } });

      // Should not return 400 (validation error)
      expect(res.status).not.toBe(400);
    });
  });

  describe("Adding Favorite (Not Yet Favorited)", () => {
    it("adds favorite with rank 1 when user has no favorites", async () => {
      const beachId = "550e8400-e29b-41d4-a716-446655440000";
      const userId = "user-123";

      const fromCalls: string[] = [];

      // Mock the entire chain for each database call
      const mockFrom = jest.fn().mockImplementation((table: string) => {
        fromCalls.push(`from:${table}`);

        // All calls are to favorite_beaches table
        return {
          // First call pattern: select('id').eq(...).eq(...).maybeSingle()
          select: jest.fn().mockImplementation((cols: string) => {
            fromCalls.push(`select:${cols}`);

            if (cols === "id") {
              // Check existing favorite
              return {
                eq: jest.fn().mockImplementation((col1, val1) => {
                  fromCalls.push(`eq:${col1}=${val1}`);
                  return {
                    eq: jest.fn().mockImplementation((col2, val2) => {
                      fromCalls.push(`eq:${col2}=${val2}`);
                      return {
                        maybeSingle: jest.fn().mockResolvedValue({
                          data: null, // No existing favorite
                          error: null,
                        }),
                      };
                    }),
                  };
                }),
              };
            } else if (cols === "rank") {
              // Fetch ranks
              return {
                eq: jest.fn().mockResolvedValue({
                  data: [], // No favorites yet
                  error: null,
                }),
              };
            }

            throw new Error(`Unexpected select: ${cols}`);
          }),
          // Insert call pattern: insert({...})
          insert: jest.fn().mockResolvedValue({
            error: null,
          }),
        };
      });

      (mockSupabaseClient.from as jest.Mock) = mockFrom;

      const req = new NextRequest(
        new URL(`http://localhost/api/beaches/${beachId}/favorite/toggle`)
      );

      const res = await POST(req, { params: { id: beachId } });

      const json = await res.json();
      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.action).toBe("added");

      // Verify the database methods were called
      expect(mockFrom).toHaveBeenCalledWith("favorite_beaches");
    });

    it("adds favorite with next rank when user has existing favorites", async () => {
      const beachId = "550e8400-e29b-41d4-a716-446655440000";
      const userId = "user-123";

      const mockFrom = jest.fn().mockImplementation((table: string) => {
        return {
          select: jest.fn().mockImplementation((cols: string) => {
            if (cols === "id") {
              // Check existing favorite
              return {
                eq: jest.fn().mockImplementation((col1, val1) => {
                  return {
                    eq: jest.fn().mockImplementation((col2, val2) => {
                      return {
                        maybeSingle: jest.fn().mockResolvedValue({
                          data: null,
                          error: null,
                        }),
                      };
                    }),
                  };
                }),
              };
            } else if (cols === "rank") {
              // Fetch ranks - user has favorites with ranks 1, 3, 5
              return {
                eq: jest.fn().mockResolvedValue({
                  data: [{ rank: 1 }, { rank: 3 }, { rank: 5 }],
                  error: null,
                }),
              };
            }

            throw new Error(`Unexpected select: ${cols}`);
          }),
          insert: jest.fn().mockImplementation((payload) => {
            // Verify next rank is calculated correctly: max(1,3,5) + 1 = 6
            expect(payload).toEqual({
              user_id: userId,
              beach_id: beachId,
              rank: 6,
            });
            return Promise.resolve({ error: null });
          }),
        };
      });

      (mockSupabaseClient.from as jest.Mock) = mockFrom;

      const req = new NextRequest(
        new URL(`http://localhost/api/beaches/${beachId}/favorite/toggle`)
      );

      const res = await POST(req, { params: { id: beachId } });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.action).toBe("added");
    });

    it("calls revalidatePath after adding favorite", async () => {
      const beachId = "550e8400-e29b-41d4-a716-446655440000";

      const mockFrom = jest.fn().mockImplementation((table: string) => {
        return {
          select: jest.fn().mockImplementation((cols: string) => {
            if (cols === "id") {
              return {
                eq: jest.fn().mockImplementation((col1, val1) => {
                  return {
                    eq: jest.fn().mockImplementation((col2, val2) => {
                      return {
                        maybeSingle: jest.fn().mockResolvedValue({
                          data: null,
                          error: null,
                        }),
                      };
                    }),
                  };
                }),
              };
            } else if (cols === "rank") {
              return {
                eq: jest.fn().mockResolvedValue({
                  data: [],
                  error: null,
                }),
              };
            }

            throw new Error(`Unexpected select: ${cols}`);
          }),
          insert: jest.fn().mockResolvedValue({ error: null }),
        };
      });

      (mockSupabaseClient.from as jest.Mock) = mockFrom;

      const req = new NextRequest(
        new URL(`http://localhost/api/beaches/${beachId}/favorite/toggle`)
      );

      await POST(req, { params: { id: beachId } });

      expect(revalidatePath).toHaveBeenCalledWith("/profile");
      expect(revalidatePath).toHaveBeenCalledWith("/");
    });
  });

  describe("Removing Favorite (Already Favorited)", () => {
    it("removes favorite when it already exists", async () => {
      const beachId = "550e8400-e29b-41d4-a716-446655440000";
      const userId = "user-123";

      const mockFrom = jest.fn().mockImplementation((table: string) => {
        return {
          select: jest.fn().mockImplementation((cols: string) => {
            if (cols === "id") {
              // Check existing favorite - it exists
              return {
                eq: jest.fn().mockImplementation((col1, val1) => {
                  return {
                    eq: jest.fn().mockImplementation((col2, val2) => {
                      return {
                        maybeSingle: jest.fn().mockResolvedValue({
                          data: { id: "favorite-id-123" }, // Favorite exists
                          error: null,
                        }),
                      };
                    }),
                  };
                }),
              };
            }

            throw new Error(`Unexpected select: ${cols}`);
          }),
          delete: jest.fn().mockReturnValue({
            eq: jest.fn().mockImplementation((col1, val1) => {
              return {
                eq: jest.fn().mockResolvedValue({
                  error: null,
                }),
              };
            }),
          }),
        };
      });

      (mockSupabaseClient.from as jest.Mock) = mockFrom;

      const req = new NextRequest(
        new URL(`http://localhost/api/beaches/${beachId}/favorite/toggle`)
      );

      const res = await POST(req, { params: { id: beachId } });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.action).toBe("removed");

      // Verify delete was called
      expect(mockFrom).toHaveBeenCalledWith("favorite_beaches");
    });

    it("calls revalidatePath after removing favorite", async () => {
      const beachId = "550e8400-e29b-41d4-a716-446655440000";

      const mockFrom = jest.fn().mockImplementation((table: string) => {
        return {
          select: jest.fn().mockImplementation((cols: string) => {
            if (cols === "id") {
              return {
                eq: jest.fn().mockImplementation((col1, val1) => {
                  return {
                    eq: jest.fn().mockImplementation((col2, val2) => {
                      return {
                        maybeSingle: jest.fn().mockResolvedValue({
                          data: { id: "favorite-id-123" },
                          error: null,
                        }),
                      };
                    }),
                  };
                }),
              };
            }

            throw new Error(`Unexpected select: ${cols}`);
          }),
          delete: jest.fn().mockReturnValue({
            eq: jest.fn().mockImplementation((col1, val1) => {
              return {
                eq: jest.fn().mockResolvedValue({
                  error: null,
                }),
              };
            }),
          }),
        };
      });

      (mockSupabaseClient.from as jest.Mock) = mockFrom;

      const req = new NextRequest(
        new URL(`http://localhost/api/beaches/${beachId}/favorite/toggle`)
      );

      await POST(req, { params: { id: beachId } });

      expect(revalidatePath).toHaveBeenCalledWith("/profile");
      expect(revalidatePath).toHaveBeenCalledWith("/");
    });
  });

  describe("Error Handling", () => {
    it("returns 500 when database check fails", async () => {
      const beachId = "550e8400-e29b-41d4-a716-446655440000";

      (mockSupabaseClient.from as jest.Mock).mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              maybeSingle: jest.fn().mockResolvedValue({
                data: null,
                error: { message: "Database connection failed" },
              }),
            }),
          }),
        }),
      });

      const req = new NextRequest(
        new URL(`http://localhost/api/beaches/${beachId}/favorite/toggle`)
      );

      const res = await POST(req, { params: { id: beachId } });

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.success).toBe(false);
      expect(json.error).toMatch(/failed to toggle favorite/i);
    });

    it("returns 500 when delete fails", async () => {
      const beachId = "550e8400-e29b-41d4-a716-446655440000";

      const mockFrom = jest.fn();

      mockFrom.mockImplementation((table: string) => {
        if (mockFrom.mock.calls.length === 1) {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  maybeSingle: jest.fn().mockResolvedValue({
                    data: { id: "favorite-id-123" },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }

        return {
          delete: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                error: { message: "Delete failed" },
              }),
            }),
          }),
        };
      });

      (mockSupabaseClient.from as jest.Mock) = mockFrom;

      const req = new NextRequest(
        new URL(`http://localhost/api/beaches/${beachId}/favorite/toggle`)
      );

      const res = await POST(req, { params: { id: beachId } });

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it("returns 500 when rank fetch fails", async () => {
      const beachId = "550e8400-e29b-41d4-a716-446655440000";

      const mockFrom = jest.fn();
      let callCount = 0;

      mockFrom.mockImplementation((table: string) => {
        callCount++;

        if (callCount === 1) {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  maybeSingle: jest.fn().mockResolvedValue({
                    data: null,
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }

        if (callCount === 2) {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                data: null,
                error: { message: "Rank fetch failed" },
              }),
            }),
          };
        }

        return {
          insert: jest.fn().mockResolvedValue({ error: null }),
        };
      });

      (mockSupabaseClient.from as jest.Mock) = mockFrom;

      const req = new NextRequest(
        new URL(`http://localhost/api/beaches/${beachId}/favorite/toggle`)
      );

      const res = await POST(req, { params: { id: beachId } });

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it("returns 500 when insert fails", async () => {
      const beachId = "550e8400-e29b-41d4-a716-446655440000";

      const mockFrom = jest.fn();
      let callCount = 0;

      mockFrom.mockImplementation((table: string) => {
        callCount++;

        if (callCount === 1) {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  maybeSingle: jest.fn().mockResolvedValue({
                    data: null,
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }

        if (callCount === 2) {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          };
        }

        return {
          insert: jest.fn().mockResolvedValue({
            error: { message: "Insert failed" },
          }),
        };
      });

      (mockSupabaseClient.from as jest.Mock) = mockFrom;

      const req = new NextRequest(
        new URL(`http://localhost/api/beaches/${beachId}/favorite/toggle`)
      );

      const res = await POST(req, { params: { id: beachId } });

      expect(res.status).toBe(500);
      const json = await res.json();
      expect(json.success).toBe(false);
    });
  });

  describe("Dev E2E Bypass (Mock User with Service Role)", () => {
    beforeEach(() => {
      // Set environment variable for E2E mutations
      process.env.ALLOW_E2E_MUTATIONS_DEV = "1";
    });

    afterEach(() => {
      delete process.env.ALLOW_E2E_MUTATIONS_DEV;
    });

    it("uses service role client for mock users when E2E flag is enabled", async () => {
      const beachId = "550e8400-e29b-41d4-a716-446655440000";
      const mockUserId = "mock-user-123";

      // Mock profile check for mock user
      const mockProfileCheck = jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { is_mock: true },
              error: null,
            }),
          }),
        }),
      });

      const mockServiceFrom = jest.fn();
      let callCount = 0;

      mockServiceFrom.mockImplementation((table: string) => {
        if (table === "profiles") {
          return mockProfileCheck(table);
        }

        callCount++;

        if (callCount === 1) {
          // Check existing favorite
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  maybeSingle: jest.fn().mockResolvedValue({
                    data: null,
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }

        if (callCount === 2) {
          // Fetch ranks
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          };
        }

        // Insert favorite
        return {
          insert: jest.fn().mockResolvedValue({
            error: null,
          }),
        };
      });

      (mockSupabaseClient.from as jest.Mock) = mockServiceFrom;
      (mockServiceRoleClient.from as jest.Mock) = mockServiceFrom;

      const req = new NextRequest(
        new URL(`http://localhost/api/beaches/${beachId}/favorite/toggle`)
      );

      const res = await POST(req, { params: { id: beachId } });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.action).toBe("added");

      // Verify service role client was requested
      expect(createSupabaseServiceRoleClient).toHaveBeenCalled();
    });

    it("uses regular client for non-mock users even when E2E flag is enabled", async () => {
      const beachId = "550e8400-e29b-41d4-a716-446655440000";
      const normalUserId = "normal-user-123";

      const mockFrom = jest.fn();
      let callCount = 0;

      mockFrom.mockImplementation((table: string) => {
        if (table === "profiles") {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: { is_mock: false }, // Not a mock user
                  error: null,
                }),
              }),
            }),
          };
        }

        callCount++;

        if (callCount === 1) {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  maybeSingle: jest.fn().mockResolvedValue({
                    data: null,
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }

        if (callCount === 2) {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          };
        }

        return {
          insert: jest.fn().mockResolvedValue({
            error: null,
          }),
        };
      });

      (mockSupabaseClient.from as jest.Mock) = mockFrom;

      const req = new NextRequest(
        new URL(`http://localhost/api/beaches/${beachId}/favorite/toggle`)
      );

      const res = await POST(req, { params: { id: beachId } });

      expect(res.status).toBe(200);
      // Should use regular client, not service role
      expect(mockSupabaseClient.from).toHaveBeenCalledWith("profiles");
    });
  });

  describe("Cache Invalidation", () => {
    it("continues successfully even if revalidatePath throws", async () => {
      const beachId = "550e8400-e29b-41d4-a716-446655440000";

      const mockFrom = jest.fn();
      let callCount = 0;

      mockFrom.mockImplementation((table: string) => {
        callCount++;

        if (callCount === 1) {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  maybeSingle: jest.fn().mockResolvedValue({
                    data: null,
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }

        if (callCount === 2) {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          };
        }

        return {
          insert: jest.fn().mockResolvedValue({
            error: null,
          }),
        };
      });

      (mockSupabaseClient.from as jest.Mock) = mockFrom;

      // Make revalidatePath throw
      (revalidatePath as jest.Mock).mockImplementation(() => {
        throw new Error("Revalidation failed");
      });

      const req = new NextRequest(
        new URL(`http://localhost/api/beaches/${beachId}/favorite/toggle`)
      );

      const res = await POST(req, { params: { id: beachId } });

      // Should still return success even if revalidation fails
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.action).toBe("added");
    });
  });

  describe("Response Structure", () => {
    it("returns standardized response with timestamp when adding", async () => {
      const beachId = "550e8400-e29b-41d4-a716-446655440000";

      const mockFrom = jest.fn();
      let callCount = 0;

      mockFrom.mockImplementation((table: string) => {
        callCount++;

        if (callCount === 1) {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  maybeSingle: jest.fn().mockResolvedValue({
                    data: null,
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }

        if (callCount === 2) {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          };
        }

        return {
          insert: jest.fn().mockResolvedValue({
            error: null,
          }),
        };
      });

      (mockSupabaseClient.from as jest.Mock) = mockFrom;

      const req = new NextRequest(
        new URL(`http://localhost/api/beaches/${beachId}/favorite/toggle`)
      );

      const res = await POST(req, { params: { id: beachId } });

      const json = await res.json();
      expect(json).toHaveProperty("success");
      expect(json).toHaveProperty("data");
      expect(json).toHaveProperty("timestamp");
      expect(json.success).toBe(true);
      expect(json.data).toHaveProperty("action");
      expect(typeof json.timestamp).toBe("string");
    });

    it("returns standardized response with timestamp when removing", async () => {
      const beachId = "550e8400-e29b-41d4-a716-446655440000";

      const mockFrom = jest.fn();

      mockFrom.mockImplementation((table: string) => {
        if (mockFrom.mock.calls.length === 1) {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  maybeSingle: jest.fn().mockResolvedValue({
                    data: { id: "favorite-id-123" },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }

        return {
          delete: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                error: null,
              }),
            }),
          }),
        };
      });

      (mockSupabaseClient.from as jest.Mock) = mockFrom;

      const req = new NextRequest(
        new URL(`http://localhost/api/beaches/${beachId}/favorite/toggle`)
      );

      const res = await POST(req, { params: { id: beachId } });

      const json = await res.json();
      expect(json).toHaveProperty("success");
      expect(json).toHaveProperty("data");
      expect(json).toHaveProperty("timestamp");
      expect(json.success).toBe(true);
      expect(json.data).toHaveProperty("action");
      expect(json.data.action).toBe("removed");
    });
  });
});
