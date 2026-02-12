/**
 * @jest-environment node
 *
 * Tests for actions/intel/intel-confirm-actions.ts
 *
 * Covers:
 * - confirmIntelPost: authentication, post existence, active/expired checks
 * - confirmIntelPost: prevent self-confirmation, duplicate confirmation
 * - confirmIntelPost: successful confirmation with count and XP credit
 * - removeIntelPostConfirmation: authentication, post existence
 * - removeIntelPostConfirmation: deletes confirmation, handles not-found
 * - Error handling for database errors in both flows
 */

// =============================================================================
// MOCK SETUP
// =============================================================================

const mockUser = { id: "confirmer-user-123" };

const createMockSupabase = () => ({
  auth: {
    getUser: jest.fn(),
  },
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
  single: jest.fn(),
});

let mockSupabase: ReturnType<typeof createMockSupabase>;

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: jest.fn(() => Promise.resolve(mockSupabase)),
}));

// Mock XP credit (async, non-blocking)
jest.mock("@/lib/gamification", () => ({
  creditAuthorWithXP: jest.fn().mockResolvedValue(undefined),
}));

// Mock revalidatePath
jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
}));

import {
  confirmIntelPost,
  removeIntelPostConfirmation,
} from "@/actions/intel/intel-confirm-actions";
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

const ACTIVE_POST = {
  id: "post-123",
  user_id: "author-456",
  is_active: true,
  expires_at: new Date(Date.now() + 86400000).toISOString(), // Future
};

const EXPIRED_POST = {
  id: "post-expired",
  user_id: "author-456",
  is_active: true,
  expires_at: new Date(Date.now() - 86400000).toISOString(), // Past
};

const INACTIVE_POST = {
  id: "post-inactive",
  user_id: "author-456",
  is_active: false,
  expires_at: null,
};

const OWN_POST = {
  id: "post-own",
  user_id: mockUser.id, // Same as confirmer
  is_active: true,
  expires_at: null,
};

// =============================================================================
// TESTS - confirmIntelPost
// =============================================================================

describe("confirmIntelPost", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase = createMockSupabase();
    const { createSupabaseServerClient } = jest.requireMock(
      "@/lib/supabase/server"
    );
    createSupabaseServerClient.mockReturnValue(Promise.resolve(mockSupabase));
  });

  describe("Authentication", () => {
    test("requires authentication", async () => {
      mockUnauthenticated();

      const result = await confirmIntelPost("post-123");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Authentication required");
    });
  });

  describe("Post Validation", () => {
    test("returns error when post not found", async () => {
      mockAuthenticated();
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { code: "PGRST116", message: "no rows" },
      });

      const result = await confirmIntelPost("nonexistent-post");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Intel post not found");
    });

    test("rejects confirmation of inactive posts", async () => {
      mockAuthenticated();
      mockSupabase.single.mockResolvedValueOnce({
        data: INACTIVE_POST,
        error: null,
      });

      const result = await confirmIntelPost(INACTIVE_POST.id);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Intel post is no longer active");
    });

    test("rejects confirmation of expired posts", async () => {
      mockAuthenticated();
      mockSupabase.single.mockResolvedValueOnce({
        data: EXPIRED_POST,
        error: null,
      });

      const result = await confirmIntelPost(EXPIRED_POST.id);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Intel post has expired");
    });

    test("prevents self-confirmation", async () => {
      mockAuthenticated();
      mockSupabase.single.mockResolvedValueOnce({
        data: OWN_POST,
        error: null,
      });

      const result = await confirmIntelPost(OWN_POST.id);

      expect(result.success).toBe(false);
      expect(result.error).toBe("You cannot confirm your own intel post");
    });
  });

  describe("Duplicate Confirmation", () => {
    test("rejects if user already confirmed this post", async () => {
      mockAuthenticated();
      // Post lookup
      mockSupabase.single.mockResolvedValueOnce({
        data: ACTIVE_POST,
        error: null,
      });
      // Existing confirmation check
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: "existing-confirmation" },
        error: null,
      });

      const result = await confirmIntelPost(ACTIVE_POST.id);

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        "You have already confirmed this intel post"
      );
    });
  });

  describe("Successful Confirmation", () => {
    test("creates confirmation and returns updated count", async () => {
      mockAuthenticated();
      // Post lookup
      mockSupabase.single
        .mockResolvedValueOnce({ data: ACTIVE_POST, error: null })
        // No existing confirmation (PGRST116 = not found)
        .mockResolvedValueOnce({
          data: null,
          error: { code: "PGRST116", message: "no rows found" },
        })
        // Insert confirmation
        .mockResolvedValueOnce({
          data: { id: "new-confirmation-id" },
          error: null,
        })
        // Updated post count
        .mockResolvedValueOnce({
          data: { confirmations_count: 4 },
          error: null,
        });

      const result = await confirmIntelPost(ACTIVE_POST.id);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        confirmed: true,
        confirmations_count: 4,
        confirmation_id: "new-confirmation-id",
      });
    });

    test("credits author with XP (non-blocking)", async () => {
      mockAuthenticated();
      mockSupabase.single
        .mockResolvedValueOnce({ data: ACTIVE_POST, error: null })
        .mockResolvedValueOnce({
          data: null,
          error: { code: "PGRST116" },
        })
        .mockResolvedValueOnce({
          data: { id: "conf-id" },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { confirmations_count: 2 },
          error: null,
        });

      await confirmIntelPost(ACTIVE_POST.id);

      expect(creditAuthorWithXP).toHaveBeenCalledWith(
        ACTIVE_POST.user_id,
        "intel_post",
        ACTIVE_POST.id
      );
    });

    test("falls back to count=1 when count query fails", async () => {
      mockAuthenticated();
      mockSupabase.single
        .mockResolvedValueOnce({ data: ACTIVE_POST, error: null })
        .mockResolvedValueOnce({
          data: null,
          error: { code: "PGRST116" },
        })
        .mockResolvedValueOnce({
          data: { id: "conf-id" },
          error: null,
        })
        // Count query fails
        .mockResolvedValueOnce({
          data: null,
          error: { message: "query error" },
        });

      const result = await confirmIntelPost(ACTIVE_POST.id);

      expect(result.success).toBe(true);
      expect(result.data?.confirmations_count).toBe(1);
    });
  });

  describe("Error Handling", () => {
    test("handles confirmation check query errors (not PGRST116)", async () => {
      mockAuthenticated();
      mockSupabase.single
        .mockResolvedValueOnce({ data: ACTIVE_POST, error: null })
        .mockResolvedValueOnce({
          data: null,
          error: { code: "42501", message: "permission denied" },
        });

      const result = await confirmIntelPost(ACTIVE_POST.id);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to check confirmation status");
    });

    test("handles insert confirmation error", async () => {
      mockAuthenticated();
      mockSupabase.single
        .mockResolvedValueOnce({ data: ACTIVE_POST, error: null })
        .mockResolvedValueOnce({
          data: null,
          error: { code: "PGRST116" },
        })
        .mockResolvedValueOnce({
          data: null,
          error: { message: "insert error" },
        });

      const result = await confirmIntelPost(ACTIVE_POST.id);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to confirm intel post");
    });

    test("catches unexpected exceptions", async () => {
      mockAuthenticated();
      mockSupabase.single.mockRejectedValueOnce(
        new Error("Unexpected DB error")
      );

      const result = await confirmIntelPost("post-123");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Unexpected DB error");
    });
  });
});

// =============================================================================
// TESTS - removeIntelPostConfirmation
// =============================================================================

describe("removeIntelPostConfirmation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase = createMockSupabase();
    const { createSupabaseServerClient } = jest.requireMock(
      "@/lib/supabase/server"
    );
    createSupabaseServerClient.mockReturnValue(Promise.resolve(mockSupabase));
  });

  describe("Authentication", () => {
    test("requires authentication", async () => {
      mockUnauthenticated();

      const result = await removeIntelPostConfirmation("post-123");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Authentication required");
    });
  });

  describe("Post Validation", () => {
    test("returns error when post not found", async () => {
      mockAuthenticated();
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { code: "PGRST116" },
      });

      const result = await removeIntelPostConfirmation("nonexistent");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Intel post not found");
    });
  });

  describe("Successful Removal", () => {
    test("deletes confirmation and returns updated count", async () => {
      mockAuthenticated();
      // Post lookup
      mockSupabase.single
        .mockResolvedValueOnce({
          data: { id: "post-123" },
          error: null,
        })
        // Delete confirmation
        .mockResolvedValueOnce({
          data: { id: "deleted-conf-id" },
          error: null,
        })
        // Updated count
        .mockResolvedValueOnce({
          data: { confirmations_count: 2 },
          error: null,
        });

      const result = await removeIntelPostConfirmation("post-123");

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        confirmed: false,
        confirmations_count: 2,
        confirmation_id: "deleted-conf-id",
      });
    });

    test("falls back to count=0 when count query fails", async () => {
      mockAuthenticated();
      mockSupabase.single
        .mockResolvedValueOnce({
          data: { id: "post-123" },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { id: "conf-id" },
          error: null,
        })
        .mockResolvedValueOnce({
          data: null,
          error: { message: "query error" },
        });

      const result = await removeIntelPostConfirmation("post-123");

      expect(result.success).toBe(true);
      expect(result.data?.confirmations_count).toBe(0);
    });
  });

  describe("Error Handling", () => {
    test("returns error when user has not confirmed the post (PGRST116)", async () => {
      mockAuthenticated();
      mockSupabase.single
        .mockResolvedValueOnce({
          data: { id: "post-123" },
          error: null,
        })
        // Delete returns no rows
        .mockResolvedValueOnce({
          data: null,
          error: { code: "PGRST116", message: "no rows found" },
        });

      const result = await removeIntelPostConfirmation("post-123");

      expect(result.success).toBe(false);
      expect(result.error).toBe("You have not confirmed this intel post");
    });

    test("handles delete error (non-PGRST116)", async () => {
      mockAuthenticated();
      mockSupabase.single
        .mockResolvedValueOnce({
          data: { id: "post-123" },
          error: null,
        })
        .mockResolvedValueOnce({
          data: null,
          error: { code: "42501", message: "permission denied" },
        });

      const result = await removeIntelPostConfirmation("post-123");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to remove confirmation");
    });

    test("catches unexpected exceptions", async () => {
      mockAuthenticated();
      mockSupabase.single.mockRejectedValueOnce(
        new Error("Connection lost")
      );

      const result = await removeIntelPostConfirmation("post-123");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Connection lost");
    });
  });
});
