import { renderHook, act, waitFor } from "@testing-library/react";
import { useIntelData } from "@/hooks/use-intel-data";
import {
  getNearbyIntelPosts,
  getPublicIntelPosts,
} from "@/actions/intel-actions";
import type { IntelPostWithUser, IntelPostTag } from "@/types/database";

// Mock the intel actions
jest.mock("@/actions/intel-actions", () => ({
  getNearbyIntelPosts: jest.fn(),
  getPublicIntelPosts: jest.fn(),
  getAllIntelPosts: jest.fn(),
}));

// Mock the auth context
jest.mock("@/context/auth-context", () => ({
  useAuth: jest.fn(),
}));

const mockGetNearbyIntelPosts = getNearbyIntelPosts as jest.MockedFunction<
  typeof getNearbyIntelPosts
>;
const mockGetPublicIntelPosts = getPublicIntelPosts as jest.MockedFunction<
  typeof getPublicIntelPosts
>;

// Import mocked modules after mocking
import { useAuth } from "@/context/auth-context";

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

describe("useIntelData", () => {
  // Helper function to create mock intel posts
  const createMockIntelPost = (
    id: string,
    lat: number,
    lon: number,
    tag: IntelPostTag = "conditions"
  ): IntelPostWithUser => ({
    id,
    session_id: null,
    user_id: "user-123",
    beach_id: "beach-123",
    latitude: lat,
    longitude: lon,
    tag,
    title: `Test Intel Post ${id}`,
    description: "Test description",
    photo_url: null,
    photo_storage_path: null,
    surf_conditions: null,
    confirmations_count: 0,
    is_active: true,
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    dedupe_hash: null,
    emoji_rating: null,
    report_count: 0,
    helpful_count: 0,
    off_count: 0,
    confirmed_count: 0,
    vibe: null,
    wave_size_range: null,
    user: {
      full_name: "Test User",
      avatar_url: null,
    },
    user_has_confirmed: false,
  });

  const mockIntelPosts = [
    createMockIntelPost("post-1", 32.7157, -117.1611, "conditions"),
    createMockIntelPost("post-2", 32.7158, -117.1612, "hazard"),
    createMockIntelPost("post-3", 32.7159, -117.1613, "crowd"),
  ];

  const createMockIntelData = (lat: number, lon: number) => ({
    posts: mockIntelPosts,
    total: mockIntelPosts.length,
    filters: {
      latitude: lat,
      longitude: lon,
      radius: 5,
      tag: "all" as const,
      limit: 50,
    },
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock implementations
    mockUseAuth.mockReturnValue({
      user: null,
      session: null,
      isLoading: false,
      isAuthenticated: false,
      signUp: jest.fn(),
      signIn: jest.fn(),
      signOut: jest.fn(),
      refreshSession: jest.fn(),
    });
  });

  describe("Coordinate Mapping (Critical Bug Fix)", () => {
    it("should correctly map latitude prop to params.lat", async () => {
      const latitude = 32.7157;
      const longitude = -117.1611;

      mockGetPublicIntelPosts.mockResolvedValue({
        success: true,
        data: createMockIntelData(latitude, longitude),
      });

      renderHook(() =>
        useIntelData({
          latitude,
          longitude,
          enabled: true,
        })
      );

      await waitFor(() => {
        expect(mockGetPublicIntelPosts).toHaveBeenCalledWith(
          expect.objectContaining({
            lat: latitude,
          })
        );
      });
    });

    it("should correctly map longitude prop to params.lon", async () => {
      const latitude = 32.7157;
      const longitude = -117.1611;

      mockGetPublicIntelPosts.mockResolvedValue({
        success: true,
        data: createMockIntelData(latitude, longitude),
      });

      renderHook(() =>
        useIntelData({
          latitude,
          longitude,
          enabled: true,
        })
      );

      await waitFor(() => {
        expect(mockGetPublicIntelPosts).toHaveBeenCalledWith(
          expect.objectContaining({
            lon: longitude,
          })
        );
      });
    });

    it("should handle valid coordinate values (San Diego)", async () => {
      const latitude = 32.7157;
      const longitude = -117.1611;

      mockGetPublicIntelPosts.mockResolvedValue({
        success: true,
        data: createMockIntelData(latitude, longitude),
      });

      renderHook(() =>
        useIntelData({
          latitude,
          longitude,
          enabled: true,
        })
      );

      await waitFor(() => {
        expect(mockGetPublicIntelPosts).toHaveBeenCalledWith(
          expect.objectContaining({
            lat: latitude,
            lon: longitude,
          })
        );
      });
    });

    it("should handle negative coordinates (Sydney, Australia)", async () => {
      const latitude = -33.9249;
      const longitude = 151.2599;

      mockGetPublicIntelPosts.mockResolvedValue({
        success: true,
        data: createMockIntelData(latitude, longitude),
      });

      renderHook(() =>
        useIntelData({
          latitude,
          longitude,
          enabled: true,
        })
      );

      await waitFor(() => {
        expect(mockGetPublicIntelPosts).toHaveBeenCalledWith(
          expect.objectContaining({
            lat: latitude,
            lon: longitude,
          })
        );
      });
    });

    it("should handle coordinates at valid extremes (Hawaii)", async () => {
      const latitude = 21.3099; // Hawaii
      const longitude = -157.8581;

      mockGetPublicIntelPosts.mockResolvedValue({
        success: true,
        data: createMockIntelData(latitude, longitude),
      });

      renderHook(() =>
        useIntelData({
          latitude,
          longitude,
          enabled: true,
        })
      );

      await waitFor(() => {
        expect(mockGetPublicIntelPosts).toHaveBeenCalledWith(
          expect.objectContaining({
            lat: latitude,
            lon: longitude,
          })
        );
      });
    });

    it("should not fetch when coordinates are missing", async () => {
      renderHook(() =>
        useIntelData({
          enabled: true,
        })
      );

      // Wait a bit to ensure no calls are made
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockGetPublicIntelPosts).not.toHaveBeenCalled();
      expect(mockGetNearbyIntelPosts).not.toHaveBeenCalled();
    });

    it("should not fetch when only latitude is provided", async () => {
      renderHook(() =>
        useIntelData({
          latitude: 32.7157,
          enabled: true,
        })
      );

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockGetPublicIntelPosts).not.toHaveBeenCalled();
      expect(mockGetNearbyIntelPosts).not.toHaveBeenCalled();
    });

    it("should not fetch when only longitude is provided", async () => {
      renderHook(() =>
        useIntelData({
          longitude: -117.1611,
          enabled: true,
        })
      );

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockGetPublicIntelPosts).not.toHaveBeenCalled();
      expect(mockGetNearbyIntelPosts).not.toHaveBeenCalled();
    });
  });

  describe("Filter Parameters", () => {
    it("should apply default radius filter", async () => {
      mockGetPublicIntelPosts.mockResolvedValue({
        success: true,
        data: createMockIntelData(32.7157, -117.1611),
      });

      renderHook(() =>
        useIntelData({
          latitude: 32.7157,
          longitude: -117.1611,
          enabled: true,
        })
      );

      await waitFor(() => {
        expect(mockGetPublicIntelPosts).toHaveBeenCalledWith(
          expect.objectContaining({
            radius: 5, // Default radius
          })
        );
      });
    });

    it("should apply custom radius filter", async () => {
      mockGetPublicIntelPosts.mockResolvedValue({
        success: true,
        data: createMockIntelData(32.7157, -117.1611),
      });

      renderHook(() =>
        useIntelData({
          latitude: 32.7157,
          longitude: -117.1611,
          radius: 10,
          enabled: true,
        })
      );

      await waitFor(() => {
        expect(mockGetPublicIntelPosts).toHaveBeenCalledWith(
          expect.objectContaining({
            radius: 10,
          })
        );
      });
    });

    it("should apply tag filter when provided", async () => {
      mockGetPublicIntelPosts.mockResolvedValue({
        success: true,
        data: createMockIntelData(32.7157, -117.1611),
      });

      renderHook(() =>
        useIntelData({
          latitude: 32.7157,
          longitude: -117.1611,
          tag: "conditions",
          enabled: true,
        })
      );

      await waitFor(() => {
        expect(mockGetPublicIntelPosts).toHaveBeenCalledWith(
          expect.objectContaining({
            tag: "conditions",
          })
        );
      });
    });

    it("should apply default tag filter (all)", async () => {
      mockGetPublicIntelPosts.mockResolvedValue({
        success: true,
        data: createMockIntelData(32.7157, -117.1611),
      });

      renderHook(() =>
        useIntelData({
          latitude: 32.7157,
          longitude: -117.1611,
          enabled: true,
        })
      );

      await waitFor(() => {
        expect(mockGetPublicIntelPosts).toHaveBeenCalledWith(
          expect.objectContaining({
            tag: "all",
          })
        );
      });
    });

    it("should apply limit filter", async () => {
      mockGetPublicIntelPosts.mockResolvedValue({
        success: true,
        data: createMockIntelData(32.7157, -117.1611),
      });

      renderHook(() =>
        useIntelData({
          latitude: 32.7157,
          longitude: -117.1611,
          limit: 25,
          enabled: true,
        })
      );

      await waitFor(() => {
        expect(mockGetPublicIntelPosts).toHaveBeenCalledWith(
          expect.objectContaining({
            limit: 25,
          })
        );
      });
    });

    it("should apply default limit filter", async () => {
      mockGetPublicIntelPosts.mockResolvedValue({
        success: true,
        data: createMockIntelData(32.7157, -117.1611),
      });

      renderHook(() =>
        useIntelData({
          latitude: 32.7157,
          longitude: -117.1611,
          enabled: true,
        })
      );

      await waitFor(() => {
        expect(mockGetPublicIntelPosts).toHaveBeenCalledWith(
          expect.objectContaining({
            limit: 50, // Default limit
          })
        );
      });
    });

    it("should update filters and apply them on next refetch", async () => {
      mockGetPublicIntelPosts.mockResolvedValue({
        success: true,
        data: createMockIntelData(32.7157, -117.1611),
      });

      const { result } = renderHook(() =>
        useIntelData({
          latitude: 32.7157,
          longitude: -117.1611,
          enabled: true,
        })
      );

      await waitFor(() => {
        expect(mockGetPublicIntelPosts).toHaveBeenCalled();
      });

      // Update filters
      act(() => {
        result.current.updateFilters({
          radius: 15,
          tag: "hazard",
        });
      });

      // Manually trigger refetch after filter update
      act(() => {
        result.current.refetch();
      });

      // Verify the updated filters are used in the refetch
      await waitFor(() => {
        const lastCall =
          mockGetPublicIntelPosts.mock.calls[
            mockGetPublicIntelPosts.mock.calls.length - 1
          ];
        expect(lastCall[0]).toEqual(
          expect.objectContaining({
            radius: 15,
            tag: "hazard",
          })
        );
      });
    });
  });

  describe("Data Fetching", () => {
    it("should fetch intel posts when coordinates are valid (unauthenticated)", async () => {
      mockGetPublicIntelPosts.mockResolvedValue({
        success: true,
        data: createMockIntelData(32.7157, -117.1611),
      });

      const { result } = renderHook(() =>
        useIntelData({
          latitude: 32.7157,
          longitude: -117.1611,
          enabled: true,
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.posts.length).toBeGreaterThan(0);
        expect(result.current.hasData).toBe(true);
      });
    });

    it("should fetch intel posts when coordinates are valid (authenticated)", async () => {
      const mockUser = {
        id: "user-123",
        email: "test@example.com",
        app_metadata: {},
        user_metadata: {},
        aud: "authenticated" as const,
        created_at: new Date().toISOString(),
      };

      mockUseAuth.mockReturnValue({
        user: mockUser,
        session: null,
        isLoading: false,
        isAuthenticated: true,
        signUp: jest.fn(),
        signIn: jest.fn(),
        signOut: jest.fn(),
        refreshSession: jest.fn(),
      });

      mockGetNearbyIntelPosts.mockResolvedValue({
        success: true,
        data: createMockIntelData(32.7157, -117.1611),
      });

      const { result } = renderHook(() =>
        useIntelData({
          latitude: 32.7157,
          longitude: -117.1611,
          enabled: true,
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.posts.length).toBeGreaterThan(0);
        expect(result.current.hasData).toBe(true);
      });
    });

    it("should return empty array when no posts found", async () => {
      mockGetPublicIntelPosts.mockResolvedValue({
        success: true,
        data: {
          posts: [],
          total: 0,
          filters: {
            lat: 32.7157,
            lon: -117.1611,
            radius: 5,
            tag: "all",
            limit: 50,
          },
        },
      });

      const { result } = renderHook(() =>
        useIntelData({
          latitude: 32.7157,
          longitude: -117.1611,
          enabled: true,
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.posts).toEqual([]);
        expect(result.current.hasData).toBe(false);
      });
    });

    it("should handle loading states correctly", () => {
      mockGetPublicIntelPosts.mockImplementation(
        () =>
          new Promise(() => {
            // Never resolves - keeps loading
          })
      );

      const { result } = renderHook(() =>
        useIntelData({
          latitude: 32.7157,
          longitude: -117.1611,
          enabled: true,
        })
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.posts).toEqual([]);
      expect(result.current.hasData).toBe(false);
    });

    it("should handle error states", async () => {
      const errorMessage = "Failed to fetch intel posts";

      mockGetPublicIntelPosts.mockResolvedValue({
        success: false,
        error: errorMessage,
      });

      const { result } = renderHook(() =>
        useIntelData({
          latitude: 32.7157,
          longitude: -117.1611,
          enabled: true,
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.error).toBeTruthy();
        expect(result.current.posts).toEqual([]);
        expect(result.current.hasData).toBe(false);
      });
    });
  });

  describe("Hook Dependencies", () => {
    it("should refetch when coordinates change", async () => {
      mockGetPublicIntelPosts.mockResolvedValue({
        success: true,
        data: createMockIntelData(32.7157, -117.1611),
      });

      const { rerender } = renderHook(
        ({ latitude, longitude }) =>
          useIntelData({
            latitude,
            longitude,
            enabled: true,
          }),
        {
          initialProps: {
            latitude: 32.7157,
            longitude: -117.1611,
          },
        }
      );

      await waitFor(() => {
        expect(mockGetPublicIntelPosts).toHaveBeenCalled();
      });

      const initialCallCount = mockGetPublicIntelPosts.mock.calls.length;

      // Change coordinates
      rerender({
        latitude: 32.8,
        longitude: -117.2,
      });

      await waitFor(() => {
        expect(mockGetPublicIntelPosts.mock.calls.length).toBeGreaterThan(
          initialCallCount
        );
      });
    });

    it("should not refetch when enabled is false", async () => {
      const { rerender } = renderHook(
        ({ enabled }) =>
          useIntelData({
            latitude: 32.7157,
            longitude: -117.1611,
            enabled,
          }),
        {
          initialProps: { enabled: false },
        }
      );

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockGetPublicIntelPosts).not.toHaveBeenCalled();

      // Change coordinates while disabled
      rerender({ enabled: false });

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockGetPublicIntelPosts).not.toHaveBeenCalled();
    });
  });

  describe("Edge Cases", () => {
    it("should handle data with null posts array", async () => {
      mockGetPublicIntelPosts.mockResolvedValue({
        success: true,
        data: null as any,
      });

      const { result } = renderHook(() =>
        useIntelData({
          latitude: 32.7157,
          longitude: -117.1611,
          enabled: true,
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.posts).toEqual([]);
        expect(result.current.hasData).toBe(false);
      });
    });

    it("should handle partial filter updates", async () => {
      mockGetPublicIntelPosts.mockResolvedValue({
        success: true,
        data: createMockIntelData(32.7157, -117.1611),
      });

      const { result } = renderHook(() =>
        useIntelData({
          latitude: 32.7157,
          longitude: -117.1611,
          radius: 5,
          tag: "all",
          limit: 50,
          enabled: true,
        })
      );

      await waitFor(() => {
        expect(mockGetPublicIntelPosts).toHaveBeenCalled();
      });

      // Update only radius filter
      act(() => {
        result.current.updateFilters({ radius: 10 });
      });

      // Manually trigger refetch after filter update
      act(() => {
        result.current.refetch();
      });

      // Verify partial update preserved other filters
      await waitFor(() => {
        const lastCall =
          mockGetPublicIntelPosts.mock.calls[
            mockGetPublicIntelPosts.mock.calls.length - 1
          ];
        expect(lastCall[0]).toEqual(
          expect.objectContaining({
            radius: 10,
            tag: "all", // Should preserve existing value
            limit: 50, // Should preserve existing value
          })
        );
      });
    });

    it("should expose refetch function", async () => {
      mockGetPublicIntelPosts.mockResolvedValue({
        success: true,
        data: createMockIntelData(32.7157, -117.1611),
      });

      const { result } = renderHook(() =>
        useIntelData({
          latitude: 32.7157,
          longitude: -117.1611,
          enabled: true,
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(typeof result.current.refetch).toBe("function");

      const initialCallCount = mockGetPublicIntelPosts.mock.calls.length;

      act(() => {
        result.current.refetch();
      });

      await waitFor(() => {
        expect(mockGetPublicIntelPosts.mock.calls.length).toBeGreaterThan(
          initialCallCount
        );
      });
    });

    it("should handle rapid coordinate changes", async () => {
      mockGetPublicIntelPosts.mockResolvedValue({
        success: true,
        data: createMockIntelData(32.7157, -117.1611),
      });

      const { rerender } = renderHook(
        ({ latitude, longitude }) =>
          useIntelData({
            latitude,
            longitude,
            enabled: true,
          }),
        {
          initialProps: {
            latitude: 32.7157,
            longitude: -117.1611,
          },
        }
      );

      // Rapid changes
      rerender({ latitude: 32.7158, longitude: -117.1612 });
      rerender({ latitude: 32.7159, longitude: -117.1613 });
      rerender({ latitude: 32.7160, longitude: -117.1614 });

      await waitFor(() => {
        // Should call refetch for each change
        expect(mockGetPublicIntelPosts.mock.calls.length).toBeGreaterThan(1);
      });
    });
  });

  describe("Authentication Context", () => {
    it("should use getPublicIntelPosts when user is not authenticated", async () => {
      mockUseAuth.mockReturnValue({
        user: null,
        session: null,
        isLoading: false,
        isAuthenticated: false,
        signUp: jest.fn(),
        signIn: jest.fn(),
        signOut: jest.fn(),
        refreshSession: jest.fn(),
      });

      mockGetPublicIntelPosts.mockResolvedValue({
        success: true,
        data: createMockIntelData(32.7157, -117.1611),
      });

      renderHook(() =>
        useIntelData({
          latitude: 32.7157,
          longitude: -117.1611,
          enabled: true,
        })
      );

      await waitFor(() => {
        expect(mockGetPublicIntelPosts).toHaveBeenCalled();
        expect(mockGetNearbyIntelPosts).not.toHaveBeenCalled();
      });
    });

    it("should use getNearbyIntelPosts when user is authenticated", async () => {
      const mockUser = {
        id: "user-123",
        email: "test@example.com",
        app_metadata: {},
        user_metadata: {},
        aud: "authenticated" as const,
        created_at: new Date().toISOString(),
      };

      mockUseAuth.mockReturnValue({
        user: mockUser,
        session: null,
        isLoading: false,
        isAuthenticated: true,
        signUp: jest.fn(),
        signIn: jest.fn(),
        signOut: jest.fn(),
        refreshSession: jest.fn(),
      });

      mockGetNearbyIntelPosts.mockResolvedValue({
        success: true,
        data: createMockIntelData(32.7157, -117.1611),
      });

      renderHook(() =>
        useIntelData({
          latitude: 32.7157,
          longitude: -117.1611,
          enabled: true,
        })
      );

      await waitFor(() => {
        expect(mockGetNearbyIntelPosts).toHaveBeenCalled();
        expect(mockGetPublicIntelPosts).not.toHaveBeenCalled();
      });
    });
  });

  describe("Return Values", () => {
    it("should return all required properties", async () => {
      mockGetPublicIntelPosts.mockResolvedValue({
        success: true,
        data: createMockIntelData(32.7157, -117.1611),
      });

      const { result } = renderHook(() =>
        useIntelData({
          latitude: 32.7157,
          longitude: -117.1611,
          enabled: true,
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current).toHaveProperty("data");
      expect(result.current).toHaveProperty("posts");
      expect(result.current).toHaveProperty("loading");
      expect(result.current).toHaveProperty("error");
      expect(result.current).toHaveProperty("refetch");
      expect(result.current).toHaveProperty("updateFilters");
      expect(result.current).toHaveProperty("hasData");
    });

    it("should calculate hasData correctly when posts exist", async () => {
      mockGetPublicIntelPosts.mockResolvedValue({
        success: true,
        data: createMockIntelData(32.7157, -117.1611),
      });

      const { result } = renderHook(() =>
        useIntelData({
          latitude: 32.7157,
          longitude: -117.1611,
          enabled: true,
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.hasData).toBe(true);
      });
    });

    it("should calculate hasData correctly when no posts", async () => {
      mockGetPublicIntelPosts.mockResolvedValue({
        success: true,
        data: {
          posts: [],
          total: 0,
          filters: {
            lat: 32.7157,
            lon: -117.1611,
            radius: 5,
            tag: "all",
            limit: 50,
          },
        },
      });

      const { result } = renderHook(() =>
        useIntelData({
          latitude: 32.7157,
          longitude: -117.1611,
          enabled: true,
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
        expect(result.current.hasData).toBe(false);
      });
    });
  });
});
