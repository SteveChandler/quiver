import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DiscoverPage from "@/app/discover/page";
import { useAuth } from "@/context/auth-context";

// Mock the auth context
jest.mock("@/context/auth-context", () => ({
  useAuth: jest.fn(),
}));

// Mock the FollowButton component to simulate the current behavior (without callback)
jest.mock("@/components/social/follow-button", () => ({
  FollowButton: ({ userId, initialFollowersCount }: any) => {
    const [following, setFollowing] = React.useState(false);
    const [count, setCount] = React.useState(initialFollowersCount);

    const handleFollow = () => {
      const newFollowing = !following;
      const newCount = newFollowing ? count + 1 : count - 1;

      setFollowing(newFollowing);
      setCount(newCount);

      // Note: No callback implementation yet - this represents the current bug
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

describe("DiscoverPage Follower Count Synchronization", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: mockUser });
  });

  describe("Luna follower count bug reproduction", () => {
    it("should demonstrate the current Luna follower count sync issue", async () => {
      // This test reproduces the exact scenario described by the user:
      // 1. Search for Luna shows 0 followers
      // 2. Follow Luna
      // 3. Follower count DOESN'T update on discover page (this is the bug)
      // 4. But the FollowButton's internal count does update

      const mockLunaSearchResult = [
        {
          id: "luna-user-id",
          full_name: "Luna",
          avatar_url: null,
          followers_count: 0, // Luna starts with 0 followers
        },
      ];

      (global.fetch as jest.Mock).mockResolvedValue({
        json: () =>
          Promise.resolve({
            success: true,
            data: { users: mockLunaSearchResult },
          }),
      });

      const user = userEvent.setup();
      render(<DiscoverPage />);

      // Step 1: Search for Luna
      const searchInput = screen.getByPlaceholderText(
        "Search by name or email..."
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

      // Step 4: The BUG - discover page still shows "0 followers"
      // but the button's internal count updated to 1
      expect(screen.getByText("0 followers")).toBeInTheDocument(); // Page count doesn't update
      expect(screen.getByTestId("button-count-luna-user-id")).toHaveTextContent(
        "1"
      ); // Button count does update

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

      (global.fetch as jest.Mock).mockResolvedValue({
        json: () =>
          Promise.resolve({
            success: true,
            data: { users: mockUserSearchResult },
          }),
      });

      const user = userEvent.setup();
      render(<DiscoverPage />);

      // Search for user
      const searchInput = screen.getByPlaceholderText(
        "Search by name or email..."
      );
      await user.type(searchInput, "Test User");

      const searchButton = screen.getByRole("button", { name: /search/i });
      await user.click(searchButton);

      await waitFor(() => {
        expect(screen.getByText("5 followers")).toBeInTheDocument();
      });

      const followButton = screen.getByTestId("follow-button-test-user-id");

      // Follow (button internal count: 5 -> 6, but page still shows 5)
      await user.click(followButton);
      await waitFor(() => {
        expect(screen.getByText("5 followers")).toBeInTheDocument(); // Page count doesn't update
        expect(
          screen.getByTestId("button-count-test-user-id")
        ).toHaveTextContent("6"); // Button count does
      });

      // Unfollow (button internal count: 6 -> 5, page still shows 5)
      await user.click(followButton);
      await waitFor(() => {
        expect(screen.getByText("5 followers")).toBeInTheDocument(); // Page count doesn't update
        expect(
          screen.getByTestId("button-count-test-user-id")
        ).toHaveTextContent("5"); // Button count does
      });

      // Follow again (button internal count: 5 -> 6, page still shows 5)
      await user.click(followButton);
      await waitFor(() => {
        expect(screen.getByText("5 followers")).toBeInTheDocument(); // Page count doesn't update
        expect(
          screen.getByTestId("button-count-test-user-id")
        ).toHaveTextContent("6"); // Button count does
      });
    });
  });

  describe("Search result state management", () => {
    it("should demonstrate the current bug where search results don't update", async () => {
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

      (global.fetch as jest.Mock).mockResolvedValue({
        json: () =>
          Promise.resolve({
            success: true,
            data: { users: mockSearchResults },
          }),
      });

      const user = userEvent.setup();
      render(<DiscoverPage />);

      // Perform search
      const searchInput = screen.getByPlaceholderText(
        "Search by name or email..."
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
        // BUG: Page count doesn't update, but button count does
        expect(screen.getByText("3 followers")).toBeInTheDocument(); // Page still shows original
        expect(screen.getByTestId("button-count-user-2")).toHaveTextContent(
          "4"
        ); // Button updated
        // Second user's count should remain unchanged
        expect(screen.getByText("7 followers")).toBeInTheDocument();
      });

      // Follow second user
      const followButton2 = screen.getByTestId("follow-button-user-3");
      await user.click(followButton2);

      await waitFor(() => {
        // BUG: Page counts don't update, but button counts do
        expect(screen.getByText("3 followers")).toBeInTheDocument(); // Original page count
        expect(screen.getByText("7 followers")).toBeInTheDocument(); // Original page count
        expect(screen.getByTestId("button-count-user-2")).toHaveTextContent(
          "4"
        ); // Button updated
        expect(screen.getByTestId("button-count-user-3")).toHaveTextContent(
          "8"
        ); // Button updated
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

      (global.fetch as jest.Mock).mockResolvedValue({
        json: () =>
          Promise.resolve({
            success: true,
            data: { users: mockSearchResults },
          }),
      });

      const user = userEvent.setup();
      render(<DiscoverPage />);

      const searchInput = screen.getByPlaceholderText(
        "Search by name or email..."
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
        // BUG: Page still shows 0 followers, but button count updates to 1
        expect(screen.getByText("0 followers")).toBeInTheDocument(); // Page doesn't update
        expect(screen.getByTestId("button-count-user-2")).toHaveTextContent(
          "1"
        ); // Button does update
      });
    });
  });

  describe("Search loading and error states", () => {
    it("should show loading state during search", async () => {
      // Mock delayed response
      (global.fetch as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  json: () =>
                    Promise.resolve({ success: true, data: { users: [] } }),
                }),
              100
            )
          )
      );

      const user = userEvent.setup();
      render(<DiscoverPage />);

      const searchInput = screen.getByPlaceholderText(
        "Search by name or email..."
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

      // First successful search
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            success: true,
            data: {
              users: [{ id: "user-2", full_name: "Luna", followers_count: 0 }],
            },
          }),
      });

      const user = userEvent.setup();
      render(<DiscoverPage />);

      // Successful search
      const searchInput = screen.getByPlaceholderText(
        "Search by name or email..."
      );
      await user.type(searchInput, "Luna");

      let searchButton = screen.getByRole("button", { name: /search/i });
      await user.click(searchButton);

      await waitFor(() => {
        expect(screen.getByText("Search Results (1)")).toBeInTheDocument();
      });

      // Now mock failed search
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        json: () =>
          Promise.resolve({
            success: false,
            error: "Search failed",
          }),
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
