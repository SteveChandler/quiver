import { render, screen, waitFor } from "@testing-library/react";
import { FavoriteBeaches } from "@/components/favorite-beaches";
import { useAuth } from "@/context/auth-context";
import * as favoriteBeachActions from "@/actions/beach/beach-favorite-actions";

// Mock auth context to provide a user (required to attempt loading favorites)
jest.mock("@/context/auth-context");
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

// Mock actions to return empty favorites list
jest.mock("@/actions/beach/beach-favorite-actions");
const mockBeachActions =
  favoriteBeachActions as jest.Mocked<typeof favoriteBeachActions>;

// Set up mocks before tests
beforeEach(() => {
  mockUseAuth.mockReturnValue({
    user: { id: "test-user-id", email: "dev@local.test" } as any,
    isLoading: false,
    isAuthenticated: true,
    session: null,
    signUp: jest.fn(),
    signIn: jest.fn(),
    signOut: jest.fn(),
    refreshSession: jest.fn(),
  } as any);
  
  mockBeachActions.getFavoriteBeaches.mockResolvedValue({ success: true, data: [] });
  mockBeachActions.removeFavoriteBeach.mockResolvedValue({ success: true });
  mockBeachActions.reorderFavoriteBeaches.mockResolvedValue({ success: true });
});

afterEach(() => {
  jest.clearAllMocks();
});

// Mock Next.js Link to render a normal anchor
jest.mock("next/link", () => {
  return function MockLink({ children, href, ...props }: any) {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  };
});

describe("FavoriteBeaches empty state", () => {
  it("renders Explore beaches link pointing to /map", async () => {
    render(<FavoriteBeaches />);

    // Wait for loading to finish and empty state to render
    await waitFor(
      () => {
        expect(screen.getByText("You don't have any favorite beaches yet.")).toBeInTheDocument();
      },
      { timeout: 5000 }
    );
    
    const exploreLink = screen.getByRole("link", {
      name: /explore beaches/i,
    });
    expect(exploreLink).toHaveAttribute("href", "/map");
  });
});
