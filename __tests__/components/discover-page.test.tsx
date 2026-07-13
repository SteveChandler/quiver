import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DiscoverPage from "@/app/discover/page";
import { useAuth } from "@/context/auth-context";
import { FollowButton } from "@/components/social/follow-button";

// Mock dependencies
jest.mock("@/context/auth-context");
jest.mock("@/components/social/follow-button");
jest.mock("@/components/social/user-profile-modal", () => ({
  UserProfileModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div role="dialog">Surfer Profile</div> : null,
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const MockFollowButton = FollowButton as jest.MockedFunction<
  typeof FollowButton
>;

const mockUser = {
  id: "user-1",
  email: "user1@example.com",
} as any;

// Mock fetch for user search
global.fetch = jest.fn();

type MockFetchOptions = {
  searchResponse?: unknown;
  suggestedResponse?: unknown;
  searchError?: Error;
  searchDelayMs?: number;
};
type MockFetchResponse = {
  ok: boolean;
  json: () => Promise<unknown>;
};

const emptyUsersResponse = {
  success: true,
  data: { users: [], source: "popular_profiles" },
};

function makeJsonResponse(body: unknown): MockFetchResponse {
  return {
    ok: true,
    json: () => Promise.resolve(body),
  };
}

function jsonResponse(body: unknown): Promise<MockFetchResponse> {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve(body),
  });
}

function mockDiscoverFetch({
  searchResponse = { success: true, data: { users: [] } },
  suggestedResponse = emptyUsersResponse,
  searchError,
  searchDelayMs = 0,
}: MockFetchOptions = {}): void {
  (global.fetch as jest.Mock).mockImplementation((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/api/events")) {
      return jsonResponse({ success: true });
    }

    if (url.includes("/api/users/suggested")) {
      return jsonResponse(suggestedResponse);
    }

    if (url.includes("/api/users/search")) {
      if (searchError) return Promise.reject(searchError);
      if (searchDelayMs > 0) {
        return new Promise((resolve) =>
          setTimeout(
            () => resolve(makeJsonResponse(searchResponse)),
            searchDelayMs
          )
        );
      }

      return jsonResponse(searchResponse);
    }

    return jsonResponse({ success: true, data: { users: [] } });
  });
}

async function renderDiscoverWithEmptySuggestions(): Promise<void> {
  render(<DiscoverPage />);
  await screen.findByText("No suggested users right now");
}

describe("DiscoverPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: mockUser } as any);
    MockFollowButton.mockImplementation(
      ({
        userId,
        initialFollowersCount,
        onFollowAttempt,
        onFollowersCountChange,
      }) => (
        <button
          data-testid={`follow-button-${userId}`}
          onClick={() => {
            onFollowAttempt?.();
            onFollowersCountChange?.((initialFollowersCount ?? 0) + 1);
          }}
        >
          Follow (Initial: {initialFollowersCount})
        </button>
      ),
    );
    mockDiscoverFetch();
  });

  describe("Authentication", () => {
    it("should show sign-in message for unauthenticated users", () => {
      mockUseAuth.mockReturnValue({ user: null } as any);

      render(<DiscoverPage />);

      expect(screen.getByText("Discover Surfers")).toBeInTheDocument();
      expect(
        screen.getByText(
          /Sign in to discover and follow other surfers in your community/i
        )
      ).toBeInTheDocument();
    });

    it("should show full interface for authenticated users", async () => {
      await renderDiscoverWithEmptySuggestions();

      expect(screen.getByText("Discover Surfers")).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText("Search by surfer name...")
      ).toBeInTheDocument();
      expect(screen.getByText("Suggested Surfers")).toBeInTheDocument();
    });
  });

  describe("User search functionality", () => {
    it("should handle empty search query", async () => {
      const user = userEvent.setup();
      await renderDiscoverWithEmptySuggestions();

      const searchButton = screen.getByRole("button", { name: /search/i });
      await user.click(searchButton);

      expect(global.fetch).not.toHaveBeenCalledWith(
        expect.stringContaining("/api/users/search")
      );
    });

    it("should handle short search query", async () => {
      const user = userEvent.setup();
      await renderDiscoverWithEmptySuggestions();

      const searchInput = screen.getByPlaceholderText(
        "Search by surfer name..."
      );
      await user.type(searchInput, "a"); // Less than 2 characters

      const searchButton = screen.getByRole("button", { name: /search/i });
      await user.click(searchButton);

      expect(global.fetch).not.toHaveBeenCalledWith(
        expect.stringContaining("/api/users/search")
      );
    });

    it("should perform search with valid query", async () => {
      const user = userEvent.setup();
      const mockSearchResults = [
        {
          id: "user-2",
          full_name: "Luna Surfer",
          avatar_url: null,
          followers_count: 5,
        },
      ];

      mockDiscoverFetch({
        searchResponse: {
          success: true,
          data: { users: mockSearchResults },
        },
      });

      await renderDiscoverWithEmptySuggestions();

      const searchInput = screen.getByPlaceholderText(
        "Search by surfer name..."
      );
      await user.type(searchInput, "Luna");

      const searchButton = screen.getByRole("button", { name: /search/i });
      await user.click(searchButton);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          `/api/users/search?q=${encodeURIComponent("Luna")}&limit=20`
        );
      });
    });

    it("should display search results with follower counts", async () => {
      const user = userEvent.setup();
      const mockSearchResults = [
        {
          id: "user-2",
          full_name: "Luna Surfer",
          avatar_url: null,
          followers_count: 5,
        },
        {
          id: "user-3",
          full_name: "Wave Rider",
          avatar_url: null,
          followers_count: 12,
        },
      ];

      mockDiscoverFetch({
        searchResponse: {
          success: true,
          data: { users: mockSearchResults },
        },
      });

      await renderDiscoverWithEmptySuggestions();

      const searchInput = screen.getByPlaceholderText(
        "Search by surfer name..."
      );
      await user.type(searchInput, "Luna");

      const searchButton = screen.getByRole("button", { name: /search/i });
      await user.click(searchButton);

      await waitFor(() => {
        expect(screen.getByText("Search Results (2)")).toBeInTheDocument();
        expect(screen.getByText("Luna Surfer")).toBeInTheDocument();
        expect(screen.getByText("5 followers")).toBeInTheDocument();
        expect(screen.getByText("Wave Rider")).toBeInTheDocument();
        expect(screen.getByText("12 followers")).toBeInTheDocument();
      });
    });

    it("should handle search API errors", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      const user = userEvent.setup();

      mockDiscoverFetch({
        searchResponse: {
          success: false,
          error: "Search failed",
        },
      });

      await renderDiscoverWithEmptySuggestions();

      const searchInput = screen.getByPlaceholderText(
        "Search by surfer name..."
      );
      await user.type(searchInput, "Luna");

      const searchButton = screen.getByRole("button", { name: /search/i });
      await user.click(searchButton);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          "Search error:",
          "Search failed"
        );
      });

      consoleSpy.mockRestore();
    });

    it("should handle network errors during search", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      const user = userEvent.setup();

      mockDiscoverFetch({ searchError: new Error("Network error") });

      await renderDiscoverWithEmptySuggestions();

      const searchInput = screen.getByPlaceholderText(
        "Search by surfer name..."
      );
      await user.type(searchInput, "Luna");

      const searchButton = screen.getByRole("button", { name: /search/i });
      await user.click(searchButton);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          "Search failed:",
          expect.any(Error)
        );
      });

      consoleSpy.mockRestore();
    });
  });

  describe("Search results display", () => {
    it("should render search results with proper FollowButton props", async () => {
      const user = userEvent.setup();
      const mockSearchResults = [
        {
          id: "user-2",
          full_name: "Luna Surfer",
          avatar_url: null,
          followers_count: 5,
        },
      ];

      mockDiscoverFetch({
        searchResponse: {
          success: true,
          data: { users: mockSearchResults },
        },
      });

      await renderDiscoverWithEmptySuggestions();

      const searchInput = screen.getByPlaceholderText(
        "Search by surfer name..."
      );
      await user.type(searchInput, "Luna");

      const searchButton = screen.getByRole("button", { name: /search/i });
      await user.click(searchButton);

      await waitFor(() => {
        // Verify the mock was called with expected props
        expect(MockFollowButton).toHaveBeenCalled();
        const callArgs = MockFollowButton.mock.calls[0][0];
        expect(callArgs).toMatchObject({
          userId: "user-2",
          initialFollowersCount: 5,
          variant: "default",
          size: "sm",
        });
      });
    });

    it("should handle users with no followers count", async () => {
      const user = userEvent.setup();
      const mockSearchResults = [
        {
          id: "user-2",
          full_name: "New User",
          avatar_url: null,
          // No followers_count property
        },
      ];

      mockDiscoverFetch({
        searchResponse: {
          success: true,
          data: { users: mockSearchResults },
        },
      });

      await renderDiscoverWithEmptySuggestions();

      const searchInput = screen.getByPlaceholderText(
        "Search by surfer name..."
      );
      await user.type(searchInput, "New");

      const searchButton = screen.getByRole("button", { name: /search/i });
      await user.click(searchButton);

      await waitFor(() => {
        expect(screen.getByText("0 followers")).toBeInTheDocument();
        // Verify the mock was called with expected props
        expect(MockFollowButton).toHaveBeenCalled();
        const callArgs = MockFollowButton.mock.calls[0][0];
        expect(callArgs).toMatchObject({
          initialFollowersCount: 0,
        });
      });
    });

    it("should open user profile modal when View Profile is clicked", async () => {
      const user = userEvent.setup();
      const mockSearchResults = [
        {
          id: "user-2",
          full_name: "Luna Surfer",
          avatar_url: null,
          followers_count: 5,
        },
      ];

      mockDiscoverFetch({
        searchResponse: {
          success: true,
          data: { users: mockSearchResults },
        },
      });

      await renderDiscoverWithEmptySuggestions();

      const searchInput = screen.getByPlaceholderText(
        "Search by surfer name..."
      );
      await user.type(searchInput, "Luna");

      const searchButton = screen.getByRole("button", { name: /search/i });
      await user.click(searchButton);

      const viewProfileButton = await screen.findByRole("button", {
        name: /view profile/i,
      });
      await user.click(viewProfileButton);

      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText("Surfer Profile")).toBeInTheDocument();
    });
  });

  describe("Suggested users section", () => {
    it("should show empty state when no suggested users", async () => {
      await renderDiscoverWithEmptySuggestions();

      expect(
        await screen.findByText("No suggested users right now")
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          /Search by surfer name or invite the people you paddle with/
        )
      ).toBeInTheDocument();
    });

    it("loads suggested users and tracks their impression", async () => {
      mockDiscoverFetch({
        suggestedResponse: {
          success: true,
          data: {
            source: "popular_profiles",
            users: [
              {
                id: "suggested-1",
                full_name: "Suggested Surfer",
                followers_count: 9,
                avatar_url: null,
              },
            ],
          },
        },
      });

      render(<DiscoverPage />);

      expect(await screen.findByText("Suggested Surfer")).toBeInTheDocument();
      expect(screen.getByText("9 followers")).toBeInTheDocument();
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/users/suggested?limit=8",
        { cache: "no-store" },
      );
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/events",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            eventType: "discover_suggested_users_impression",
            metadata: { count: 1, source: "popular_profiles" },
          }),
        }),
      );
    });
  });

  describe("Loading states", () => {
    it("should show search loading state", async () => {
      const user = userEvent.setup();

      mockDiscoverFetch({
        searchResponse: { success: true, data: { users: [] } },
        searchDelayMs: 100,
      });

      await renderDiscoverWithEmptySuggestions();

      const searchInput = screen.getByPlaceholderText(
        "Search by surfer name..."
      );
      await user.type(searchInput, "Luna");

      const searchButton = screen.getByRole("button", { name: /search/i });
      await user.click(searchButton);

      // Should show loading state - wait for the state update
      await waitFor(() => {
        expect(screen.getByText("Searching...")).toBeInTheDocument();
      });
      expect(screen.getByRole("button", { name: /searching/i })).toBeDisabled();
    });
  });

  describe("Input validation", () => {
    it("should disable search button for empty input", async () => {
      await renderDiscoverWithEmptySuggestions();

      const searchButton = screen.getByRole("button", { name: /search/i });
      expect(searchButton).toBeDisabled();
    });

    it("should enable search button for valid input", async () => {
      const user = userEvent.setup();
      await renderDiscoverWithEmptySuggestions();

      const searchInput = screen.getByPlaceholderText(
        "Search by surfer name..."
      );
      await user.type(searchInput, "Luna");

      const searchButton = screen.getByRole("button", { name: /search/i });
      expect(searchButton).not.toBeDisabled();
    });

    it("should update search input value correctly", async () => {
      const user = userEvent.setup();
      await renderDiscoverWithEmptySuggestions();

      const searchInput = screen.getByPlaceholderText(
        "Search by surfer name..."
      ) as HTMLInputElement;
      await user.type(searchInput, "Luna Surfer");

      expect(searchInput.value).toBe("Luna Surfer");
    });
  });

  describe("How Following Works section", () => {
    it("should display information about following features", async () => {
      await renderDiscoverWithEmptySuggestions();

      expect(screen.getByText("How Following Works")).toBeInTheDocument();
      expect(
        screen.getByText(/Follow other surfers to see their session activities/)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Invite followers to join your planned surf sessions/)
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          /Get notifications when people you follow plan epic sessions/
        )
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          /Build your local surf community and coordinate better sessions/
        )
      ).toBeInTheDocument();
    });
  });
});
