import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BeachIntelSection } from "@/components/intel/beach-intel-section";
import { useIntelData } from "@/hooks/use-intel-data";
import { useAuth } from "@/context/auth-context";
import {
  confirmIntelPost,
  removeIntelPostConfirmation,
} from "@/actions/intel-actions";
import { toast } from "sonner";

// Mock dependencies
jest.mock("@/hooks/use-intel-data");
jest.mock("@/context/auth-context");
jest.mock("@/actions/intel-actions");
jest.mock("sonner");
jest.mock("@/components/intel/intel-post-form", () => ({
  IntelPostForm: ({ isOpen, onClose, onSuccess }: any) =>
    isOpen ? (
      <div data-testid="intel-post-form">
        <button onClick={() => onSuccess()}>Create Intel</button>
        <button onClick={onClose}>Close</button>
      </div>
    ) : null,
}));
// Render a simple button to validate we pass userId into the clickable avatar
jest.mock("@/components/social/user-avatar-button", () => ({
  UserAvatarButton: ({ userId, name }: any) => (
    <button data-testid="user-avatar-button" data-user-id={userId}>
      {name}
    </button>
  ),
}));
jest.mock("@/components/user-avatar", () => ({
  UserAvatar: ({ name }: any) => <div data-testid="user-avatar">{name}</div>,
}));

const mockUseIntelData = useIntelData as jest.MockedFunction<
  typeof useIntelData
>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockConfirmIntelPost = confirmIntelPost as jest.MockedFunction<
  typeof confirmIntelPost
>;
const mockRemoveIntelPostConfirmation =
  removeIntelPostConfirmation as jest.MockedFunction<
    typeof removeIntelPostConfirmation
  >;
const mockToast = toast as jest.Mocked<typeof toast>;

const mockUser = {
  id: "user123",
  email: "test@example.com",
};

const mockIntelPost = {
  id: "post123",
  user_id: "user456",
  lat: 32.7157,
  lon: -117.1611,
  tag: "conditions" as const,
  title: "Great waves today!",
  description: "Perfect conditions with clean 4-6ft waves and offshore winds",
  confirmations_count: 3,
  user_has_confirmed: false,
  created_at: "2024-01-15T10:00:00Z",
  is_active: true,
  updated_at: "2024-01-15T10:00:00Z",
  user: {
    id: "user456",
    full_name: "surfer123",
    avatar_url: null,
  },
  user_confirmed: false,
};

const defaultProps = {
  beachId: "beach123",
  beachName: "La Jolla Shores",
  lat: 32.7157,
  lon: -117.1611,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUseAuth.mockReturnValue({ user: mockUser, loading: false });
  mockToast.success = jest.fn();
  mockToast.error = jest.fn();
});

describe("BeachIntelSection", () => {
  describe("Loading States", () => {
    it("shows loading skeleton when loading with no posts", () => {
      mockUseIntelData.mockReturnValue({
        data: { posts: [], total: 0, filters: {} },
        loading: true,
        error: null,
        refetch: jest.fn(),
        posts: [],
        updateFilters: jest.fn(),
        hasData: false,
      });

      render(<BeachIntelSection {...defaultProps} />);

      expect(screen.getByText("Local Intel")).toBeInTheDocument();
      expect(screen.getAllByTestId("loading-skeleton")).toHaveLength(3);
    });

    it("renders properly when not loading", () => {
      mockUseIntelData.mockReturnValue({
        data: { posts: [], total: 0, filters: {} },
        loading: false,
        error: null,
        refetch: jest.fn(),
        posts: [],
        updateFilters: jest.fn(),
        hasData: false,
      });

      render(<BeachIntelSection {...defaultProps} />);

      expect(screen.getByText("Local Intel")).toBeInTheDocument();
      expect(screen.getByText("Add Intel")).toBeInTheDocument();
    });
  });

  describe("Empty State", () => {
    it("shows empty state message when no posts", () => {
      mockUseIntelData.mockReturnValue({
        data: { posts: [], total: 0, filters: {} },
        loading: false,
        error: null,
        refetch: jest.fn(),
        posts: [],
        updateFilters: jest.fn(),
        hasData: false,
      });

      render(<BeachIntelSection {...defaultProps} />);

      expect(screen.getByText("No local intel yet")).toBeInTheDocument();
      expect(
        screen.getByText(
          `Be the first to share intel about ${defaultProps.beachName}`
        )
      ).toBeInTheDocument();
      expect(screen.getByText("Add First Intel")).toBeInTheDocument();
    });

    it("opens post form when clicking 'Add First Intel'", () => {
      mockUseIntelData.mockReturnValue({
        data: { posts: [], total: 0, filters: {} },
        loading: false,
        error: null,
        refetch: jest.fn(),
        posts: [],
        updateFilters: jest.fn(),
        hasData: false,
      });

      render(<BeachIntelSection {...defaultProps} />);

      fireEvent.click(screen.getByText("Add First Intel"));
      expect(screen.getByTestId("intel-post-form")).toBeInTheDocument();
    });
  });

  describe("Error State", () => {
    it("shows error message when there's an error", () => {
      mockUseIntelData.mockReturnValue({
        data: null,
        loading: false,
        error: "Network error",
        refetch: jest.fn(),
      });

      render(<BeachIntelSection {...defaultProps} />);

      expect(
        screen.getByText("Unable to load intel posts")
      ).toBeInTheDocument();
      expect(screen.getByText("Try Again")).toBeInTheDocument();
    });

    it("calls refetch when clicking 'Try Again'", () => {
      const mockRefetch = jest.fn();
      mockUseIntelData.mockReturnValue({
        data: null,
        loading: false,
        error: "Network error",
        refetch: mockRefetch,
      });

      render(<BeachIntelSection {...defaultProps} />);

      fireEvent.click(screen.getByText("Try Again"));
      expect(mockRefetch).toHaveBeenCalled();
    });
  });

  describe("Intel Posts Display", () => {
    it("renders intel posts correctly", () => {
      mockUseIntelData.mockReturnValue({
        data: { posts: [mockIntelPost] },
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      render(<BeachIntelSection {...defaultProps} />);

      expect(screen.getByText(mockIntelPost.title)).toBeInTheDocument();
      expect(screen.getByText(mockIntelPost.description)).toBeInTheDocument();
      expect(screen.getByText("Conditions")).toBeInTheDocument(); // Tag label
      expect(screen.getByText("3")).toBeInTheDocument(); // Confirmations count
      // Clickable avatar present with correct user id
      const avatarBtn = screen.getByTestId("user-avatar-button");
      expect(avatarBtn).toHaveAttribute("data-user-id", mockIntelPost.user_id);
    });

    it("shows post count badge when posts exist", () => {
      mockUseIntelData.mockReturnValue({
        data: { posts: [mockIntelPost] },
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      render(<BeachIntelSection {...defaultProps} />);

      expect(screen.getByText("1")).toBeInTheDocument(); // Badge with count
    });

    it("limits display to 3 posts and shows 'View all' button", () => {
      const multiplePosts = Array.from({ length: 5 }, (_, i) => ({
        ...mockIntelPost,
        id: `post${i}`,
        title: `Post ${i}`,
        user: {
          full_name: `User ${i}`,
          avatar_url: null,
        },
      }));

      mockUseIntelData.mockReturnValue({
        data: { posts: multiplePosts },
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      render(<BeachIntelSection {...defaultProps} />);

      expect(screen.getByText("View all 5 intel posts")).toBeInTheDocument();
      // Should only display first 3 posts
      expect(screen.getByText("Post 0")).toBeInTheDocument();
      expect(screen.getByText("Post 1")).toBeInTheDocument();
      expect(screen.getByText("Post 2")).toBeInTheDocument();
      expect(screen.queryByText("Post 3")).not.toBeInTheDocument();
    });

    it("shows newest posts before higher-confirmed older posts (recency first)", () => {
      const olderHighConfirmed = {
        ...mockIntelPost,
        id: "older-high",
        title: "Older with confirmations",
        confirmations_count: 10,
        created_at: "2023-01-01T00:00:00Z",
        user: { full_name: "Old User", avatar_url: null },
      };
      const newestLowConfirmed = {
        ...mockIntelPost,
        id: "newest-low",
        title: "Newest with few confirmations",
        confirmations_count: 0,
        created_at: "2025-01-01T00:00:00Z",
        user: { full_name: "New User", avatar_url: null },
      };

      mockUseIntelData.mockReturnValue({
        data: { posts: [olderHighConfirmed, newestLowConfirmed] },
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      render(<BeachIntelSection {...defaultProps} />);

      // With recency-first ordering, the newest post should render before the older one
      const firstTitle = screen.getAllByText(/with/)[0];
      expect(firstTitle).toHaveTextContent("Newest with few confirmations");
    });
  });

  describe("Post Form Integration", () => {
    it("opens intel post form when clicking 'Add Intel'", () => {
      mockUseIntelData.mockReturnValue({
        data: { posts: [mockIntelPost] },
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      render(<BeachIntelSection {...defaultProps} />);

      fireEvent.click(screen.getByText("Add Intel"));
      expect(screen.getByTestId("intel-post-form")).toBeInTheDocument();
    });

    it("handles successful post creation", async () => {
      const mockRefetch = jest.fn();
      mockUseIntelData.mockReturnValue({
        data: { posts: [] },
        loading: false,
        error: null,
        refetch: mockRefetch,
      });

      render(<BeachIntelSection {...defaultProps} />);

      fireEvent.click(screen.getByText("Add Intel"));
      fireEvent.click(screen.getByText("Create Intel"));

      await waitFor(() => {
        expect(mockRefetch).toHaveBeenCalled();
        expect(mockToast.success).toHaveBeenCalledWith(
          "Intel post created successfully!"
        );
        expect(screen.queryByTestId("intel-post-form")).not.toBeInTheDocument();
      });
    });
  });

  describe("Post Voting", () => {
    it("handles confirming a post", async () => {
      const mockRefetch = jest.fn();
      mockConfirmIntelPost.mockResolvedValue({ success: true });
      mockUseIntelData.mockReturnValue({
        data: { posts: [mockIntelPost] },
        loading: false,
        error: null,
        refetch: mockRefetch,
      });

      render(<BeachIntelSection {...defaultProps} />);

      fireEvent.click(screen.getByText("Confirm"));

      await waitFor(() => {
        expect(mockConfirmIntelPost).toHaveBeenCalledWith(mockIntelPost.id);
        expect(mockToast.success).toHaveBeenCalledWith(
          "Thanks for confirming this intel!"
        );
        expect(mockRefetch).toHaveBeenCalled();
      });
    });

    it("handles removing confirmation", async () => {
      const mockRefetch = jest.fn();
      const confirmedPost = {
        ...mockIntelPost,
        user_has_confirmed: true,
        user: {
          full_name: "Confirmed User",
          avatar_url: null,
        },
      };
      mockRemoveIntelPostConfirmation.mockResolvedValue({ success: true });
      mockUseIntelData.mockReturnValue({
        data: { posts: [confirmedPost] },
        loading: false,
        error: null,
        refetch: mockRefetch,
      });

      render(<BeachIntelSection {...defaultProps} />);

      fireEvent.click(screen.getByText("Confirmed"));

      await waitFor(() => {
        expect(mockRemoveIntelPostConfirmation).toHaveBeenCalledWith(
          confirmedPost.id
        );
        expect(mockToast.success).toHaveBeenCalledWith("Vote removed");
        expect(mockRefetch).toHaveBeenCalled();
      });
    });

    it("shows error when voting fails", async () => {
      mockConfirmIntelPost.mockResolvedValue({
        success: false,
        error: "Network error",
      });
      mockUseIntelData.mockReturnValue({
        data: { posts: [mockIntelPost] },
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      render(<BeachIntelSection {...defaultProps} />);

      fireEvent.click(screen.getByText("Confirm"));

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith("Network error");
      });
    });

    it("hides voting controls for unauthenticated users", async () => {
      mockUseAuth.mockReturnValue({ user: null, loading: false });
      mockUseIntelData.mockReturnValue({
        data: { posts: [mockIntelPost] },
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      render(<BeachIntelSection {...defaultProps} />);

      // Should not show the confirm button for unauthenticated users
      expect(screen.queryByText("Confirm")).not.toBeInTheDocument();
      expect(screen.queryByText("Confirmed")).not.toBeInTheDocument();
    });
  });

  describe("Post Expansion", () => {
    it("handles expanding and collapsing long descriptions", () => {
      const longPost = {
        ...mockIntelPost,
        description: "A".repeat(150), // Long description
        user: {
          full_name: "Long Post User",
          avatar_url: null,
        },
      };

      mockUseIntelData.mockReturnValue({
        data: { posts: [longPost] },
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      render(<BeachIntelSection {...defaultProps} />);

      const showMoreButton = screen.getByText("Show more");
      expect(showMoreButton).toBeInTheDocument();

      fireEvent.click(showMoreButton);
      expect(screen.getByText("Show less")).toBeInTheDocument();

      fireEvent.click(screen.getByText("Show less"));
      expect(screen.getByText("Show more")).toBeInTheDocument();
    });

    it("doesn't show expansion controls for short descriptions", () => {
      mockUseIntelData.mockReturnValue({
        data: { posts: [mockIntelPost] }, // Short description
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      render(<BeachIntelSection {...defaultProps} />);

      expect(screen.queryByText("Show more")).not.toBeInTheDocument();
      expect(screen.queryByText("Show less")).not.toBeInTheDocument();
    });
  });

  describe("Responsive Design", () => {
    it("applies custom className", () => {
      mockUseIntelData.mockReturnValue({
        data: { posts: [] },
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      const { container } = render(
        <BeachIntelSection {...defaultProps} className="custom-class" />
      );

      expect(container.firstChild).toHaveClass("custom-class");
    });
  });
});
