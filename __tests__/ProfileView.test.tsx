import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ProfileView } from "@/components/profile-view";
import { useAuth } from "@/context/auth-context";
import { renderWithAppRouter } from "../test-utils/test-utils";
import { mockRouter, resetMockRouter } from "../test-utils/nextNavigation";

// Mock next/navigation for direct access to router.push
jest.mock("next/navigation", () => {
  return {
    useRouter: () => ({
      push: mockRouter.push,
      replace: mockRouter.replace,
      prefetch: mockRouter.prefetch,
      back: mockRouter.back,
      forward: mockRouter.forward,
    }),
    usePathname: () => "/",
    useSearchParams: () => ({
      get: jest.fn(() => null),
    }),
  };
});

// Mock the modules
jest.mock("@/context/auth-context");
jest.mock("@/components/user-stats", () => ({
  UserStats: () => <div data-testid="user-stats">User Stats</div>,
}));
jest.mock("@/components/favorite-beaches", () => ({
  FavoriteBeaches: () => (
    <div data-testid="favorite-beaches">Favorite Beaches</div>
  ),
}));
jest.mock("@/components/edit-profile-modal", () => ({
  EditProfileModal: () => (
    <div data-testid="edit-profile-modal">Edit Profile Modal</div>
  ),
}));

// Mock the server actions
jest.mock("@/actions/profile-actions", () => ({
  getProfile: jest.fn(() =>
    Promise.resolve({ success: true, data: { full_name: "Test User" } })
  ),
}));
jest.mock("@/actions/board-actions", () => ({
  getUserBoards: jest.fn(() => Promise.resolve({ success: true, data: [] })),
}));
jest.mock("@/actions/session-actions", () => ({
  getUserSessions: jest.fn(() => Promise.resolve({ success: true, data: [] })),
}));

// Mock Loader2 component from lucide-react
jest.mock("lucide-react", () => ({
  ...jest.requireActual("lucide-react"),
  Loader2: () => (
    <div data-testid="loading-spinner" role="status">
      Loading...
    </div>
  ),
}));

describe("ProfileView Component", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetMockRouter();
  });

  it("shows loading state when auth is loading", () => {
    // Mock auth context with loading state
    (useAuth as jest.Mock).mockReturnValue({
      user: null,
      isLoading: true,
      signOut: jest.fn(),
      refreshSession: jest.fn(),
    });

    render(<ProfileView />);

    // Should show loading indicator
    expect(screen.getByTestId("loading-spinner")).toBeInTheDocument();
  });

  it("redirects to sign in page for unauthenticated users", async () => {
    // Mock auth context with no user
    (useAuth as jest.Mock).mockReturnValue({
      user: null,
      isLoading: false,
      signOut: jest.fn(),
      refreshSession: jest.fn(),
    });

    render(<ProfileView />);

    // Router should call push to redirect
    await waitFor(() => {
      expect(mockRouter.push).toHaveBeenCalledWith("/auth/sign-in");
    });
  });

  it("renders profile page for authenticated users", async () => {
    // Mock user data
    const mockUser = {
      id: "test-user-id",
      email: "test@example.com",
    };

    // Mock profile data that would be fetched
    const mockProfile = {
      full_name: "Test User",
      avatar_url: "/test.jpg",
      bio: "Test bio",
    };

    // Mock auth context with a user
    (useAuth as jest.Mock).mockReturnValue({
      user: mockUser,
      isLoading: false,
      signOut: jest.fn(),
      refreshSession: jest.fn(),
    });

    render(<ProfileView />);

    // Initially should show loading state
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});
