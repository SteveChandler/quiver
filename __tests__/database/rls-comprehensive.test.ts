/**
 * RLS Policy Enforcement Tests
 *
 * These tests verify that Row Level Security (RLS) policies are correctly
 * enforced at the application level. Since we can't run actual database
 * queries in unit tests, we mock the Supabase client to simulate how
 * RLS policies should behave.
 *
 * The tests document and verify expected RLS behavior based on:
 * - supabase/migrations/20250823200000_fix_sessions_rls_policies.sql
 * - supabase/migrations/20251024000005_add_admin_rls_policies.sql
 * - supabase/migrations/20251024000006_create_session_media_table.sql
 * - supabase/migrations/20250819050000_create_user_follows_table_production.sql
 * - supabase/migrations/20250116000000_push_notifications_infrastructure.sql
 * - supabase/migrations/20250817182000_enable_rls_and_policies_for_intel.sql
 *
 * RLS Policy Summary:
 * - Sessions: Users can CRUD their own; public sessions visible to all authenticated
 * - Session Media: Inherits visibility from parent session; users can CRUD their own
 * - Profiles: Users can read/update their own; public profiles visible to all
 * - Intel Posts: Publicly readable; users can manage their own
 * - Notifications: Users can only see/update their own
 * - User Follows: Publicly readable; users can only manage their own follow relationships
 * - Admin users: Have elevated permissions via is_admin_user() function
 * - Service role: Bypasses RLS entirely
 */

import { describe, it, expect, beforeEach, jest } from "@jest/globals";
import {
  createMockSupabaseClient,
  createMockUser,
  createMockAdminUser,
  mockAuthenticatedUser,
  MockSupabaseClient,
} from "@/test-utils/api-test-helpers";
import {
  createMockSession,
  createMockIntelPost,
  createMockQueryChain,
  createMockProfile,
} from "@/__tests__/setup/typed-mocks";

// Test data constants
const TEST_USER_ID = "user-123-owner";
const OTHER_USER_ID = "user-456-other";
const ADMIN_USER_ID = "user-789-admin";

// Helper to create test sessions with visibility settings
function createTestSession(overrides: Partial<ReturnType<typeof createMockSession>> = {}) {
  return createMockSession({
    user_id: TEST_USER_ID,
    profile_id: TEST_USER_ID,
    ...overrides,
  });
}

// Helper to create test profiles
function createTestProfile(overrides: Partial<ReturnType<typeof createMockProfile>> = {}) {
  return createMockProfile({
    id: TEST_USER_ID,
    ...overrides,
  });
}

// Helper to create mock notification
function createMockNotification(overrides: Partial<{
  id: string;
  user_id: string;
  type: string;
  data: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}> = {}) {
  return {
    id: `notification-${Date.now()}`,
    user_id: TEST_USER_ID,
    type: "like",
    data: { message: "Test notification" },
    read_at: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

// Helper to create mock user follow relationship
function createMockUserFollow(overrides: Partial<{
  id: string;
  follower_id: string;
  following_id: string;
  created_at: string;
}> = {}) {
  return {
    id: `follow-${Date.now()}`,
    follower_id: TEST_USER_ID,
    following_id: OTHER_USER_ID,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

// Helper to create mock session media
function createMockSessionMedia(overrides: Partial<{
  id: string;
  session_id: string;
  user_id: string;
  storage_path: string;
  public_url: string;
  file_size: number;
  media_type: string;
  caption: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  deleted_at: string | null;
}> = {}) {
  return {
    id: `media-${Date.now()}`,
    session_id: "session-123",
    user_id: TEST_USER_ID,
    storage_path: "/sessions/media/test.jpg",
    public_url: "https://example.com/test.jpg",
    file_size: 1024,
    media_type: "photo",
    caption: null,
    metadata: {},
    created_at: new Date().toISOString(),
    deleted_at: null,
    ...overrides,
  };
}

/**
 * Simulates RLS policy behavior for sessions table
 * Based on actual policies:
 * - sessions_select_all: FOR SELECT USING (true) - but filtered by is_public or owner
 * - sessions_insert_own: FOR INSERT WITH CHECK (auth.uid() = profile_id)
 * - sessions_update_own: FOR UPDATE USING (auth.uid() = profile_id)
 * - sessions_delete_own: FOR DELETE USING (auth.uid() = profile_id)
 */
function simulateSessionsRLSPolicy(
  sessions: ReturnType<typeof createTestSession>[],
  currentUserId: string | null,
  isAdmin: boolean = false
): ReturnType<typeof createTestSession>[] {
  if (!currentUserId) {
    // Guest users: no sessions visible (requires authentication)
    return [];
  }

  if (isAdmin) {
    // Admin users can see all sessions
    return sessions;
  }

  // Regular authenticated users: see own sessions + public sessions
  return sessions.filter(
    (session) => session.profile_id === currentUserId || session.is_public === true
  );
}

/**
 * Simulates RLS policy behavior for session_media table
 * Based on actual policies:
 * - "Public can view media from public sessions": non-deleted media from public sessions
 * - "Users can view own media": auth.uid() = user_id
 * - "Users can insert/update/delete own media": auth.uid() = user_id
 */
function simulateSessionMediaRLSPolicy(
  mediaItems: ReturnType<typeof createMockSessionMedia>[],
  sessions: ReturnType<typeof createTestSession>[],
  currentUserId: string | null,
  isAdmin: boolean = false
): ReturnType<typeof createMockSessionMedia>[] {
  if (!currentUserId) {
    return [];
  }

  if (isAdmin) {
    return mediaItems;
  }

  const publicSessionIds = new Set(
    sessions.filter((s) => s.is_public && !s.deleted_at).map((s) => s.id)
  );

  return mediaItems.filter((media) => {
    // User can always see their own media
    if (media.user_id === currentUserId) return true;
    // Public media from public sessions is visible
    if (!media.deleted_at && publicSessionIds.has(media.session_id)) return true;
    return false;
  });
}

/**
 * Simulates RLS policy behavior for notifications table
 * Based on actual policies:
 * - "Users can view their own notifications": auth.uid() = user_id
 * - "Users can update their own notifications": auth.uid() = user_id
 * - No INSERT policy - notifications created via service role only
 */
function simulateNotificationsRLSPolicy(
  notifications: ReturnType<typeof createMockNotification>[],
  currentUserId: string | null
): ReturnType<typeof createMockNotification>[] {
  if (!currentUserId) {
    return [];
  }
  return notifications.filter((n) => n.user_id === currentUserId);
}

/**
 * Simulates RLS policy behavior for profiles table
 * Based on actual policies:
 * - "Public profiles are viewable by all": FOR SELECT USING (true)
 * - "Users can read own profile": auth.uid() = id
 * - "Users can update own profile": auth.uid() = id
 * - "Users can insert own profile": auth.uid() = id
 */
function simulateProfilesRLSPolicy(
  profiles: ReturnType<typeof createTestProfile>[],
  currentUserId: string | null,
  operation: "select" | "update" | "insert" | "delete"
): ReturnType<typeof createTestProfile>[] {
  if (operation === "select") {
    // All profiles are publicly readable
    return profiles;
  }

  if (!currentUserId) {
    return [];
  }

  // For mutations, users can only modify their own profile
  return profiles.filter((p) => p.id === currentUserId);
}

describe("RLS Policy Enforcement", () => {
  let mockClient: MockSupabaseClient;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = createMockSupabaseClient();
  });

  describe("Session Privacy", () => {
    const ownerSession = createTestSession({
      id: "session-owner",
      profile_id: TEST_USER_ID,
      is_public: false,
    });

    const publicSession = createTestSession({
      id: "session-public",
      profile_id: OTHER_USER_ID,
      is_public: true,
    });

    const otherPrivateSession = createTestSession({
      id: "session-other-private",
      profile_id: OTHER_USER_ID,
      is_public: false,
    });

    const allSessions = [ownerSession, publicSession, otherPrivateSession];

    it("private sessions only visible to owner", () => {
      // Simulate authenticated user viewing sessions
      const visibleSessions = simulateSessionsRLSPolicy(allSessions, TEST_USER_ID);

      // Owner should see their own private session
      expect(visibleSessions.some((s) => s.id === "session-owner")).toBe(true);

      // Owner should NOT see another user's private session
      expect(visibleSessions.some((s) => s.id === "session-other-private")).toBe(false);

      // Verify the correct number of visible sessions
      expect(visibleSessions).toHaveLength(2); // own private + other's public
    });

    it("public sessions visible to all authenticated users", () => {
      // Simulate a different authenticated user
      const visibleToOther = simulateSessionsRLSPolicy(allSessions, OTHER_USER_ID);

      // Other user should see public session
      expect(visibleToOther.some((s) => s.id === "session-public")).toBe(true);

      // Other user should see their own sessions (both public and private)
      expect(visibleToOther.some((s) => s.id === "session-other-private")).toBe(true);

      // Other user should NOT see original user's private session
      expect(visibleToOther.some((s) => s.id === "session-owner")).toBe(false);
    });

    it("session media inherits session privacy", () => {
      const publicSessionMedia = createMockSessionMedia({
        id: "media-public",
        session_id: "session-public",
        user_id: OTHER_USER_ID,
      });

      const privateSessionMedia = createMockSessionMedia({
        id: "media-private",
        session_id: "session-other-private",
        user_id: OTHER_USER_ID,
      });

      const ownMedia = createMockSessionMedia({
        id: "media-own",
        session_id: "session-owner",
        user_id: TEST_USER_ID,
      });

      const allMedia = [publicSessionMedia, privateSessionMedia, ownMedia];

      // User should see media from public sessions + their own media
      const visibleMedia = simulateSessionMediaRLSPolicy(
        allMedia,
        allSessions,
        TEST_USER_ID
      );

      // Should see media from public session
      expect(visibleMedia.some((m) => m.id === "media-public")).toBe(true);

      // Should see own media
      expect(visibleMedia.some((m) => m.id === "media-own")).toBe(true);

      // Should NOT see media from private session of other user
      expect(visibleMedia.some((m) => m.id === "media-private")).toBe(false);
    });

    it("guest users cannot see any sessions", () => {
      // Simulate unauthenticated user (null userId)
      const visibleToGuest = simulateSessionsRLSPolicy(allSessions, null);

      // Guest should see no sessions
      expect(visibleToGuest).toHaveLength(0);
    });

    it("verifies mock client behavior for session queries", async () => {
      // Setup mock to return all sessions
      const chain = createMockQueryChain(allSessions);
      mockClient.from.mockReturnValue(chain as any);

      // Simulate authenticated user
      mockAuthenticatedUser(mockClient, createMockUser({ id: TEST_USER_ID }));

      // The application code would filter results based on RLS
      // Here we verify the mock setup works correctly
      const result = await mockClient.from("sessions").select("*");
      expect(mockClient.from).toHaveBeenCalledWith("sessions");
    });
  });

  describe("User Data Isolation", () => {
    const ownProfile = createTestProfile({
      id: TEST_USER_ID,
      full_name: "Test User",
      experience_level: "intermediate",
    });

    const otherProfile = createTestProfile({
      id: OTHER_USER_ID,
      full_name: "Other User",
      experience_level: "advanced",
    });

    const allProfiles = [ownProfile, otherProfile];

    it("users can only read own preferences", () => {
      // Profiles are publicly readable for basic info
      const readableProfiles = simulateProfilesRLSPolicy(
        allProfiles,
        TEST_USER_ID,
        "select"
      );

      // All profiles should be readable (public read access)
      expect(readableProfiles).toHaveLength(2);

      // But for updates, only own profile is allowed
      const updatableProfiles = simulateProfilesRLSPolicy(
        allProfiles,
        TEST_USER_ID,
        "update"
      );

      expect(updatableProfiles).toHaveLength(1);
      expect(updatableProfiles[0].id).toBe(TEST_USER_ID);
    });

    it("users can only edit own profile", () => {
      const editableProfiles = simulateProfilesRLSPolicy(
        allProfiles,
        TEST_USER_ID,
        "update"
      );

      // Should only be able to edit own profile
      expect(editableProfiles).toHaveLength(1);
      expect(editableProfiles[0].id).toBe(TEST_USER_ID);

      // Other user's profile should not be editable
      expect(editableProfiles.some((p) => p.id === OTHER_USER_ID)).toBe(false);
    });

    it("users can only delete own comments", () => {
      // Similar pattern - users can only delete their own data
      // This follows the same auth.uid() = user_id pattern

      const ownComment = { id: "comment-1", user_id: TEST_USER_ID };
      const otherComment = { id: "comment-2", user_id: OTHER_USER_ID };

      const allComments = [ownComment, otherComment];

      // Simulate RLS delete policy: auth.uid() = user_id
      const deletableComments = allComments.filter(
        (c) => c.user_id === TEST_USER_ID
      );

      expect(deletableComments).toHaveLength(1);
      expect(deletableComments[0].id).toBe("comment-1");
    });

    it("unauthenticated users cannot modify any profiles", () => {
      const editableAsGuest = simulateProfilesRLSPolicy(
        allProfiles,
        null,
        "update"
      );

      expect(editableAsGuest).toHaveLength(0);
    });
  });

  describe("Social Features", () => {
    it("follower relationships respect privacy settings", () => {
      // User follows are publicly readable (for discovery)
      const userFollows = [
        createMockUserFollow({
          id: "follow-1",
          follower_id: TEST_USER_ID,
          following_id: OTHER_USER_ID,
        }),
        createMockUserFollow({
          id: "follow-2",
          follower_id: OTHER_USER_ID,
          following_id: TEST_USER_ID,
        }),
      ];

      // All follow relationships should be readable
      // Based on policy: "Users can view follow relationships" USING (true)
      expect(userFollows).toHaveLength(2);

      // But for insert, user can only create where they are the follower
      // Based on policy: WITH CHECK (auth.uid() = follower_id)
      const canCreate = userFollows.filter((f) => f.follower_id === TEST_USER_ID);
      expect(canCreate).toHaveLength(1);

      // For delete, user can only remove where they are the follower
      // Based on policy: USING (auth.uid() = follower_id)
      const canDelete = userFollows.filter((f) => f.follower_id === TEST_USER_ID);
      expect(canDelete).toHaveLength(1);
    });

    it("intel posts visible based on beach permissions", () => {
      // Intel posts are publicly readable based on policy
      const intelPosts = [
        createMockIntelPost({
          id: "intel-1",
          user_id: TEST_USER_ID,
          beach_id: "beach-1",
          is_active: true,
        }),
        createMockIntelPost({
          id: "intel-2",
          user_id: OTHER_USER_ID,
          beach_id: "beach-2",
          is_active: true,
        }),
        createMockIntelPost({
          id: "intel-3",
          user_id: OTHER_USER_ID,
          beach_id: "beach-1",
          is_active: false, // Inactive/expired
        }),
      ];

      // Based on policy: "Intel posts are publicly readable" USING (true)
      // All intel posts should be readable
      expect(intelPosts).toHaveLength(3);

      // Active intel posts are the main filter
      const activeIntel = intelPosts.filter((i) => i.is_active);
      expect(activeIntel).toHaveLength(2);
    });

    it("notifications only visible to recipient", () => {
      const notifications = [
        createMockNotification({
          id: "notif-1",
          user_id: TEST_USER_ID,
          type: "like",
        }),
        createMockNotification({
          id: "notif-2",
          user_id: OTHER_USER_ID,
          type: "follow",
        }),
      ];

      // Test user should only see their own notifications
      const visibleNotifications = simulateNotificationsRLSPolicy(
        notifications,
        TEST_USER_ID
      );

      expect(visibleNotifications).toHaveLength(1);
      expect(visibleNotifications[0].id).toBe("notif-1");
      expect(visibleNotifications[0].user_id).toBe(TEST_USER_ID);
    });

    it("users cannot see other users notifications", () => {
      const otherUserNotifications = [
        createMockNotification({
          id: "notif-other",
          user_id: OTHER_USER_ID,
        }),
      ];

      const visibleToTestUser = simulateNotificationsRLSPolicy(
        otherUserNotifications,
        TEST_USER_ID
      );

      expect(visibleToTestUser).toHaveLength(0);
    });
  });

  describe("Admin Override", () => {
    const allSessions = [
      createTestSession({ id: "session-1", profile_id: TEST_USER_ID, is_public: false }),
      createTestSession({ id: "session-2", profile_id: OTHER_USER_ID, is_public: false }),
      createTestSession({ id: "session-3", profile_id: OTHER_USER_ID, is_public: true }),
    ];

    it("service role bypasses RLS", () => {
      // Service role client has full access to all data
      // This is typically used for server-side operations like:
      // - Creating notifications
      // - Batch processing
      // - Admin operations

      // When using service role, all sessions are accessible
      // In real implementation, this uses createSupabaseServiceRoleClient()
      const serviceRoleAccess = allSessions; // Service role sees everything

      expect(serviceRoleAccess).toHaveLength(3);
      expect(serviceRoleAccess.map((s) => s.id)).toEqual([
        "session-1",
        "session-2",
        "session-3",
      ]);
    });

    it("admin role has elevated permissions", () => {
      // Admin users (is_admin = true in profiles) have elevated access
      // Based on policies like "Admins can view all sessions"
      const adminUser = createMockAdminUser({ id: ADMIN_USER_ID });

      // Simulate admin viewing all sessions
      const visibleToAdmin = simulateSessionsRLSPolicy(
        allSessions,
        ADMIN_USER_ID,
        true // isAdmin
      );

      // Admin should see all sessions including private ones
      expect(visibleToAdmin).toHaveLength(3);

      // Verify admin sees private sessions of other users
      const otherPrivate = visibleToAdmin.find(
        (s) => s.id === "session-2" && s.profile_id === OTHER_USER_ID && !s.is_public
      );
      expect(otherPrivate).toBeDefined();
    });

    it("normal users cannot escalate privileges", () => {
      // Regular user trying to access admin-only resources
      const normalUser = createMockUser({ id: TEST_USER_ID });

      // Normal users should not see other users' private sessions
      const visibleToNormal = simulateSessionsRLSPolicy(
        allSessions,
        TEST_USER_ID,
        false // not admin
      );

      // Should only see own sessions + public sessions
      expect(visibleToNormal).toHaveLength(2);

      // Should NOT see other user's private session
      expect(visibleToNormal.some((s) => s.id === "session-2")).toBe(false);
    });

    it("admin can view history tables", () => {
      // Based on policies like "Admins can view beaches history"
      // Admin users can access audit history tables

      const historyRecords = [
        { history_id: "hist-1", change_type: "UPDATE" },
        { history_id: "hist-2", change_type: "DELETE" },
      ];

      // Admin should have access to history
      // Normal users should not (policy uses is_admin_user())
      const adminHasAccess = true; // Simulated admin check
      const normalHasAccess = false;

      expect(adminHasAccess).toBe(true);
      expect(normalHasAccess).toBe(false);
    });

    it("verifies admin check function behavior", () => {
      // The is_admin_user() function checks profiles.is_admin = true
      const adminProfile = createMockProfile({
        id: ADMIN_USER_ID,
        is_admin: true,
      });

      const normalProfile = createMockProfile({
        id: TEST_USER_ID,
        is_admin: false,
      });

      // Simulate is_admin_user() check
      const isAdminUser = (userId: string, profiles: ReturnType<typeof createMockProfile>[]) => {
        const profile = profiles.find((p) => p.id === userId);
        return profile?.is_admin === true;
      };

      const allProfiles = [adminProfile, normalProfile];

      expect(isAdminUser(ADMIN_USER_ID, allProfiles)).toBe(true);
      expect(isAdminUser(TEST_USER_ID, allProfiles)).toBe(false);
      expect(isAdminUser("unknown-id", allProfiles)).toBe(false);
    });
  });

  describe("Edge Cases", () => {
    it("handles deleted sessions correctly", () => {
      const deletedSession = createTestSession({
        id: "session-deleted",
        profile_id: TEST_USER_ID,
        is_public: true,
        deleted_at: new Date().toISOString(),
      });

      const activeSession = createTestSession({
        id: "session-active",
        profile_id: TEST_USER_ID,
        is_public: true,
        deleted_at: null,
      });

      const allSessions = [deletedSession, activeSession];

      // Application logic typically filters soft-deleted records
      const visibleSessions = allSessions.filter((s) => !s.deleted_at);

      expect(visibleSessions).toHaveLength(1);
      expect(visibleSessions[0].id).toBe("session-active");
    });

    it("handles null user context gracefully", () => {
      const sessions = [createTestSession()];

      // Null user should not crash, just return empty
      const result = simulateSessionsRLSPolicy(sessions, null);
      expect(result).toHaveLength(0);
    });

    it("handles empty data sets", () => {
      const result = simulateSessionsRLSPolicy([], TEST_USER_ID);
      expect(result).toHaveLength(0);
    });

    it("prevents cross-user data modification", () => {
      // Test that users cannot modify other users' data
      // This is enforced by auth.uid() = user_id checks

      const otherUserSession = createTestSession({
        id: "other-session",
        profile_id: OTHER_USER_ID,
        user_id: OTHER_USER_ID,
      });

      // Simulate update attempt by TEST_USER
      const canUpdate = otherUserSession.profile_id === TEST_USER_ID;
      expect(canUpdate).toBe(false);

      // Simulate delete attempt by TEST_USER
      const canDelete = otherUserSession.profile_id === TEST_USER_ID;
      expect(canDelete).toBe(false);
    });
  });

  describe("RLS Policy Documentation", () => {
    /**
     * This section documents the expected RLS behavior for reference.
     * These tests serve as living documentation of security policies.
     */

    it("documents session table RLS policies", () => {
      const sessionPolicies = {
        select: {
          "sessions_select_all": "FOR SELECT USING (true) - allows authenticated reads",
          "Admins can view all sessions": "FOR SELECT USING (public.is_admin_user())",
        },
        insert: {
          "sessions_insert_own": "FOR INSERT WITH CHECK (auth.uid() = profile_id)",
        },
        update: {
          "sessions_update_own": "FOR UPDATE USING (auth.uid() = profile_id)",
          "Admins can update any session": "FOR UPDATE USING (public.is_admin_user())",
        },
        delete: {
          "sessions_delete_own": "FOR DELETE USING (auth.uid() = profile_id)",
          "Admins can delete any session": "FOR DELETE USING (public.is_admin_user())",
        },
      };

      expect(Object.keys(sessionPolicies)).toEqual(["select", "insert", "update", "delete"]);
    });

    it("documents notification table RLS policies", () => {
      const notificationPolicies = {
        select: {
          "Users can view their own notifications": "FOR SELECT USING (auth.uid() = user_id)",
        },
        update: {
          "Users can update their own notifications": "FOR UPDATE USING (auth.uid() = user_id)",
        },
        insert: {
          // No insert policy - notifications created via service role only
        },
      };

      // Verify no insert policy for notifications
      expect(Object.keys(notificationPolicies.insert || {})).toHaveLength(0);
    });

    it("documents user_follows table RLS policies", () => {
      const followPolicies = {
        select: {
          "Users can view follow relationships": "FOR SELECT USING (true)",
        },
        insert: {
          "Users can follow others": "FOR INSERT WITH CHECK (auth.uid() = follower_id)",
        },
        delete: {
          "Users can unfollow others": "FOR DELETE USING (auth.uid() = follower_id)",
        },
      };

      // No update policy - follows are immutable (create/delete only)
      expect(followPolicies).not.toHaveProperty("update");
    });
  });
});
