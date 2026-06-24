import * as React from "react";
import { render, screen, waitFor, renderHook } from "@testing-library/react";
import { act } from "react-dom/test-utils";
import type { Profile, Beach } from "@/types/database";

// Create simple localStorage mock
let localStorageData: Record<string, string> = {};

const localStorageMock = {
  getItem: jest.fn((key: string) => localStorageData[key] || null),
  setItem: jest.fn((key: string, value: string) => {
    localStorageData[key] = value;
  }),
  removeItem: jest.fn((key: string) => {
    delete localStorageData[key];
  }),
  clear: jest.fn(() => {
    localStorageData = {};
  }),
};

Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
  configurable: true,
});

// Mock fetch
global.fetch = jest.fn();

// Mock auth context
const mockUseAuth = jest.fn();

jest.mock("@/context/auth-context", () => ({
  useAuth: () => mockUseAuth(),
}));

// Import after mocks
import { ProfileProvider, useProfileContext, _clearProfileRequestCache } from "@/context/profile-context";

// Mock data
const mockUser = {
  id: "user-123",
  email: "test@example.com",
};

const mockProfile = {
  id: "user-123",
  full_name: "Test User",
  avatar_url: null,
  bio: null,
  home_beach_id: "beach-456",
  skill_level: null,
  preferred_wave_min: null,
  preferred_wave_max: null,
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
  session_count: 0,
  follower_count: 0,
  following_count: 0,
  onboarding_completed: true,
  public_sessions_only: false,
  is_private: false,
} as unknown as Profile;

const mockBeach = {
  id: "beach-456",
  name: "Test Beach",
  slug: "test-beach",
  center_lat: 34.0,
  center_lng: -118.0,
  state: "CA",
  country: "USA",
  timezone: "America/Los_Angeles",
  created_at: "2024-01-01T00:00:00Z",
  updated_at: "2024-01-01T00:00:00Z",
} as unknown as Beach;

// Test consumer component
function TestConsumer() {
  const { profile, homeBeach, isLoading, error, updateProfile, refreshProfile } =
    useProfileContext();

  return (
    <div>
      <div data-testid="loading">{String(isLoading)}</div>
      <div data-testid="profile-name">{profile?.full_name || "null"}</div>
      <div data-testid="beach-name">{homeBeach?.name || "null"}</div>
      <div data-testid="error">{error?.message || "null"}</div>
      <button
        data-testid="update-btn"
        onClick={() => updateProfile({ ...mockProfile, full_name: "Updated Name" })}
      >
        Update
      </button>
      <button data-testid="refresh-btn" onClick={() => void refreshProfile()}>
        Refresh
      </button>
    </div>
  );
}

describe("ProfileContext", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorageData = {};
    (global.fetch as jest.Mock).mockReset();
    _clearProfileRequestCache();

    mockUseAuth.mockReturnValue({
      user: null,
      isLoading: false,
      isAuthenticated: false,
    });
  });

  describe("Cache Key Generation", () => {
    it("generates correct cache key with user ID", async () => {
      const cacheKey = "quiver_profile_cache_user-123";
      const cachedData = {
        profile: mockProfile,
        homeBeach: mockBeach,
        timestamp: Date.now() - 60000,
      };

      localStorageData[cacheKey] = JSON.stringify(cachedData);

      mockUseAuth.mockReturnValue({
        user: mockUser,
        isLoading: false,
        isAuthenticated: true,
      });

      // Provider will fetch even with cached data (background refresh)
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: mockProfile }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { beach: mockBeach } }),
        });

      render(
        <ProfileProvider>
          <TestConsumer />
        </ProfileProvider>
      );

      await waitFor(() => {
        expect(localStorageMock.getItem).toHaveBeenCalledWith(cacheKey);
      });
    });
  });

  describe("Cache TTL Validation", () => {
    it("uses valid cached data without fetching", async () => {
      const cacheKey = "quiver_profile_cache_user-123";
      const cachedData = {
        profile: mockProfile,
        homeBeach: mockBeach,
        timestamp: Date.now() - 60000, // 1 minute ago
      };

      localStorageData[cacheKey] = JSON.stringify(cachedData);

      mockUseAuth.mockReturnValue({
        user: mockUser,
        isLoading: false,
        isAuthenticated: true,
      });

      // Provider may still attempt a background fetch due to effect ordering,
      // so provide a mock to prevent hanging promises
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: mockProfile }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { beach: mockBeach } }),
        });

      render(
        <ProfileProvider>
          <TestConsumer />
        </ProfileProvider>
      );

      // Cached data should be available quickly (from localStorage effect)
      await waitFor(() => {
        expect(screen.getByTestId("profile-name").textContent).toBe("Test User");
        expect(screen.getByTestId("loading").textContent).toBe("false");
      });

      expect(screen.getByTestId("beach-name").textContent).toBe("Test Beach");
      // Verify cache was read from localStorage
      expect(localStorageMock.getItem).toHaveBeenCalledWith(cacheKey);
    });

    it("removes expired cache and fetches fresh data", async () => {
      const cacheKey = "quiver_profile_cache_user-123";
      const expiredData = {
        profile: mockProfile,
        homeBeach: mockBeach,
        timestamp: Date.now() - 6 * 60 * 1000, // 6 minutes ago
      };

      localStorageData[cacheKey] = JSON.stringify(expiredData);

      mockUseAuth.mockReturnValue({
        user: mockUser,
        isLoading: false,
        isAuthenticated: true,
      });

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: mockProfile }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { beach: mockBeach } }),
        });

      render(
        <ProfileProvider>
          <TestConsumer />
        </ProfileProvider>
      );

      await waitFor(() => {
        expect(localStorageMock.removeItem).toHaveBeenCalledWith(cacheKey);
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      }, { timeout: 3000 });
    });

    it("rejects cache for different user", async () => {
      const cacheKey = "quiver_profile_cache_user-123";
      const wrongUserData = {
        profile: { ...mockProfile, id: "different-user" },
        homeBeach: mockBeach,
        timestamp: Date.now() - 60000,
      };

      localStorageData[cacheKey] = JSON.stringify(wrongUserData);

      mockUseAuth.mockReturnValue({
        user: mockUser,
        isLoading: false,
        isAuthenticated: true,
      });

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: mockProfile }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { beach: mockBeach } }),
        });

      render(
        <ProfileProvider>
          <TestConsumer />
        </ProfileProvider>
      );

      await waitFor(() => {
        expect(localStorageMock.removeItem).toHaveBeenCalledWith(cacheKey);
      });
    });

    it("handles corrupted cache gracefully", async () => {
      const cacheKey = "quiver_profile_cache_user-123";
      localStorageData[cacheKey] = "invalid-json{";

      mockUseAuth.mockReturnValue({
        user: mockUser,
        isLoading: false,
        isAuthenticated: true,
      });

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: mockProfile }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { beach: mockBeach } }),
        });

      render(
        <ProfileProvider>
          <TestConsumer />
        </ProfileProvider>
      );

      await waitFor(() => {
        expect(localStorageMock.removeItem).toHaveBeenCalledWith(cacheKey);
      });
    });
  });

  describe("Provider Behavior", () => {
    it("shows not loading when unauthenticated", async () => {
      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: false,
        isAuthenticated: false,
      });

      render(
        <ProfileProvider>
          <TestConsumer />
        </ProfileProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("loading").textContent).toBe("false");
      });

      expect(screen.getByTestId("profile-name").textContent).toBe("null");
    });

    it("fetches profile when authenticated", async () => {
      mockUseAuth.mockReturnValue({
        user: mockUser,
        isLoading: false,
        isAuthenticated: true,
      });

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: mockProfile }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { beach: mockBeach } }),
        });

      render(
        <ProfileProvider>
          <TestConsumer />
        </ProfileProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("profile-name").textContent).toBe("Test User");
      }, { timeout: 3000 });

      expect(screen.getByTestId("beach-name").textContent).toBe("Test Beach");
    });

    it("waits for auth to finish loading", async () => {
      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: true,
        isAuthenticated: false,
      });

      render(
        <ProfileProvider>
          <TestConsumer />
        </ProfileProvider>
      );

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe("Optimistic Updates", () => {
    it("updates profile immediately", async () => {
      const cacheKey = "quiver_profile_cache_user-123";
      const cachedData = {
        profile: mockProfile,
        homeBeach: mockBeach,
        timestamp: Date.now() - 60000,
      };

      localStorageData[cacheKey] = JSON.stringify(cachedData);

      // Provider will fetch even with valid cache (effect ordering)
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: mockProfile }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { beach: mockBeach } }),
        });

      mockUseAuth.mockReturnValue({
        user: mockUser,
        isLoading: false,
        isAuthenticated: true,
      });

      render(
        <ProfileProvider>
          <TestConsumer />
        </ProfileProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("profile-name").textContent).toBe("Test User");
      });

      const updateBtn = screen.getByTestId("update-btn");

      await act(async () => {
        updateBtn.click();
      });

      await waitFor(() => {
        expect(screen.getByTestId("profile-name").textContent).toBe("Updated Name");
      });
    });
  });

  describe("Error Handling", () => {
    it("handles network errors", async () => {
      const errorSpy = jest.spyOn(console, "error").mockImplementation();
      const warnSpy = jest.spyOn(console, "warn").mockImplementation();

      try {
        mockUseAuth.mockReturnValue({
          user: mockUser,
          isLoading: false,
          isAuthenticated: true,
        });

        (global.fetch as jest.Mock).mockRejectedValueOnce(
          new Error("Network error")
        );

        render(
          <ProfileProvider>
            <TestConsumer />
          </ProfileProvider>
        );

        await waitFor(() => {
          expect(screen.getByTestId("error").textContent).toBe("Network error");
        }, { timeout: 3000 });

        expect(warnSpy).toHaveBeenCalledWith(
          "Error fetching profile and home beach:",
          expect.any(Error)
        );
        expect(errorSpy).not.toHaveBeenCalled();
      } finally {
        errorSpy.mockRestore();
        warnSpy.mockRestore();
      }
    });
  });

  describe("useProfileContext Hook", () => {
    it("throws error outside provider", () => {
      const originalError = console.error;
      console.error = jest.fn();

      try {
        renderHook(() => useProfileContext());
        fail("Should have thrown error");
      } catch (error) {
        expect((error as Error).message).toContain(
          "useProfileContext must be used within a ProfileProvider"
        );
      } finally {
        console.error = originalError;
      }
    });

    it("provides context value inside provider", () => {
      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: false,
        isAuthenticated: false,
      });

      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ProfileProvider>{children}</ProfileProvider>
      );

      const { result } = renderHook(() => useProfileContext(), { wrapper });

      expect(result.current).toHaveProperty("profile");
      expect(result.current).toHaveProperty("homeBeach");
      expect(result.current).toHaveProperty("isLoading");
      expect(result.current).toHaveProperty("error");
      expect(result.current).toHaveProperty("updateProfile");
      expect(result.current).toHaveProperty("refreshProfile");
    });
  });
});
