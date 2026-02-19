/**
 * @jest-environment node
 *
 * Tests for actions/intel/intel-create-actions.ts — createIntelPost
 *
 * Covers:
 * - Successful post creation with enriched user profile
 * - Input validation (lat, lon, tag, title, description)
 * - Beach ID resolution (explicit vs nearest-beach fallback)
 * - Deduplication: blocks exact match within dedupe window
 * - Deduplication: allows different content
 * - Fallback to condition_reports when intel_posts insert fails
 * - XP tracking after successful creation
 * - Surf conditions JSONB normalization
 * - Error paths (insert failure, no beach found, auth failure)
 */

import { describe, test, expect, beforeAll, jest } from "@jest/globals";

// Mock Next.js cache functions to avoid static generation store errors
jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
  revalidateTag: jest.fn(),
}));

// =============================================================================
// MOCK HELPERS
// =============================================================================

const createSupabaseMock = () => {
  const supabase = {
    from: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn<() => Promise<{ data: unknown[] | null; error: unknown }>>(),
    single: jest.fn<() => Promise<{ data: unknown; error: unknown }>>(),
    rpc: jest.fn<() => Promise<{ data: unknown; error: unknown }>>(),
  };
  return supabase;
};

const mockUser = { id: "user-abc-123" };

/** Dependency injection that bypasses withAuthenticatedAction */
const createAuthWrapper = (supabase: ReturnType<typeof createSupabaseMock>) =>
  async (fn: any) => fn(mockUser, supabase);

const mockTrackXP = jest.fn<() => Promise<any>>().mockResolvedValue({
  success: true,
  xpGained: 10,
});

let createIntelPost: typeof import("@/actions/intel/intel-create-actions")["createIntelPost"];

beforeAll(async () => {
  ({ createIntelPost } = await import("@/actions/intel/intel-create-actions"));
});

// =============================================================================
// TESTS
// =============================================================================

describe("createIntelPost", () => {
  describe("Input Validation", () => {
    test("rejects when lat is missing (NaN)", async () => {
      const supabase = createSupabaseMock();

      const result = await createIntelPost(
        {
          lat: NaN,
          lon: -117.3,
          tag: "conditions" as any,
          title: "Test",
          description: "Test description",
          beach_id: "beach-1",
        },
        {
          authWrapper: createAuthWrapper(supabase),
          trackXP: mockTrackXP as any,
        }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Missing required fields");
    });

    test("rejects when lon is missing", async () => {
      const supabase = createSupabaseMock();

      const result = await createIntelPost(
        {
          lat: 32.8,
          lon: undefined as any,
          tag: "conditions" as any,
          title: "Test",
          description: "Test description",
          beach_id: "beach-1",
        },
        {
          authWrapper: createAuthWrapper(supabase),
          trackXP: mockTrackXP as any,
        }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Missing required fields");
    });

    test("rejects when tag is empty", async () => {
      const supabase = createSupabaseMock();

      const result = await createIntelPost(
        {
          lat: 32.8,
          lon: -117.3,
          tag: "" as any,
          title: "Test",
          description: "Test description",
          beach_id: "beach-1",
        },
        {
          authWrapper: createAuthWrapper(supabase),
          trackXP: mockTrackXP as any,
        }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Missing required fields");
    });

    test("rejects when title is empty or whitespace only", async () => {
      const supabase = createSupabaseMock();

      const result = await createIntelPost(
        {
          lat: 32.8,
          lon: -117.3,
          tag: "conditions" as any,
          title: "   ",
          description: "Test description",
          beach_id: "beach-1",
        },
        {
          authWrapper: createAuthWrapper(supabase),
          trackXP: mockTrackXP as any,
        }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Missing required fields");
    });

    test("rejects when description is empty", async () => {
      const supabase = createSupabaseMock();

      const result = await createIntelPost(
        {
          lat: 32.8,
          lon: -117.3,
          tag: "conditions" as any,
          title: "Test",
          description: "",
          beach_id: "beach-1",
        },
        {
          authWrapper: createAuthWrapper(supabase),
          trackXP: mockTrackXP as any,
        }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Missing required fields");
    });
  });

  describe("Beach ID Resolution", () => {
    test("uses explicit beach_id when provided", async () => {
      const supabase = createSupabaseMock();
      supabase.limit.mockResolvedValueOnce({ data: [], error: null }); // dedup check
      supabase.single
        .mockResolvedValueOnce({
          // insert
          data: {
            id: "intel-1",
            user_id: mockUser.id,
            beach_id: "explicit-beach",
            latitude: 32.8,
            longitude: -117.3,
            tag: "conditions",
            title: "Test",
            description: "Test description",
            is_active: true,
          },
          error: null,
        })
        .mockResolvedValueOnce({
          // profile
          data: { id: mockUser.id, full_name: "Test User", avatar_url: null },
          error: null,
        });

      const result = await createIntelPost(
        {
          lat: 32.8,
          lon: -117.3,
          tag: "conditions" as any,
          title: "Test",
          description: "Test description",
          beach_id: "explicit-beach",
        },
        {
          authWrapper: createAuthWrapper(supabase),
          trackXP: mockTrackXP as any,
        }
      );

      expect(result.success).toBe(true);
      // rpc should NOT be called for nearest beach lookup
      expect(supabase.rpc).not.toHaveBeenCalled();
    });

    test("falls back to nearest beach via RPC when beach_id missing", async () => {
      const supabase = createSupabaseMock();
      supabase.rpc.mockResolvedValueOnce({
        data: [{ id: "nearest-beach-1" }],
        error: null,
      });
      supabase.limit.mockResolvedValueOnce({ data: [], error: null }); // dedup check
      supabase.single
        .mockResolvedValueOnce({
          data: {
            id: "intel-1",
            user_id: mockUser.id,
            beach_id: "nearest-beach-1",
            latitude: 32.8,
            longitude: -117.3,
            tag: "conditions",
            title: "Test",
            description: "Test desc",
            is_active: true,
          },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { id: mockUser.id, full_name: "User", avatar_url: null },
          error: null,
        });

      const result = await createIntelPost(
        {
          lat: 32.8,
          lon: -117.3,
          tag: "conditions" as any,
          title: "Test",
          description: "Test desc",
        },
        {
          authWrapper: createAuthWrapper(supabase),
          trackXP: mockTrackXP as any,
        }
      );

      expect(result.success).toBe(true);
      expect(supabase.rpc).toHaveBeenCalledWith("get_nearby_beaches", {
        input_lat: 32.8,
        input_lng: -117.3,
        limit_count: 1,
      });
    });

    test("returns error when no beach found via RPC", async () => {
      const supabase = createSupabaseMock();
      supabase.rpc.mockResolvedValueOnce({ data: [], error: null });

      const result = await createIntelPost(
        {
          lat: 32.8,
          lon: -117.3,
          tag: "conditions" as any,
          title: "Test",
          description: "Test desc",
        },
        {
          authWrapper: createAuthWrapper(supabase),
          trackXP: mockTrackXP as any,
        }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Unable to determine a beach");
    });

    test("returns error when RPC itself fails", async () => {
      const supabase = createSupabaseMock();
      supabase.rpc.mockResolvedValueOnce({
        data: null,
        error: { message: "RPC failed" },
      });

      const result = await createIntelPost(
        {
          lat: 32.8,
          lon: -117.3,
          tag: "conditions" as any,
          title: "Test",
          description: "Test desc",
        },
        {
          authWrapper: createAuthWrapper(supabase),
          trackXP: mockTrackXP as any,
        }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Unable to determine nearest beach");
    });
  });

  describe("Deduplication", () => {
    test("rejects duplicate intel within dedupe window", async () => {
      const supabase = createSupabaseMock();
      const existingRow = {
        id: "intel-existing",
        title: "Dawn patrol at La Jolla",
        description: "Clean 3-4ft waves offshore winds",
        lat: 32.8,
        lon: -117.3,
        created_at: new Date().toISOString(),
      };

      supabase.limit.mockResolvedValueOnce({
        data: [existingRow],
        error: null,
      });

      const result = await createIntelPost(
        {
          lat: 32.8,
          lon: -117.3,
          tag: "conditions" as any,
          title: "Dawn patrol at La Jolla",
          description: "Clean 3-4ft waves offshore winds",
          beach_id: "beach-123",
        },
        {
          authWrapper: createAuthWrapper(supabase),
          trackXP: mockTrackXP as any,
        }
      );

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/already shared/i);
      expect(supabase.insert).not.toHaveBeenCalled();
    });

    test("allows different content from same user", async () => {
      const supabase = createSupabaseMock();
      const existingRow = {
        id: "intel-existing",
        title: "Morning session",
        description: "Choppy 1-2ft",
        lat: 32.8,
        lon: -117.3,
        created_at: new Date().toISOString(),
      };

      supabase.limit.mockResolvedValueOnce({
        data: [existingRow],
        error: null,
      });
      supabase.single
        .mockResolvedValueOnce({
          data: {
            id: "intel-new",
            user_id: mockUser.id,
            beach_id: "beach-123",
            latitude: 32.8,
            longitude: -117.3,
            tag: "conditions",
            title: "Afternoon report",
            description: "Glass 4-5ft sets",
            is_active: true,
          },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { id: mockUser.id, full_name: "Surfer", avatar_url: null },
          error: null,
        });

      const result = await createIntelPost(
        {
          lat: 32.8,
          lon: -117.3,
          tag: "conditions" as any,
          title: "Afternoon report",
          description: "Glass 4-5ft sets",
          beach_id: "beach-123",
        },
        {
          authWrapper: createAuthWrapper(supabase),
          trackXP: mockTrackXP as any,
        }
      );

      expect(result.success).toBe(true);
    });

    test("continues insert when dedup check errors (non-blocking)", async () => {
      const supabase = createSupabaseMock();

      supabase.limit.mockResolvedValueOnce({
        data: null,
        error: { message: "timeout" },
      });
      supabase.single
        .mockResolvedValueOnce({
          data: {
            id: "intel-1",
            user_id: mockUser.id,
            beach_id: "beach-1",
            latitude: 32.8,
            longitude: -117.3,
            tag: "conditions",
            title: "Test",
            description: "Test desc",
            is_active: true,
          },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { id: mockUser.id, full_name: "User", avatar_url: null },
          error: null,
        });

      const result = await createIntelPost(
        {
          lat: 32.8,
          lon: -117.3,
          tag: "conditions" as any,
          title: "Test",
          description: "Test desc",
          beach_id: "beach-1",
        },
        {
          authWrapper: createAuthWrapper(supabase),
          trackXP: mockTrackXP as any,
        }
      );

      // Should succeed despite dedup check error
      expect(result.success).toBe(true);
    });
  });

  describe("Successful Creation", () => {
    test("returns enriched post with user profile", async () => {
      const supabase = createSupabaseMock();
      supabase.limit.mockResolvedValueOnce({ data: [], error: null });
      supabase.single
        .mockResolvedValueOnce({
          data: {
            id: "intel-1",
            user_id: mockUser.id,
            beach_id: "beach-1",
            latitude: 32.8,
            longitude: -117.3,
            tag: "conditions",
            title: "Great session",
            description: "Perfect conditions",
            is_active: true,
          },
          error: null,
        })
        .mockResolvedValueOnce({
          data: {
            id: mockUser.id,
            full_name: "John Doe",
            avatar_url: "https://example.com/avatar.jpg",
          },
          error: null,
        });

      const result = await createIntelPost(
        {
          lat: 32.8,
          lon: -117.3,
          tag: "conditions" as any,
          title: "Great session",
          description: "Perfect conditions",
          beach_id: "beach-1",
        },
        {
          authWrapper: createAuthWrapper(supabase),
          trackXP: mockTrackXP as any,
        }
      );

      expect(result.success).toBe(true);
       
      const data = result.data as any;
      expect(data.id).toBe("intel-1");
      expect(data.user.full_name).toBe("John Doe");
      expect(data.user.avatar_url).toBe(
        "https://example.com/avatar.jpg"
      );
      expect(data.user_has_confirmed).toBe(false);
    });

    test("tracks XP after creation", async () => {
      const supabase = createSupabaseMock();
      mockTrackXP.mockClear();

      supabase.limit.mockResolvedValueOnce({ data: [], error: null });
      supabase.single
        .mockResolvedValueOnce({
          data: {
            id: "intel-xp-test",
            user_id: mockUser.id,
            beach_id: "beach-1",
            latitude: 32.8,
            longitude: -117.3,
            tag: "conditions",
            title: "Test",
            description: "Desc",
            is_active: true,
          },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { id: mockUser.id, full_name: "User", avatar_url: null },
          error: null,
        });

      await createIntelPost(
        {
          lat: 32.8,
          lon: -117.3,
          tag: "conditions" as any,
          title: "Test",
          description: "Desc",
          beach_id: "beach-1",
        },
        {
          authWrapper: createAuthWrapper(supabase),
          trackXP: mockTrackXP as any,
        }
      );

      expect(mockTrackXP).toHaveBeenCalledWith(
        "post_beach_intel",
        "intel-xp-test",
        "intel_post"
      );
    });

    test("falls back to Anonymous when profile lookup fails", async () => {
      const supabase = createSupabaseMock();

      supabase.limit.mockResolvedValueOnce({ data: [], error: null });
      supabase.single
        .mockResolvedValueOnce({
          data: {
            id: "intel-1",
            user_id: mockUser.id,
            beach_id: "beach-1",
            latitude: 32.8,
            longitude: -117.3,
            tag: "conditions",
            title: "Test",
            description: "Desc",
            is_active: true,
          },
          error: null,
        })
        .mockResolvedValueOnce({
          data: null,
          error: { message: "Profile not found" },
        });

      const result = await createIntelPost(
        {
          lat: 32.8,
          lon: -117.3,
          tag: "conditions" as any,
          title: "Test",
          description: "Desc",
          beach_id: "beach-1",
        },
        {
          authWrapper: createAuthWrapper(supabase),
          trackXP: mockTrackXP as any,
        }
      );

      expect(result.success).toBe(true);
      expect((result.data as any).user.full_name).toBe("Anonymous");
    });
  });

  describe("Surf Conditions JSONB", () => {
    test("normalizes surf conditions into JSONB object", async () => {
      const supabase = createSupabaseMock();
      let capturedInsert: any = null;

      supabase.limit.mockResolvedValueOnce({ data: [], error: null });
      supabase.insert.mockImplementation((data: any) => {
        capturedInsert = data;
        return supabase;
      });
      supabase.single
        .mockResolvedValueOnce({
          data: {
            id: "intel-1",
            user_id: mockUser.id,
            beach_id: "beach-1",
            latitude: 32.8,
            longitude: -117.3,
            tag: "conditions",
            title: "Report",
            description: "Nice waves",
            is_active: true,
            surf_conditions: {
              wave_height: 4.5,
              wind_speed: 8,
              wind_direction: "offshore",
            },
          },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { id: mockUser.id, full_name: "User", avatar_url: null },
          error: null,
        });

      await createIntelPost(
        {
          lat: 32.8,
          lon: -117.3,
          tag: "conditions" as any,
          title: "Report",
          description: "Nice waves",
          beach_id: "beach-1",
          wave_height: 4.5,
          wind_speed: 8,
          wind_direction: "offshore",
        },
        {
          authWrapper: createAuthWrapper(supabase),
          trackXP: mockTrackXP as any,
        }
      );

      expect(capturedInsert).toBeDefined();
      expect(capturedInsert.surf_conditions).toEqual({
        wave_height: 4.5,
        wind_speed: 8,
        wind_direction: "offshore",
      });
    });

    test("sets surf_conditions to null when no optional fields provided", async () => {
      const supabase = createSupabaseMock();
      let capturedInsert: any = null;

      supabase.limit.mockResolvedValueOnce({ data: [], error: null });
      supabase.insert.mockImplementation((data: any) => {
        capturedInsert = data;
        return supabase;
      });
      supabase.single
        .mockResolvedValueOnce({
          data: {
            id: "intel-1",
            user_id: mockUser.id,
            beach_id: "beach-1",
            latitude: 32.8,
            longitude: -117.3,
            tag: "parking",
            title: "Parking",
            description: "Open lot",
            is_active: true,
          },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { id: mockUser.id, full_name: "User", avatar_url: null },
          error: null,
        });

      await createIntelPost(
        {
          lat: 32.8,
          lon: -117.3,
          tag: "parking" as any,
          title: "Parking",
          description: "Open lot",
          beach_id: "beach-1",
        },
        {
          authWrapper: createAuthWrapper(supabase),
          trackXP: mockTrackXP as any,
        }
      );

      expect(capturedInsert.surf_conditions).toBeNull();
    });
  });

  describe("Error Handling", () => {
    test("returns error when insert fails", async () => {
      const supabase = createSupabaseMock();
      supabase.limit.mockResolvedValueOnce({ data: [], error: null });
      supabase.single.mockResolvedValueOnce({
        data: null,
        error: { code: "23505", message: "Unique violation" },
      });

      const result = await createIntelPost(
        {
          lat: 32.8,
          lon: -117.3,
          tag: "conditions" as any,
          title: "Test",
          description: "Desc",
          beach_id: "beach-1",
        },
        {
          authWrapper: createAuthWrapper(supabase),
          trackXP: mockTrackXP as any,
        }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to create intel post");
    });

    test("catches unexpected exceptions gracefully", async () => {
      const result = await createIntelPost(
        {
          lat: 32.8,
          lon: -117.3,
          tag: "conditions" as any,
          title: "Test",
          description: "Desc",
          beach_id: "beach-1",
        },
        {
          authWrapper: async () => {
            throw new Error("Unexpected failure");
          },
          trackXP: mockTrackXP as any,
        }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Unexpected failure");
    });
  });
});
