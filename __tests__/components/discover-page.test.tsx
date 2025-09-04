import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DiscoverPage from "@/app/discover/page";
import { UserProfileModal } from "@/components/social/user-profile-modal";
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
};

// Mock fetch for user search
global.fetch = jest.fn();

describe("DiscoverPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: mockUser });
    MockFollowButton.mockImplementation(({ userId, initialFollowersCount }) => (
      <button data-testid={`follow-button-${userId}`}>
        Follow (Initial: {initialFollowersCount})
      </button>
    ));
    (global.fetch as jest.Mock).mockResolvedValue({
      json: () => Promise.resolve({ success: true, data: { users: [] } }),
    });
  });

  describe("Authentication", () => {
    it("should show sign-in message for unauthenticated users", () => {
      mockUseAuth.mockReturnValue({ user: null });

      render(<DiscoverPage />);

      expect(screen.getByText("Discover Surfers")).toBeInTheDocument();
      expect(
        screen.getByText(
          "Sign in to discover and follow other surfers in your community."
        )
      ).toBeInTheDocument();
    });

    it("should show full interface for authenticated users", () => {
      render(<DiscoverPage />);

      expect(screen.getByText("Discover Surfers")).toBeInTheDocument();
      expect(
        screen.getByPlaceholderText("Search by name or email...")
      ).toBeInTheDocument();
      expect(screen.getByText("Suggested Surfers")).toBeInTheDocument();
    });
  });

  describe("User search functionality", () => {
    it("should handle empty search query", async () => {
      const user = userEvent.setup();
      render(<DiscoverPage />);

      const searchButton = screen.getByRole("button", { name: /search/i });
      await user.click(searchButton);

      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("should handle short search query", async () => {
      const user = userEvent.setup();
      render(<DiscoverPage />);

      const searchInput = screen.getByPlaceholderText(
        "Search by name or email..."
      );
      await user.type(searchInput, "a"); // Less than 2 characters

      const searchButton = screen.getByRole("button", { name: /search/i });
      await user.click(searchButton);

      expect(global.fetch).not.toHaveBeenCalled();
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

      (global.fetch as jest.Mock).mockResolvedValue({
        json: () =>
          Promise.resolve({
            success: true,
            data: { users: mockSearchResults },
          }),
      });

      render(<DiscoverPage />);

      const searchInput = screen.getByPlaceholderText(
        "Search by name or email..."
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

      (global.fetch as jest.Mock).mockResolvedValue({
        json: () =>
          Promise.resolve({
            success: true,
            data: { users: mockSearchResults },
          }),
      });

      render(<DiscoverPage />);

      const searchInput = screen.getByPlaceholderText(
        "Search by name or email..."
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

      (global.fetch as jest.Mock).mockResolvedValue({
        json: () =>
          Promise.resolve({
            success: false,
            error: "Search failed",
          }),
      });

      render(<DiscoverPage />);

      const searchInput = screen.getByPlaceholderText(
        "Search by name or email..."
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

      (global.fetch as jest.Mock).mockRejectedValue(new Error("Network error"));

      render(<DiscoverPage />);

      const searchInput = screen.getByPlaceholderText(
        "Search by name or email..."
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

      (global.fetch as jest.Mock).mockResolvedValue({
        json: () =>
          Promise.resolve({
            success: true,
            data: { users: mockSearchResults },
          }),
      });

      render(<DiscoverPage />);

      const searchInput = screen.getByPlaceholderText(
        "Search by name or email..."
      );
      await user.type(searchInput, "Luna");

      const searchButton = screen.getByRole("button", { name: /search/i });
      await user.click(searchButton);

      await waitFor(() => {
        expect(MockFollowButton).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: "user-2",
            initialFollowersCount: 5,
            variant: "default",
            size: "sm",
          }),
          expect.any(Object)
        );
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

      (global.fetch as jest.Mock).mockResolvedValue({
        json: () =>
          Promise.resolve({
            success: true,
            data: { users: mockSearchResults },
          }),
      });

      render(<DiscoverPage />);

      const searchInput = screen.getByPlaceholderText(
        "Search by name or email..."
      );
      await user.type(searchInput, "New");

      const searchButton = screen.getByRole("button", { name: /search/i });
      await user.click(searchButton);

      await waitFor(() => {
        expect(screen.getByText("0 followers")).toBeInTheDocument();
        expect(MockFollowButton).toHaveBeenCalledWith(
          expect.objectContaining({
            initialFollowersCount: 0,
          }),
          expect.any(Object)
        );
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

      (global.fetch as jest.Mock).mockResolvedValue({
        json: () =>
          Promise.resolve({
            success: true,
            data: { users: mockSearchResults },
          }),
      });

      render(<DiscoverPage />);

      const searchInput = screen.getByPlaceholderText(
        "Search by name or email..."
      );
      await user.type(searchInput, "Luna");

      const searchButton = screen.getByRole("button", { name: /search/i });
      await user.click(searchButton);

      await waitFor(async () => {
        const viewProfileButton = screen.getByRole("button", {
          name: /view profile/i,
        });
        await user.click(viewProfileButton);
        expect(screen.getByRole("dialog")).toBeInTheDocument();
        expect(screen.getByText("Surfer Profile")).toBeInTheDocument();
      });
    });
  });

  describe("Suggested users section", () => {
    it("should show empty state when no suggested users", () => {
      render(<DiscoverPage />);

      expect(
        screen.getByText("No suggested users right now")
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          /As more people join Quiver.*you'll see suggested surfers/s
        )
      ).toBeInTheDocument();
    });
  });

  describe("Loading states", () => {
    it("should show search loading state", async () => {
      const user = userEvent.setup();

      // Mock a delayed response
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
    });
  });

  describe("Input validation", () => {
    it("should disable search button for empty input", () => {
      render(<DiscoverPage />);

      const searchButton = screen.getByRole("button", { name: /search/i });
      expect(searchButton).toBeDisabled();
    });

    it("should enable search button for valid input", async () => {
      const user = userEvent.setup();
      render(<DiscoverPage />);

      const searchInput = screen.getByPlaceholderText(
        "Search by name or email..."
      );
      await user.type(searchInput, "Luna");

      const searchButton = screen.getByRole("button", { name: /search/i });
      expect(searchButton).not.toBeDisabled();
    });

    it("should update search input value correctly", async () => {
      const user = userEvent.setup();
      render(<DiscoverPage />);

      const searchInput = screen.getByPlaceholderText(
        "Search by name or email..."
      ) as HTMLInputElement;
      await user.type(searchInput, "Luna Surfer");

      expect(searchInput.value).toBe("Luna Surfer");
    });
  });

  describe("How Following Works section", () => {
    it("should display information about following features", () => {
      render(<DiscoverPage />);

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
