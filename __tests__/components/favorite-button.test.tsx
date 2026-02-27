import React from "react";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import { FavoriteButton } from "@/components/favorite-button";
import { useAuth } from "@/context/auth-context";
import * as favoriteBeachActions from "@/actions/beach/beach-favorite-actions";

jest.mock("@/context/auth-context");
jest.mock("@/actions/beach/beach-favorite-actions");
jest.mock("next/navigation", () => ({ usePathname: () => "/ca/san-diego/blacks" }));
jest.mock("@/components/auth/unified-auth-modal", () => ({
  UnifiedAuthModal: (props: any) =>
    props.isOpen ? <div data-testid="auth-modal" /> : null,
}));

const mockSetPendingAction = jest.fn();
const mockClearPendingAction = jest.fn();
let mockPendingAction: any = null;

jest.mock("@/hooks/use-pending-action", () => ({
  usePendingAction: () => ({
    pendingAction: mockPendingAction,
    setPendingAction: mockSetPendingAction,
    clearPendingAction: mockClearPendingAction,
  }),
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const actions = favoriteBeachActions as jest.Mocked<
  typeof favoriteBeachActions
>;
const originalFetch = global.fetch as any;

describe("FavoriteButton", () => {
  beforeEach(() => {
    mockPendingAction = null;
    mockSetPendingAction.mockClear();
    mockClearPendingAction.mockClear();

    mockUseAuth.mockReturnValue({
      user: { id: "u1", email: "test@example.com" } as any,
      session: null as any,
      isLoading: false,
      isAuthenticated: true,
      signUp: jest.fn(),
      signIn: jest.fn(),
      signOut: jest.fn(),
      refreshSession: jest.fn(),
    } as any);

    actions.getFavoriteBeaches.mockResolvedValue({
      success: true,
      data: [],
    } as any);
    actions.addFavoriteBeach.mockResolvedValue({ success: true } as any);
    actions.removeFavoriteBeach.mockResolvedValue({ success: true } as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
    global.fetch = originalFetch;
    mockPendingAction = null;
  });

  it("toggles aria-label on click (optimistic)", async () => {
    // First call add -> success, second call remove -> success
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, action: "added" }),
      } as any)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, action: "removed" }),
      } as any);

    render(<FavoriteButton beachId="b1" />);

    // After initial load, should show Add to favorites
    const btn = await screen.findByRole("button", {
      name: /add to favorites/i,
    });

    // Click to add -> label should flip to Remove from favorites
    fireEvent.click(btn);
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /remove from favorites/i })
      ).toBeInTheDocument();
    });

    // Click to remove -> label should flip back to Add to favorites
    fireEvent.click(
      screen.getByRole("button", { name: /remove from favorites/i })
    );
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /add to favorites/i })
      ).toBeInTheDocument();
    });
  });

  it("reverts on server error", async () => {
    // Force API to return success:false so component reverts optimistic state
    global.fetch = jest
      .fn()
      .mockResolvedValue({
        ok: true,
        json: async () => ({ success: false, error: "boom" }),
      } as any);

    render(<FavoriteButton beachId="b2" />);
    const btn = await screen.findByRole("button", {
      name: /add to favorites/i,
    });

    fireEvent.click(btn);

    // Optimistic flip then revert to Add to favorites when API fails
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /add to favorites/i })
      ).toBeInTheDocument();
    });
  });

  it("opens auth modal when non-authenticated user clicks", async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      session: null as any,
      isLoading: false,
      isAuthenticated: false,
      signUp: jest.fn(),
      signIn: jest.fn(),
      signOut: jest.fn(),
      refreshSession: jest.fn(),
    } as any);

    render(<FavoriteButton beachId="b3" beachName="Blacks Beach" />);

    const btn = await screen.findByRole("button", { name: /add to favorites/i });
    fireEvent.click(btn);

    await waitFor(() => {
      expect(screen.getByTestId("auth-modal")).toBeInTheDocument();
    });
  });

  it("stores pending action in localStorage before opening auth modal", async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      session: null as any,
      isLoading: false,
      isAuthenticated: false,
      signUp: jest.fn(),
      signIn: jest.fn(),
      signOut: jest.fn(),
      refreshSession: jest.fn(),
    } as any);

    render(<FavoriteButton beachId="b3" beachName="Blacks Beach" />);

    const btn = await screen.findByRole("button", { name: /add to favorites/i });
    fireEvent.click(btn);

    expect(mockSetPendingAction).toHaveBeenCalledWith({
      type: "favorite",
      beachId: "b3",
      beachName: "Blacks Beach",
    });
  });

  it("auto-completes favorite after auth return", async () => {
    // Start with no user but a pending action for this beach
    mockPendingAction = {
      type: "favorite",
      beachId: "b3",
      beachName: "Blacks Beach",
      timestamp: Date.now(),
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, action: "added" }),
    } as any);

    // Start unauthenticated
    mockUseAuth.mockReturnValue({
      user: null,
      session: null as any,
      isLoading: false,
      isAuthenticated: false,
      signUp: jest.fn(),
      signIn: jest.fn(),
      signOut: jest.fn(),
      refreshSession: jest.fn(),
    } as any);

    const { rerender } = render(<FavoriteButton beachId="b3" beachName="Blacks Beach" />);

    // Now simulate user becoming authenticated
    mockUseAuth.mockReturnValue({
      user: { id: "u1", email: "test@example.com" } as any,
      session: null as any,
      isLoading: false,
      isAuthenticated: true,
      signUp: jest.fn(),
      signIn: jest.fn(),
      signOut: jest.fn(),
      refreshSession: jest.fn(),
    } as any);

    act(() => {
      rerender(<FavoriteButton beachId="b3" beachName="Blacks Beach" />);
    });

    // Should auto-call the toggle API and clear the pending action
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/beaches/b3/favorite/toggle",
        expect.objectContaining({ method: "POST" })
      );
    });

    expect(mockClearPendingAction).toHaveBeenCalled();
  });
});
