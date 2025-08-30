import {
  getProfile,
  createProfile,
  updateProfile,
  getUserStats,
} from "@/actions/profile-actions";
import type { Profile } from "@/types/database";

// Mock Supabase clients with flexible chaining
const mockSupabaseClient = {
  auth: {
    getUser: jest.fn(),
  },
  from: jest.fn(),
  rpc: jest.fn(),
};

// Helper function to create flexible mock chains
const createMockChain = (finalResult: any) => {
  const chainMethods = {
    select: jest.fn((columns?: any, options?: any) => {
      // Handle count queries with special options
      if (options && options.count === "exact" && options.head === true) {
        return {
          eq: jest.fn(() => finalResult),
        };
      }
      return chainMethods;
    }),
    eq: jest.fn(() => chainMethods),
    maybeSingle: jest.fn(() => finalResult),
    single: jest.fn(() => finalResult),
    insert: jest.fn(() => chainMethods),
    update: jest.fn(() => chainMethods),
    limit: jest.fn(() => finalResult),
  };
  return chainMethods;
};

const mockSupabaseServiceRoleClient = {
  auth: {
    admin: {
      getUserById: jest.fn(),
    },
  },
};

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: jest.fn(() =>
    Promise.resolve(mockSupabaseClient)
  ),
  createSupabaseServiceRoleClient: jest.fn(() => mockSupabaseServiceRoleClient),
}));

jest.mock("next/cache", () => ({
  revalidatePath: jest.fn(),
  revalidateTag: jest.fn(),
}));

jest.mock("@/hooks/use-user-profile", () => ({
  invalidateProfileCache: jest.fn(),
}));

const mockUser = {
  id: "user-123",
  email: "test@example.com",
  user_metadata: {
    full_name: "Test User",
  },
};

const mockProfile: Profile = {
  id: "user-123",
  full_name: "Test User",
  email: "test@example.com",
  phone_number: null,
  bio: "Test bio",
  avatar_url: "https://example.com/avatar.jpg",
  location: null,
  experience_level: null,
  favorite_spot: "Malibu",
  instagram: null,
  home_beach_id: null,
  notification_session_reminders: true,
  notification_community_replies: true,
  inapp_session_invites: true,
  email_session_invites: false,
  digest_session_invites: false,
  followers_count: 10,
  following_count: 5,
  is_mock: false,
  created_at: "2024-01-01T00:00:00.000Z",
  updated_at: "2024-01-01T00:00:00.000Z",
};

describe("Profile Actions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getProfile", () => {
    it("should return profile successfully when found", async () => {
      // Mock connection check (first query)
      const mockConnectionResult = Promise.resolve({
        data: [],
        error: null,
      });
      const mockConnectionChain = createMockChain(mockConnectionResult);

      // Mock profile query (second query)
      const mockProfileResult = Promise.resolve({
        data: mockProfile,
        error: null,
      });
      const mockProfileChain = createMockChain(mockProfileResult);

      // Set up the mock to handle both calls
      mockSupabaseClient.from
        .mockReturnValueOnce(mockConnectionChain)
        .mockReturnValueOnce(mockProfileChain);

      const result = await getProfile("user-123");

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockProfile);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith("profiles");
    });

    it("should return error when no user ID provided", async () => {
      const result = await getProfile("");

      expect(result.success).toBe(false);
      expect(result.error).toBe("No user ID provided");
    });

    it("should handle database connection errors", async () => {
      const mockConnectionError = Promise.reject(new Error("Connection failed"));
      const mockChain = createMockChain(mockConnectionError);
      
      mockSupabaseClient.from.mockReturnValue(mockChain);

      const result = await getProfile("user-123");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Database connection failed. Please try again later.");
      expect(result.isConnectionError).toBe(true);
    });

    it("should create profile when none exists", async () => {
      // Mock connection check success
      const mockConnectionResult = Promise.resolve({
        data: [],
        error: null,
      });
      const mockConnectionChain = createMockChain(mockConnectionResult);

      // Mock profile lookup returning null (no profile found)
      const mockProfileLookupResult = Promise.resolve({
        data: null,
        error: null,
      });
      const mockProfileLookupChain = createMockChain(mockProfileLookupResult);

      // Mock checking if profile exists in createProfile (returns null)
      const mockCheckResult = Promise.resolve({
        data: null,
        error: null,
      });
      const mockCheckChain = createMockChain(mockCheckResult);

      // Mock profile creation success
      const mockCreateResult = Promise.resolve({
        data: mockProfile,
        error: null,
      });
      const mockCreateChain = createMockChain(mockCreateResult);

      // Mock service role client for user lookup
      mockSupabaseServiceRoleClient.auth.admin.getUserById.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      // Set up the from calls
      mockSupabaseClient.from
        .mockReturnValueOnce(mockConnectionChain) // Connection check
        .mockReturnValueOnce(mockProfileLookupChain) // Profile lookup
        .mockReturnValueOnce(mockCheckChain) // Check existing in createProfile
        .mockReturnValueOnce(mockCreateChain); // Profile creation

      const result = await getProfile("user-123");

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockProfile);
      expect(mockSupabaseServiceRoleClient.auth.admin.getUserById).toHaveBeenCalledWith("user-123");
    });

    it("should handle database query errors", async () => {
      // Mock connection check success
      const mockConnectionCheck = jest.fn().mockResolvedValue({
        data: [],
        error: null,
      });

      const mockSelectCount = jest.fn().mockReturnValue({
        limit: () => mockConnectionCheck,
      });

      // Mock database error
      const mockMaybeSingle = jest.fn().mockResolvedValue({
        data: null,
        error: { message: "Database query failed" },
      });

      const mockEq = jest.fn().mockReturnValue({
        maybeSingle: mockMaybeSingle,
      });

      const mockSelect = jest.fn().mockReturnValue({
        eq: mockEq,
      });

      mockSupabaseClient.from
        .mockReturnValueOnce({ select: mockSelectCount })
        .mockReturnValueOnce({ select: mockSelect });

      const result = await getProfile("user-123");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Database query failed");
      expect(result.isConnectionError).toBe(false);
    });
  });

  describe("createProfile", () => {
    it("should create profile successfully", async () => {
      // Mock checking if profile exists (returns null)
      const mockCheckSingle = jest.fn().mockResolvedValue({
        data: null,
        error: null,
      });

      const mockCheckEq = jest.fn().mockReturnValue({
        maybeSingle: mockCheckSingle,
      });

      const mockCheckSelect = jest.fn().mockReturnValue({
        eq: mockCheckEq,
      });

      // Mock profile creation
      const mockCreateSingle = jest.fn().mockResolvedValue({
        data: mockProfile,
        error: null,
      });

      const mockCreateSelect = jest.fn().mockReturnValue({
        single: mockCreateSingle,
      });

      const mockInsert = jest.fn().mockReturnValue({
        select: mockCreateSelect,
      });

      mockSupabaseClient.from
        .mockReturnValueOnce({ select: mockCheckSelect })
        .mockReturnValueOnce({ insert: mockInsert });

      // Mock service role client
      mockSupabaseServiceRoleClient.auth.admin.getUserById.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const result = await createProfile("user-123");

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockProfile);
      expect(mockInsert).toHaveBeenCalledWith({
        id: "user-123",
        full_name: "Test User",
      });
    });

    it("should return error when no user ID provided", async () => {
      const result = await createProfile("");

      expect(result.success).toBe(false);
      expect(result.error).toBe("No user ID provided");
    });

    it("should return existing profile if already exists", async () => {
      // Mock finding existing profile
      const mockCheckSingle = jest.fn().mockResolvedValue({
        data: { id: "user-123" },
        error: null,
      });

      const mockCheckEq = jest.fn().mockReturnValue({
        maybeSingle: mockCheckSingle,
      });

      const mockCheckSelect = jest.fn().mockReturnValue({
        eq: mockCheckEq,
      });

      // Mock the getProfile call that will be made
      const mockGetProfileSingle = jest.fn().mockResolvedValue({
        data: mockProfile,
        error: null,
      });

      const mockGetProfileEq = jest.fn().mockReturnValue({
        maybeSingle: mockGetProfileSingle,
      });

      const mockGetProfileSelect = jest.fn().mockReturnValue({
        eq: mockGetProfileEq,
      });

      const mockConnectionCheck = jest.fn().mockResolvedValue({
        data: [],
        error: null,
      });

      const mockSelectCount = jest.fn().mockReturnValue({
        limit: () => mockConnectionCheck,
      });

      mockSupabaseClient.from
        .mockReturnValueOnce({ select: mockCheckSelect })
        .mockReturnValueOnce({ select: mockSelectCount })
        .mockReturnValueOnce({ select: mockGetProfileSelect });

      const result = await createProfile("user-123");

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockProfile);
    });

    it("should handle user lookup errors", async () => {
      // Mock no existing profile
      const mockCheckSingle = jest.fn().mockResolvedValue({
        data: null,
        error: null,
      });

      const mockCheckEq = jest.fn().mockReturnValue({
        maybeSingle: mockCheckSingle,
      });

      const mockCheckSelect = jest.fn().mockReturnValue({
        eq: mockCheckEq,
      });

      mockSupabaseClient.from.mockReturnValue({
        select: mockCheckSelect,
      });

      // Mock service role client error
      mockSupabaseServiceRoleClient.auth.admin.getUserById.mockResolvedValue({
        data: { user: null },
        error: { message: "User not found" },
      });

      const result = await createProfile("user-123");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Could not get user data: User not found");
    });

    it("should handle profile creation errors", async () => {
      // Mock no existing profile
      const mockCheckSingle = jest.fn().mockResolvedValue({
        data: null,
        error: null,
      });

      const mockCheckEq = jest.fn().mockReturnValue({
        maybeSingle: mockCheckSingle,
      });

      const mockCheckSelect = jest.fn().mockReturnValue({
        eq: mockCheckEq,
      });

      // Mock profile creation error
      const mockCreateSingle = jest.fn().mockResolvedValue({
        data: null,
        error: { message: "Creation failed" },
      });

      const mockCreateSelect = jest.fn().mockReturnValue({
        single: mockCreateSingle,
      });

      const mockInsert = jest.fn().mockReturnValue({
        select: mockCreateSelect,
      });

      mockSupabaseClient.from
        .mockReturnValueOnce({ select: mockCheckSelect })
        .mockReturnValueOnce({ insert: mockInsert });

      mockSupabaseServiceRoleClient.auth.admin.getUserById.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });

      const result = await createProfile("user-123");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Creation failed");
    });
  });

  describe("updateProfile", () => {
    beforeEach(() => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: mockUser },
        error: null,
      });
    });

    it("should update profile successfully", async () => {
      const updateData = { full_name: "Updated Name", bio: "Updated bio" };

      const mockSingle = jest.fn().mockResolvedValue({
        data: { ...mockProfile, ...updateData },
        error: null,
      });

      const mockSelect = jest.fn().mockReturnValue({
        single: mockSingle,
      });

      const mockEq = jest.fn().mockReturnValue({
        select: mockSelect,
      });

      const mockUpdate = jest.fn().mockReturnValue({
        eq: mockEq,
      });

      mockSupabaseClient.from.mockReturnValue({
        update: mockUpdate,
      });

      const result = await updateProfile(updateData);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ ...mockProfile, ...updateData });
      expect(mockUpdate).toHaveBeenCalledWith({
        ...updateData,
        updated_at: expect.any(String),
      });
      expect(mockEq).toHaveBeenCalledWith("id", mockUser.id);
    });

    it("should handle array-wrapped data from Next.js", async () => {
      const updateData = { full_name: "Updated Name" };
      const wrappedData = [updateData];

      const mockSingle = jest.fn().mockResolvedValue({
        data: { ...mockProfile, ...updateData },
        error: null,
      });

      const mockSelect = jest.fn().mockReturnValue({
        single: mockSingle,
      });

      const mockEq = jest.fn().mockReturnValue({
        select: mockSelect,
      });

      const mockUpdate = jest.fn().mockReturnValue({
        eq: mockEq,
      });

      mockSupabaseClient.from.mockReturnValue({
        update: mockUpdate,
      });

      const result = await updateProfile(wrappedData);

      expect(result.success).toBe(true);
      expect(mockUpdate).toHaveBeenCalledWith({
        ...updateData,
        updated_at: expect.any(String),
      });
    });

    it("should handle authentication errors", async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: "Not authenticated" },
      });

      const result = await updateProfile({ full_name: "Test" });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Authentication error: Not authenticated");
    });

    it("should handle update errors", async () => {
      const mockSingle = jest.fn().mockResolvedValue({
        data: null,
        error: { message: "Update failed" },
      });

      const mockSelect = jest.fn().mockReturnValue({
        single: mockSingle,
      });

      const mockEq = jest.fn().mockReturnValue({
        select: mockSelect,
      });

      const mockUpdate = jest.fn().mockReturnValue({
        eq: mockEq,
      });

      mockSupabaseClient.from.mockReturnValue({
        update: mockUpdate,
      });

      const result = await updateProfile({ full_name: "Test" });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Update failed");
    });

    it("should handle missing user (unauthenticated)", async () => {
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const result = await updateProfile({ full_name: "Test" });

      expect(result.success).toBe(false);
      expect(result.error).toBe("User not authenticated");
    });
  });

  describe("getUserStats", () => {
    it("should return user stats successfully", async () => {
      const mockProfile = { favorite_spot: "Malibu" };
      const mockQualityData = [
        { wave_quality: 8 },
        { wave_quality: 6 },
        { wave_quality: 7 },
      ];
      const mockBeachData = [
        { beach_name: "Pipeline", visit_count: 15 }
      ];

      // Mock profile query
      const mockProfileResult = Promise.resolve({
        data: mockProfile,
        error: null,
      });
      const mockProfileChain = createMockChain(mockProfileResult);

      // Mock session count query (uses count: "exact", head: true)
      const mockSessionCountResult = Promise.resolve({
        count: 25,
        error: null,
      });
      const mockSessionCountChain = createMockChain(mockSessionCountResult);

      // Mock board count query (uses count: "exact", head: true)
      const mockBoardCountResult = Promise.resolve({
        count: 3,
        error: null,
      });
      const mockBoardCountChain = createMockChain(mockBoardCountResult);

      // Mock wave quality query (no single(), just data array)
      const mockQualityResult = Promise.resolve({
        data: mockQualityData,
        error: null,
      });
      const mockQualityChain = {
        select: jest.fn(() => ({
          eq: jest.fn(() => mockQualityResult),
        })),
      };

      // Mock RPC call for most visited beach
      mockSupabaseClient.rpc.mockResolvedValue({
        data: mockBeachData,
        error: null,
      });

      // Set up all the from() calls in sequence
      mockSupabaseClient.from
        .mockReturnValueOnce(mockProfileChain) // profiles
        .mockReturnValueOnce(mockSessionCountChain) // sessions count
        .mockReturnValueOnce(mockBoardCountChain) // boards count
        .mockReturnValueOnce(mockQualityChain); // wave quality

      const result = await getUserStats("user-123");

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        sessionCount: 25,
        boardCount: 3,
        averageRating: 7.0,
        favoriteSpot: "Malibu",
        defaultBeachId: null,
        defaultBeachName: null,
        mostVisitedBeach: "Pipeline",
        mostVisitedBeachCount: 15,
      });

      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith(
        "get_most_visited_beach",
        { user_id: "user-123" }
      );
    });

    it("should return error when no user ID provided", async () => {
      const result = await getUserStats("");

      expect(result.success).toBe(false);
      expect(result.error).toBe("No user ID provided");
    });

    it("should handle profile query errors gracefully", async () => {
      // Mock profile error but continue with other queries
      const mockProfileResult = Promise.resolve({
        data: null,
        error: { message: "Profile not found" },
      });
      const mockProfileChain = createMockChain(mockProfileResult);

      // Mock successful other queries
      const mockSessionCountResult = Promise.resolve({
        count: 10,
        error: null,
      });
      const mockSessionCountChain = createMockChain(mockSessionCountResult);

      const mockBoardCountResult = Promise.resolve({
        count: 2,
        error: null,
      });
      const mockBoardCountChain = createMockChain(mockBoardCountResult);

      const mockQualityResult = Promise.resolve({
        data: [],
        error: null,
      });
      const mockQualityChain = {
        select: jest.fn(() => ({
          eq: jest.fn(() => mockQualityResult),
        })),
      };

      mockSupabaseClient.rpc.mockResolvedValue({
        data: [],
        error: null,
      });

      mockSupabaseClient.from
        .mockReturnValueOnce(mockProfileChain)
        .mockReturnValueOnce(mockSessionCountChain)
        .mockReturnValueOnce(mockBoardCountChain)
        .mockReturnValueOnce(mockQualityChain);

      const result = await getUserStats("user-123");

      expect(result.success).toBe(true);
      expect(result.data.favoriteSpot).toBeNull();
      expect(result.data.sessionCount).toBe(10);
    });

    it("should handle session count query errors", async () => {
      const mockProfileResult = Promise.resolve({
        data: { favorite_spot: "Test Beach" },
        error: null,
      });
      const mockProfileChain = createMockChain(mockProfileResult);

      const mockSessionCountResult = Promise.resolve({
        count: null,
        error: new Error("Sessions query failed"),
      });
      const mockSessionCountChain = createMockChain(mockSessionCountResult);

      mockSupabaseClient.from
        .mockReturnValueOnce(mockProfileChain)
        .mockReturnValueOnce(mockSessionCountChain);

      const result = await getUserStats("user-123");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Sessions query failed");
    });

    it("should calculate average rating correctly with mixed data", async () => {
      const mockProfile = { favorite_spot: null };
      const mockQualityData = [
        { wave_quality: 8 },
        { wave_quality: null }, // Should be treated as 0
        { wave_quality: 6 },
        { wave_quality: 10 },
      ];

      const mockProfileResult = Promise.resolve({
        data: mockProfile,
        error: null,
      });
      const mockProfileChain = createMockChain(mockProfileResult);

      const mockSessionCountResult = Promise.resolve({
        count: 4,
        error: null,
      });
      const mockSessionCountChain = createMockChain(mockSessionCountResult);

      const mockBoardCountResult = Promise.resolve({
        count: 1,
        error: null,
      });
      const mockBoardCountChain = createMockChain(mockBoardCountResult);

      const mockQualityResult = Promise.resolve({
        data: mockQualityData,
        error: null,
      });
      const mockQualityChain = {
        select: jest.fn(() => ({
          eq: jest.fn(() => mockQualityResult),
        })),
      };

      mockSupabaseClient.rpc.mockResolvedValue({
        data: [],
        error: null,
      });

      mockSupabaseClient.from
        .mockReturnValueOnce(mockProfileChain)
        .mockReturnValueOnce(mockSessionCountChain)
        .mockReturnValueOnce(mockBoardCountChain)
        .mockReturnValueOnce(mockQualityChain);

      const result = await getUserStats("user-123");

      expect(result.success).toBe(true);
      // Average should be (8 + 0 + 6 + 10) / 4 = 6.0
      expect(result.data.averageRating).toBe(6.0);
    });

    it("should handle RPC function errors gracefully", async () => {
      const mockProfile = { favorite_spot: "Test" };

      const mockProfileResult = Promise.resolve({
        data: mockProfile,
        error: null,
      });
      const mockProfileChain = createMockChain(mockProfileResult);

      const mockSessionCountResult = Promise.resolve({
        count: 5,
        error: null,
      });
      const mockSessionCountChain = createMockChain(mockSessionCountResult);

      const mockBoardCountResult = Promise.resolve({
        count: 2,
        error: null,
      });
      const mockBoardCountChain = createMockChain(mockBoardCountResult);

      const mockQualityResult = Promise.resolve({
        data: [],
        error: null,
      });
      const mockQualityChain = {
        select: jest.fn(() => ({
          eq: jest.fn(() => mockQualityResult),
        })),
      };

      // Mock RPC error
      mockSupabaseClient.rpc.mockResolvedValue({
        data: null,
        error: { message: "RPC failed" },
      });

      mockSupabaseClient.from
        .mockReturnValueOnce(mockProfileChain)
        .mockReturnValueOnce(mockSessionCountChain)
        .mockReturnValueOnce(mockBoardCountChain)
        .mockReturnValueOnce(mockQualityChain);

      const result = await getUserStats("user-123");

      expect(result.success).toBe(true);
      expect(result.data.mostVisitedBeach).toBeNull();
      expect(result.data.mostVisitedBeachCount).toBe(0);
    });
  });
});