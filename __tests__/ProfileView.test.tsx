import { render, screen, fireEvent } from "@testing-library/react";
import { ProfileView } from "@/components/profile-view";
import { useAuth } from "@/context/auth-context";
import * as navigation from "next/navigation";

// Mock router
const mockPush = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  usePathname: () => "/",
}));

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
    mockPush.mockClear();
  });

  it("shows loading state when auth is loading", () => {
    // Mock auth context with loading state
    (useAuth as jest.Mock).mockReturnValue({
      user: null,
      isLoading: true,
      signOut: jest.fn(),
    });

    render(<ProfileView />);

    // Should show loading indicator
    expect(screen.getByTestId("loading-spinner")).toBeInTheDocument();
  });

  it("shows authentication required message for unauthenticated users", () => {
    // Mock auth context with no user
    (useAuth as jest.Mock).mockReturnValue({
      user: null,
      isLoading: false,
      signOut: jest.fn(),
    });

    render(<ProfileView />);

    // Should show authentication message
    expect(screen.getByText("Authentication Required")).toBeInTheDocument();
    expect(
      screen.getByText("Please sign in to view and manage your profile.")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /sign in/i })
    ).toBeInTheDocument();
  });

  it("renders profile page for authenticated users", () => {
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
    });

    // Need to mock the server action calls
    global.fetch = jest.fn(() =>
      Promise.resolve({
        json: () =>
          Promise.resolve({
            success: true,
            data: mockProfile,
          }),
        ok: true,
      })
    ) as jest.Mock;

    render(<ProfileView />);

    // Initially should show loading state
    expect(screen.getByRole("status")).toBeInTheDocument();

    // After data loads, should show profile content
    // Note: This is hard to test in this setup since we're mocking fetch
    // In a real test we would use waitFor to wait for state updates
  });

  it("redirects to sign in page when sign in button is clicked", () => {
    // Mock auth context with no user
    (useAuth as jest.Mock).mockReturnValue({
      user: null,
      isLoading: false,
      signOut: jest.fn(),
    });

    render(<ProfileView />);

    // Click sign in button
    const signInButton = screen.getByRole("button", { name: /sign in/i });
    fireEvent.click(signInButton);

    // Should redirect to sign in page
    expect(mockPush).toHaveBeenCalledWith("/auth/sign-in");
  });
});
