/**
 * @jest-environment node
 *
 * Tests for actions/intel/intel-vote-actions.ts
 *
 * Covers:
 * - voteOnIntelPost: UUID validation, authentication, post existence, active/expired checks
 * - voteOnIntelPost: prevent self-voting, duplicate/same-vote no-op
 * - voteOnIntelPost: first vote insert with XP (positive votes only), vote-type change update
 * - voteOnIntelPost: insert/update failure paths
 * - removeIntelVote: UUID validation, authentication, post existence, successful removal
 * - removeIntelVote: delete failure path
 * - Error handling for unexpected exceptions in both flows
 */

// =============================================================================
// MOCK SETUP
// =============================================================================

const mockUser = { id: "voter-user-123" };

const createMockSupabase = () => ({
  auth: { getUser: jest.fn() },
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
  single: jest.fn(),
  maybeSingle: jest.fn(),
});

let mockSupabase: ReturnType<typeof createMockSupabase>;

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: jest.fn(() => Promise.resolve(mockSupabase)),
}));

jest.mock("@/lib/gamification", () => ({
  creditAuthorWithXP: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
}));

import {
  voteOnIntelPost,
  removeIntelVote,
} from "@/actions/intel/intel-vote-actions";
import { creditAuthorWithXP } from "@/lib/gamification";

// =============================================================================
// HELPERS
// =============================================================================

function mockAuthenticated(userId = mockUser.id) {
  mockSupabase.auth.getUser.mockResolvedValue({
    data: { user: { id: userId } },
    error: null,
  });
}

function mockUnauthenticated() {
  mockSupabase.auth.getUser.mockResolvedValue({
    data: { user: null },
    error: { message: "Not authenticated" },
  });
}

// Valid UUIDs for test fixtures (format: 8-4-4-4-12 hex chars)
const POST_ID = "a1b2c3d4-e5f6-4890-abcd-ef1234567890";
const EXPIRED_POST_ID = "b2c3d4e5-f6a7-4901-bcde-f12345678901";
const INACTIVE_POST_ID = "c3d4e5f6-a7b8-4012-9def-123456789012";
const OWN_POST_ID = "d4e5f6a7-b8c9-4123-aefa-234567890123";
const NONEXISTENT_POST_ID = "e5f6a7b8-c9d0-4234-afab-345678901234";
const AUTHOR_USER_ID = "f6a7b8c9-d0e1-4345-b0ab-456789012345";

const ACTIVE_POST = {
  id: POST_ID,
  user_id: AUTHOR_USER_ID,
  is_active: true,
  expires_at: new Date(Date.now() + 86400000).toISOString(), // future
};

const EXPIRED_POST = {
  id: EXPIRED_POST_ID,
  user_id: AUTHOR_USER_ID,
  is_active: true,
  expires_at: new Date(Date.now() - 86400000).toISOString(), // past
};

const INACTIVE_POST = {
  id: INACTIVE_POST_ID,
  user_id: AUTHOR_USER_ID,
  is_active: false,
  expires_at: null,
};

// A post owned by the voting user
const OWN_POST = {
  id: OWN_POST_ID,
  user_id: mockUser.id,
  is_active: true,
  expires_at: null,
};

const UPDATED_COUNTS = {
  helpful_count: 3,
  off_count: 0,
  confirmed_count: 1,
};

// =============================================================================
// TESTS — voteOnIntelPost
// =============================================================================

describe("voteOnIntelPost", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase = createMockSupabase();
    const { createSupabaseServerClient } = jest.requireMock(
      "@/lib/supabase/server"
    );
    createSupabaseServerClient.mockReturnValue(Promise.resolve(mockSupabase));
  });

  // -------------------------------------------------------------------------
  // UUID Validation
  // -------------------------------------------------------------------------

  describe("UUID Validation", () => {
    test("returns error for invalid UUID", async () => {
      const result = await voteOnIntelPost("not-a-uuid", "helpful");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid intel post ID");
      // Should not attempt auth or DB queries
      expect(mockSupabase.auth.getUser).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Authentication
  // -------------------------------------------------------------------------

  describe("Authentication", () => {
    test("returns error when not authenticated", async () => {
      mockUnauthenticated();

      const result = await voteOnIntelPost(POST_ID, "helpful");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Authentication error: Not authenticated");
    });
  });

  // -------------------------------------------------------------------------
  // Post validation
  // -------------------------------------------------------------------------

  describe("Post Validation", () => {
    test("returns error when post not found", async () => {
      mockAuthenticated();
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { code: "PGRST116", message: "no rows" },
      });

      const result = await voteOnIntelPost(NONEXISTENT_POST_ID, "helpful");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Intel post not found");
    });

    test("returns error when post is not active", async () => {
      mockAuthenticated();
      mockSupabase.single.mockResolvedValueOnce({
        data: INACTIVE_POST,
        error: null,
      });

      const result = await voteOnIntelPost(INACTIVE_POST_ID, "helpful");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Intel post is no longer active");
    });

    test("returns error when post has expired", async () => {
      mockAuthenticated();
      mockSupabase.single.mockResolvedValueOnce({
        data: EXPIRED_POST,
        error: null,
      });

      const result = await voteOnIntelPost(EXPIRED_POST_ID, "helpful");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Intel post has expired");
    });

    test("returns error when voting on own post", async () => {
      mockAuthenticated();
      mockSupabase.single.mockResolvedValueOnce({
        data: OWN_POST,
        error: null,
      });

      const result = await voteOnIntelPost(OWN_POST_ID, "helpful");

      expect(result.success).toBe(false);
      expect(result.error).toBe("You cannot vote on your own intel post");
    });

    test("returns error when existing-vote DB check fails", async () => {
      mockAuthenticated();
      // Post lookup succeeds
      mockSupabase.single.mockResolvedValueOnce({
        data: ACTIVE_POST,
        error: null,
      });
      // Existing vote check returns a non-PGRST116 DB error
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: { code: "42501", message: "permission denied" },
      });

      const result = await voteOnIntelPost(POST_ID, "helpful");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to check vote status");
    });
  });

  // -------------------------------------------------------------------------
  // First vote — insert path
  // -------------------------------------------------------------------------

  describe("First vote (insert path)", () => {
    test("successful first vote returns success with updated counts", async () => {
      mockAuthenticated();
      // Post lookup
      mockSupabase.single.mockResolvedValueOnce({
        data: ACTIVE_POST,
        error: null,
      });
      // No existing vote
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: null,
      });
      // insert() is awaited directly — mock returns { error: null } on the chain
      mockSupabase.insert.mockResolvedValueOnce({ data: null, error: null });
      // Updated counts after insert
      mockSupabase.single.mockResolvedValueOnce({
        data: UPDATED_COUNTS,
        error: null,
      });

      const result = await voteOnIntelPost(POST_ID, "helpful");

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        vote_type: "helpful",
        helpful_count: 3,
        off_count: 0,
        confirmed_count: 1,
      });
    });

    test("awards XP to the post author on first helpful vote", async () => {
      mockAuthenticated();
      mockSupabase.single.mockResolvedValueOnce({
        data: ACTIVE_POST,
        error: null,
      });
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: null,
      });
      mockSupabase.insert.mockResolvedValueOnce({ data: null, error: null });
      mockSupabase.single.mockResolvedValueOnce({
        data: UPDATED_COUNTS,
        error: null,
      });

      await voteOnIntelPost(POST_ID, "helpful");

      expect(creditAuthorWithXP).toHaveBeenCalledWith(
        ACTIVE_POST.user_id,
        "intel_post",
        ACTIVE_POST.id
      );
    });

    test("awards XP to the post author on first confirmed vote", async () => {
      mockAuthenticated();
      mockSupabase.single.mockResolvedValueOnce({
        data: ACTIVE_POST,
        error: null,
      });
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: null,
      });
      mockSupabase.insert.mockResolvedValueOnce({ data: null, error: null });
      mockSupabase.single.mockResolvedValueOnce({
        data: UPDATED_COUNTS,
        error: null,
      });

      await voteOnIntelPost(POST_ID, "confirmed");

      expect(creditAuthorWithXP).toHaveBeenCalledWith(
        ACTIVE_POST.user_id,
        "intel_post",
        ACTIVE_POST.id
      );
    });

    test("does not award XP on first off vote", async () => {
      mockAuthenticated();
      mockSupabase.single.mockResolvedValueOnce({
        data: ACTIVE_POST,
        error: null,
      });
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: null,
      });
      mockSupabase.insert.mockResolvedValueOnce({ data: null, error: null });
      mockSupabase.single.mockResolvedValueOnce({
        data: UPDATED_COUNTS,
        error: null,
      });

      await voteOnIntelPost(POST_ID, "off");

      expect(creditAuthorWithXP).not.toHaveBeenCalled();
    });

    test("returns error on insert failure", async () => {
      mockAuthenticated();
      mockSupabase.single.mockResolvedValueOnce({
        data: ACTIVE_POST,
        error: null,
      });
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: null,
      });
      // Simulate insert DB error
      mockSupabase.insert.mockResolvedValueOnce({
        data: null,
        error: { message: "unique violation" },
      });

      const result = await voteOnIntelPost(POST_ID, "confirmed");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to cast vote");
    });
  });

  // -------------------------------------------------------------------------
  // Same vote type — no-op
  // -------------------------------------------------------------------------

  describe("Same vote type (no-op)", () => {
    test("returns current counts without insert or update when same vote type cast again", async () => {
      mockAuthenticated();
      // Post lookup
      mockSupabase.single.mockResolvedValueOnce({
        data: ACTIVE_POST,
        error: null,
      });
      // Existing vote with same type
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: { id: "vote-existing-id", vote_type: "helpful" },
        error: null,
      });
      // Count fetch (no-op path fetches current counts via single)
      mockSupabase.single.mockResolvedValueOnce({
        data: UPDATED_COUNTS,
        error: null,
      });

      const result = await voteOnIntelPost(POST_ID, "helpful");

      expect(result.success).toBe(true);
      expect(result.data?.vote_type).toBe("helpful");
      expect(result.data?.helpful_count).toBe(3);
      // Should not insert or update
      expect(mockSupabase.insert).not.toHaveBeenCalled();
      expect(mockSupabase.update).not.toHaveBeenCalled();
    });

    test("does not award XP on a no-op (repeated same vote type)", async () => {
      mockAuthenticated();
      mockSupabase.single.mockResolvedValueOnce({
        data: ACTIVE_POST,
        error: null,
      });
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: { id: "vote-existing-id", vote_type: "off" },
        error: null,
      });
      mockSupabase.single.mockResolvedValueOnce({
        data: UPDATED_COUNTS,
        error: null,
      });

      await voteOnIntelPost(POST_ID, "off");

      expect(creditAuthorWithXP).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Different vote type — update path
  // -------------------------------------------------------------------------

  describe("Different vote type (update path)", () => {
    test("updates existing vote to new type and returns updated counts", async () => {
      mockAuthenticated();
      // Post lookup
      mockSupabase.single.mockResolvedValueOnce({
        data: ACTIVE_POST,
        error: null,
      });
      // Existing vote with a different type
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: { id: "vote-existing-id", vote_type: "helpful" },
        error: null,
      });
      // The action does: await supabase.from(...).update({...}).eq("id", existingVote.id)
      // .from() → this, .update() → this, .eq() → this (default mockReturnThis).
      // Awaiting the sync mock object gives the mock itself, so error = undefined (success).
      // Updated counts after update
      mockSupabase.single.mockResolvedValueOnce({
        data: { helpful_count: 2, off_count: 1, confirmed_count: 0 },
        error: null,
      });

      const result = await voteOnIntelPost(POST_ID, "off");

      expect(result.success).toBe(true);
      expect(result.data?.vote_type).toBe("off");
      expect(mockSupabase.insert).not.toHaveBeenCalled();
    });

    test("returns error on update failure", async () => {
      mockAuthenticated();
      mockSupabase.single.mockResolvedValueOnce({
        data: ACTIVE_POST,
        error: null,
      });
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: { id: "vote-existing-id", vote_type: "helpful" },
        error: null,
      });
      // Override update() to return an object that resolves with an error when
      // the chain is awaited. The action awaits the full from().update().eq()
      // expression; by making update() return a Promise-like mock we ensure
      // the error propagates without disturbing the eq chain on select paths.
      mockSupabase.update.mockReturnValueOnce({
        eq: jest.fn().mockResolvedValueOnce({
          data: null,
          error: { message: "update conflict" },
        }),
      });

      const result = await voteOnIntelPost(POST_ID, "off");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to update vote");
    });

    test("does not award XP on vote type change (not a first vote)", async () => {
      mockAuthenticated();
      mockSupabase.single.mockResolvedValueOnce({
        data: ACTIVE_POST,
        error: null,
      });
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: { id: "vote-existing-id", vote_type: "helpful" },
        error: null,
      });
      // update() chain is awaited — default mockReturnThis means error = undefined (success)
      mockSupabase.single.mockResolvedValueOnce({
        data: UPDATED_COUNTS,
        error: null,
      });

      await voteOnIntelPost(POST_ID, "confirmed");

      expect(creditAuthorWithXP).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // XP credit failure (MEDIUM-10)
  // -------------------------------------------------------------------------

  describe("XP credit failure path (MEDIUM-10)", () => {
    test("returns success even when XP credit fails", async () => {
      // creditAuthorWithXP is called fire-and-forget with .catch().
      // If the promise rejects, the action should still return success.
      const { creditAuthorWithXP: mockCreditXP } = jest.requireMock(
        "@/lib/gamification"
      );
      mockCreditXP.mockRejectedValueOnce(new Error("XP service unavailable"));

      mockAuthenticated();
      // Post lookup
      mockSupabase.single.mockResolvedValueOnce({
        data: ACTIVE_POST,
        error: null,
      });
      // No existing vote — first vote path (XP is attempted)
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: null,
      });
      // Insert succeeds
      mockSupabase.insert.mockResolvedValueOnce({ data: null, error: null });
      // Updated counts
      mockSupabase.single.mockResolvedValueOnce({
        data: UPDATED_COUNTS,
        error: null,
      });

      const result = await voteOnIntelPost(POST_ID, "helpful");

      // Despite XP credit failure the vote action must succeed.
      expect(result.success).toBe(true);
      expect(result.data?.vote_type).toBe("helpful");
      expect(result.data?.helpful_count).toBe(3);
      expect(result.data?.off_count).toBe(0);
      expect(result.data?.confirmed_count).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // Unexpected exceptions
  // -------------------------------------------------------------------------

  describe("Error Handling", () => {
    test("catches unexpected exceptions and returns error message", async () => {
      mockAuthenticated();
      mockSupabase.single.mockRejectedValueOnce(new Error("DB connection lost"));

      const result = await voteOnIntelPost(POST_ID, "helpful");

      expect(result.success).toBe(false);
      expect(result.error).toBe("DB connection lost");
    });

    test("returns fallback message for non-Error exceptions", async () => {
      mockAuthenticated();
      mockSupabase.single.mockRejectedValueOnce("string error");

      const result = await voteOnIntelPost(POST_ID, "helpful");

      expect(result.success).toBe(false);
      // withServerAction handles string errors by returning the string directly
      expect(result.error).toBe("string error");
    });
  });
});

// =============================================================================
// TESTS — removeIntelVote
// =============================================================================

describe("removeIntelVote", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase = createMockSupabase();
    const { createSupabaseServerClient } = jest.requireMock(
      "@/lib/supabase/server"
    );
    createSupabaseServerClient.mockReturnValue(Promise.resolve(mockSupabase));
  });

  // -------------------------------------------------------------------------
  // UUID Validation
  // -------------------------------------------------------------------------

  describe("UUID Validation", () => {
    test("returns error for invalid UUID", async () => {
      const result = await removeIntelVote("not-a-uuid");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid intel post ID");
      expect(mockSupabase.auth.getUser).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Authentication
  // -------------------------------------------------------------------------

  describe("Authentication", () => {
    test("returns error when not authenticated", async () => {
      mockUnauthenticated();

      const result = await removeIntelVote(POST_ID);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Authentication error: Not authenticated");
    });
  });

  // -------------------------------------------------------------------------
  // Post validation
  // -------------------------------------------------------------------------

  describe("Post Validation", () => {
    test("returns error when post not found", async () => {
      mockAuthenticated();
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { code: "PGRST116", message: "no rows" },
      });

      const result = await removeIntelVote(NONEXISTENT_POST_ID);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Intel post not found");
    });
  });

  // -------------------------------------------------------------------------
  // Successful removal
  // -------------------------------------------------------------------------

  describe("Successful Removal", () => {
    test("deletes the vote and returns null vote_type with updated counts", async () => {
      mockAuthenticated();
      // The action does:
      //   (1) intel_posts.select("id").single()            — post lookup
      //   (2) intel_votes.select("id,vote_type").maybeSingle() — existing vote check
      //   (3) intel_votes.delete().eq().eq()               — delete (only when vote found)
      //   (4) intel_posts.select("helpful_count,...").single() — counts fetch
      //
      // We track call counts per table so sequential calls return the right data.
      let intelVotesCallCount = 0;
      let intelPostsCallCount = 0;
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "intel_votes") {
          intelVotesCallCount++;
          if (intelVotesCallCount === 1) {
            // First call: select("id, vote_type").maybeSingle() — returns existing vote
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              maybeSingle: jest
                .fn()
                .mockResolvedValue({
                  data: { id: "vote-uuid", vote_type: "helpful" },
                  error: null,
                }),
            };
          }
          // Second call: delete().eq().eq()
          return {
            delete: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          };
        }
        // intel_posts: first call = post lookup, second call = counts fetch
        intelPostsCallCount++;
        const postData =
          intelPostsCallCount === 1
            ? { data: { id: POST_ID }, error: null }
            : { data: { helpful_count: 1, off_count: 0, confirmed_count: 2 }, error: null };
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue(postData),
        };
      });

      const result = await removeIntelVote(POST_ID);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        vote_type: null,
        helpful_count: 1,
        off_count: 0,
        confirmed_count: 2,
      });
    });

    test("falls back to zero counts when count query fails after successful delete", async () => {
      mockAuthenticated();
      let intelVotesCallCount = 0;
      let intelPostsCallCount = 0;
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "intel_votes") {
          intelVotesCallCount++;
          if (intelVotesCallCount === 1) {
            // Existing vote check — returns a vote so delete path is taken
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              maybeSingle: jest
                .fn()
                .mockResolvedValue({
                  data: { id: "vote-uuid", vote_type: "confirmed" },
                  error: null,
                }),
            };
          }
          // Delete succeeds
          return {
            delete: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          };
        }
        intelPostsCallCount++;
        const postData =
          intelPostsCallCount === 1
            ? { data: { id: POST_ID }, error: null }
            : { data: null, error: { message: "query error" } }; // counts fetch fails
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue(postData),
        };
      });

      const result = await removeIntelVote(POST_ID);

      expect(result.success).toBe(true);
      expect(result.data?.helpful_count).toBe(0);
      expect(result.data?.off_count).toBe(0);
      expect(result.data?.confirmed_count).toBe(0);
      expect(result.data?.vote_type).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Idempotent removal (no existing vote) — MEDIUM-9
  // -------------------------------------------------------------------------

  describe("Idempotent removal (MEDIUM-9)", () => {
    test("returns success when removing a non-existent vote (idempotent)", async () => {
      mockAuthenticated();
      // When no vote exists the action short-circuits: it skips the delete
      // and returns current counts immediately (no 0-row delete side-effect).
      //
      // Call sequence:
      //   (1) intel_posts.select("id").single()               — post lookup
      //   (2) intel_votes.select("id,vote_type").maybeSingle() — no vote found
      //   (3) intel_posts.select("helpful_count,...").single() — counts fetch
      let intelPostsCallCount = 0;
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "intel_votes") {
          // Only called once: maybeSingle returns null (no existing vote)
          return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest
              .fn()
              .mockResolvedValue({ data: null, error: null }),
          };
        }
        // intel_posts: post lookup then counts fetch
        intelPostsCallCount++;
        const postData =
          intelPostsCallCount === 1
            ? { data: { id: POST_ID }, error: null }
            : {
                data: { helpful_count: 2, off_count: 1, confirmed_count: 3 },
                error: null,
              };
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue(postData),
        };
      });

      const result = await removeIntelVote(POST_ID);

      // Action should succeed even though there was no vote to remove.
      expect(result.success).toBe(true);
      expect(result.data?.vote_type).toBeNull();
      expect(result.data?.helpful_count).toBe(2);
      expect(result.data?.off_count).toBe(1);
      expect(result.data?.confirmed_count).toBe(3);
    });
  });

  // -------------------------------------------------------------------------
  // Delete failure
  // -------------------------------------------------------------------------

  describe("Error Handling", () => {
    test("returns error when delete fails", async () => {
      mockAuthenticated();
      // Call sequence:
      //   (1) intel_posts.select("id").single()               — post lookup (success)
      //   (2) intel_votes.select("id,vote_type").maybeSingle() — existing vote found
      //   (3) intel_votes.delete().eq().eq()                   — delete fails
      let intelVotesCallCount = 0;
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "intel_votes") {
          intelVotesCallCount++;
          if (intelVotesCallCount === 1) {
            // Existing vote check — returns a vote so delete path is taken
            return {
              select: jest.fn().mockReturnThis(),
              eq: jest.fn().mockReturnThis(),
              maybeSingle: jest
                .fn()
                .mockResolvedValue({
                  data: { id: "vote-uuid", vote_type: "helpful" },
                  error: null,
                }),
            };
          }
          // Delete fails with a database error
          return {
            delete: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({
                  data: null,
                  error: { message: "delete constraint violation" },
                }),
              }),
            }),
          };
        }
        // intel_posts: only post lookup needed (delete fails before counts fetch)
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest
            .fn()
            .mockResolvedValue({ data: { id: POST_ID }, error: null }),
        };
      });

      const result = await removeIntelVote(POST_ID);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to remove vote");
    });

    test("catches unexpected exceptions and returns error message", async () => {
      mockAuthenticated();
      mockSupabase.single.mockRejectedValueOnce(
        new Error("Network timeout")
      );

      const result = await removeIntelVote(POST_ID);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Network timeout");
    });
  });
});
