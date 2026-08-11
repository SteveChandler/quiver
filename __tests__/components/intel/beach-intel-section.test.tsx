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

// Create a mock user that satisfies the User type (partial mock)
const mockUser = {
  id: "user123",
  email: "test@example.com",
  app_metadata: {},
  user_metadata: {},
  aud: "authenticated",
  created_at: "2024-01-01T00:00:00Z",
} as any;

// Default filters for IntelData
const defaultFilters = {
  latitude: 32.7157,
  longitude: -117.1611,
  radius: 5,
  tag: "all" as const,
  limit: 50,
};

// Complete mock intel post with all required properties
const mockIntelPost = {
  id: "post123",
  user_id: "user456",
  latitude: 32.7157,
  longitude: -117.1611,
  tag: "conditions" as const,
  title: "Great waves today!",
  description: "Perfect conditions with clean 4-6ft waves and offshore winds",
  confirmations_count: 3,
  user_has_confirmed: false,
  created_at: "2024-01-15T10:00:00Z",
  is_active: true,
  updated_at: "2024-01-15T10:00:00Z",
  beach_id: null,
  dedupe_hash: null,
  expires_at: null,
  photo_storage_path: null,
  photo_url: null,
  surf_conditions: null,
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
  latitude: 32.7157,
  longitude: -117.1611,
};

// Mock auth return value helper
const mockAuthReturn = (user: any = mockUser) => ({
  user,
  session: null,
  isLoading: false,
  isAuthenticated: !!user,
  signUp: jest.fn(),
  signIn: jest.fn(),
  signOut: jest.fn(),
  refreshSession: jest.fn(),
});

// Mock intel data return value helper - cast to any to bypass strict type checking
const mockIntelDataReturn = (overrides: {
  data?: { posts: any[]; total?: number; filters?: any } | null;
  loading?: boolean;
  error?: string | null;
  refetch?: jest.Mock;
  posts?: any[];
  updateFilters?: jest.Mock;
  hasData?: boolean;
} = {}) => {
  const dataWithDefaults = overrides.data !== undefined
    ? overrides.data === null
      ? null
      : {
          posts: overrides.data.posts || [],
          total: overrides.data.total ?? overrides.data.posts?.length ?? 0,
          filters: overrides.data.filters || defaultFilters,
        }
    : { posts: [], total: 0, filters: defaultFilters };

  return {
    data: dataWithDefaults,
    loading: overrides.loading ?? false,
    error: overrides.error ?? null,
    refetch: overrides.refetch ?? jest.fn(),
    posts: overrides.posts ?? (dataWithDefaults?.posts || []),
    updateFilters: overrides.updateFilters ?? jest.fn(),
    hasData: overrides.hasData ?? (dataWithDefaults?.posts?.length ?? 0) > 0,
  } as any;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUseAuth.mockReturnValue(mockAuthReturn());
  mockToast.success = jest.fn();
  mockToast.error = jest.fn();
});

describe("BeachIntelSection", () => {
  describe("Loading States", () => {
    it("shows loading skeleton when loading with no posts", () => {
      mockUseIntelData.mockReturnValue({
        data: { posts: [], total: 0, filters: defaultFilters },
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
        data: { posts: [], total: 0, filters: defaultFilters },
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
        data: { posts: [], total: 0, filters: defaultFilters },
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
        data: { posts: [], total: 0, filters: defaultFilters },
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
        posts: [],
        updateFilters: jest.fn(),
        hasData: false,
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
        posts: [],
        updateFilters: jest.fn(),
        hasData: false,
      });

      render(<BeachIntelSection {...defaultProps} />);

      fireEvent.click(screen.getByText("Try Again"));
      expect(mockRefetch).toHaveBeenCalled();
    });
  });

  describe("Intel Posts Display", () => {
    it("renders intel posts correctly", () => {
      mockUseIntelData.mockReturnValue(mockIntelDataReturn({
        data: { posts: [mockIntelPost] as any },
      }));

      render(<BeachIntelSection {...defaultProps} />);

      expect(screen.getByText(mockIntelPost.title)).toBeInTheDocument();
      expect(screen.getByText(mockIntelPost.description)).toBeInTheDocument();
      expect(screen.getByText("Conditions")).toBeInTheDocument(); // Tag label
      expect(screen.getByText("3")).toBeInTheDocument(); // Confirmations count
      // Clickable avatar present with correct user id
      const avatarBtn = screen.getByTestId("user-avatar-button");
      expect(avatarBtn).toHaveAttribute("data-user-id", mockIntelPost.user_id);
    });

    it("renders structured conditions fields as chips", () => {
      mockUseIntelData.mockReturnValue(mockIntelDataReturn({
        data: {
          posts: [
            {
              ...mockIntelPost,
              wave_size_range: "2-3ft",
              vibe: "fun",
              description: "Clean lines and a light offshore breeze",
            },
          ] as any,
        },
      }));

      render(<BeachIntelSection {...defaultProps} />);

      expect(screen.getByTestId("conditions-chips")).toHaveTextContent("2-3ft");
      expect(screen.getByTestId("conditions-chips")).toHaveTextContent("🤙 Fun");
      expect(screen.getByText("Clean lines and a light offshore breeze")).toBeInTheDocument();
    });

    it("keeps legacy conditions posts text-only when structured fields are absent", () => {
      mockUseIntelData.mockReturnValue(mockIntelDataReturn({
        data: { posts: [mockIntelPost] as any },
      }));

      render(<BeachIntelSection {...defaultProps} />);

      expect(screen.queryByTestId("conditions-chips")).not.toBeInTheDocument();
      expect(screen.getByText(mockIntelPost.description)).toBeInTheDocument();
    });

    it("resolves an approved report video only after the tile is clicked", async () => {
      const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ url: "https://signed.example/report.mp4" }), { status: 200 }),
      );
      mockUseIntelData.mockReturnValue(mockIntelDataReturn({
        data: {
          posts: [{ ...mockIntelPost, session_id: "session-report", video_media_id: "media-report" }] as any,
        },
      }));

      render(<BeachIntelSection {...defaultProps} />);

      expect(screen.getByRole("button", { name: "Play local spot report video" })).toBeInTheDocument();
      expect(fetchMock).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole("button", { name: "Play local spot report video" }));

      await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
        "/api/sessions/session-report/videos/media-report",
      ));
      await waitFor(() => expect(document.querySelector("video")).toHaveAttribute("src", "https://signed.example/report.mp4"));
      fetchMock.mockRestore();
    });

    it("shows post count badge when posts exist", () => {
      mockUseIntelData.mockReturnValue(mockIntelDataReturn({
        data: { posts: [mockIntelPost] as any },
      }));

      render(<BeachIntelSection {...defaultProps} />);

      expect(screen.getByText("1")).toBeInTheDocument(); // Badge with count
    });

    it("limits display to 3 posts and shows 'View all' button", () => {
      const multiplePosts = Array.from({ length: 5 }, (_, i) => ({
        ...mockIntelPost,
        id: `post${i}`,
        title: `Post ${i}`,
        user: {
          id: `user${i}`,
          full_name: `User ${i}`,
          avatar_url: null,
        },
      }));

      mockUseIntelData.mockReturnValue(mockIntelDataReturn({
        data: { posts: multiplePosts as any },
      }));

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
        user: { id: "old-user", full_name: "Old User", avatar_url: null },
      };
      const newestLowConfirmed = {
        ...mockIntelPost,
        id: "newest-low",
        title: "Newest with few confirmations",
        confirmations_count: 0,
        created_at: "2025-01-01T00:00:00Z",
        user: { id: "new-user", full_name: "New User", avatar_url: null },
      };

      mockUseIntelData.mockReturnValue(mockIntelDataReturn({
        data: { posts: [olderHighConfirmed, newestLowConfirmed] as any },
      }));

      render(<BeachIntelSection {...defaultProps} />);

      // With recency-first ordering, the newest post should render before the older one
      const firstTitle = screen.getAllByText(/with/)[0];
      expect(firstTitle).toHaveTextContent("Newest with few confirmations");
    });
  });

  describe("Post Form Integration", () => {
    it("opens intel post form when clicking 'Add Intel'", () => {
      mockUseIntelData.mockReturnValue(mockIntelDataReturn({
        data: { posts: [mockIntelPost] as any },
      }));

      render(<BeachIntelSection {...defaultProps} />);

      fireEvent.click(screen.getByText("Add Intel"));
      expect(screen.getByTestId("intel-post-form")).toBeInTheDocument();
    });

    it("handles successful post creation", async () => {
      const mockRefetch = jest.fn();
      mockUseIntelData.mockReturnValue(mockIntelDataReturn({
        data: { posts: [] as any },
        refetch: mockRefetch,
      }));

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
      mockUseIntelData.mockReturnValue(mockIntelDataReturn({
        data: { posts: [mockIntelPost] as any },
        refetch: mockRefetch,
      }));

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
          id: "confirmed-user",
          full_name: "Confirmed User",
          avatar_url: null,
        },
      };
      mockRemoveIntelPostConfirmation.mockResolvedValue({ success: true });
      mockUseIntelData.mockReturnValue(mockIntelDataReturn({
        data: { posts: [confirmedPost] as any },
        refetch: mockRefetch,
      }));

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
      mockUseIntelData.mockReturnValue(mockIntelDataReturn({
        data: { posts: [mockIntelPost] as any },
      }));

      render(<BeachIntelSection {...defaultProps} />);

      fireEvent.click(screen.getByText("Confirm"));

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith("Network error");
      });
    });

    it("hides voting controls for unauthenticated users", async () => {
      mockUseAuth.mockReturnValue(mockAuthReturn(null));
      mockUseIntelData.mockReturnValue(mockIntelDataReturn({
        data: { posts: [mockIntelPost] as any },
      }));

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
          id: "long-post-user",
          full_name: "Long Post User",
          avatar_url: null,
        },
      };

      mockUseIntelData.mockReturnValue(mockIntelDataReturn({
        data: { posts: [longPost] as any },
      }));

      render(<BeachIntelSection {...defaultProps} />);

      const showMoreButton = screen.getByText("Show more");
      expect(showMoreButton).toBeInTheDocument();

      fireEvent.click(showMoreButton);
      expect(screen.getByText("Show less")).toBeInTheDocument();

      fireEvent.click(screen.getByText("Show less"));
      expect(screen.getByText("Show more")).toBeInTheDocument();
    });

    it("doesn't show expansion controls for short descriptions", () => {
      mockUseIntelData.mockReturnValue(mockIntelDataReturn({
        data: { posts: [mockIntelPost] as any },
      }));

      render(<BeachIntelSection {...defaultProps} />);

      expect(screen.queryByText("Show more")).not.toBeInTheDocument();
      expect(screen.queryByText("Show less")).not.toBeInTheDocument();
    });
  });

  describe("Responsive Design", () => {
    it("applies custom className", () => {
      mockUseIntelData.mockReturnValue(mockIntelDataReturn({
        data: { posts: [] as any },
      }));

      const { container } = render(
        <BeachIntelSection {...defaultProps} className="custom-class" />
      );

      expect(container.firstChild).toHaveClass("custom-class");
    });
  });
});
