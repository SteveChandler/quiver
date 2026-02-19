/**
 * @jest-environment node
 *
 * Tests for actions/intel/intel-confirm-actions.ts
 *
 * confirmIntelPost is a thin wrapper that delegates to voteOnIntelPost
 * with vote_type='confirmed' and maps the VoteData response to ConfirmationData.
 *
 * removeIntelPostConfirmation uses withAuthenticatedAction directly, checks
 * the user's current vote type via Supabase, and delegates to removeIntelVote
 * only when the existing vote is of type 'confirmed'.
 *
 * Covers (HIGH-6):
 * - confirmIntelPost delegates to voteOnIntelPost with vote_type='confirmed'
 * - confirmIntelPost maps confirmed_count → confirmations_count
 * - confirmIntelPost sets confirmation_id equal to the post ID
 * - confirmIntelPost sets confirmed: true on success
 * - confirmIntelPost error pass-through from voteOnIntelPost unchanged
 * - confirmIntelPost falls back to confirmations_count=0 when data is absent
 * - removeIntelPostConfirmation: UUID validation, authentication
 * - removeIntelPostConfirmation: delegates to removeIntelVote for confirmed votes
 * - removeIntelPostConfirmation: maps confirmed_count → confirmations_count
 * - removeIntelPostConfirmation: sets confirmed: false on success
 * - removeIntelPostConfirmation: error pass-through from removeIntelVote
 */

// =============================================================================
// MOCK SETUP
// =============================================================================

// Use jest.fn() directly inside the factory so the mock is available at hoist
// time. Access the mocks in tests via jest.requireMock(...).
jest.mock("@/actions/intel/intel-vote-actions", () => ({
  voteOnIntelPost: jest.fn(),
  removeIntelVote: jest.fn(),
}));

// Supabase mock (required for removeIntelPostConfirmation which uses
// withAuthenticatedAction internally before delegating to removeIntelVote)
const createMockSupabase = () => ({
  auth: {
    getUser: jest.fn(),
  },
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

jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
}));

import {
  confirmIntelPost,
  removeIntelPostConfirmation,
} from "@/actions/intel/intel-confirm-actions";

// Typed accessors to the vote action mocks
const { voteOnIntelPost: mockVoteOnIntelPost, removeIntelVote: mockRemoveIntelVote } =
  jest.requireMock("@/actions/intel/intel-vote-actions") as {
    voteOnIntelPost: jest.Mock;
    removeIntelVote: jest.Mock;
  };

// Valid UUIDs for test fixtures (RFC 4122 v4 format)
const POST_ID        = "a1b2c3d4-e5f6-4890-abcd-ef1234567890";
const USER_ID        = "11111111-2222-3333-a444-555555555555";
const AUTHOR_USER_ID = "f6a7b8c9-d0e1-4345-b0ab-456789012345";

// =============================================================================
// HELPERS
// =============================================================================

function mockAuthenticated(userId = USER_ID) {
  mockSupabase.auth.getUser.mockResolvedValue({
    data: { user: { id: userId } },
    error: null,
  });
}

function mockUnauthenticated() {
  mockSupabase.auth.getUser.mockResolvedValue({
    data: { user: null },
    error: null,
  });
}

// =============================================================================
// TESTS — confirmIntelPost
// =============================================================================

describe("confirmIntelPost", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase = createMockSupabase();
    const { createSupabaseServerClient } = jest.requireMock("@/lib/supabase/server");
    createSupabaseServerClient.mockReturnValue(Promise.resolve(mockSupabase));
  });

  // -------------------------------------------------------------------------
  // Delegation
  // -------------------------------------------------------------------------

  describe("Delegation to voteOnIntelPost", () => {
    it("calls voteOnIntelPost with the post ID and vote_type 'confirmed'", async () => {
      mockVoteOnIntelPost.mockResolvedValueOnce({
        success: true,
        data: { vote_type: "confirmed", helpful_count: 0, off_count: 0, confirmed_count: 1 },
      });

      await confirmIntelPost(POST_ID);

      expect(mockVoteOnIntelPost).toHaveBeenCalledTimes(1);
      expect(mockVoteOnIntelPost).toHaveBeenCalledWith(POST_ID, "confirmed");
    });

    it("does not call removeIntelVote", async () => {
      mockVoteOnIntelPost.mockResolvedValueOnce({
        success: true,
        data: { vote_type: "confirmed", helpful_count: 0, off_count: 0, confirmed_count: 1 },
      });

      await confirmIntelPost(POST_ID);

      expect(mockRemoveIntelVote).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Successful path — field mapping
  // -------------------------------------------------------------------------

  describe("Successful confirmation — field mapping", () => {
    it("maps confirmed_count to confirmations_count", async () => {
      mockVoteOnIntelPost.mockResolvedValueOnce({
        success: true,
        data: { vote_type: "confirmed", helpful_count: 2, off_count: 0, confirmed_count: 7 },
      });

      const result = await confirmIntelPost(POST_ID);

      expect(result.success).toBe(true);
      expect(result.data?.confirmations_count).toBe(7);
    });

    it("sets confirmed to true", async () => {
      mockVoteOnIntelPost.mockResolvedValueOnce({
        success: true,
        data: { vote_type: "confirmed", helpful_count: 0, off_count: 0, confirmed_count: 4 },
      });

      const result = await confirmIntelPost(POST_ID);

      expect(result.success).toBe(true);
      expect(result.data?.confirmed).toBe(true);
    });

    it("sets confirmation_id equal to the post ID", async () => {
      mockVoteOnIntelPost.mockResolvedValueOnce({
        success: true,
        data: { vote_type: "confirmed", helpful_count: 0, off_count: 0, confirmed_count: 1 },
      });

      const result = await confirmIntelPost(POST_ID);

      expect(result.success).toBe(true);
      expect(result.data?.confirmation_id).toBe(POST_ID);
    });

    it("returns full ConfirmationData shape on success", async () => {
      mockVoteOnIntelPost.mockResolvedValueOnce({
        success: true,
        data: { vote_type: "confirmed", helpful_count: 1, off_count: 0, confirmed_count: 3 },
      });

      const result = await confirmIntelPost(POST_ID);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        confirmed: true,
        confirmations_count: 3,
        confirmation_id: POST_ID,
      });
    });

    it("falls back to confirmations_count=0 when data.confirmed_count is absent", async () => {
      mockVoteOnIntelPost.mockResolvedValueOnce({
        success: true,
        data: { vote_type: "confirmed", helpful_count: 0, off_count: 0 },
      });

      const result = await confirmIntelPost(POST_ID);

      expect(result.success).toBe(true);
      expect(result.data?.confirmations_count).toBe(0);
    });

    it("falls back to confirmations_count=0 when data is undefined", async () => {
      mockVoteOnIntelPost.mockResolvedValueOnce({
        success: true,
        data: undefined,
      });

      const result = await confirmIntelPost(POST_ID);

      expect(result.success).toBe(true);
      expect(result.data?.confirmations_count).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Error pass-through
  // -------------------------------------------------------------------------

  describe("Error pass-through from voteOnIntelPost", () => {
    it("passes through authentication errors", async () => {
      mockVoteOnIntelPost.mockResolvedValueOnce({
        success: false,
        error: "User not authenticated",
      });

      const result = await confirmIntelPost(POST_ID);

      expect(result.success).toBe(false);
      expect(result.error).toBe("User not authenticated");
    });

    it("passes through post-not-found errors", async () => {
      mockVoteOnIntelPost.mockResolvedValueOnce({
        success: false,
        error: "Intel post not found",
      });

      const result = await confirmIntelPost(POST_ID);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Intel post not found");
    });

    it("passes through inactive post errors", async () => {
      mockVoteOnIntelPost.mockResolvedValueOnce({
        success: false,
        error: "Intel post is no longer active",
      });

      const result = await confirmIntelPost(POST_ID);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Intel post is no longer active");
    });

    it("passes through expired post errors", async () => {
      mockVoteOnIntelPost.mockResolvedValueOnce({
        success: false,
        error: "Intel post has expired",
      });

      const result = await confirmIntelPost(POST_ID);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Intel post has expired");
    });

    it("passes through self-vote errors", async () => {
      mockVoteOnIntelPost.mockResolvedValueOnce({
        success: false,
        error: "You cannot vote on your own intel post",
      });

      const result = await confirmIntelPost(POST_ID);

      expect(result.success).toBe(false);
      expect(result.error).toBe("You cannot vote on your own intel post");
    });

    it("passes through insert failure errors", async () => {
      mockVoteOnIntelPost.mockResolvedValueOnce({
        success: false,
        error: "Failed to cast vote",
      });

      const result = await confirmIntelPost(POST_ID);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to cast vote");
    });

    it("does not return data on failure", async () => {
      mockVoteOnIntelPost.mockResolvedValueOnce({
        success: false,
        error: "Some error",
      });

      const result = await confirmIntelPost(POST_ID);

      expect(result.success).toBe(false);
      expect((result as any).data).toBeUndefined();
    });
  });
});

// =============================================================================
// TESTS — removeIntelPostConfirmation
// =============================================================================

describe("removeIntelPostConfirmation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase = createMockSupabase();
    const { createSupabaseServerClient } = jest.requireMock("@/lib/supabase/server");
    createSupabaseServerClient.mockReturnValue(Promise.resolve(mockSupabase));
  });

  // -------------------------------------------------------------------------
  // UUID Validation
  // -------------------------------------------------------------------------

  describe("UUID Validation", () => {
    it("returns error for invalid UUID without calling any supabase or vote action", async () => {
      const result = await removeIntelPostConfirmation("not-a-uuid");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid intel post ID");
      expect(mockSupabase.auth.getUser).not.toHaveBeenCalled();
      expect(mockRemoveIntelVote).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Authentication
  // -------------------------------------------------------------------------

  describe("Authentication", () => {
    it("returns error when not authenticated", async () => {
      mockUnauthenticated();

      const result = await removeIntelPostConfirmation(POST_ID);

      expect(result.success).toBe(false);
      expect(result.error).toBe("User not authenticated");
    });
  });

  // -------------------------------------------------------------------------
  // No existing vote — no-op path
  // -------------------------------------------------------------------------

  describe("No existing vote (no-op path)", () => {
    it("returns confirmed=false without calling removeIntelVote when no vote exists", async () => {
      mockAuthenticated();
      // existingVote check: returns null (no vote)
      mockSupabase.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
      // currentPost count query
      mockSupabase.single.mockResolvedValueOnce({
        data: { confirmed_count: 5 },
        error: null,
      });

      const result = await removeIntelPostConfirmation(POST_ID);

      expect(result.success).toBe(true);
      expect(result.data?.confirmed).toBe(false);
      expect(result.data?.confirmations_count).toBe(5);
      expect(result.data?.confirmation_id).toBe(POST_ID);
      // removeIntelVote should NOT be called — only confirmed votes are removed
      expect(mockRemoveIntelVote).not.toHaveBeenCalled();
    });

    it("returns confirmed=false without calling removeIntelVote when existing vote is 'helpful'", async () => {
      mockAuthenticated();
      // existingVote check: returns a 'helpful' vote
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: { id: "vote-id", vote_type: "helpful" },
        error: null,
      });
      // currentPost count query
      mockSupabase.single.mockResolvedValueOnce({
        data: { confirmed_count: 3 },
        error: null,
      });

      const result = await removeIntelPostConfirmation(POST_ID);

      expect(result.success).toBe(true);
      expect(result.data?.confirmed).toBe(false);
      expect(result.data?.confirmations_count).toBe(3);
      expect(mockRemoveIntelVote).not.toHaveBeenCalled();
    });

    it("returns confirmed=false without calling removeIntelVote when existing vote is 'off'", async () => {
      mockAuthenticated();
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: { id: "vote-id", vote_type: "off" },
        error: null,
      });
      mockSupabase.single.mockResolvedValueOnce({
        data: { confirmed_count: 2 },
        error: null,
      });

      const result = await removeIntelPostConfirmation(POST_ID);

      expect(result.success).toBe(true);
      expect(result.data?.confirmed).toBe(false);
      expect(mockRemoveIntelVote).not.toHaveBeenCalled();
    });

    it("falls back to confirmations_count=0 when post count query fails in no-op path", async () => {
      mockAuthenticated();
      mockSupabase.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
      // count query fails
      mockSupabase.single.mockResolvedValueOnce({ data: null, error: { message: "error" } });

      const result = await removeIntelPostConfirmation(POST_ID);

      expect(result.success).toBe(true);
      expect(result.data?.confirmations_count).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Delegation to removeIntelVote (confirmed vote path)
  // -------------------------------------------------------------------------

  describe("Delegation to removeIntelVote", () => {
    it("calls removeIntelVote with the post ID when vote_type is 'confirmed'", async () => {
      mockAuthenticated();
      // existingVote: 'confirmed' vote found
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: { id: "vote-id", vote_type: "confirmed" },
        error: null,
      });
      mockRemoveIntelVote.mockResolvedValueOnce({
        success: true,
        data: { vote_type: null, helpful_count: 0, off_count: 0, confirmed_count: 4 },
      });

      await removeIntelPostConfirmation(POST_ID);

      expect(mockRemoveIntelVote).toHaveBeenCalledTimes(1);
      expect(mockRemoveIntelVote).toHaveBeenCalledWith(POST_ID);
    });

    it("does not call voteOnIntelPost", async () => {
      mockAuthenticated();
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: { id: "vote-id", vote_type: "confirmed" },
        error: null,
      });
      mockRemoveIntelVote.mockResolvedValueOnce({
        success: true,
        data: { vote_type: null, helpful_count: 0, off_count: 0, confirmed_count: 4 },
      });

      await removeIntelPostConfirmation(POST_ID);

      expect(mockVoteOnIntelPost).not.toHaveBeenCalled();
    });

    it("maps confirmed_count to confirmations_count from removeIntelVote result", async () => {
      mockAuthenticated();
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: { id: "vote-id", vote_type: "confirmed" },
        error: null,
      });
      mockRemoveIntelVote.mockResolvedValueOnce({
        success: true,
        data: { vote_type: null, helpful_count: 1, off_count: 0, confirmed_count: 6 },
      });

      const result = await removeIntelPostConfirmation(POST_ID);

      expect(result.success).toBe(true);
      expect(result.data?.confirmations_count).toBe(6);
    });

    it("sets confirmed to false on successful removal", async () => {
      mockAuthenticated();
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: { id: "vote-id", vote_type: "confirmed" },
        error: null,
      });
      mockRemoveIntelVote.mockResolvedValueOnce({
        success: true,
        data: { vote_type: null, helpful_count: 0, off_count: 0, confirmed_count: 2 },
      });

      const result = await removeIntelPostConfirmation(POST_ID);

      expect(result.success).toBe(true);
      expect(result.data?.confirmed).toBe(false);
    });

    it("sets confirmation_id equal to the post ID", async () => {
      mockAuthenticated();
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: { id: "vote-id", vote_type: "confirmed" },
        error: null,
      });
      mockRemoveIntelVote.mockResolvedValueOnce({
        success: true,
        data: { vote_type: null, helpful_count: 0, off_count: 0, confirmed_count: 2 },
      });

      const result = await removeIntelPostConfirmation(POST_ID);

      expect(result.success).toBe(true);
      expect(result.data?.confirmation_id).toBe(POST_ID);
    });

    it("returns full ConfirmationData shape on successful removal", async () => {
      mockAuthenticated();
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: { id: "vote-id", vote_type: "confirmed" },
        error: null,
      });
      mockRemoveIntelVote.mockResolvedValueOnce({
        success: true,
        data: { vote_type: null, helpful_count: 0, off_count: 0, confirmed_count: 3 },
      });

      const result = await removeIntelPostConfirmation(POST_ID);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        confirmed: false,
        confirmations_count: 3,
        confirmation_id: POST_ID,
      });
    });

    it("falls back to confirmations_count=0 when removeIntelVote data is undefined", async () => {
      mockAuthenticated();
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: { id: "vote-id", vote_type: "confirmed" },
        error: null,
      });
      mockRemoveIntelVote.mockResolvedValueOnce({
        success: true,
        data: undefined,
      });

      const result = await removeIntelPostConfirmation(POST_ID);

      expect(result.success).toBe(true);
      expect(result.data?.confirmations_count).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Error pass-through from removeIntelVote
  // -------------------------------------------------------------------------

  describe("Error pass-through from removeIntelVote", () => {
    it("surfaces removeIntelVote errors as action failures", async () => {
      mockAuthenticated();
      // existingVote: confirmed vote
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: { id: "vote-id", vote_type: "confirmed" },
        error: null,
      });
      // removeIntelVote fails
      mockRemoveIntelVote.mockResolvedValueOnce({
        success: false,
        error: "Failed to remove vote",
      });

      const result = await removeIntelPostConfirmation(POST_ID);

      expect(result.success).toBe(false);
      // The action wraps the error in withAuthenticatedAction, which catches the thrown Error
      expect(result.error).toContain("Failed to remove");
    });
  });

  // -------------------------------------------------------------------------
  // Vote status check errors
  // -------------------------------------------------------------------------

  describe("Error Handling", () => {
    it("returns error when vote status check fails", async () => {
      mockAuthenticated();
      // maybeSingle errors out on the vote status check
      mockSupabase.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: { code: "42501", message: "permission denied" },
      });

      const result = await removeIntelPostConfirmation(POST_ID);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to check vote status");
    });

    it("catches unexpected exceptions", async () => {
      mockAuthenticated();
      mockSupabase.maybeSingle.mockRejectedValueOnce(new Error("DB connection lost"));

      const result = await removeIntelPostConfirmation(POST_ID);

      expect(result.success).toBe(false);
      expect(result.error).toBe("DB connection lost");
    });
  });
});
