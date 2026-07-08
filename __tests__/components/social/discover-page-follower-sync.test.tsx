import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DiscoverPage from "@/app/discover/page";
import { useAuth } from "@/context/auth-context";

// Mock the auth context
jest.mock("@/context/auth-context", () => ({
  useAuth: jest.fn(),
}));

// Mock the FollowButton component to exercise the parent count callback.
jest.mock("@/components/social/follow-button", () => ({
  FollowButton: ({
    userId,
    initialFollowersCount,
    onFollowAttempt,
    onFollowersCountChange,
  }: any) => {
    const [following, setFollowing] = React.useState(false);
    const [count, setCount] = React.useState(initialFollowersCount);

    const handleFollow = () => {
      const newFollowing = !following;
      const newCount = newFollowing ? count + 1 : count - 1;

      onFollowAttempt?.();
      setFollowing(newFollowing);
      setCount(newCount);
      onFollowersCountChange?.(newCount);
    };

    return (
      <div data-testid={`follow-button-container-${userId}`}>
        <button onClick={handleFollow} data-testid={`follow-button-${userId}`}>
          {following ? "Unfollow" : "Follow"}
        </button>
        <span data-testid={`button-count-${userId}`}>{count}</span>
      </div>
    );
  },
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

const mockUser = {
  id: "user-1",
  email: "user1@example.com",
};

// Mock fetch for user search
global.fetch = jest.fn();

type MockFetchResponse = {
  ok: boolean;
  json: () => Promise<unknown>;
};

function jsonResponse(body: unknown): Promise<MockFetchResponse> {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve(body),
  });
}

function mockDiscoverFetch(searchResponse: unknown): void {
  (global.fetch as jest.Mock).mockImplementation((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/api/events")) {
      return jsonResponse({ success: true });
    }

    if (url.includes("/api/users/suggested")) {
      return jsonResponse({
        success: true,
        data: { users: [], source: "popular_profiles" },
      });
    }

    if (url.includes("/api/users/search")) {
      return jsonResponse(searchResponse);
    }

    return jsonResponse({ success: true, data: { users: [] } });
  });
}

describe("DiscoverPage Follower Count Synchronization", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: mockUser } as any);
  });

  describe("Follower count synchronization", () => {
    it("should synchronize Luna follower count after follow", async () => {
      const mockLunaSearchResult = [
        {
          id: "luna-user-id",
          full_name: "Luna",
          avatar_url: null,
          followers_count: 0, // Luna starts with 0 followers
        },
      ];

      mockDiscoverFetch({
        success: true,
        data: { users: mockLunaSearchResult },
      });

      const user = userEvent.setup();
      render(<DiscoverPage />);

      // Step 1: Search for Luna
      const searchInput = screen.getByPlaceholderText(
        "Search by surfer name..."
      );
      await user.type(searchInput, "Luna");

      const searchButton = screen.getByRole("button", { name: /search/i });
      await user.click(searchButton);

      // Wait for search results to appear
      await waitFor(() => {
        expect(screen.getByText("Search Results (1)")).toBeInTheDocument();
        expect(screen.getByText("Luna")).toBeInTheDocument();
      });

      // Step 2: Verify initial follower count (should be 0)
      expect(screen.getByText("0 followers")).toBeInTheDocument();

      // Step 3: Follow Luna
      const followButton = screen.getByTestId("follow-button-luna-user-id");
      await user.click(followButton);

      await waitFor(() => {
        expect(screen.getByText("1 followers")).toBeInTheDocument();
        expect(
          screen.getByTestId("button-count-luna-user-id")
        ).toHaveTextContent("1");
      });

      // Verify the follow button shows "Unfollow" state
      expect(followButton).toHaveTextContent("Unfollow");
    });

    it("should maintain count accuracy across multiple follow/unfollow actions", async () => {
      const mockUserSearchResult = [
        {
          id: "test-user-id",
          full_name: "Test User",
          avatar_url: null,
          followers_count: 5, // Starts with 5 followers
        },
      ];

      mockDiscoverFetch({
        success: true,
        data: { users: mockUserSearchResult },
      });

      const user = userEvent.setup();
      render(<DiscoverPage />);

      // Search for user
      const searchInput = screen.getByPlaceholderText(
        "Search by surfer name..."
      );
      await user.type(searchInput, "Test User");

      const searchButton = screen.getByRole("button", { name: /search/i });
      await user.click(searchButton);

      await waitFor(() => {
        expect(screen.getByText("5 followers")).toBeInTheDocument();
      });

      const followButton = screen.getByTestId("follow-button-test-user-id");

      await user.click(followButton);
      await waitFor(() => {
        expect(screen.getByText("6 followers")).toBeInTheDocument();
        expect(
          screen.getByTestId("button-count-test-user-id")
        ).toHaveTextContent("6");
      });

      await user.click(followButton);
      await waitFor(() => {
        expect(screen.getByText("5 followers")).toBeInTheDocument();
        expect(
          screen.getByTestId("button-count-test-user-id")
        ).toHaveTextContent("5");
      });

      await user.click(followButton);
      await waitFor(() => {
        expect(screen.getByText("6 followers")).toBeInTheDocument();
        expect(
          screen.getByTestId("button-count-test-user-id")
        ).toHaveTextContent("6");
      });
    });
  });

  describe("Search result state management", () => {
    it("should update the matching search result when follow counts change", async () => {
      const mockSearchResults = [
        {
          id: "user-2",
          full_name: "User 2",
          followers_count: 3,
        },
        {
          id: "user-3",
          full_name: "User 3",
          followers_count: 7,
        },
      ];

      mockDiscoverFetch({
        success: true,
        data: { users: mockSearchResults },
      });

      const user = userEvent.setup();
      render(<DiscoverPage />);

      // Perform search
      const searchInput = screen.getByPlaceholderText(
        "Search by surfer name..."
      );
      await user.type(searchInput, "User");

      const searchButton = screen.getByRole("button", { name: /search/i });
      await user.click(searchButton);

      await waitFor(() => {
        expect(screen.getByText("3 followers")).toBeInTheDocument();
        expect(screen.getByText("7 followers")).toBeInTheDocument();
      });

      // Follow first user
      const followButton1 = screen.getByTestId("follow-button-user-2");
      await user.click(followButton1);

      await waitFor(() => {
        expect(screen.getByText("4 followers")).toBeInTheDocument();
        expect(screen.getByTestId("button-count-user-2")).toHaveTextContent(
          "4"
        );
        expect(screen.getByText("7 followers")).toBeInTheDocument();
      });

      // Follow second user
      const followButton2 = screen.getByTestId("follow-button-user-3");
      await user.click(followButton2);

      await waitFor(() => {
        expect(screen.getByText("4 followers")).toBeInTheDocument();
        expect(screen.getByText("8 followers")).toBeInTheDocument();
        expect(screen.getByTestId("button-count-user-2")).toHaveTextContent(
          "4"
        );
        expect(screen.getByTestId("button-count-user-3")).toHaveTextContent(
          "8"
        );
      });
    });

    it("should handle users with undefined follower counts", async () => {
      const mockSearchResults = [
        {
          id: "user-2",
          full_name: "New User",
          // No followers_count property
        },
      ];

      mockDiscoverFetch({
        success: true,
        data: { users: mockSearchResults },
      });

      const user = userEvent.setup();
      render(<DiscoverPage />);

      const searchInput = screen.getByPlaceholderText(
        "Search by surfer name..."
      );
      await user.type(searchInput, "New");

      const searchButton = screen.getByRole("button", { name: /search/i });
      await user.click(searchButton);

      await waitFor(() => {
        // Should default to 0 followers
        expect(screen.getByText("0 followers")).toBeInTheDocument();
      });

      // Follow the user
      const followButton = screen.getByTestId("follow-button-user-2");
      await user.click(followButton);

      await waitFor(() => {
        expect(screen.getByText("1 followers")).toBeInTheDocument();
        expect(screen.getByTestId("button-count-user-2")).toHaveTextContent(
          "1"
        );
      });
    });
  });

  describe("Search loading and error states", () => {
    it("should show loading state during search", async () => {
      (global.fetch as jest.Mock).mockImplementation((input: RequestInfo | URL) => {
        const url = String(input);
        if (!url.includes("/api/users/search")) {
          return jsonResponse({
            success: true,
            data: { users: [], source: "popular_profiles" },
          });
        }

        return new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                ok: true,
                json: () =>
                  Promise.resolve({ success: true, data: { users: [] } }),
              }),
            100
          )
        );
      });

      const user = userEvent.setup();
      render(<DiscoverPage />);

      const searchInput = screen.getByPlaceholderText(
        "Search by surfer name..."
      );
      await user.type(searchInput, "Luna");

      const searchButton = screen.getByRole("button", { name: /search/i });
      await user.click(searchButton);

      // Should show loading state
      expect(screen.getByText("Searching...")).toBeInTheDocument();
      expect(searchButton).toBeDisabled();

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText("Searching...")).not.toBeInTheDocument();
      });
    });

    it("should clear search results on failed search", async () => {
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      let searchCalls = 0;
      (global.fetch as jest.Mock).mockImplementation((input: RequestInfo | URL) => {
        const url = String(input);

        if (!url.includes("/api/users/search")) {
          return Promise.resolve({
            json: () =>
              Promise.resolve({ success: true, data: { users: [] } }),
          });
        }

        searchCalls += 1;
        if (searchCalls === 1) {
          return Promise.resolve({
            json: () =>
              Promise.resolve({
                success: true,
                data: {
                  users: [
                    { id: "user-2", full_name: "Luna", followers_count: 0 },
                  ],
                },
              }),
          });
        }

        return Promise.resolve({
          json: () =>
            Promise.resolve({
              success: false,
              error: "Search failed",
            }),
        });
      });

      const user = userEvent.setup();
      render(<DiscoverPage />);

      // Successful search
      const searchInput = screen.getByPlaceholderText(
        "Search by surfer name..."
      );
      await user.type(searchInput, "Luna");

      let searchButton = screen.getByRole("button", { name: /search/i });
      await user.click(searchButton);

      await waitFor(() => {
        expect(screen.getByText("Search Results (1)")).toBeInTheDocument();
      });

      // Clear and search again
      await user.clear(searchInput);
      await user.type(searchInput, "Failed");

      searchButton = screen.getByRole("button", { name: /search/i });
      await user.click(searchButton);

      await waitFor(() => {
        // Search results should be cleared
        expect(screen.queryByText("Search Results")).not.toBeInTheDocument();
      });

      consoleSpy.mockRestore();
    });
  });
});
