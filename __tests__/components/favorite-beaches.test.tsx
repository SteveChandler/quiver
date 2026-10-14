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
        expect(screen.getByText("You don't have any saved spots yet.")).toBeInTheDocument();
      },
      { timeout: 5000 }
    );
    
    const exploreLink = screen.getByRole("link", {
      name: /explore beaches/i,
    });
    expect(exploreLink).toHaveAttribute("href", "/map");
  });
});

describe("FavoriteBeaches saved targets", () => {
  it("shows a custom spot on the profile list without beach alert or ordering controls", async () => {
    const fetchMock = jest.fn(async (input: string) => ({
      ok: true,
      json: async () => input === "/api/beaches/favorites"
        ? { data: { targets: [{ kind: "custom_spot", rank: 1, nearestBeachId: null,
            customSpot: { id: "spot-1", name: "My Reef", lat: 33, lon: -118, break_type: "reef", nearest_beach_id: null } }] } }
        : { data: [] },
    }));
    const originalFetch = global.fetch;
    global.fetch = fetchMock as unknown as typeof fetch;
    try {
      render(<FavoriteBeaches />);
      expect(await screen.findByText("My Reef")).toBeInTheDocument();
      expect(screen.getByText("Custom spot")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "View Details" })).toHaveAttribute("href", "/custom-spots/spot-1");
      expect(screen.queryByText("No alerts set")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Manage" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /home/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Save Order" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Move Up" })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Remove" })).not.toBeInTheDocument();
    } finally {
      global.fetch = originalFetch;
    }
  });
});
